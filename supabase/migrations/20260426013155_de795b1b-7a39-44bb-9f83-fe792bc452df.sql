
-- ---------- founder_pool ----------
CREATE TABLE IF NOT EXISTS public.founder_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text, first_name text, last_name text, email text,
  sector jsonb, business_type text, customer_type jsonb,
  revenue text, capital_raised text, last_round text, icp text, linkedin_url text,
  raw_data jsonb, mapped_data jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS founder_pool_company_email_key
  ON public.founder_pool (lower(coalesce(company_name,'')), lower(coalesce(email,'')));
ALTER TABLE public.founder_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read founder_pool" ON public.founder_pool;
CREATE POLICY "Authenticated users can read founder_pool" ON public.founder_pool FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can modify founder_pool" ON public.founder_pool;
CREATE POLICY "Admins can modify founder_pool" ON public.founder_pool FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------- lead_pool extensions ----------
ALTER TABLE public.lead_pool
  ADD COLUMN IF NOT EXISTS default_stage text,
  ADD COLUMN IF NOT EXISTS sector_strengths jsonb,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS network_strengths text,
  ADD COLUMN IF NOT EXISTS profile_pdf_url text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS lead_pool_name_linkedin_key
  ON public.lead_pool (lower(coalesce(name,'')), lower(coalesce(linkedin_url,'')));

