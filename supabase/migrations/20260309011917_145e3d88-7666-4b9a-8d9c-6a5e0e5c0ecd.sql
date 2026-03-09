ALTER TABLE public.breakout_sessions
  ADD COLUMN IF NOT EXISTS avoid_competitors boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_matching_mode text DEFAULT 'flexible';