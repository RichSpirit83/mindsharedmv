

## Fix: Founder import "Import failed"

### What's actually wrong

Looking at `src/pages/admin/FounderPool.tsx` (the import handler, lines 227–279), I see two real problems — and **duplicates are NOT one of them**. The code already handles duplicates correctly (lines 241–253: it skips rows whose `first_name|last_name|company_name` already exist in the session, then only inserts the rest).

The actual failure modes:

1. **All-or-nothing single insert.** Every row is sent in ONE `supabase.from("breakout_companies").insert(inserts)` call. If even one row violates something (e.g. an oversized `raw_data` JSON, an odd character, or the whole payload exceeds Supabase's request limit), the entire import fails and you see "Import failed" with a cryptic message — even rows that were fine never land.

2. **No visibility into what went wrong.** The toast just shows `err.message`, which for a Supabase batch error is often unhelpful (e.g. "Failed to fetch", "payload too large", or a Postgres error mentioning only the first offending row). You can't tell which row broke it or how many succeeded.

3. **No row-level validation.** Empty rows, rows missing both name and company, or rows with massive freeform `additional_info` text get pushed straight into the batch.

### What I'll change

**`src/pages/admin/FounderPool.tsx` — `handleImport` only:**

1. **Batch inserts (200 rows per batch).** Loop through `uniqueRows` in chunks so a single bad row or a payload-size limit can't kill the whole import. Track `insertedCount` and `failedBatches` separately.

2. **Per-row fallback on batch failure.** If a batch insert errors, retry that batch row-by-row so good rows still land and bad rows are isolated. Collect the first ~3 row-level error messages with the offending name/company to show the user.

3. **Skip empty rows up front.** Filter out rows where `first_name`, `last_name`, AND `company_name` are all empty before inserting (these are usually trailing CSV blanks and serve no purpose).

4. **Trim oversized fields.** Cap any single mapped field at 8,000 chars and `raw_data` JSON at ~32KB total before insert, to avoid Postgres/Supabase payload limits. Long `additional_info` / `critical_challenges` will be truncated with a `…[truncated]` suffix.

5. **Honest result toast.** Replace the single success/fail toast with a structured summary:
   - `✓ Added: 37 · Skipped duplicates: 4 · Empty rows skipped: 2 · Failed: 1`
   - If failures > 0, include the first failed row's name + the actual error message.
   - Keep the dialog open if everything failed so you can retry; close it on partial/full success.

6. **Console-log the full error** for any failed row so we can debug further if needed.

### What stays the same

- Existing duplicate detection (name + company match within the session) — unchanged.
- CSV parsing, column mapping UI, preview step — unchanged.
- Database schema and RLS — no changes needed.

### After deploy — what you do

1. Re-run the same upload that just failed.
2. You'll see a precise breakdown (e.g. "Added: 38, Skipped duplicates: 0, Failed: 2 — first failure: 'Acme Corp' — value too long for type…").
3. If specific rows fail, the message will tell you which field/row to fix in the CSV; re-upload and the duplicate-detection will skip the 38 already added.

### Files touched

- `src/pages/admin/FounderPool.tsx` — rewrite `handleImport` (lines ~227–279) with batching, per-row fallback, validation, and a detailed result toast. No other files affected.

