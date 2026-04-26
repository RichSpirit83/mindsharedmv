CREATE TABLE IF NOT EXISTS public.breakout_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breakout_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  markdown text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS breakout_briefings_unique_pair
  ON public.breakout_briefings (breakout_id, lead_id);

ALTER TABLE public.breakout_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can modify breakout_briefings" ON public.breakout_briefings;
CREATE POLICY "Admins can modify breakout_briefings"
  ON public.breakout_briefings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read breakout_briefings" ON public.breakout_briefings;
CREATE POLICY "Authenticated users can read breakout_briefings"
  ON public.breakout_briefings FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_breakout_briefings_updated_at ON public.breakout_briefings;
CREATE TRIGGER trg_breakout_briefings_updated_at
  BEFORE UPDATE ON public.breakout_briefings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();