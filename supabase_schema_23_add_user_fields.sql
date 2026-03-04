-- Migration: Add full_name and phone to users table
-- Description: Adds mandatory fields for identifying users and contact via WhatsApp.

-- 1. Add columns if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Update existing policies or add new ones for Admin management
-- Note: existing policies in schema_2/3 might already cover general access, 
-- but we ensure Admins can manage these specific fields.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies 
        WHERE tablename = 'users' AND policyname = 'Admins podem atualizar todos os dados dos usuários'
    ) THEN
        CREATE POLICY "Admins podem atualizar todos os dados dos usuários" 
          ON public.users
          FOR UPDATE
          USING (public.is_admin())
          WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 3. Ensure the metadata from Auth is also synced if profile is updated (optional but recommended)
-- This logic would typicaly go into handle_new_user but since we'll use an Edge Function,
-- the function will handle both Auth and Public table.
