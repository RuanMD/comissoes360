-- ============================================================
-- Migration 21: Permitir conversões sem track (vendas não rastreadas)
-- ============================================================
-- Permite armazenar TODAS as conversões da Shopee, mesmo as que
-- não estão vinculadas a um creative track. Isso garante que
-- páginas como Produtos, Origens, Canais etc. exibam todas as
-- vendas, não apenas as vinculadas a tracks criados.
--
-- Rode este script no Supabase SQL Editor.
-- IMPORTANTE: Se já rodou a versão anterior, rode este script novamente.

-- 1. Adicionar user_id para identificar o dono da conversão
ALTER TABLE shopee_conversions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Preencher user_id para registros existentes (via creative_tracks)
UPDATE shopee_conversions sc
SET user_id = ct.user_id
FROM creative_tracks ct
WHERE sc.track_id = ct.id AND sc.user_id IS NULL;

-- 3. Tornar track_id nullable (era NOT NULL)
ALTER TABLE shopee_conversions ALTER COLUMN track_id DROP NOT NULL;

-- 4. Remover constraints/indexes antigos
ALTER TABLE shopee_conversions DROP CONSTRAINT IF EXISTS shopee_conversions_track_id_conversion_id_item_id_key;
DROP INDEX IF EXISTS idx_shopee_conv_unique_v2;

-- 5. Criar nova unique constraint baseada em user_id (funciona com Supabase JS upsert)
-- Cada conversão+item é unica por usuario (independente de ter track ou nao)
ALTER TABLE shopee_conversions ADD CONSTRAINT shopee_conversions_user_conv_item_key
    UNIQUE (user_id, conversion_id, item_id);

-- 6. Atualizar RLS policies para incluir conversões sem track
DROP POLICY IF EXISTS "Users can view own conversions" ON shopee_conversions;
CREATE POLICY "Users can view own conversions"
    ON shopee_conversions FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own conversions" ON shopee_conversions;
CREATE POLICY "Users can insert own conversions"
    ON shopee_conversions FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own conversions" ON shopee_conversions;
CREATE POLICY "Users can update own conversions"
    ON shopee_conversions FOR UPDATE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own conversions" ON shopee_conversions;
CREATE POLICY "Users can delete own conversions"
    ON shopee_conversions FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM creative_tracks
            WHERE creative_tracks.id = shopee_conversions.track_id
            AND creative_tracks.user_id = auth.uid()
        )
    );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_shopee_conv_user_id ON shopee_conversions(user_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
