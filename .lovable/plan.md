

## Plan: Fix Table Lead Selection Index Mismatch

### Problem
There's an index mismatch between the `LeadSelectionDialog` and `generateMatches`:

1. `pendingTableLeads` is a **filtered subset** of `leads` (only those tagged "Table Lead" in the pool)
2. The dialog returns indices into `pendingTableLeads` (e.g., [0, 1, 2])
3. `generateMatches(overrideLeadIndices)` checks `overrideLeadIndices.includes(idx)` where `idx` is the index into the **full** `leads` array
4. This means the wrong leads get flagged as table leads

### Fix

**File: `src/pages/admin/MatchingWorkspace.tsx`**

In the `onConfirm` callback of `LeadSelectionDialog`, convert the dialog's selected indices (into `pendingTableLeads`) back to indices in the full `leads` array before passing to `generateMatches`.

```
onConfirm={(selectedDialogIndices) => {
  // Map dialog indices (into pendingTableLeads) to indices in the full leads array
  const normalize = (s: string) => s.toLowerCase().trim();
  const fullLeadIndices = selectedDialogIndices.map((di) => {
    const selectedName = pendingTableLeads[di]?.name || "";
    return leads.findIndex((l: any) => normalize(l.name || "") === normalize(selectedName));
  }).filter((i) => i >= 0);
  
  setLeadSelectionOpen(false);
  generateMatches(fullLeadIndices);
}}
```

This ensures the correct leads in the full array get the `isTableLead: true` flag when sent to the AI.

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Fix index mapping in LeadSelectionDialog onConfirm callback (~line 612) |