-- ---------- breakout_rsvps ----------
CREATE TABLE IF NOT EXISTS public.breakout_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breakout_id uuid NOT NULL REFERENCES public.breakout_sessions(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES public.founder_pool(id) ON DELETE CASCADE,
  rsvpd boolean NOT NULL DEFAULT false,
  attended boolean NOT NULL DEFAULT false,
  manual_table_override uuid REFERENCES public.breakout_tables(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (breakout_id, founder_id)
);
ALTER TABLE public.breakout_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read breakout_rsvps" ON public.breakout_rsvps;
CREATE POLICY "Authenticated users can read breakout_rsvps" ON public.breakout_rsvps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can modify breakout_rsvps" ON public.breakout_rsvps;
CREATE POLICY "Admins can modify breakout_rsvps" ON public.breakout_rsvps FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------- breakout_table_leads ----------
CREATE TABLE IF NOT EXISTS public.breakout_table_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breakout_id uuid NOT NULL REFERENCES public.breakout_sessions(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.lead_pool(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.breakout_tables(id) ON DELETE SET NULL,
  stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (breakout_id, lead_id)
);
ALTER TABLE public.breakout_table_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read breakout_table_leads" ON public.breakout_table_leads;
CREATE POLICY "Authenticated users can read breakout_table_leads" ON public.breakout_table_leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can modify breakout_table_leads" ON public.breakout_table_leads;
CREATE POLICY "Admins can modify breakout_table_leads" ON public.breakout_table_leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------- match_history ----------
CREATE TABLE IF NOT EXISTS public.match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES public.founder_pool(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.lead_pool(id) ON DELETE CASCADE,
  breakout_id uuid NOT NULL REFERENCES public.breakout_sessions(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.breakout_tables(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (founder_id, lead_id, breakout_id)
);
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read match_history" ON public.match_history;
CREATE POLICY "Authenticated users can read match_history" ON public.match_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can modify match_history" ON public.match_history;
CREATE POLICY "Admins can modify match_history" ON public.match_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS match_history_founder_idx ON public.match_history(founder_id);
CREATE INDEX IF NOT EXISTS match_history_breakout_idx ON public.match_history(breakout_id);

-- ---------- updated_at triggers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS founder_pool_set_updated_at ON public.founder_pool;
CREATE TRIGGER founder_pool_set_updated_at BEFORE UPDATE ON public.founder_pool
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS lead_pool_set_updated_at ON public.lead_pool;
CREATE TRIGGER lead_pool_set_updated_at BEFORE UPDATE ON public.lead_pool
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Data migration
-- =========================================================

-- Founders
INSERT INTO public.founder_pool (
  company_name, first_name, last_name, email, sector, business_type,
  customer_type, revenue, capital_raised, last_round, icp, linkedin_url,
  raw_data, mapped_data, created_at
)
SELECT DISTINCT ON (lower(coalesce(company_name,'')), lower(coalesce(email,'')))
  company_name, first_name, last_name, email, sector, business_type,
  customer_type, revenue, capital_raised, last_round, icp, linkedin_url,
  raw_data, mapped_data, created_at
FROM (
  SELECT
    COALESCE(NULLIF(bc.mapped_data->>'company_name',''), NULLIF(bc.raw_data->>'Company Name','')) AS company_name,
    NULLIF(bc.mapped_data->>'first_name','') AS first_name,
    NULLIF(bc.mapped_data->>'last_name','')  AS last_name,
    NULLIF(bc.mapped_data->>'email','')      AS email,
    NULLIF(bc.mapped_data->>'business_type','') AS business_type,
    NULLIF(bc.mapped_data->>'revenue','')        AS revenue,
    NULLIF(bc.mapped_data->>'capital_raised','') AS capital_raised,
    NULLIF(bc.mapped_data->>'last_round','')     AS last_round,
    NULLIF(bc.mapped_data->>'icp','')            AS icp,
    NULLIF(bc.mapped_data->>'linkedin_url','')   AS linkedin_url,
    CASE WHEN bc.mapped_data ? 'sector' THEN to_jsonb(string_to_array(bc.mapped_data->>'sector', ',')) END AS sector,
    CASE WHEN bc.mapped_data ? 'customer_type' THEN to_jsonb(string_to_array(bc.mapped_data->>'customer_type', ',')) END AS customer_type,
    bc.raw_data, bc.mapped_data, bc.created_at
  FROM public.breakout_companies bc
) src
ORDER BY lower(coalesce(company_name,'')), lower(coalesce(email,'')), created_at
ON CONFLICT DO NOTHING;

-- RSVPs
INSERT INTO public.breakout_rsvps (breakout_id, founder_id, rsvpd, attended, created_at)
SELECT DISTINCT bc.session_id, fp.id, true, false, bc.created_at
FROM public.breakout_companies bc
JOIN public.founder_pool fp
  ON lower(coalesce(fp.company_name,'')) =
     lower(coalesce(NULLIF(bc.mapped_data->>'company_name',''), NULLIF(bc.raw_data->>'Company Name',''),''))
 AND lower(coalesce(fp.email,'')) = lower(coalesce(NULLIF(bc.mapped_data->>'email',''), ''))
ON CONFLICT (breakout_id, founder_id) DO NOTHING;

-- Lead pool from breakout_leads
INSERT INTO public.lead_pool (name, linkedin_url, company, title, email, website, expertise_tags, background, created_at)
SELECT DISTINCT ON (lower(coalesce(name,'')), lower(coalesce(linkedin_url,'')))
  COALESCE(name, 'Unknown'), linkedin_url, company, title, email, website, expertise_tags, background, created_at
FROM public.breakout_leads
WHERE name IS NOT NULL
ORDER BY lower(coalesce(name,'')), lower(coalesce(linkedin_url,'')), created_at
ON CONFLICT DO NOTHING;

-- breakout_table_leads (no table_id known from legacy schema)
INSERT INTO public.breakout_table_leads (breakout_id, lead_id, created_at)
SELECT DISTINCT bl.session_id, lp.id, bl.created_at
FROM public.breakout_leads bl
JOIN public.lead_pool lp
  ON lower(coalesce(lp.name,'')) = lower(coalesce(bl.name,''))
 AND lower(coalesce(lp.linkedin_url,'')) = lower(coalesce(bl.linkedin_url,''))
ON CONFLICT (breakout_id, lead_id) DO NOTHING;

-- match_history: founder x every lead at the same breakout
INSERT INTO public.match_history (founder_id, lead_id, breakout_id, table_id, created_at)
SELECT DISTINCT fp.id, btl.lead_id, bt.session_id, bt.id, now()
FROM public.breakout_table_assignments bta
JOIN public.breakout_tables bt ON bt.id = bta.table_id
JOIN public.breakout_companies bc ON bc.id = bta.company_id
JOIN public.founder_pool fp
  ON lower(coalesce(fp.company_name,'')) =
     lower(coalesce(NULLIF(bc.mapped_data->>'company_name',''), NULLIF(bc.raw_data->>'Company Name',''),''))
 AND lower(coalesce(fp.email,'')) = lower(coalesce(NULLIF(bc.mapped_data->>'email',''), ''))
JOIN public.breakout_table_leads btl ON btl.breakout_id = bt.session_id
ON CONFLICT (founder_id, lead_id, breakout_id) DO NOTHING;

COMMENT ON TABLE public.breakout_companies IS 'DEPRECATED — use founder_pool + breakout_rsvps. Kept for backwards compatibility until UI migration completes.';
COMMENT ON TABLE public.breakout_leads IS 'DEPRECATED — use lead_pool + breakout_table_leads.';
COMMENT ON TABLE public.breakout_table_assignments IS 'DEPRECATED — use match_history + breakout_rsvps.manual_table_override.';
