-- Add status column to creative_tracks table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creative_tracks' AND column_name = 'status') THEN
        ALTER TABLE creative_tracks ADD COLUMN status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'desativado', 'validado'));
    END IF;
END $$;
