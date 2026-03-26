

## Plan: Fix Lead Pool Email Lookup

### Problem
The email lookup in `PasteEmailsDialog.tsx` has two issues:
1. **Case-sensitive matching**: Emails are lowercased client-side before the `.in()` query, but PostgreSQL's `IN` is case-sensitive. If the DB stores `AMurphy@JobSync.io`, it won't match `amurphy@jobsync.io`.
2. **Unnecessary `as any` casts**: The `lead_pool` table exists in the generated types, so the `as any` casts are unnecessary and could mask real errors.

### Fix

**File: `src/components/PasteEmailsDialog.tsx`**
- Remove `as any` casts from the Supabase query
- Use `.ilike()` won't work for arrays. Instead, use a case-insensitive approach: query with both original-case and lowered emails, or use an RPC function. The simplest fix: use `.or()` with `ilike` filters, but that's unwieldy for many emails.
- Best approach: keep emails as-is (don't lowercase them before the query), and do case-insensitive comparison client-side when deduplicating. The DB likely stores emails in the same case they were entered — so pass the original-case emails to `.in()`.
- Actually the simplest robust fix: query ALL lead_pool emails and filter client-side, since lead pools are typically small. Or use a Postgres function with `LOWER()`.

**Chosen approach**: Use an RPC or simply fetch leads where `email` is in the list, but also try original case. The most pragmatic fix:
1. Don't lowercase the emails before passing to `.in()` — pass them as-is
2. Also pass lowercased versions as a fallback
3. Do case-insensitive deduplication client-side

Actually, the simplest and most reliable fix: use `.ilike` with `or` filter, or better yet, create a small server-side query. But the easiest: just pass original-case emails to `.in()` and handle comparison client-side with `.toLowerCase()`.

**File: `src/components/PasteEmailsDialog.tsx`**
- Parse emails without lowercasing for the DB query
- Pass both original and lowercased variants to `.in()` to catch either case
- Remove `as any` casts
- Keep client-side deduplication case-insensitive

| File | Change |
|------|--------|
| `src/components/PasteEmailsDialog.tsx` | Fix email case handling in query, remove `as any` casts |

