
-- Delete stale user record so admin can re-register cleanly
DELETE FROM auth.users WHERE email = 'ade.omit@gmail.com';

-- Update assign_initial_role to check email instead of count
CREATE OR REPLACE FUNCTION public.assign_initial_role()
  RETURNS app_role
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _existing app_role;
  _email text;
BEGIN
  SELECT role INTO _existing FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  IF _email = 'ade.omit@gmail.com' THEN
    _role := 'admin';
  ELSE
    _role := 'pending';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _role);
  RETURN _role;
END;
$function$;
