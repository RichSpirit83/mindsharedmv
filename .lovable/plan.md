

## Plan: Fix Missing Participants (Assignments Not Being Saved)

### Root Cause

The `breakout_table_assignments` table has **0 rows** despite 94 companies and 8 tables existing. The problem is in `saveTablesToDb` in `MatchingWorkspace.tsx`:

1. It builds a `companyIdMap` keyed by `company_name` from the DB
2. The AI match response returns company names that may differ slightly (e.g. extra spaces, abbreviations)
3. `companyIdMap.get(c.company_name)` returns `undefined` for mismatches, so the assignment is filtered out as `null`

This means both the Briefings page and Presentation page show 0 participants because they read from the empty assignments table.

### Fix

**File: `src/pages/admin/MatchingWorkspace.tsx`** — Make the company matching more robust:

1. **Use fuzzy/normalized matching**: Normalize company names (lowercase, trim, remove punctuation) when building the map and when looking up. This handles case differences and minor formatting.
2. **Fallback to first_name matching**: If company_name doesn't match, try matching by `first_name + last_name` as a secondary key.
3. **Add logging**: Log unmatched companies so failures are visible in the console.

Specifically in `saveTablesToDb`:
- Build the map with normalized keys: `companyIdMap.set(normalize(name), c.id)`
- Lookup with normalized keys: `companyIdMap.get(normalize(c.company_name))`
- Add a secondary map by `first_name` as fallback
- After saving, log how many assignments were created vs expected

The `normalize` function: `(s) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "")`

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Fix company name matching in `saveTablesToDb` with normalized lookup and fallback matching |

No changes needed to PresentationView or LeadBriefings — they already read assignments correctly; the data just isn't there.

