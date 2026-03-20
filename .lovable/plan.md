

## Plan: Executive Summary Dashboard Above Company Data

### What
Add a collapsible "Cohort Executive Summary" card above the Company Data Upload section in SessionConfig. It appears only when company data is loaded (csvData.length > 0) and shows key insights with charts.

### Insights & Visualizations

Based on the canonical fields available in the CSV data:

1. **Key Metrics Row** — 4 stat cards:
   - Total companies count
   - Unique sectors count
   - Most common sales stage
   - Geographic spread (unique cities/states)

2. **Sector Distribution** — Horizontal bar chart (Recharts BarChart) showing company count per sector

3. **Sales Stage Breakdown** — Pie/donut chart showing distribution across sales stages

4. **Revenue Distribution** — Bar chart showing revenue band counts

5. **Needs Analysis** — Radar or grouped bar chart showing what founders need most (networking, trends, partners, opportunities, mentorship) based on the `need_*` fields

6. **Geography** — Simple bar chart of top states/cities

### Implementation

**New file: `src/components/CohortSummary.tsx`**
- Accepts `csvData` and `columnMapping` as props
- Uses `useMemo` to compute all aggregations from the mapped data
- Renders using Recharts components (already installed: `BarChart`, `PieChart`, `RadarChart`) via the existing `ChartContainer` wrapper
- Responsive grid layout: 4 stat cards on top, then 2×2 chart grid
- Each chart is compact — the whole section should be scannable at a glance
- Collapsible via a toggle so it doesn't overwhelm the page

**File: `src/pages/admin/SessionConfig.tsx`**
- Import `CohortSummary`
- Render `<CohortSummary csvData={csvData} columnMapping={columnMapping} />` just above the Company Data Upload card (before line 967)

### Design
- Clean white cards with subtle borders
- Chart colors use the app's primary palette
- Section header: "Cohort Executive Summary" with a collapse toggle
- Charts use small font sizes and are compact (200px height each)

### Files Changed

| File | Change |
|------|--------|
| `src/components/CohortSummary.tsx` | New — executive summary with stat cards + 4 Recharts visualizations |
| `src/pages/admin/SessionConfig.tsx` | Import and render CohortSummary above company data card |

