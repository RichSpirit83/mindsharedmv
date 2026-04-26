CREATE TABLE public.breakout_seating (
  breakout_id uuid NOT NULL,
  founder_id  uuid NOT NULL,
  table_id    uuid NOT NULL,
  lead_id     uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (breakout_id, founder_id)
);

CREATE INDEX idx_breakout_seating_breakout ON public.breakout_seating(breakout_id);

ALTER TABLE public.breakout_seating ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can modify breakout_seating"
ON public.breakout_seating
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can read breakout_seating"
ON public.breakout_seating
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE TRIGGER trg_breakout_seating_updated_at
BEFORE UPDATE ON public.breakout_seating
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.breakout_seating (breakout_id, founder_id, table_id, lead_id)
SELECT DISTINCT ON (mh.breakout_id, mh.founder_id)
       mh.breakout_id, mh.founder_id, mh.table_id, mh.lead_id
FROM public.match_history mh
WHERE mh.table_id IS NOT NULL
ORDER BY mh.breakout_id, mh.founder_id, mh.created_at DESC
ON CONFLICT (breakout_id, founder_id) DO NOTHING;