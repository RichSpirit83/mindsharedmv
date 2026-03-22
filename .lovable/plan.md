

## Plan: Add Stage Score to Founder Participants Table

### Problem
The stage scoring model exists in `companyData.ts` but only shows in the cohort dashboard drill-down. The Founder Participants page (`/admin/founders`) has no scoring visibility.

### Approach
Create a helper that computes the stage score from `mapped_data` fields (which use snake_case like `sales_stage`, `revenue`, `pmf`, `employees`) by mapping them to the `Company` interface format, then call `computeStageScore`.

Add two new columns to the Founder Pool table: **Stage Score** (visual bar + number) and **Stage** (colored pill label).

### Changes

**File: `src/components/cohort/companyData.ts`**
- Add a new exported function `computeStageScoreFromMapped(mapped: Record<string, string>): StageScore` that:
  - Maps `mapped_data` fields to `Company` shape (e.g. `sales_stage` → `salesStage`, `pmf` → boolean)
  - Calls existing `computeStageScore` internally
  - Handles missing/unmapped fields gracefully (defaults to 0)

**File: `src/pages/admin/FounderPool.tsx`**
- Import `computeStageScoreFromMapped` and `STAGE_SCORE_THRESHOLDS`
- Add "Stage Score" and "Stage" to `displayColumns` (after session_name, before other fields)
- Render the Stage Score column as a thin colored bar + numeric score
- Render the Stage column as a colored pill (Pre-Traction / Early / Growth / Scale)
- Add sort support for the score column (sorts by computed numeric value rather than string)

### Summary

| File | Change |
|------|--------|
| `src/components/cohort/companyData.ts` | Add `computeStageScoreFromMapped()` adapter function |
| `src/pages/admin/FounderPool.tsx` | Add Stage Score bar + Stage pill columns to the table |

