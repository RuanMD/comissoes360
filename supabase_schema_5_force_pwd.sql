-- =====================================================================================
-- SCHEMA SUPABASE: Forçar Troca de Senha
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- 1. Adiciona a coluna para controlar se o usuário precisa trocar a senha
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

-- 2. Cria uma função segura (RPC) para o próprio usuário autenticado limpar essa flag
-- Usamos SECURITY DEFINER para que ela possa dar bypass no RLS se necessário,
-- mas restringimos o UPDATE apenas para o ID de quem está logado (auth.uid()).

CREATE OR REPLACE FUNCTION public.clear_force_password_change()
RETURNS JSONB AS $$
BEGIN
  -- Apenas atualiza o registro do usuário atual
  UPDATE public.users
  SET 
    force_password_change = false,
    updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Permite que qualquer usuário autenticado chame essa função
GRANT EXECUTE ON FUNCTION public.clear_force_password_change TO authenticated;
