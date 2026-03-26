

## Plan: Fix URL Scraping + Add Bulk URL Import + Manual Add

### 1. Fix the scrape-company-name edge function (bug fix)

The Firecrawl API is rejecting the request because `formats` contains an object `{ type: 'json', prompt: '...' }` instead of a string. Firecrawl v1 expects `formats: ['markdown']` with extraction as a separate top-level field, or simply use metadata/title extraction.

**File: `supabase/functions/scrape-company-name/index.ts`**
- Change `formats: [{ type: 'json', prompt: '...' }]` to `formats: ['markdown']`
- Extract company name from `metadata.title` (split on `|`, `-`, etc.) with domain fallback
- This avoids the BAD_REQUEST error entirely

### 2. Convert AddCompanyByUrlDialog to support bulk URLs

**File: `src/components/AddCompanyByUrlDialog.tsx`**
- Replace single `Input` with a `Textarea` for pasting multiple URLs (one per line)
- Parse URLs, call the edge function for each one sequentially (with progress indicator)
- Show results: successfully scraped companies and any failures
- User confirms to add all successful results at once
- Keep single-URL support (Enter key on single line)

### 3. Add a "Manual Add" button for companies

**File: `src/pages/admin/SessionConfig.tsx`**
- Add a "Manual Add" button in the Company Data header (next to "Paste Emails" and "Add by URL")
- Opens a small dialog with an input for company name (and optionally website)
- On submit, appends the row to `csvData` directly — no scraping needed

**File: `src/components/ManualAddCompanyDialog.tsx`** (new)
- Simple dialog with company name input + optional website input
- Calls `onAdd({ company_name, website })` on submit

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/scrape-company-name/index.ts` | Fix Firecrawl formats param from object to string `'markdown'` |
| `src/components/AddCompanyByUrlDialog.tsx` | Convert to bulk textarea, process multiple URLs with progress |
| `src/components/ManualAddCompanyDialog.tsx` | New simple dialog for manual company name entry |
| `src/pages/admin/SessionConfig.tsx` | Add "Manual Add" button wired to new dialog |

