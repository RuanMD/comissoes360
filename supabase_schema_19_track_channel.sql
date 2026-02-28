-- ============================================================
-- Migration 19: Add channel to creative_tracks
-- ============================================================
-- Allows caching the "Referenciador" for a track to avoid 
-- losing channel attribution when CSV is not loaded and track has 0 sales.

ALTER TABLE creative_tracks ADD COLUMN IF NOT EXISTS channel TEXT;

NOTIFY pgrst, 'reload schema';
