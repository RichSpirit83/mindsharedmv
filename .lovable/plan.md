# Stage-First Matching + Aligned Table Card Indicators

## What's wrong today

Session #2 is already set to `grouping_priority = stage`, but Round 1 was generated earlier when it was `sector`. As a result the table cards still show sector-flavored names ("Hardware, Robotics & Deep Tech", "Workflow & Industry Integration") and `stage_mix` badges that mix vocabularies ("Deep-tech / R&D Heavy" vs "Growth-stage AI/Data focus"). The badge on the card doesn't actually tell you what was used to match.

## Goal

When grouping is **by stage**, every table should be grouped on Sales Stage + Revenue maturity (not sector), the card name/theme should describe a *stage cohort*, and the badges should make the stage logic visually obvious.

## Plan

### 1. Tighten the AI matcher for stage-first grouping
File: `supabase/functions/generate-matches/index.ts`

- Rewrite the `stage` priority instruction to be unambiguous: cluster on a normalized stage tier derived from `sales_stage` + `revenue` + `capital_raised`, ignore sector when forming groups, and only use sector as a *tiebreaker* for conversation relevance.
- Define 4 canonical stage tiers the model must use for `stage_mix` so the badge vocabulary is consistent:
  - `Pre-Traction` (Founder-Led, <$250K)
  - `Early Stage` ($250K–$1M, Founder-Led/Refining)
  - `Growth Stage` ($1M–$5M, Refining/Building Repeatable)
  - `Scale Stage` ($5M+, Team-Led)
- Require `table_name` and `theme` to describe the *stage cohort* (e.g. "Founder-Led Operators", "Repeatable Revenue Builders") rather than a sector vertical, when priority is `stage`.
- Add a post-processing step that recomputes each table's dominant stage tier from the actual assigned founders' `mapped_data` and overwrites `stage_mix` with the canonical label, so the badge always matches reality even if the model drifts.

### 2. Re-run matching for Round 1 of Session #2
- Back up current Round 1 to `is_backup = true` with label `Pre stage-first regen (2026-04-25)` so the user can revert.
- Trigger a fresh generation with `groupingPriority: 'stage'` and write the new tables.

### 3. Update the table card to reflect *what drove the match*
File: `src/pages/admin/MatchingWorkspace.tsx` (`TableCard` component)

- Replace the single `stage_mix` outline badge with a small **"Matched by"** indicator chip that reads from `sessionConfig.grouping_priority`:
  - `stage` → blue badge `Stage · {canonical tier}` (e.g. `Stage · Growth Stage`)
  - `sector` → purple badge `Sector · {dominant sector}`
  - `need` → amber badge `Needs · {top shared challenge}`
  - `hybrid` → neutral badge `Hybrid`
- Add a secondary stat row under the table title showing the actual cohort makeup (computed client-side from the assigned companies):
  - Revenue spread (e.g. `Rev: <250K → 1M`)
  - Sales stage majority (e.g. `Mostly Founder-Led`)
  - Sector spread count (e.g. `4 sectors`)
- Keep the `theme` text but make clear it's an AI-written description, not the matching criterion.

### 4. Surface the active grouping priority at the top of the matching page
- Add a small read-only chip near the page header: `Matching by: Stage` (or Sector / Needs / Hybrid) so the organizer always knows which lens drove the current layout. Clicking it deep-links to Session Config to change it.

## Technical notes

- Stage tier computation already exists in `src/components/cohort/companyData.ts` → `computeStageScoreFromMapped`. Reuse `STAGE_SCORE_THRESHOLDS` labels (`Pre-Traction`, `Early Stage`, `Growth Stage`, `Scale Stage`) as the single source of truth for the canonical badge vocabulary in both the edge function (hardcoded list) and the card UI.
- Dominant tier per table = mode of `computeStageScoreFromMapped(c.mapped_data).label` across that table's companies.
- No DB schema changes required. `stage_mix` column already exists.
- The existing revenue/cap badges on each company chip stay as-is — they complement the new table-level stage badge.

## Out of scope

- Changing the global default `groupingPriority` for new sessions (still `sector` per Session Config UI).
- Round 2 / Round 3 — only Round 1 is regenerated. Other rounds keep their current state.
