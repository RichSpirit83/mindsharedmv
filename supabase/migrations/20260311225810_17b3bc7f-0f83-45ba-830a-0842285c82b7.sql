
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "users_read_own_role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RPC to assign initial role: first user gets admin, rest get viewer
CREATE OR REPLACE FUNCTION public.assign_initial_role()
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _existing app_role;
BEGIN
  -- Check if user already has a role
  SELECT role INTO _existing FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  -- First user ever gets admin, all others get viewer
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    _role := 'admin';
  ELSE
    _role := 'viewer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _role);
  RETURN _role;
END;
$$;
