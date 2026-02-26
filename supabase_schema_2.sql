-- =====================================================================================
-- SCHEMA SUPABASE: Admin, Planos e Leads
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- 1. Modificar a tabela de usuários existente (users) adicionando a flag de Admin
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Tabela de Configurações Gerais da Landing Page (Terá apenas 1 registro)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number TEXT DEFAULT '5511999999999',
  whatsapp_message TEXT DEFAULT 'Olá, gostaria de saber mais sobre o Comissões 360',
  hero_image_url TEXT, -- Imagem de demonstração da LP
  show_name_field BOOLEAN DEFAULT true, -- Controla se o campo de nome aparece no modal
  show_phone_field BOOLEAN DEFAULT true, -- Controla se o telefone aparece
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Planos de Assinatura (Gerenciáveis pelo painel)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  period TEXT DEFAULT 'mês', -- Ex: "/ mês", "/ ano"
  checkout_url TEXT NOT NULL,
  features TEXT[] DEFAULT '{}', -- Array de strings com os itens de checklist
  is_popular BOOLEAN DEFAULT false, -- Mostra a tag "Mais Popular" na LP
  is_active BOOLEAN DEFAULT true, -- Se falso, não aparece na Landing Page
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Leads (Usuários que preenchem o modal antes do Checkout)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================================================
-- ROW LEVEL SECURITY (Segurança de quem acessa o quê)
-- =====================================================================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ADMIN: Pode fazer TUDO nas settings
CREATE POLICY "Admins podem alterar settings" 
  ON public.app_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- PUBLIC: Qualquer um pode VER as settings e os planos ativos
CREATE POLICY "Público pode ver settings" 
  ON public.app_settings
  FOR SELECT 
  TO public
  USING (true);

CREATE POLICY "Público pode ver planos ativos" 
  ON public.plans
  FOR SELECT 
  TO public
  USING (is_active = true);

-- ADMIN: Pode fazer TUDO nos planos e leads
CREATE POLICY "Admins podem alterar planos" 
  ON public.plans
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

CREATE POLICY "Admins podem ver todos os leads" 
  ON public.leads
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- PUBLIC (Anon ou auth): Pode criar records de Lead livremente, mas não ver ou deletar
CREATE POLICY "Público pode inserir leads" 
  ON public.leads
  FOR INSERT 
  TO public
  WITH CHECK (true);

-- =====================================================================================
-- INSERÇÕES DE REGISTROS INICIAIS (SEED DATA)
-- =====================================================================================

-- Inserir o primeiro registro de configuração padrão (Ignora se já existir)
INSERT INTO public.app_settings (whatsapp_number, whatsapp_message, show_name_field, show_phone_field)
SELECT '5511999999999', 'Olá, vim do site!', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Inserir o plano padrão que estava hardcoded na Landing Page
INSERT INTO public.plans (name, description, price, period, checkout_url, features, is_popular, is_active)
SELECT 
  'Plano Único',
  'Cancela quando quiser.',
  49.90,
  'mês',
  'https://pay.kiwify.com.br/LINK-DO-SEU-CHECKOUT',
  ARRAY[
    'Upload ilimitado de planilhas CSV',
    'Análise de comissões em tempo real',
    'Suporte prioritário via WhatsApp',
    'Dashboard completo com métricas avançadas',
    'Acesso vitalício a novas funcionalidades'
  ],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.plans);
