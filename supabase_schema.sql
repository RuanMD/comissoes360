-- =====================================================================================
-- SCHEMA SUPABASE PARA O COMISSÕES 360
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- 1. Cria a tabela de usuários (tabela pública que reflete os usuários autenticados)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'active', -- Configurado para active por padrão (para facilitar os testes)
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilita Políticas de Segurança (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Cria política para que usuários só possam ver os próprios dados
CREATE POLICY "Usuários podem ver apenas os seus próprios dados" 
  ON public.users
  FOR SELECT 
  USING (auth.uid() = id);

-- 4. Função que é disparada automaticamente sempre que um novo usuário logar/cadastrar (Magic Link)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_status, subscription_expires_at)
  VALUES (
    new.id, 
    new.email, 
    'active', 
    timezone('utc'::text, now()) + interval '7 days' -- 7 dias de acesso ou adapte depois
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger (Gatilho) para chamar a função acima ao criar um novo auth.user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
