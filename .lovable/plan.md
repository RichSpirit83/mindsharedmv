

## Plan: Add CSV Export for Matching Data

### What
Add a "CSV" download button to the matching workspace nav bar that exports the current table assignments (tables, companies, leads) as a CSV file.

### CSV Format
One row per company assignment:
```
Round, Table #, Table Name, Theme, Company, First Name, Last Name, Sector, Stage, Revenue, Lead(s)
```

### Implementation

**File: `src/pages/admin/MatchingWorkspace.tsx`**

1. Add a `handleDownloadCsv` function that:
   - Iterates over all `tables` in state
   - For each table, iterates over its `companies`
   - Creates a row with: round number, table number, table name, theme, company name, first/last name, sector, stage, revenue, and a joined list of assigned lead names
   - Converts to CSV string with proper escaping (wrap fields containing commas/quotes)
   - Creates a Blob and triggers a browser download as `{session_name}_matching.csv`

2. Pass `onDownloadCsv` to the `WorkspaceNav` component alongside the existing `onDownloadPdf`.

**File: `src/components/WorkspaceNav.tsx`**

3. Add an optional `onDownloadCsv` prop and render a CSV download button (using the `Download` icon) next to the existing PDF button.

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Add `handleDownloadCsv` function and pass it to WorkspaceNav |
| `src/components/WorkspaceNav.tsx` | Add `onDownloadCsv` prop and CSV button |

