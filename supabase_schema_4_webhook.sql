-- =====================================================================================
-- SCHEMA SUPABASE: Adicionar coluna Webhook
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- Adiciona a coluna para a URL do Webhook na tabela de configurações
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS webhook_url TEXT;
