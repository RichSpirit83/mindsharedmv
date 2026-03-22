

## Plan: Add New Founder Data Import on Founder Pool Page

### What
Add two import options (file upload + paste) directly on the Founder Participants page, allowing new survey data to be appended to an existing cohort. The user selects which session (cohort) the data belongs to, maps columns, and new rows are inserted into `breakout_companies` without touching existing records.

### Changes

**File: `src/pages/admin/FounderPool.tsx`**

1. **Add import buttons** in the header area (next to the badge): "Upload CSV" and "Paste Data" buttons
2. **Session selector** — When either import flow starts, show a dropdown of existing `breakout_sessions` so the user picks which cohort the new data belongs to
3. **CSV upload flow**:
   - File input accepting `.csv`
   - Parse with PapaParse, show the `ColumnMapper` component using the same `CANONICAL_FIELDS` list from SessionConfig (extract to a shared constant file)
   - Preview via `CsvPreviewTable`
   - On confirm, insert rows into `breakout_companies` with the selected `session_id`, storing both `raw_data` and `mapped_data`
   - Invalidate the `founder_pool` query to refresh the table
4. **Paste flow**:
   - Open a dialog with a textarea (similar to `PasteLeadsDialog` pattern)
   - Parse pasted TSV/CSV, auto-detect columns
   - Same column mapping + session selector + preview + insert flow
5. **Deduplication check** — Before inserting, compare new rows against existing `breakout_companies` for the selected session by normalized `(first_name + last_name + company_name)`. Skip duplicates and show a toast with the count skipped.

**New file: `src/lib/founderFields.ts`**
- Extract `CANONICAL_FIELDS` and `FIELD_ALIASES` from SessionConfig into a shared module so both SessionConfig and FounderPool import from the same source

**File: `src/pages/admin/SessionConfig.tsx`**
- Import `CANONICAL_FIELDS` and `FIELD_ALIASES` from the shared module instead of defining them locally

### Flow

```text
User clicks "Upload CSV" or "Paste Data"
  → Select cohort (session) from dropdown
  → Parse data → Column Mapper
  → Preview table (with delete row option)
  → Confirm → Insert into breakout_companies → Refresh table
```

### Summary

| File | Change |
|------|--------|
| `src/lib/founderFields.ts` | New — shared canonical fields + aliases |
| `src/pages/admin/FounderPool.tsx` | Add CSV upload + paste import with session selector, mapping, dedup, insert |
| `src/pages/admin/SessionConfig.tsx` | Import fields from shared module |

