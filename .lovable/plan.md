## Problem

When you click **Save Assignments** in the matching workspace and then open the **Present** page, the tables show the *previous* matching run, not the one you just saved.

## Root cause

Two bugs that compound:

### 1. `generate-matches` silently drops new assignments on commit

In `supabase/functions/generate-matches/index.ts` (line 207–219), the commit step:

```ts
const rows = assignments
  .filter((a) => a.tableId && a.leadId)         // <-- requires leadId
  .map(...);
await supabase.from("match_history").upsert(rows, {
  onConflict: "founder_id,lead_id,breakout_id",
  ignoreDuplicates: true,                        // <-- skip if combo exists
});
```

Two problems:

- **`leadId` is `null` for every assignment in the current run** (visible in the network log: `"leadId":null` on all 38 rows). The function only fills `leadId` when a table has a row in `breakout_table_leads` with `table_id` set — but for this breakout all `breakout_table_leads` rows have `table_id: null` (leads are in the pool but not linked to specific tables yet). Result: the filter drops every row and nothing is written.
- Even when `leadId` is present, `ignoreDuplicates: true` on the `(founder_id, lead_id, breakout_id)` unique key means the **previous** run's `table_id` wins forever. New table assignments for the same (founder, lead) pair can never overwrite the old one.

### 2. `PresentationView` resolves a founder's table from stale `match_history`

`PresentationView.tsx` (line 120–131) takes the most-recent `match_history` row per founder. But `match_history` is meant as an **anti-rematch ledger** (which leads has this founder met before), not a source of truth for "where does this founder sit *now*". The current seating belongs in a dedicated, replaceable record.

The same issue affects `MatchingWorkspace.tsx` (line 109–127) and `get-public-breakout/index.ts` (line 61–88).

## Fix

### A. Introduce a single source of truth for current seating

Add a new table `breakout_seating` (one row per founder per breakout) that the workspace writes on Save and the presenter reads:

```sql
create table public.breakout_seating (
  breakout_id uuid not null,
  founder_id  uuid not null,
  table_id    uuid not null,
  lead_id     uuid,           -- nullable; filled when table has a lead linked
  updated_at  timestamptz not null default now(),
  primary key (breakout_id, founder_id)
);
alter table public.breakout_seating enable row level security;
-- Same admin/viewer policies as the other breakout_* tables.
```

Manual overrides on `breakout_rsvps.manual_table_override` continue to win on read (so drag-and-drop is still respected).

`match_history` keeps its original purpose: append-only log of every (founder, lead) pairing across breakouts, used only for the "avoid re-match" rule.

### B. Rewrite the commit step in `generate-matches`

When `commit: true`:
1. **Upsert** one `breakout_seating` row per founder with the new `table_id` (and `lead_id` if known) — `on conflict (breakout_id, founder_id) do update set table_id = excluded.table_id, lead_id = excluded.lead_id, updated_at = now()`. This is what makes new assignments actually replace old ones.
2. Append to `match_history` only when a real `lead_id` exists, keeping `ignoreDuplicates: true` (history should not double-count a re-pairing).
3. Stop dropping seating rows just because `lead_id` is null.

### C. Update the three readers to use `breakout_seating`

- `src/pages/admin/PresentationView.tsx` — replace the `match_history` query with a `breakout_seating` query; keep `manual_table_override` as a wins-over override.
- `src/pages/admin/MatchingWorkspace.tsx` — same swap, so the workspace shows the saved state on reload.
- `supabase/functions/get-public-breakout/index.ts` — same swap, so the public attendee view matches.

### D. One-time backfill (in the same migration)

So existing breakouts (like the one you're looking at now) don't appear empty after the change:

```sql
insert into public.breakout_seating (breakout_id, founder_id, table_id, lead_id)
select distinct on (mh.breakout_id, mh.founder_id)
       mh.breakout_id, mh.founder_id, mh.table_id, mh.lead_id
from public.match_history mh
where mh.table_id is not null
order by mh.breakout_id, mh.founder_id, mh.created_at desc
on conflict do nothing;
```

## Files touched

- **New**: `supabase/migrations/<ts>_breakout_seating.sql` (table + RLS + backfill)
- **Edit**: `supabase/functions/generate-matches/index.ts` (commit logic)
- **Edit**: `src/pages/admin/PresentationView.tsx` (read from `breakout_seating`)
- **Edit**: `src/pages/admin/MatchingWorkspace.tsx` (read from `breakout_seating`)
- **Edit**: `supabase/functions/get-public-breakout/index.ts` (read from `breakout_seating`)

## Verification after rollout

1. Open the matching workspace, click **Generate Matches**, then **Save Assignments**.
2. Open the Present page — table grids match the workspace.
3. Drag a founder to a different table in the workspace — Present page reflects the move on refresh.
4. Re-run **Generate Matches** + **Save** — Present page updates to the new layout (no stale rows).
