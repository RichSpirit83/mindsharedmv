

## Plan: Persist Briefings, Include Prompts, Add Presentation Display Page

### 1. Save Briefings to Database

**DB Migration**: Add a `briefing_content` text column to `breakout_tables` table.

**Edit `LeadBriefings.tsx`**:
- After generating a briefing, save it to the `breakout_tables` row via `supabase.update({ briefing_content })`.
- On load, pre-populate `briefings` state from any existing `briefing_content` values so they persist across navigation.

### 2. Include Session Prompts in Briefings

The prompts are already sent to the edge function and included in the AI prompt under "ENGAGEMENT PROMPTS". Update the `generate-briefing` system prompt to explicitly instruct the AI to include the engagement prompts verbatim in the output (not just use them as context), so they appear on the printed one-pager.

### 3. Presentation Display Page

**New file: `src/pages/admin/PresentationView.tsx`**
- Full-screen, dark-themed display page optimized for projecting onto a screen.
- Route: `/admin/present/:sessionId`
- Loads session, tables, companies, and leads from DB.
- Layout: Session title at top, then a grid of table cards showing:
  - Table number and name (large)
  - Table lead name (highlighted)
  - List of participant names + company names
  - Table theme as subtitle
- Large text, high contrast, no interactive controls visible (clean for projection).
- Optional: auto-cycle through tables if there are many, or show all in a scrollable grid.

**Edit `App.tsx`**: Add route `/admin/present/:sessionId`.

**Edit `MatchingWorkspace.tsx`** or **`LeadBriefings.tsx`**: Add a "Present" button that navigates to the presentation view.

### File Changes Summary

| Action | File |
|--------|------|
| DB Migration | Add `briefing_content` column to `breakout_tables` |
| Edit | `src/pages/admin/LeadBriefings.tsx` — persist/load briefings, ensure prompts in output |
| Edit | `supabase/functions/generate-briefing/index.ts` — instruct AI to include prompts verbatim |
| Create | `src/pages/admin/PresentationView.tsx` — full-screen projection display |
| Edit | `src/App.tsx` — add present route |
| Edit | `src/pages/admin/MatchingWorkspace.tsx` — add "Present" button |

