

## Plan: De-duplicate Companies Before Matching

### Problem
The `breakout_companies` table can contain duplicate rows for the same company within a session (e.g., SUSA appears twice). The matching engine sends all rows to the AI, causing duplicates in table assignments.

### Fix

**File: `src/pages/admin/MatchingWorkspace.tsx`**

After fetching `dbCompanies` and building `fullCompanyData` (line ~130), deduplicate by company name (case-insensitive) before setting state. Merge `mapped_data` from duplicates (prefer non-empty values), keeping only one record per unique company.

Same dedup logic should also apply to the `companies` (chips) array.

This is a ~10-line change: wrap the `dbCompanies` array in a dedup function before `.map()` calls on lines 117-130.

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Deduplicate `dbCompanies` by company name before building chips and `fullCompanyData` |

