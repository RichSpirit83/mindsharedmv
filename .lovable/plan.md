

## Plan: Simplify Cohort Executive Summary Layout

### Changes to `src/components/CohortSummary.tsx`

Restructure the component to show:

1. **Written summary at the top** — Move the existing text overview (with highlighted KPIs) above everything else. Add capital raised info to the summary text.

2. **4 stat cards in a row below the summary:**
   - **Number of Companies** — total count
   - **Breakout by Revenue** — top revenue band + count (e.g., "$1M-$5M (40%)")
   - **Breakout by Capital Raised** — top capital raised band + count (uses `capital_raised` field from column mapping)
   - **Breakout by Sector** — top sector + count

3. **Remove everything else** — Delete all charts (sector bar, stage donut, revenue bar, radar, geography) and the old stat cards row (Sectors, Top Stage, Locations).

### Data changes
- Add `capital_raised` aggregation to the `useMemo` stats computation (same `countBy` pattern as revenue/sector)
- Update the written summary to mention capital raised
- Simplify stat cards to show the top value + percentage for revenue, capital raised, and sector

### File changed
| File | Change |
|------|--------|
| `src/components/CohortSummary.tsx` | Restructure: text summary on top, 4 simplified stat cards below, remove all charts |

