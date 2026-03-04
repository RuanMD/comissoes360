-- Remove a versão anterior para evitar conflito de assinaturas (quantidade/tipo de parâmetros)
DROP FUNCTION IF EXISTS public.create_or_update_subscriber(TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.create_or_update_subscriber(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_or_update_subscriber(
  p_email TEXT,
  p_plano TEXT,
  p_proximo_pagamento TIMESTAMP WITH TIME ZONE,
  p_nome_completo TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_password TEXT;
  v_is_new_user BOOLEAN := false;
BEGIN
  -- 1. Validação de campos obrigatórios
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O e-mail é obrigatório.');
  END IF;

  IF p_plano IS NULL OR p_plano = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O nome do plano é obrigatório (ex: Plano Essencial).');
  END IF;

  IF p_proximo_pagamento IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A data do próximo pagamento é obrigatória.');
  END IF;

  -- 2. Busca o ID do plano pelo nome exato ou similar (ignora maiúsculas/minúsculas)
  -- Isso garante que se você mudar o nome no admin, basta enviar o nome novo aqui.
  SELECT id INTO v_plan_id FROM public.plans 
  WHERE name ILIKE p_plano 
  AND is_active = true 
  LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plano "' || p_plano || '" não encontrado ou inativo no sistema.');
  END IF;

  -- 3. Verifica se o usuário já existe no Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  -- 4. Se não existir, cria o usuário na tabela auth.users
  IF v_user_id IS NULL THEN
    v_is_new_user := true;
    v_password := '123456'; -- Senha padrão inicial

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email,
        crypt(v_password, gen_salt('bf')), now(), NULL, NULL,
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_nome_completo, 'phone', p_telefone, 'cpf', p_cpf),
        now(), now(), '', '', '', ''
    ) RETURNING id INTO v_user_id;
  END IF;

  -- 5. Atualiza os dados na tabela public.users
  UPDATE public.users
  SET
    plan_id = v_plan_id,
    subscription_status = 'active',
    subscription_expires_at = p_proximo_pagamento,
    full_name = COALESCE(p_nome_completo, full_name),
    phone = COALESCE(p_telefone, phone),
    force_password_change = CASE WHEN v_is_new_user THEN true ELSE force_password_change END,
    updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'user_id', v_user_id, 
    'email', p_email, 
    'plan_id', v_plan_id,
    'plan_name', p_plano,
    'expires_at', p_proximo_pagamento
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY: Revoke all public access
REVOKE ALL ON FUNCTION public.create_or_update_subscriber(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_or_update_subscriber(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT) FROM anon, authenticated;

-- Grant access to service_role only
GRANT EXECUTE ON FUNCTION public.create_or_update_subscriber TO service_role;

