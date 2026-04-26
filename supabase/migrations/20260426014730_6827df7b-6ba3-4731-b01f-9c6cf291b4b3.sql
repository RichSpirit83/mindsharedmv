ALTER TABLE public.breakout_sessions
  ADD COLUMN IF NOT EXISTS table_prompts jsonb NOT NULL DEFAULT '{}'::jsonb;