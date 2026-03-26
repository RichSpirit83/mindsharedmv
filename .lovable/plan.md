

## Plan: Deduplicate Leads per Table

### Problem
The `suggested_lead` field stored in the DB contains "Katherine Ferguson" twice in its comma-separated string, causing her to appear twice in the table's lead list.

### Fix

**File: `src/pages/admin/MatchingWorkspace.tsx`** (line 210)

Add deduplication after splitting the `suggested_lead` string — filter out duplicate names before mapping to lead objects:

```typescript
assigned_leads: [...new Set(
  (t.suggested_lead || "").split(",").map((n: string) => n.trim()).filter(Boolean)
)].map((name: string) => {
  // ... existing lead lookup logic
})
```

Single-line change wrapping the existing split/map/filter in `[...new Set(...)]`.

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Deduplicate lead names from `suggested_lead` before building `assigned_leads` array |

