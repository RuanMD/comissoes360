-- ============================================================
-- Migration 22: Preferências do usuário (ordem dos blocos KPI etc.)
-- ============================================================
-- Armazena preferências do usuário em formato JSONB para que
-- sejam sincronizadas entre dispositivos/navegadores.
--
-- Rode este script no Supabase SQL Editor.

-- 1. Adicionar coluna user_preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_preferences jsonb DEFAULT '{}'::jsonb;
