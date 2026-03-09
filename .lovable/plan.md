

## Analysis: Zero Companies Assigned Despite Matching

The database shows:
- **8 tables** created with themes and suggested leads
- **0 assignments** in the `breakout_table_assignments` table
- PresentationView is loading tables correctly, but the `companies` array is empty because assignments don't exist

This is the **same bug** we supposedly fixed earlier — the company matching logic in `saveTablesToDb` is still failing to create assignments.

### Root Cause
Looking at lines 158-209 in `MatchingWorkspace.tsx`:
1. The `normalize` function and dual-lookup (by company name, then by person name) are implemented
2. The logging shows "Saved 0/X assignments"
3. **BUT**: The edge function is passing `sessionConfig` and `leads` **without transformation**

At line 130:
```typescript
body: { companies: fullCompanyData, sessionConfig, leads }
```

The `sessionConfig` object comes from the database (line 62) with snake_case fields like `grouping_priority`, but the edge function expects camelCase `groupingPriority`. Same issue with `leads` — the DB has `expertise_tags` but the function expects `expertiseTags`.

**This was supposedly fixed in the last approved plan, but the code still doesn't transform the data before sending it to the edge function.**

### Second Issue: Settings Panel Missing
The user requested "settings on the left" to adjust:
- Grouping Priority
- Allow Stage Mixing

This panel was planned but **never implemented** in the left sidebar.

---

## Plan

### 1. Fix Data Transformation (MatchingWorkspace.tsx)
Before invoking the edge function at line 129, transform:
- `sessionConfig`: map snake_case → camelCase
- `leads`: map `expertise_tags` → `expertiseTags`, `network_strengths` → `networkStrengths`

### 2. Add Settings Collapsible Panel (MatchingWorkspace.tsx)
Below the companies list in the left sidebar (after line 275), add a `Collapsible` section:
- **Grouping Priority** dropdown (Sector, Stage, Need, Hybrid)
- **Allow Stage Mixing** toggle
- On change: update DB + set `hasGenerated = false` to enable regeneration
- Show lead count summary

### 3. Verify PresentationView Logic
PresentationView code (lines 53-72) is correct — it queries assignments and maps to companies. Once assignments exist, it will work.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Add data transformation before edge function call; add Settings collapsible panel in left sidebar |
| `src/components/ui/collapsible.tsx` | Already exists (confirmed in files list) |

