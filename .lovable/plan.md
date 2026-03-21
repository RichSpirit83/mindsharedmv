

## Plan: Workspace Menu Bar + Ensure Lead Pool ↔ Session Leads Sync

### Two Issues

**1. No top navigation in the Matching Workspace** — currently the only way to navigate is the "Session Config" back button. Need a menu bar for quick access to Session Config, Lead Briefings, Presentation, and other workspace sections.

**2. "Jeff Grass" appears as a session lead but isn't in the lead pool** — `breakout_leads` and `lead_pool` are completely independent tables. When leads are added to a session (via paste, CSV, or LinkedIn scrape), they are inserted into `breakout_leads` but never synced back to `lead_pool`. The "Table Lead" tag feature relies on cross-referencing by name, which breaks when leads exist in only one table.

### Changes

**File: `src/pages/admin/MatchingWorkspace.tsx`**

1. **Add a horizontal menu bar** below the existing header (or replace the header buttons). Use a clean tab/link bar with:
   - **Session Config** → `/admin/session/{sessionId}`
   - **Matching** (active/current)
   - **Lead Briefings** → `/admin/leads/{sessionId}`
   - **Present** → opens `/admin/present/{sessionId}` in new tab
   - **Download PDF** → triggers existing PDF function
   
   Style: horizontal bar with text buttons, active state underline, sits at the top of the right panel. Move the existing "Session Config" back-button, "Present", and "Download PDF" actions into this bar to declutter the toolbar.

2. **Sync session leads to lead pool on load** — After loading `breakout_leads` for the session, check each lead against `lead_pool` by normalized name. For any session lead NOT found in the pool, auto-insert them into `lead_pool` (with their name, company, title, email, etc.). This ensures every lead used in matching is also discoverable and taggable in the Lead Pool page.

   This runs once on load — a lightweight upsert loop that only inserts missing leads.

3. **Show a warning badge** next to any lead in the workspace that doesn't exist in the lead pool (as a fallback visual indicator).

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Add top menu bar for workspace navigation; sync missing session leads to lead_pool on load |

