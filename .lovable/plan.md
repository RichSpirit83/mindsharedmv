

## Plan: Add Company on the Fly + Drag-and-Drop Companies + Remove Companies in Matching

Three features to implement:

### 1. Quick-Add Company by Website URL (SessionConfig)
Add a button/dialog in the Company Data section where the user can paste a website URL. The system will use the Firecrawl connector (already configured) to scrape the website and extract the company name, then add a new row to the company data.

**File: `src/components/AddCompanyByUrlDialog.tsx`** (new)
- Dialog with a text input for website URL
- On submit, call a new edge function or use existing Firecrawl scrape to extract company name from the page title/metadata
- Adds a new row to csvData with `company_name` and `website` populated

**File: `src/pages/admin/SessionConfig.tsx`**
- Add "Add by URL" button next to Paste Emails in the Company Data card header
- Wire dialog's onAdd callback to append to csvData

**File: `supabase/functions/scrape-company-name/index.ts`** (new)
- Lightweight edge function that uses Firecrawl to scrape a URL with `formats: ['json']` and a prompt to extract the company name
- Returns `{ success: true, company_name: "..." }`

### 2. Drag-and-Drop Companies Between Tables (MatchingWorkspace)
Currently leads are draggable but companies are static. Add drag-and-drop for company chips in the TableCard.

**File: `src/pages/admin/MatchingWorkspace.tsx`**
- Wrap company list in each TableCard with a `<Droppable>` zone (id: `companies-{tableIndex}`)
- Wrap each company chip in a `<Draggable>`
- Add a new `handleCompanyDragEnd` or expand `handleLeadDragEnd` to handle both lead and company drag types (distinguish by droppableId prefix `leads-` vs `companies-`)
- Update `DragDropContext.onDragEnd` to route to the correct handler

### 3. Remove Companies from Tables (MatchingWorkspace)
Add a small "×" button on each company chip in the TableCard.

**File: `src/pages/admin/MatchingWorkspace.tsx`**
- Add an `onRemoveCompany` callback prop to `TableCard`
- Render an `X` icon button on each company row
- On click, remove the company from that table's `companies` array via `setTables`

### Changes Summary

| File | Change |
|------|--------|
| `src/components/AddCompanyByUrlDialog.tsx` | New dialog: paste URL → scrape company name → add to data |
| `supabase/functions/scrape-company-name/index.ts` | New edge function using Firecrawl to extract company name |
| `src/pages/admin/SessionConfig.tsx` | Add "Add by URL" button in Company Data header |
| `src/pages/admin/MatchingWorkspace.tsx` | Add company drag-and-drop, add remove (×) button on company chips |

