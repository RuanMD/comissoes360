-- ============================================================
-- Migration: Shopee API Credentials (Encrypted per-user)
-- ============================================================

-- 1. Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add encrypted columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shopee_app_id_encrypted TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shopee_secret_encrypted TEXT;

-- 3. Function to SAVE encrypted credentials
CREATE OR REPLACE FUNCTION public.save_shopee_credentials(
    p_app_id TEXT,
    p_secret TEXT
)
RETURNS VOID AS $$
DECLARE
    v_passphrase TEXT := 'k8X#mP2$vL9nQ4wR7jF0bY6hT3cA5eG1dZ8iU2oS4xN7qW0pJ6lK9mB3fH5rV1';
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- SECURITY CHECK: Ensure we are only updating the authenticated user's record
    -- The WHERE id = auth.uid() is already present, which is good.
    UPDATE public.users
    SET
        shopee_app_id_encrypted = CASE
            WHEN p_app_id IS NOT NULL AND p_app_id != ''
            THEN encode(pgp_sym_encrypt(p_app_id, v_passphrase), 'base64')
            ELSE NULL
        END,
        shopee_secret_encrypted = CASE
            WHEN p_secret IS NOT NULL AND p_secret != ''
            THEN encode(pgp_sym_encrypt(p_secret, v_passphrase), 'base64')
            ELSE NULL
        END
    WHERE id = auth.uid();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to GET decrypted credentials
CREATE OR REPLACE FUNCTION public.get_shopee_credentials()
RETURNS TABLE(shopee_app_id TEXT, shopee_secret TEXT) AS $$
DECLARE
    v_passphrase TEXT := 'k8X#mP2$vL9nQ4wR7jF0bY6hT3cA5eG1dZ8iU2oS4xN7qW0pJ6lK9mB3fH5rV1';
    v_encrypted_app_id TEXT;
    v_encrypted_secret TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT u.shopee_app_id_encrypted, u.shopee_secret_encrypted
    INTO v_encrypted_app_id, v_encrypted_secret
    FROM public.users u
    WHERE u.id = auth.uid();

    RETURN QUERY SELECT
        CASE WHEN v_encrypted_app_id IS NOT NULL
            THEN pgp_sym_decrypt(decode(v_encrypted_app_id, 'base64'), v_passphrase)
            ELSE NULL
        END,
        CASE WHEN v_encrypted_secret IS NOT NULL
            THEN pgp_sym_decrypt(decode(v_encrypted_secret, 'base64'), v_passphrase)
            ELSE NULL
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
