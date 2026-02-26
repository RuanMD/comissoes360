-- =====================================================================================
-- MIGRATION 3: Admin capabilities for user management
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- PASSO 1: Criar função SECURITY DEFINER para verificar admin sem causar recursão RLS
-- (Esta função roda com permissão do dono, ignorando RLS na consulta interna)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PASSO 2: Remover policies que possam já existir (caso rode novamente)
DROP POLICY IF EXISTS "Admins podem ver todos os usuarios" ON public.users;
DROP POLICY IF EXISTS "Admins podem atualizar usuarios" ON public.users;

-- PASSO 3: Admin pode VER todos os usuários
CREATE POLICY "Admins podem ver todos os usuarios"
  ON public.users
  FOR SELECT
  USING (public.is_admin());

-- PASSO 4: Admin pode ATUALIZAR todos os usuários (assinatura, status admin)
CREATE POLICY "Admins podem atualizar usuarios"
  ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PASSO 5: Setar seu usuário como admin (substitua o email se necessário)
UPDATE public.users SET is_admin = true WHERE email = 'ruanstts17@gmail.com';
