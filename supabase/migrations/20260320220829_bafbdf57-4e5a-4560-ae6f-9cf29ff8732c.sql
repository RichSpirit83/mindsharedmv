CREATE OR REPLACE FUNCTION public.admin_set_password(_user_id uuid, _password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
BEGIN
  UPDATE auth.users SET encrypted_password = crypt(_password, gen_salt('bf')) WHERE id = _user_id;
END;
$$;