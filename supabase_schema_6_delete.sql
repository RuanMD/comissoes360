-- =====================================================================================
-- SCHEMA SUPABASE: Excluir Usuário (Apenas Admins)
-- Copie e cole este código no SQL Editor do seu Supabase e clique em "Run"
-- =====================================================================================

-- Cria ou substitui a função que deleta fisicamente um usuário do auth.users
-- Baseado na segurança, só vai permitir a exclusão de um UUID se o solicitante
-- tiver is_admin = true na tabela public.users.
CREATE OR REPLACE FUNCTION public.delete_user_secure(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_is_admin BOOLEAN;
BEGIN
  -- 1. Verifica se quem está chamando a função (auth.uid()) é administrador
  SELECT is_admin INTO v_caller_is_admin
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não tem permissão de administrador.');
  END IF;

  -- 2. Deleta o usuário alvo no esquema auth (o ON DELETE CASCADE na public.users fará o resto)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garante que usuários logados possam no geral chamar a rotina (mas a verificação bloqueará internos)
GRANT EXECUTE ON FUNCTION public.delete_user_secure(UUID) TO authenticated;
