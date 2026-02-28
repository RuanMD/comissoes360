-- ============================================================
-- Migration 16: Shopee Product Enrichment (Auto-fetched Data)
-- ============================================================
-- Adds columns to creative_tracks for storing product data
-- fetched automatically from Shopee API (productOfferV2 + shopOfferV2).
-- Existing columns from schema_14 are kept intact.

-- Product identity
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_item_id BIGINT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_image_url TEXT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_link TEXT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_offer_link TEXT;

-- Price details (complements existing product_price)
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_price_min NUMERIC(10,2);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_price_max NUMERIC(10,2);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_discount_rate INTEGER;

-- Commission details
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_commission NUMERIC(10,2);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_commission_rate NUMERIC(5,4);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_seller_commission_rate NUMERIC(5,4);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shopee_commission_rate NUMERIC(5,4);

-- Category info (stored as JSON string array)
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_category_ids TEXT;

-- Shop details
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shop_id BIGINT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shop_name TEXT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shop_type TEXT;
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shop_rating NUMERIC(3,1);
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_shop_image_url TEXT;

-- Metadata
ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS product_fetched_at TIMESTAMPTZ;

-- Indexes for future analytics queries
CREATE INDEX IF NOT EXISTS idx_creative_tracks_shop_id ON creative_tracks(product_shop_id);
CREATE INDEX IF NOT EXISTS idx_creative_tracks_item_id ON creative_tracks(product_item_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
