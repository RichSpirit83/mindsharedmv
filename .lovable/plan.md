

## Plan: Persist Breakouts, PDF Lead Upload, Founder Profiles, Lead Briefings

### 1. Database Schema (new tables)

Create tables to persist all breakout session data:

```text
breakout_sessions
├── id (uuid PK)
├── session_name, session_date, breakout_start, breakout_end
├── num_tables, target_per_table, grouping_priority, allow_stage_mixing
├── session_format, prompts (jsonb), status (draft/matched/finalized)
├── created_at, updated_at

breakout_companies
├── id (uuid PK)
├── session_id (FK → breakout_sessions)
├── raw_data (jsonb) — full CSV row
├── mapped_data (jsonb) — canonical field mapping result
├── column_mapping (stored once on session, but raw_data per company)

breakout_leads
├── id (uuid PK)
├── session_id (FK → breakout_sessions)
├── name, linkedin_url, network_strengths, notes
├── expertise_tags (jsonb array)
├── profile_pdf_url (text, nullable) — stored in storage bucket

breakout_tables
├── id (uuid PK)
├── session_id (FK → breakout_sessions)
├── table_number, table_name, theme, stage_mix
├── suggested_lead, rationale, shared_challenges (jsonb)

breakout_table_assignments
├── id (uuid PK)
├── table_id (FK → breakout_tables)
├── company_id (FK → breakout_companies)
```

Storage bucket: `lead-profiles` (public: false) for uploaded PDF files.

RLS: All tables open for now (no auth required) — these are admin-only internal tools. Can lock down later.

### 2. Breakouts List Page

**New file: `src/pages/admin/BreakoutsList.tsx`**
- Lists all saved breakout sessions with name, date, status badge (Draft/Matched/Finalized)
- Click to resume → navigates to SessionConfig with data loaded from DB
- "New Breakout" button
- Add to admin nav as the index route

**Update `AdminLayout.tsx`**: Add "Breakouts" nav item, make it the `/admin` index route. Move SessionConfig to `/admin/session/:id`.

**Update routing in `App.tsx`**: Add new routes.

### 3. Auto-Save Logic

**Update `SessionConfig.tsx`**:
- On mount, if route has session ID, load from DB
- Auto-save on changes (debounced) — upsert `breakout_sessions`, bulk upsert `breakout_companies` and `breakout_leads`
- Store `column_mapping` as jsonb on the session row
- "Continue to Matching" saves first, then navigates with session ID

**Update `MatchingWorkspace.tsx`**:
- Load session data from DB using session ID (not just route state)
- After generating matches, save `breakout_tables` and `breakout_table_assignments` to DB
- "Finalize & Publish" updates session status to "finalized"

### 4. PDF Upload for Leads

**Update `SessionConfig.tsx`** lead card:
- Add "Upload PDF" button next to LinkedIn Import button
- Accept `.pdf` files, upload to `lead-profiles` storage bucket
- Parse PDF using document parsing (or just store the URL for reference)
- Use AI edge function to extract profile data from PDF text, same structured output as LinkedIn scrape

**New edge function: `supabase/functions/parse-lead-pdf/index.ts`**
- Accepts PDF text content
- Sends to Lovable AI gateway to extract name, headline, expertiseTags, networkStrengths, notes
- Same tool-calling pattern as scrape-linkedin

### 5. Clickable Founder Profiles in Matching

**Update `MatchingWorkspace.tsx`**:
- Each company chip in a table card becomes clickable
- Opens a `Dialog` showing a formatted profile card:
  - Company name (large heading), founder name + email
  - Company description
  - Sector, Primary Market, Business Type badges
  - Revenue, Capital Raised, Sales Stage, Employee Count in a grid
  - ICP, PMF status
  - Critical Challenges (formatted paragraph)
  - Topics of Interest
  - Networking objectives
- Data sourced from `mapped_data` jsonb on the company record

**New component: `src/components/FounderProfileDialog.tsx`**

### 6. Lead Briefings — Downloadable One-Pagers

**Update `LeadBriefings.tsx`**:
- Load finalized session data from DB (tables, companies, leads, prompts)
- For each table, show a card with lead name, table theme, company count
- "Generate Briefing" button calls AI to produce a one-pager containing:
  - Table overview (theme, rationale)
  - Participant list with company snapshots (name, sector, stage, revenue, key challenge)
  - Engagement prompts from the session
  - Facilitation tips
- "Download PDF" button renders the briefing as a styled HTML page and uses `window.print()` or a lightweight HTML-to-PDF approach (print stylesheet)
- "Copy" button copies briefing text to clipboard

**New edge function: `supabase/functions/generate-briefing/index.ts`**
- Accepts table data (companies, lead info, prompts)
- Returns structured briefing markdown via Lovable AI gateway

### File Changes Summary

| Action | File |
|--------|------|
| DB Migration | Create 5 tables + storage bucket |
| Create | `src/pages/admin/BreakoutsList.tsx` |
| Create | `src/components/FounderProfileDialog.tsx` |
| Create | `supabase/functions/parse-lead-pdf/index.ts` |
| Create | `supabase/functions/generate-briefing/index.ts` |
| Edit | `src/App.tsx` — new routes |
| Edit | `src/components/AdminLayout.tsx` — new nav item |
| Edit | `src/pages/admin/SessionConfig.tsx` — auto-save, PDF upload, load from DB |
| Edit | `src/pages/admin/MatchingWorkspace.tsx` — load/save from DB, founder profiles |
| Edit | `src/pages/admin/LeadBriefings.tsx` — full briefing generation + download |

