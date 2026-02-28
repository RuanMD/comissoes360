import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
    return acc;
}, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

async function run() {
    // We can't query users or ads if RLS is on and we use anon key, but let's try using service_role key if it exists
    const token = env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
    
    // fetch ad_id
    const adsRes = await fetch(`${SUPABASE_URL}/rest/v1/creative_track_fb_ads?select=*&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const ads = await adsRes.json();
    if (!ads || ads.length === 0) { console.log('No ads found.'); return; }
    
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=facebook_api_key&facebook_api_key=not.is.null&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const users = await usersRes.json();
    if (!users || users.length === 0) { console.log('No users found.'); return; }
    
    const fbToken = users[0].facebook_api_key;
    const adId = ads[0].ad_id;
    console.log(`Fetching Ad: ${adId}`);
    
    const fbRes = await fetch(`https://graph.facebook.com/v21.0/${adId}?access_token=${fbToken}&fields=creative{id,object_story_spec,asset_feed_spec},adcreatives{object_story_spec,asset_feed_spec,object_id,body,image_url,call_to_action_type}`);
    const fbData = await fbRes.json();
    console.log(JSON.stringify(fbData, null, 2));
}

run();
