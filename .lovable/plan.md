

## Plan: Add Total People Count per Table

### Change

**File: `src/pages/admin/MatchingWorkspace.tsx`** — In the `TableCard` component header (line ~1062-1063), add a badge showing the total headcount (founders + leads) next to the existing stage_mix badge.

```tsx
// After the stage_mix badge on line 1063, add:
<Badge variant="secondary" className="text-xs">
  {table.companies.length + (table.assigned_leads?.length || 0)} people
</Badge>
```

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Add total people count badge in TableCard header |

