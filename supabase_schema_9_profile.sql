-- =====================================================================================
-- SCHEMA SUPABASE: Perfil de Usuário
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- 1. Adiciona a coluna facebook_api_key na tabela users se ela não existir
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS facebook_api_key TEXT;
