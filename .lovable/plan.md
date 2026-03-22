

## Plan: Add Computed Stage Score to Cohort Roster Drill-Down

### Problem
There's no stage scoring system in the codebase. The user wants each company card in the Card 1 drill-down to show a computed maturity score with a visual bar, color-coded stage label, and sort options.

### Scoring Design

Compute a 0–3 score from four signals already available on each company:

| Signal | Weight | Mapping |
|--------|--------|---------|
| Sales Stage | 0–3 | Founder-Led=0, Refining=1, Building Repeatable=2, Team-Led=3 |
| Revenue | 0–3 | <$250K=0, $251K-500K=0.5, $501K-$1M=1, $2M-$5M=2, $6M-$10M=2.5, $11M-$20M=3 |
| PMF | 0 or 1 | false=0, true=1 |
| Employees | 0–1 | 1-5=0, 6-25=0.33, 25-50=0.66, 51-100=1 |

**Composite**: weighted average → `(salesStage * 0.4 + revenue * 0.3 + pmf * 0.15 + employees * 0.15)` normalized to 0–3 range.

**Stage labels** from score:
- 0–0.75 → "Pre-Traction" (#475569 slate)
- 0.76–1.50 → "Early Stage" (#f59e0b amber)
- 1.51–2.25 → "Growth Stage" (#14b8a6 teal)
- 2.26–3.00 → "Scale Stage" (#10b981 emerald)

### Changes

**File: `src/components/cohort/companyData.ts`**
- Add `computeStageScore(company)` function returning `{ score: number, label: string, color: string }`
- Export score thresholds and the computation function

**File: `src/components/cohort/CohortDrilldownModal.tsx`**
- In `RosterDrilldown`:
  - Import and call `computeStageScore` for each company
  - Add a new bottom row to each company card showing: score bar (left), numeric score + stage pill (right)
  - Add sort dropdown options: "Sort by Score (High → Low)" and "Sort by Score (Low → High)" alongside existing filters
  - Add `sortBy` state that defaults to "name" with score sort options

No override system exists yet, so override badges won't appear — the infrastructure is ready for when manual overrides are added later.

### Summary

| File | Change |
|------|--------|
| `src/components/cohort/companyData.ts` | Add `computeStageScore()` function with scoring logic |
| `src/components/cohort/CohortDrilldownModal.tsx` | Add score bar + pill to roster cards; add sort-by-score options |

