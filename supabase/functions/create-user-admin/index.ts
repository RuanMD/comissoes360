import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Create admin client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Get Auth user from token
        const authHeader = req.headers.get('Authorization')!
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !adminUser) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Check if user is actually admin in public.users
        const { data: adminProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('is_admin')
            .eq('id', adminUser.id)
            .single()

        if (profileError || !adminProfile?.is_admin) {
            return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Request body
        const { full_name, email, phone, password, plan_id, days } = await req.json()

        if (!email || !password) {
            throw new Error('E-mail and password are required')
        }

        // 1. Create user in auth.users
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, phone }
        })

        if (createError) throw createError
        if (!newUser.user) throw new Error('Failed to create user object')

        const userId = newUser.user.id
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + (parseInt(days) || 1))

        // 2. Update public.users (trigger handle_new_user might have created a record already)
        // We update it with the specific plan and duration
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                full_name,
                phone,
                plan_id: plan_id || null,
                subscription_status: 'active',
                subscription_expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (updateError) {
            // If update fails, we might want to cleanup the auth user, but for now we log it
            console.error('Error updating public profile:', updateError)
            return new Response(JSON.stringify({
                success: false,
                error: 'User created but profile update failed: ' + updateError.message
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({
            success: true,
            user: newUser.user
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
