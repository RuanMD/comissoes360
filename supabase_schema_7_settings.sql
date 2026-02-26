-- =====================================================================================
-- SCHEMA SUPABASE: Configurações Globais (SEO e Aparência)
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- 1. Cria a tabela de Configurações
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INT PRIMARY KEY DEFAULT 1,
    title TEXT NOT NULL DEFAULT 'Shopee Analytics',
    description TEXT NOT NULL DEFAULT 'Maximize seus lucros com análises inteligentes.',
    favicon_url TEXT,
    banner_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Garante que só haverá a linha de ID = 1
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Insere os valores padrão (se a tabela estiver vazia)
INSERT INTO public.site_settings (id, title, description)
VALUES (1, 'Shopee Analytics', 'Plataforma líder em gestão de afiliados e relatórios.')
ON CONFLICT (id) DO NOTHING;

-- 3. Configura RLS (Apenas Leitura Pública, Gravação só para Administradores)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configurações podem ser lidas por qualquer um"
ON public.site_settings FOR SELECT
USING (true);

CREATE POLICY "Apenas administradores podem modificar configurações"
ON public.site_settings FOR UPDATE
USING (
  auth.role() = 'authenticated' AND 
  EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
  )
);

-- 4. Criação do Bucket de Storage para Imagens de Plataforma (Ex: Logos, Banners)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('platform_assets', 'platform_assets', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Policies para o Bucket
-- Leitura pública das imagens
CREATE POLICY "Imagens do platform_assets são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'platform_assets');

-- Upload apenas por Administradores (usando nossa tabela users para checar a role)
CREATE POLICY "Admins podem fazer upload de assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'platform_assets' AND
  auth.role() = 'authenticated' AND 
  EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
  )
);

-- Admins podem atualizar e deletar os arquivos do Bucket
CREATE POLICY "Admins podem alterar assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'platform_assets' AND
  auth.role() = 'authenticated' AND 
  EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
  )
);

CREATE POLICY "Admins podem deletar assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'platform_assets' AND
  auth.role() = 'authenticated' AND 
  EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
  )
);
