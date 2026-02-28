-- ============================================================
-- Migration 17: Shopee Conversions (ConversionReport + ValidatedReport)
-- ============================================================
-- Armazena dados de conversão da API Shopee para integração
-- automática com o Creative Track.
-- Cada row = 1 item de 1 pedido de 1 conversão.

CREATE TABLE IF NOT EXISTS shopee_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES creative_tracks(id) ON DELETE CASCADE,

    -- Conversion-level fields
    conversion_id TEXT NOT NULL,
    click_time TIMESTAMPTZ,
    purchase_time TIMESTAMPTZ,
    conversion_status TEXT,          -- PENDING, PAID, CANCELLED
    net_commission NUMERIC(10,2) DEFAULT 0,
    total_commission NUMERIC(10,2) DEFAULT 0,
    seller_commission NUMERIC(10,2) DEFAULT 0,
    shopee_commission NUMERIC(10,2) DEFAULT 0,
    buyer_type TEXT,                 -- NEW, EXISTING
    device TEXT,                     -- DESKTOP, MOBILE, APP
    utm_content TEXT,                -- Sub_ID / tag de rastreamento
    referrer TEXT,
    product_type TEXT,

    -- Order-level fields (denormalized)
    order_id TEXT,
    order_status TEXT,
    shop_type TEXT,

    -- Item-level fields (denormalized)
    item_id BIGINT,
    item_name TEXT,
    item_price NUMERIC(10,2),
    qty INTEGER DEFAULT 1,
    actual_amount NUMERIC(10,2),
    refund_amount NUMERIC(10,2) DEFAULT 0,
    image_url TEXT,
    item_total_commission NUMERIC(10,2) DEFAULT 0,
    item_seller_commission NUMERIC(10,2) DEFAULT 0,
    item_seller_commission_rate NUMERIC(5,4),
    item_shopee_commission NUMERIC(10,2) DEFAULT 0,
    item_shopee_commission_rate NUMERIC(5,4),
    display_item_status TEXT,

    -- Attribution & Campaign
    attribution_type TEXT,           -- DIRECT, INDIRECT
    channel_type TEXT,
    campaign_type TEXT,
    campaign_partner_name TEXT,

    -- Categories
    global_category_lv1 TEXT,
    global_category_lv2 TEXT,
    global_category_lv3 TEXT,

    -- Fraud detection
    fraud_status TEXT,
    fraud_reason TEXT,

    -- Validation
    is_validated BOOLEAN DEFAULT FALSE,

    -- Metadata
    synced_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicates: same conversion + same item = one row
    UNIQUE(track_id, conversion_id, item_id)
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_shopee_conv_track_id ON shopee_conversions(track_id);
CREATE INDEX IF NOT EXISTS idx_shopee_conv_conversion_id ON shopee_conversions(conversion_id);
CREATE INDEX IF NOT EXISTS idx_shopee_conv_item_id ON shopee_conversions(item_id);
CREATE INDEX IF NOT EXISTS idx_shopee_conv_purchase_time ON shopee_conversions(purchase_time);
CREATE INDEX IF NOT EXISTS idx_shopee_conv_utm_content ON shopee_conversions(utm_content);

-- ── RLS ──
ALTER TABLE shopee_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversions"
    ON shopee_conversions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own conversions"
    ON shopee_conversions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own conversions"
    ON shopee_conversions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own conversions"
    ON shopee_conversions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
