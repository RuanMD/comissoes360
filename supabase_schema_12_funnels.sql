-- =============================================
-- Funnel Builder
-- Table for custom funnels with day-based metric conditions
-- =============================================

CREATE TABLE IF NOT EXISTS funnels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    days jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own funnels"
    ON funnels
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_funnels_user_id ON funnels(user_id);

-- =============================================
-- Add funnel_id to creative_tracks
-- =============================================

ALTER TABLE creative_tracks
    ADD COLUMN IF NOT EXISTS funnel_id uuid REFERENCES funnels(id) ON DELETE SET NULL;

-- Add maintenance_conditions to funnels
ALTER TABLE funnels
    ADD COLUMN IF NOT EXISTS maintenance_conditions jsonb DEFAULT '[]'::jsonb;
