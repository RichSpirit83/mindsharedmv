

## Plan: Bulk LinkedIn Profile Import

### What to Build

Add a "Bulk LinkedIn Import" flow to both the Lead Pool page and the Session Config table leads section. The user pastes a list of LinkedIn URLs (one per line), and the system scrapes each profile in sequence, extracting structured lead data and inserting results into the lead pool / session leads.

### How It Works

1. **New "Import LinkedIn URLs" button** on both Lead Pool and Session Config table leads toolbar (alongside existing CSV/Paste buttons)
2. Opens a dialog with a textarea: "Paste LinkedIn profile URLs, one per line"
3. On submit, parse URLs (split by newline, filter valid `linkedin.com/in/` URLs)
4. Show a progress indicator: "Processing 1 of 12..."
5. For each URL, call the existing `scrape-linkedin` edge function sequentially (to avoid rate limiting)
6. Collect results into a preview table showing extracted name, company, title, etc.
7. Failed URLs shown with error message, skippable
8. On confirm, bulk insert all successful results into `lead_pool` (and session leads if on SessionConfig)

### New Component

**`src/components/BulkLinkedInDialog.tsx`** — shared dialog:
- Props: `open`, `onOpenChange`, `onImport(leads: ParsedLead[])`
- State machine: `input` → `processing` → `preview`
- In `processing` step: iterates URLs, calls `supabase.functions.invoke('scrape-linkedin')` for each, shows progress bar
- In `preview` step: shows results table with success/fail status, confirm button
- Returns array of `ParsedLead` objects to parent

### File Changes

| File | Change |
|------|--------|
| `src/components/BulkLinkedInDialog.tsx` | New component: textarea for URLs, sequential scraping with progress, preview table |
| `src/pages/admin/LeadPool.tsx` | Add "Import LinkedIn" button, wire up dialog to bulk insert into `lead_pool` |
| `src/pages/admin/SessionConfig.tsx` | Add "Import LinkedIn" button in table leads section, wire up dialog to add leads + sync to pool |

