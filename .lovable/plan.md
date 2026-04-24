## Fix: Founder pool import not saving

### Root cause (confirmed)

`src/pages/admin/SessionConfig.tsx` `saveRosterData` (lines 360–428) does a **destructive wipe-and-reinsert**:

```ts
await supabase.from("breakout_companies").delete().eq("session_id", sessionId);
// then re-inserts only what's in the local csvData state
await supabase.from("breakout_leads").delete().eq("session_id", sessionId);
// then re-inserts only what's in the local leads state
```

This fires on a 2.5s debounce (`scheduleRosterSave`) any time roster state changes. If `/admin/session/:id` is open in another tab with stale state when you import founders from `/admin/founders`, the very next debounce tick deletes everything you just added.

### What I'll change

**`src/pages/admin/SessionConfig.tsx` — incremental save**

1. Tag each `csvData` row with a hidden `__rowId` when loaded from DB (the company's `breakout_companies.id`). Newly added rows (CSV upload, paste, manual add, URL add, email lookup) have no `__rowId`.
2. Tag each `TableLead` already does — `id` matches DB `breakout_leads.id` after load.
3. Add two refs that track DB ids the user explicitly deleted **in this tab**: `deletedCompanyIdsRef`, `deletedLeadIdsRef`.
4. Rewrite `saveRosterData` to:
   - **Insert** rows with no `__rowId` (new rows). Strip `__rowId` from `raw_data` before writing.
   - **Update** mapped_data on rows that have `__rowId` (so column-mapping changes still propagate). Skip if mapped_data is unchanged.
   - **Delete** only `deletedCompanyIdsRef` / `deletedLeadIdsRef`, then clear those refs.
   - Never call `.delete().eq("session_id", …)`.
5. Wire the per-row delete handler in `CsvPreviewTable` to push the deleted row's `__rowId` into `deletedCompanyIdsRef` (if present).
6. Lead removal paths (Trash2 button) push the lead `id` into `deletedLeadIdsRef` if present.
7. Add `loaded` gate to `scheduleRosterSave` so it can never fire before the initial DB load.
8. Add a `window.addEventListener("focus", …)` that re-queries `breakout_companies` and `breakout_leads` for the session and merges any rows added by other tabs/imports into local state (preserving any unsaved local edits).

**`src/pages/admin/FounderPool.tsx`** — already calls `queryClient.invalidateQueries({ queryKey: ["founder_pool"] })` after import. No changes needed.

### What stays the same

- The matching workflow, debounced auto-save, and the existing roster UI.
- Column mapping, leads pool sync, LinkedIn/PDF imports.
- Local edits still take precedence — focus refresh only adds rows the user doesn't have.

### After deploy

1. Re-import your founders at `/admin/founders` — they'll persist.
2. If `/admin/session/:id` is open in another tab, switching back to it will refresh the roster from the database within ~1s.

### Files touched

- `src/pages/admin/SessionConfig.tsx` — incremental `saveRosterData`, deletion-id refs, focus refresh, `loaded` gate on `scheduleRosterSave`.
