

## Plan: Prevent Session Config Saves from Destroying Matching Data

### Root Cause

The `saveToDb` function in `SessionConfig.tsx` runs on a 2-second debounce whenever **any** field changes -- including dates, times, and session name. Every save:

1. Deletes ALL `breakout_companies` for the session
2. Re-inserts them with **new UUIDs**
3. Since `breakout_table_assignments.company_id` has `ON DELETE CASCADE`, deleting companies **cascades and destroys all table assignments**

So changing a date wipes all matching progress.

### Solution

Split `saveToDb` into two functions:

1. **`saveSessionMetadata`** -- saves only session-level fields (name, date, times, format, prompts, grouping, etc.) to `breakout_sessions`. This is what the debounced auto-save calls.

2. **`saveRosterData`** -- saves companies and leads (the destructive delete-reinsert). Only called explicitly when roster data actually changes (CSV upload, lead add/remove, company add/remove).

### Changes

**File: `src/pages/admin/SessionConfig.tsx`**

1. Extract session metadata update into `saveSessionMetadata()` -- just the `supabase.from("breakout_sessions").update(...)` call. No company/lead deletion.

2. Extract company + lead persistence into `saveRosterData()` -- the delete-reinsert logic for companies and leads.

3. Change the debounced auto-save (line 414-419) to only call `saveSessionMetadata()`. Remove `csvData` and `leads` from its dependency array.

4. Call `saveRosterData()` explicitly after roster-changing actions:
   - CSV upload (`handleCsvUpload`, `handleDrop`)
   - Company add/remove (paste emails, add by URL, manual add, delete row)
   - Lead add/remove (paste, CSV import, pool add, individual add/delete, LinkedIn import, PDF upload)

5. Update `handleContinue` to call both `saveSessionMetadata()` and `saveRosterData()`.

6. Add a "stale matching" warning: after roster changes, if the session status is `"matched"`, show a warning badge in the UI indicating matching may be out-of-date.

### Technical Details

| Area | Detail |
|------|--------|
| Auto-save deps | Remove `csvData`, `leads` from the `useEffect` dependency array |
| Roster save trigger | Call `saveRosterData()` inside each roster-mutation handler |
| Stale indicator | Track `rosterDirty` state; set true after roster changes when status is "matched" |
| Warning UI | Show amber badge near "Continue to Matching" button |

### Files Modified
- `src/pages/admin/SessionConfig.tsx`

