-- ============================================================
-- Migration 22: LGPD Privacy Hardening & Right to Erasure
-- Ensures all user data is wiped upon account deletion.
-- ============================================================

-- 1. Fix shopee_conversions foreign key to include CASCADE
-- First, identify the constraint name (usually automatically generated)
-- To be safe, we drop and recreate it.
ALTER TABLE public.shopee_conversions 
DROP CONSTRAINT IF EXISTS shopee_conversions_user_id_fkey;

ALTER TABLE public.shopee_conversions
ADD CONSTRAINT shopee_conversions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create a function to clean up orphaned data in public.leads
-- Since leads aren't linked by UUID (only email), we need a trigger.
CREATE OR REPLACE FUNCTION public.proc_cleanup_user_privacy_data()
RETURNS TRIGGER AS $$
BEGIN
    -- LGPD: Wipe the lead record associated with the user's email
    DELETE FROM public.leads WHERE email = OLD.email;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply the trigger to public.users
-- When a user is deleted (either via auth.users cascade or direct delete), 
-- we catch it here to clean up non-UUID linked data.
DROP TRIGGER IF EXISTS tr_cleanup_user_privacy ON public.users;
CREATE TRIGGER tr_cleanup_user_privacy
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.proc_cleanup_user_privacy_data();

-- 4. Audit Note: 
-- All other critical tables (creative_tracks, funnels, fb_ads) 
-- already have ON DELETE CASCADE established in their respective schemas.
