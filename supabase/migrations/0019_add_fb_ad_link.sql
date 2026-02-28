-- Adicionando a coluna ad_link na tabela creative_track_fb_ads
ALTER TABLE public.creative_track_fb_ads ADD COLUMN IF NOT EXISTS ad_link TEXT;
