

## Plan: Fix Stage Score Computation for Database Data

### Root Cause
The `computeStageScoreFromMapped()` function uses field names and value formats that don't match the actual database `mapped_data`. Every signal returns 0 because nothing matches.

### Mismatches Found

| Signal | Code expects | Actual DB value |
|--------|-------------|-----------------|
| Sales Stage field | `sales_stage` | `sales_stage` (correct) |
| Sales Stage value | `"building repeatable"` | `"Building a repeatable process – I have a structured sales process and am working on making it scalable beyond the founder."` |
| PMF field | `pmf` or `product_market_fit` | `has_pmf` |
| PMF value | `"true"`, `"yes"`, `"1"` | `"checked"` |
| Revenue value | `"$2M-$5M"` | `"2M-5M"` (no $ sign) |
| Employees field | `employees` or `team_size` | `employee_count` |

### Fix in `src/components/cohort/companyData.ts`

Update `computeStageScoreFromMapped()`:

1. **Sales stage normalization** — Use `includes()` matching instead of exact match. The DB values are full sentences like "Building a repeatable process...", so match on keywords:
   - Contains "founder-led" → "Founder-Led"
   - Contains "refining" → "Refining"
   - Contains "repeatable" → "Building Repeatable"
   - Contains "team-led" → "Team-Led"

2. **PMF field** — Also check `has_pmf`. Accept `"checked"` as a truthy value.

3. **Revenue normalization** — Strip `$` and match flexibly. Add mappings for values without dollar signs: `"2M-5M"` → `"$2M-$5M"`, `"501K-1M"` → `"$501K-$1M"`, etc.

4. **Employees field** — Also check `employee_count`.

### Summary

| File | Change |
|------|--------|
| `src/components/cohort/companyData.ts` | Fix field name lookups and value normalization in `computeStageScoreFromMapped()` |

