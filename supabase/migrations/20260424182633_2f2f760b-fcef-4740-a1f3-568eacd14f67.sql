-- Snapshot current live Round 1 state for session before CSV fix work
WITH new_tables AS (
  INSERT INTO public.breakout_tables (
    session_id, table_number, table_name, theme, stage_mix, suggested_lead,
    rationale, shared_challenges, round_number, briefing_content,
    is_backup, backup_label, backup_created_at
  )
  SELECT
    session_id, table_number, table_name, theme, stage_mix, suggested_lead,
    rationale, shared_challenges, round_number, briefing_content,
    true, 'Pre-CSV-fix backup (2026-04-24)', now()
  FROM public.breakout_tables
  WHERE session_id = 'f0833640-16af-4ebd-a2c4-b69655dd0758'
    AND is_backup = false
  RETURNING id, session_id, round_number, table_number
)
INSERT INTO public.breakout_table_assignments (table_id, company_id)
SELECT nt.id, a.company_id
FROM public.breakout_table_assignments a
JOIN public.breakout_tables ot ON ot.id = a.table_id
JOIN new_tables nt
  ON nt.session_id = ot.session_id
 AND nt.round_number = ot.round_number
 AND nt.table_number = ot.table_number
WHERE ot.is_backup = false
  AND ot.session_id = 'f0833640-16af-4ebd-a2c4-b69655dd0758';