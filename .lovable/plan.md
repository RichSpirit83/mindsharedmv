## What I found in your data

You're on **Breakout Session #2** (`f0833640…`). Looking at the database directly:

- **38 founders** are loaded for this session (all have a non-blank Company Name, no duplicates by name).
- **5 tables** were generated for Round 1.
- **39 assignments** exist across those 5 tables — that's the discrepancy. One company (`a8b46d9d-…`) was assigned to **both Table 3 (B2B SaaS & AI Intelligence) and Table 5 (Consumer, Retail & Media)**.
- Table sizes are 8 / 8 / 8 / 8 / **7** — which only adds up to 38 because one founder is double-counted.

So the 38 are all there, but one is sitting at two tables instead of one, which is why the layout looks like "the matching doesn't reflect 38" (visually you'd see what feels like 39 cards, with one founder appearing twice).

The matching edge-function logs confirm the run: `Generating matches: 38 companies -> 5 tables (stage)` → `Generated 5 tables`. The duplicate slipped through because the cross-table de-dup step isn't checking that a single company can't be placed at two tables in the same round.

## Plan (no destructive changes to your work)

### Step 1 — Snapshot your current Round 1 as a safety backup

Before changing anything, write the current Round 1 to a backup so we can restore if needed.

- Add a new column `is_backup boolean default false` (and `backup_label text`, `backup_created_at timestamptz`) to `breakout_tables` via migration. Pure additive — existing rows untouched.
- Duplicate the 5 current Round 1 tables and their 39 assignments into new rows tagged `is_backup = true` with label `"Round 1 — pre-fix backup (2026-04-24)"`.
- Filter `is_backup = true` rows out of the matching workspace UI so they're invisible day-to-day.
- Add a small "Restore backup" action under Round 1 settings (popover) that copies the backup rows back into a live round if you ever need it.

This means: nothing you've done gets deleted. Worst case, you press Restore and we put the 39-assignment state back exactly as it is right now.

### Step 2 — Fix the duplicate assignment for this session, in place

Targeted, non-destructive cleanup for `a8b46d9d-…` only:

- Look up which table it was assigned to **first** (earliest `id` / created order) and **keep that one**.
- Delete the other assignment row.
- Refresh the workspace — you'll see exactly 38 cards across the 5 tables (8 / 8 / 8 / 7 / 7).

You'll be able to drag it to a different table afterwards if Table 3 isn't where you want it.

### Step 3 — Prevent this from recurring

In `MatchingWorkspace.tsx`, the `enforceUniqueLeadsAcrossTables` step already de-dupes leads. Add a sibling step `enforceUniqueCompaniesAcrossTables` that runs right before saving, so AI runs that try to place the same company at two tables in the same round get reduced to one (keeping the table with the better fit / first occurrence).

Also tighten `saveTablesToDb` to skip inserting an assignment whose `company_id` is already present on another table in the same round during this save pass.

### Step 4 — Add a small "Coverage" badge to the workspace header

Above the tables, show: `Assigned: 38 / 38 founders · Round 1`. If the number ever drifts (duplicates, missing), it'll be obvious immediately instead of having to count.

## Files touched

- **New migration**: add backup columns to `breakout_tables`, then duplicate-insert current Round 1 rows + assignments tagged as backup.
- **One-off SQL** (in the same migration, scoped to this session): delete the duplicate assignment for company `a8b46d9d-…` keeping the earlier table.
- **Updated**: `src/pages/admin/MatchingWorkspace.tsx` — add `enforceUniqueCompaniesAcrossTables`, filter `is_backup` out of loads, add coverage badge, add Restore-backup control.

## What you'll see after

- Round 1 still shows your 5 tables and table names exactly as they are now.
- Founder count reads **38 / 38**, with each founder appearing on exactly one table.
- A "Pre-fix backup" entry exists in the background that you can restore at any time.
- Future "Generate" runs can't produce the same duplicate.

Approve and I'll implement Steps 1–4 in one pass.