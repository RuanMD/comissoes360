-- Migration: Prevent self-promotion and sensitive field manipulation
-- Description: Adds a trigger to public.users to block non-service_role updates to admin/subscription fields.

-- Create a function to validate user updates
CREATE OR REPLACE FUNCTION public.check_user_privileges()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow service_role to bypass these checks so backend/edge functions can update these fields.
    IF current_setting('role') = 'service_role' OR current_setting('role') = 'postgres' THEN
        RETURN NEW;
    END IF;

    -- Safety check: Prevent changing is_admin if not authorized
    IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) THEN
        RAISE EXCEPTION 'You are not authorized to change the is_admin flag.';
    END IF;

    IF (OLD.subscription_status IS DISTINCT FROM NEW.subscription_status) THEN
        RAISE EXCEPTION 'You are not authorized to change your subscription status.';
    END IF;

    IF (OLD.subscription_expires_at IS DISTINCT FROM NEW.subscription_expires_at) THEN
        RAISE EXCEPTION 'You are not authorized to change your subscription expiration date.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to the users table
DROP TRIGGER IF EXISTS tr_check_user_privileges ON public.users;
CREATE TRIGGER tr_check_user_privileges
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_privileges();

-- NOTE: This trigger blocks the frontend from changing these fields via .update().
-- System-level updates (via Edge Functions or Admin RPCs) will need to bypass this
-- or we need a more sophisticated check (e.g. current_setting('role') = 'service_role').

-- Better approach for service role:
/*
IF (current_setting('role') != 'service_role') THEN
    -- checks here
END IF;
*/
