
-- Add created_at to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Recreate function with correct column reference
CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE(user_id uuid, email text, role app_role, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, au.email::text, ur.role, au.created_at
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  ORDER BY au.created_at DESC;
$$;
