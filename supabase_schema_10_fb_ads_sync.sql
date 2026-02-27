-- =============================================
-- Schema 10: Facebook Ads Sync
-- Vincula anúncios do Facebook aos Creative Tracks
-- e armazena métricas diárias de performance
-- =============================================

-- 1. Tabela de vínculos: quais anúncios FB estão ligados a cada track
CREATE TABLE IF NOT EXISTS creative_track_fb_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES creative_tracks(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL,
    campaign_name TEXT,
    adset_id TEXT NOT NULL,
    adset_name TEXT,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(track_id, ad_id)
);

-- 2. Tabela de métricas diárias por anúncio
CREATE TABLE IF NOT EXISTS creative_track_fb_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES creative_tracks(id) ON DELETE CASCADE,
    ad_id TEXT NOT NULL,
    date DATE NOT NULL,
    clicks INTEGER DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    spend NUMERIC(10,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(track_id, ad_id, date)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_fb_ads_track_id ON creative_track_fb_ads(track_id);
CREATE INDEX IF NOT EXISTS idx_fb_metrics_track_id ON creative_track_fb_metrics(track_id);
CREATE INDEX IF NOT EXISTS idx_fb_metrics_date ON creative_track_fb_metrics(date);
CREATE INDEX IF NOT EXISTS idx_fb_metrics_ad_id ON creative_track_fb_metrics(ad_id);

-- 4. RLS para creative_track_fb_ads
ALTER TABLE creative_track_fb_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fb ads"
    ON creative_track_fb_ads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_ads.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own fb ads"
    ON creative_track_fb_ads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_ads.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own fb ads"
    ON creative_track_fb_ads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_ads.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

-- 5. RLS para creative_track_fb_metrics
ALTER TABLE creative_track_fb_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fb metrics"
    ON creative_track_fb_metrics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_metrics.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own fb metrics"
    ON creative_track_fb_metrics FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_metrics.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own fb metrics"
    ON creative_track_fb_metrics FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_metrics.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own fb metrics"
    ON creative_track_fb_metrics FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_fb_metrics.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );
