-- =====================================================================================
-- SCHEMA SUPABASE: Função RPC para criar assinantes via Webhook/n8n
-- =====================================================================================

-- Esta função pode ser chamada pela API do Supabase (por exemplo, no n8n)
-- endpoint: /rest/v1/rpc/create_or_update_subscriber

CREATE OR REPLACE FUNCTION public.create_or_update_subscriber(
  p_email TEXT,
  p_nome_completo TEXT,
  p_telefone TEXT,
  p_cpf TEXT,
  p_proximo_pagamento TIMESTAMP WITH TIME ZONE
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_password TEXT;
  v_is_new_user BOOLEAN := false;
BEGIN
  -- 1. Verifica se o usuário já existe no Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  -- 2. Se não existir, cria o usuário na tabela auth.users (Supabase bloqueia inserts diretos via REST, precisa ser DDL ou RPC com SECURITY DEFINER)
  IF v_user_id IS NULL THEN
    v_is_new_user := true;

    -- Gera uma senha padrão (o usuário terá que redefinir no primeiro acesso via frontend)
    v_password := '123456';

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email,
        crypt(v_password, gen_salt('bf')), now(), NULL, NULL,
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('nome_completo', p_nome_completo, 'cpf', p_cpf, 'telefone', p_telefone),
        now(), now(), '', '', '', ''
    ) RETURNING id INTO v_user_id;

    -- O trigger `handle_new_user` criará automaticamente o public.users,
    -- mas precisamos atualizar as informações de plano em seguida.
  END IF;

  -- 3. Atualiza os dados públicos
  IF v_is_new_user THEN
    -- Usuário recém-criado: força troca de senha no primeiro acesso
    UPDATE public.users
    SET
      subscription_status = 'active',
      subscription_expires_at = p_proximo_pagamento,
      force_password_change = true,
      updated_at = now()
    WHERE id = v_user_id;
  ELSE
    -- Usuário já existente (renovação): apenas atualiza assinatura, NÃO força troca de senha
    UPDATE public.users
    SET
      subscription_status = 'active',
      subscription_expires_at = p_proximo_pagamento,
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', p_email);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permite que a API (service_role ou anon) chame esta função
GRANT EXECUTE ON FUNCTION public.create_or_update_subscriber TO service_role;
