

## Plan: Bulk Lead Pool Import + Fix Pool Dialog

### Bug Fix: "Add from Lead Pool" shows empty

The dialog correctly filters out leads already added to the session. Since Steve is the only pool lead and he's already a session lead, the dialog shows "No available leads." Two fixes:

1. Change the empty state message to distinguish "pool is empty" vs "all pool leads already added"
2. Add a checkbox option to re-add leads that are already in the session (show them greyed out with an "already added" label instead of hiding them entirely)

### Bulk Lead Import to Lead Pool

Add a CSV import flow to the Lead Pool page (`LeadPool.tsx`):
- "Import CSV" button next to "Add Lead"
- File picker accepts `.csv`
- Parse CSV headers, show a column mapper dialog mapping CSV columns to lead pool fields: `name`, `company`, `title`, `email`, `website`, `linkedin_url`, `expertise_tags`, `background`
- Preview first 10 rows in a table (reuse `CsvPreviewTable` component)
- On confirm, bulk insert all rows into `lead_pool` table
- Show success toast with count

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/LeadPool.tsx` | Add CSV import button, file parsing, column mapping dialog, bulk insert logic |
| `src/pages/admin/SessionConfig.tsx` | Fix empty state message; show already-added leads as disabled instead of hiding them |

