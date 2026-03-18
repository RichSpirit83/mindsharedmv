

## Problem

The company data insert to the database is failing silently. The network logs show the POST request to `breakout_companies` failed with "Error: Load failed" — the payload is too large because each company row includes the full `raw_data` (all survey fields). With 47 companies, each containing 30+ fields of survey data, the single batch exceeds the request size limit.

The DELETE runs first and succeeds, wiping existing companies. Then the INSERT fails, leaving 0 companies in the database. The code doesn't handle this error, so the user sees no warning.

## Fix

**File: `src/pages/admin/SessionConfig.tsx`**

1. **Reduce batch size** from 100 to 20 rows per insert — each row is very large due to `raw_data` containing the full survey response.
2. **Add error handling** on the insert — if a batch fails, show a toast error so the user knows.
3. **Wrap delete + insert in a try/catch** — if the insert fails, notify the user instead of silently losing data.

| File | Change |
|------|--------|
| `SessionConfig.tsx` | Reduce batch size to 20, add error handling on company insert |

