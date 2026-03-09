

## Analysis: Current Issues Found

After reviewing the code, I found **two critical bugs** plus the requested feature changes:

### Bug 1: Lead Profile Data Not Reaching AI
In `generate-matches/index.ts` line 27, the edge function expects `l.expertiseTags` (camelCase), but `MatchingWorkspace.tsx` passes the raw DB object which uses `expertise_tags` (snake_case). So the AI receives empty expertise info.

### Bug 2: Grouping Priority Not Reaching AI
Same issue: edge function reads `sessionConfig?.groupingPriority` (line 18) but the DB column is `grouping_priority`. The priority setting has no effect on matching.

### Current State
- Lead profiles ARE collected in SessionConfig with expertise tags and network strengths
- These ARE stored in the database correctly
- But the camelCase/snake_case mismatch means the AI never sees them

---

## Plan

### 1. Fix Data Transformation in MatchingWorkspace
**File: `src/pages/admin/MatchingWorkspace.tsx`**

Before invoking the edge function, transform the DB data to use camelCase:
- Map `expertise_tags` → `expertiseTags`
- Map `network_strengths` → `networkStrengths`  
- Transform `sessionConfig` fields: `grouping_priority` → `groupingPriority`, `num_tables` → `numTables`, `target_per_table` → `targetPerTable`

### 2. Add Settings Panel to Left Sidebar
**File: `src/pages/admin/MatchingWorkspace.tsx`**

Add a collapsible "Settings" section in the left panel (below the companies list) with:
- Grouping Priority selector (4 options: Sector, Stage, Need, Hybrid)
- Allow Stage Mixing toggle
- Table leads summary with edit link back to SessionConfig

These settings update the session in the DB and re-enable "Generate Matches" when changed.

### 3. Enhance Edge Function Lead Instructions
**File: `supabase/functions/generate-matches/index.ts`**

Make the AI use lead expertise more explicitly:
- Change prompt from "assign one per table where possible" to explicit matching instruction: "Match each lead to a table whose theme aligns with their expertise tags"

---

## File Changes

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Fix camelCase transform for leads/sessionConfig; add settings panel to left sidebar |
| `supabase/functions/generate-matches/index.ts` | Strengthen lead-to-table matching instruction |

