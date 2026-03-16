

## Plan: Update Lead Pool & Table Lead Fields + Auto-Sync + Pool Import

### Current State
- **Lead fields**: name, expertiseTags, networkStrengths, notes, linkedinUrl
- **Lead Pool fields**: name, expertise_tags, linkedin_url, network_strengths, notes
- **AI extraction** (both LinkedIn scrape + PDF parse): returns name, headline, expertiseTags, networkStrengths, notes
- **No connection** between session leads and lead pool — they're fully independent
- **No "Add from Lead Pool"** button on the session config table leads section

### Changes

#### 1. DB Migration — Update `lead_pool` table
Add new columns, drop `network_strengths`:
```sql
ALTER TABLE lead_pool ADD COLUMN company text;
ALTER TABLE lead_pool ADD COLUMN title text;
ALTER TABLE lead_pool ADD COLUMN email text;
ALTER TABLE lead_pool ADD COLUMN website text;
ALTER TABLE lead_pool DROP COLUMN network_strengths;
ALTER TABLE lead_pool RENAME COLUMN notes TO background;
```

Also update `breakout_leads` to match:
```sql
ALTER TABLE breakout_leads ADD COLUMN company text;
ALTER TABLE breakout_leads ADD COLUMN title text;
ALTER TABLE breakout_leads ADD COLUMN email text;
ALTER TABLE breakout_leads ADD COLUMN website text;
ALTER TABLE breakout_leads DROP COLUMN network_strengths;
ALTER TABLE breakout_leads RENAME COLUMN notes TO background;
```

#### 2. Update Edge Functions — AI Extraction Schema

**`scrape-linkedin/index.ts`**: Change the AI tool schema to extract `company`, `title`, `email`, `website`, and `background` (a summary of the profile). Add `"AI Generated"` to expertiseTags. Remove `networkStrengths`.

**`parse-lead-pdf/index.ts`**: Same schema changes.

#### 3. Update `SessionConfig.tsx` — Table Leads UI
- Remove `networkStrengths` field, replace `notes` with `background`
- Add `company`, `title`, `email`, `website` fields to the lead form
- On LinkedIn import / PDF import: also auto-insert into `lead_pool` table
- Add an **"Add from Lead Pool"** button that opens a dialog listing pool leads, letting the admin pick one to add as a session lead
- Update the `TableLead` interface and `saveToDb` to match new columns

#### 4. Update `LeadPool.tsx`
- Remove `network_strengths` field
- Rename `notes` to `background`
- Add `company`, `title`, `email`, `website` fields to the form and table display

#### 5. Update `MatchingWorkspace.tsx`
- Update `leadsForAi` mapping: replace `networkStrengths` with `background`, add `company`/`title`

### Files Changed

| File | Change |
|------|--------|
| DB migration | Add company/title/email/website, drop network_strengths, rename notes→background on both tables |
| `supabase/functions/scrape-linkedin/index.ts` | New extraction schema with company/title/email/website/background, add "AI Generated" tag |
| `supabase/functions/parse-lead-pdf/index.ts` | Same schema changes |
| `src/pages/admin/SessionConfig.tsx` | New lead fields, auto-sync to lead_pool on import, "Add from Lead Pool" dialog |
| `src/pages/admin/LeadPool.tsx` | Updated form/table for new fields |
| `src/pages/admin/MatchingWorkspace.tsx` | Update leadsForAi mapping |

