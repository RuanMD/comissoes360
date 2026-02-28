-- ============================================================
-- Migration 18: Novos campos no shopee_conversions
-- ============================================================
-- Adiciona campos que a API retorna mas não estavam sendo persistidos.
-- Rode este script no Supabase SQL Editor.

-- Conversion-level extras
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS checkout_id BIGINT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS gross_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS capped_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS total_brand_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS estimated_total_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS mcn_management_fee_rate TEXT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS mcn_management_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS mcn_contract_id BIGINT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS linked_mcn_name TEXT;

-- Item-level extras
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS shop_id BIGINT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS complete_time TIMESTAMPTZ;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS promotion_id TEXT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS model_id BIGINT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS item_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS gross_brand_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS item_notes TEXT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS category_lv1_name TEXT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS category_lv2_name TEXT;
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS category_lv3_name TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
