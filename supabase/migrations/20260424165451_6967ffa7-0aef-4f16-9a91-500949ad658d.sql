ALTER TABLE public.breakout_tables
  ADD COLUMN IF NOT EXISTS is_backup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_label text,
  ADD COLUMN IF NOT EXISTS backup_created_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_breakout_tables_session_backup
  ON public.breakout_tables (session_id, is_backup);