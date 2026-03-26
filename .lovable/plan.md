

## Plan: Editable Founder Records + De-duplication

### 1. Editable Founder Profile Dialog

**File: `src/components/FounderProfileDialog.tsx`**

- Add an "Edit" toggle button in the dialog header
- When in edit mode, render each field as an `Input` instead of plain text
- Track edits in local state; on "Save", update `mapped_data` in `breakout_companies` for all DB rows belonging to that founder (important for deduped founders spanning multiple sessions)
- Pass the founder's DB row IDs and a `queryClient.invalidateQueries` callback from the parent

**File: `src/pages/admin/FounderPool.tsx`**

- Pass the list of underlying `breakout_companies` IDs to the dialog so it knows which rows to update
- After save, invalidate the `founder_pool` query to refresh the table

### 2. De-duplicate Founders Across Sessions

**File: `src/pages/admin/FounderPool.tsx`**

- After fetching `rawData`, group rows by a dedup key: `email` (if present) or `first_name|last_name|company_name`
- Merge grouped rows into a single display record with:
  - Combined `session_names: string[]` (shown as multiple badges)
  - Combined `ids: string[]` (all underlying DB row IDs, needed for editing)
  - Merged `mapped_data` (union of fields, preferring the most complete record)
- Update the table rendering to show multiple session badges per row instead of a single one
- The `session_name` column becomes a list of badge tags

### Changes Summary

| File | Change |
|------|--------|
| `src/components/FounderProfileDialog.tsx` | Add edit mode with inline inputs and save-to-DB logic |
| `src/pages/admin/FounderPool.tsx` | Dedup founders by email/name+company, merge sessions into tags, pass IDs to dialog |

