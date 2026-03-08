
-- Breakout sessions table
CREATE TABLE public.breakout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL DEFAULT '',
  session_date date,
  breakout_start text DEFAULT '10:00',
  breakout_end text DEFAULT '11:00',
  num_tables integer DEFAULT 5,
  target_per_table integer DEFAULT 6,
  grouping_priority text DEFAULT 'sector',
  allow_stage_mixing boolean DEFAULT true,
  session_format text DEFAULT 'deep_dive',
  prompts jsonb DEFAULT '[]'::jsonb,
  column_mapping jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breakout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to breakout_sessions" ON public.breakout_sessions FOR ALL USING (true) WITH CHECK (true);

-- Breakout companies table
CREATE TABLE public.breakout_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.breakout_sessions(id) ON DELETE CASCADE NOT NULL,
  raw_data jsonb DEFAULT '{}'::jsonb,
  mapped_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breakout_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to breakout_companies" ON public.breakout_companies FOR ALL USING (true) WITH CHECK (true);

-- Breakout leads table
CREATE TABLE public.breakout_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.breakout_sessions(id) ON DELETE CASCADE NOT NULL,
  name text DEFAULT '',
  linkedin_url text DEFAULT '',
  network_strengths text DEFAULT '',
  notes text DEFAULT '',
  expertise_tags jsonb DEFAULT '[]'::jsonb,
  profile_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breakout_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to breakout_leads" ON public.breakout_leads FOR ALL USING (true) WITH CHECK (true);

-- Breakout tables table
CREATE TABLE public.breakout_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.breakout_sessions(id) ON DELETE CASCADE NOT NULL,
  table_number integer NOT NULL,
  table_name text DEFAULT '',
  theme text DEFAULT '',
  stage_mix text DEFAULT '',
  suggested_lead text DEFAULT '',
  rationale text DEFAULT '',
  shared_challenges jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breakout_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to breakout_tables" ON public.breakout_tables FOR ALL USING (true) WITH CHECK (true);

-- Breakout table assignments
CREATE TABLE public.breakout_table_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.breakout_tables(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.breakout_companies(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.breakout_table_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to breakout_table_assignments" ON public.breakout_table_assignments FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for lead profile PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-profiles', 'lead-profiles', false);

CREATE POLICY "Allow all uploads to lead-profiles" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lead-profiles');
CREATE POLICY "Allow all reads from lead-profiles" ON storage.objects FOR SELECT USING (bucket_id = 'lead-profiles');

-- Auto-update updated_at on breakout_sessions
CREATE OR REPLACE FUNCTION public.update_breakout_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER breakout_sessions_updated_at
  BEFORE UPDATE ON public.breakout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_breakout_sessions_updated_at();
