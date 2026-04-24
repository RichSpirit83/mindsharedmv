## Why your imports keep disappearing

Looked at the network log. At **14:18:42** the FounderPool inserted 49 rows into `breakout_companies` for "Breakout 2". At **14:19:25** — 43 seconds later — there is a single `DELETE breakout_companies?id=in.(...)` request with **exactly those 49 IDs**. After that delete, "Breakout 2" has 0 companies. That's why "Paste Emails" later finds nothing — the rows are gone.

Querying the DB now: 0 rows for "Breakout 2", 40 for "Mindshare Breakout 1". So the data persisted briefly, then SessionConfig deleted it.

The only code path in the entire app that deletes from `breakout_companies` is `saveRosterData` in `SessionConfig.tsx` (the one I last edited). It deletes whatever IDs are in `deletedCompanyIdsRef.current`. The previous "incremental save" fix narrowed this down from "delete everything" to "delete only IDs in the ref" — but several flows still dump IDs into that ref (or bypass it in ways that still cause data loss):

1. **"Replace File" button** (line 1115) — clears local `csvData` but does NOT add rows to the delete ref. So those rows become invisible to the tab. Not the cause of *this* delete, but a latent bug.
2. **Per-row delete button** in `CsvPreviewTable` — adds `__rowId` to the ref. If the user (or a stale reconciliation effect) ever triggered this for the focus-refreshed rows, they'd be queued for deletion.
3. **Most likely culprit here:** the focus-refresh effect (lines 347-396) merges new DB rows into local state by `__rowId`. If the user had SessionConfig open with the *old* (pre-import) roster, then imported via FounderPool in another tab, then came back and edited *anything* in SessionConfig, the auto-save runs `saveRosterData` — and although the current code only deletes ref IDs, an earlier session of this tab (before today's fix shipped) could have left the ref populated, OR a re-render races such that some rows get marked stale.

Regardless of the exact trigger, the architecture is fundamentally fragile: a long-lived SessionConfig tab can issue destructive deletes against a session it no longer has authoritative state for.

## The fix

### 1. Make SessionConfig deletes opt-in and verifiable

In `src/pages/admin/SessionConfig.tsx`:

- **Require an explicit confirm modal** for any roster delete that affects more than 3 rows at once. If `deletedCompanyIdsRef.current.size > 3` when `saveRosterData` runs, show "About to remove N companies — continue?" instead of silently deleting.
- **Re-validate every queued delete ID against the DB at save time.** Before calling `.delete().in("id", ids)`, fetch `select id, created_at from breakout_companies where id in (ids) and session_id = sessionId`. If any of those rows were created *after* the current SessionConfig tab was loaded (compare to a `tabLoadedAtRef`), drop them from the delete set — they are imports from another tab and were never meant to be deleted by this tab.
- **Fix "Replace File"** (line 1115) to also enqueue every existing `__rowId` into `deletedCompanyIdsRef` so the destructive intent is explicit and would trip the confirm modal above.
- **Don't auto-save deletes at all.** Keep insert/update auto-saving (those are non-destructive), but require an explicit "Save changes" button click to flush queued deletes. This single change would have prevented today's loss.

### 2. Make the FounderPool import survive race conditions

In `src/pages/admin/FounderPool.tsx`:

- After a successful import, also invalidate `["session_companies", sessionId]` and broadcast a `BroadcastChannel("breakout_companies")` message so any open SessionConfig tab refreshes immediately rather than waiting for window-focus.
- Switch the dedup key to **`email` first, then `first|last|company`**, so re-uploading the same CSV truly skips already-present rows even if the company-name spelling drifts.

### 3. Tighten the Paste Emails lookup so it can't silently miss matches

In `src/components/PasteCompanyEmailsDialog.tsx` (`handleLookup`, lines 64-92):

- Currently selects only 3 columns and pages over all sessions client-side. That's fine at 40 rows but will silently truncate at 1000+. Add `.limit(10000)` explicitly and surface a warning if the limit is hit.
- Broaden the email match: also check `raw_data["Email Address"]`, `raw_data["E-mail"]`, and any key whose lowercase name contains `"email"`. The current logic only checks three exact keys, so a CSV whose email column is named anything else won't match even after a correct mapping (because the mapping lives on the session, not on the row).
- Show *which session* each matched company came from in the results list so you can tell at a glance whether you're pulling from a stale session.

### 4. Add a session-companies count badge

In `src/pages/admin/BreakoutsList.tsx`, show "N founders" on each session card. If "Breakout 2" had said "0 founders" you'd have caught the wipe immediately instead of after the next email-paste attempt.

## What you'll do after deploy

1. Re-run the FounderPool import for "Breakout 2".
2. Confirm the count badge on the session card shows the right number.
3. Open Paste Emails in the breakout tool — matches should appear with session names attached.
4. If you ever see the new confirm modal "About to remove N companies", that's the old bug trying to fire — say No.

## Files touched

- `src/pages/admin/SessionConfig.tsx` — confirm modal for bulk deletes, re-validate IDs against DB before deleting, never auto-flush deletes, fix Replace File.
- `src/pages/admin/FounderPool.tsx` — broadcast channel + email-first dedup.
- `src/components/PasteCompanyEmailsDialog.tsx` — broader email key matching, explicit limit, session-name in results.
- `src/pages/admin/BreakoutsList.tsx` — founder count badge per session.
