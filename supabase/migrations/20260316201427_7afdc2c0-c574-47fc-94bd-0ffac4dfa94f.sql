
-- Create lead_pool table with new schema
CREATE TABLE public.lead_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  linkedin_url text,
  expertise_tags jsonb DEFAULT '[]'::jsonb,
  background text,
  company text,
  title text,
  email text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can modify lead_pool" ON public.lead_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read lead_pool" ON public.lead_pool
  FOR SELECT TO authenticated
  USING (true);

-- Update breakout_leads table: add new columns, drop network_strengths, rename notes
ALTER TABLE public.breakout_leads ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.breakout_leads ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.breakout_leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.breakout_leads ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.breakout_leads DROP COLUMN IF EXISTS network_strengths;
ALTER TABLE public.breakout_leads RENAME COLUMN notes TO background;
