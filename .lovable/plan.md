

## Plan: Fix Uneven Table Sizes in Matching

### Problem
The AI matching engine asks for "roughly" N companies per table but doesn't enforce even distribution, so some tables (like table 7) end up with significantly fewer founders.

### Fix

**File: `supabase/functions/generate-matches/index.ts`**

1. **Strengthen the prompt constraint** — Add explicit min/max bounds to the system prompt:
   - Calculate `minPerTable = Math.floor(companies.length / numTables)` and `maxPerTable = minPerTable + 1`
   - Add rule: `"Each table MUST have between ${minPerTable} and ${maxPerTable} companies. No table may have fewer than ${minPerTable}. This is a hard constraint — do NOT create unbalanced tables."`

2. **Add post-processing validation** — After parsing the AI response, check table sizes and rebalance if needed:
   - If any table has fewer than `minPerTable` companies, move companies from the largest table(s) to the smallest until balanced
   - This acts as a safety net regardless of what the AI returns

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/generate-matches/index.ts` | Add hard min/max constraint to prompt + post-processing rebalance |

