-- =============================================
-- Schema 8: Creative Tracks (Criativo Track)
-- Rastreia desempenho de criativos de anúncio
-- =============================================

-- Tabela de tracks (cada criativo)
CREATE TABLE IF NOT EXISTS creative_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    affiliate_link TEXT DEFAULT '',
    sub_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de registros diários por track
CREATE TABLE IF NOT EXISTS creative_track_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES creative_tracks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    ad_clicks INTEGER DEFAULT 0,
    shopee_clicks INTEGER DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    orders INTEGER DEFAULT 0,
    commission_value NUMERIC(10,2) DEFAULT 0,
    investment NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(track_id, date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_creative_tracks_user_id ON creative_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_track_entries_track_id ON creative_track_entries(track_id);
CREATE INDEX IF NOT EXISTS idx_creative_track_entries_date ON creative_track_entries(date);

-- RLS para creative_tracks
ALTER TABLE creative_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracks"
    ON creative_tracks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracks"
    ON creative_tracks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracks"
    ON creative_tracks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracks"
    ON creative_tracks FOR DELETE
    USING (auth.uid() = user_id);

-- RLS para creative_track_entries (via subquery no track)
ALTER TABLE creative_track_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own track entries"
    ON creative_track_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_entries.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own track entries"
    ON creative_track_entries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_entries.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own track entries"
    ON creative_track_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_entries.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own track entries"
    ON creative_track_entries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = creative_track_entries.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

-- Trigger para updated_at na creative_tracks
CREATE OR REPLACE FUNCTION update_creative_tracks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creative_tracks_updated_at
    BEFORE UPDATE ON creative_tracks
    FOR EACH ROW
    EXECUTE FUNCTION update_creative_tracks_updated_at();
