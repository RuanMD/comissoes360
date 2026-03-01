-- =============================================
-- Schema 20: Track Custom Fields
-- Adiciona suporte a campos personalizados (nome/valor)
-- =============================================

ALTER TABLE creative_tracks 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN creative_tracks.custom_fields IS 'Dicionário de campos personalizados no formato { "Nome": "Valor" }';
