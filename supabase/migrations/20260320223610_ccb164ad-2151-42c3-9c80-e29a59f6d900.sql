CREATE TABLE public.prompt_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  prompt_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can modify prompt_pool" ON public.prompt_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read prompt_pool" ON public.prompt_pool
  FOR SELECT TO authenticated
  USING (true);