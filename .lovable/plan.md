

## Plan: Fix Manually Added Companies Showing as Unnamed

### Problem
When companies are added manually (or via URL scraping), the row keys use canonical field names like `company_name`. But when saving to the database, the code maps through `columnMapping` which translates canonical names to CSV header names (e.g., `company_name` → `"Company Name"`), then looks up `row["Company Name"]`. Since manual rows use `company_name` as the key, the lookup fails and `mapped_data` ends up empty.

### Fix

**File: `src/pages/admin/SessionConfig.tsx`** (lines 357-362)

In the save logic, after mapping via `columnMapping`, also check if the row already has canonical field values directly. This way manually added rows (which already use canonical keys) will have their data preserved:

```typescript
const companyRows = csvData.map((row) => {
  const mapped: Record<string, string> = {};
  // First, copy any canonical fields that exist directly on the row
  for (const field of CANONICAL_FIELDS) {
    if (row[field]) mapped[field] = row[field];
  }
  // Then overlay with column-mapped values (CSV rows)
  for (const [canonical, csvCol] of Object.entries(columnMapping)) {
    if (csvCol && row[csvCol]) mapped[canonical] = row[csvCol];
  }
  return { session_id: sessionId, raw_data: row as any, mapped_data: mapped as any };
});
```

This ensures manually added companies (which use `company_name` directly) get their data into `mapped_data`, while CSV-imported rows continue to work through the column mapping.

| File | Change |
|------|--------|
| `src/pages/admin/SessionConfig.tsx` | Add canonical field fallback before column mapping in save logic |

