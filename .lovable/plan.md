## Why "some fields are remembered, others not"

I traced through the mapping-memory feature on `/admin/founders` (CSV upload). The core read/write logic works, but the **header normalizer in `src/lib/mappingMemory.ts` is too narrow**, so headers that *look* identical to a human end up with different storage keys and the memory misses them.

### The bug

`normalizeHeader` only strips this character class:

```
[\s _ - / ? ( ) # , . ' "]
```

Real-world CSV headers from Google Sheets / Excel / pasted-in form exports very often contain characters this regex does NOT match, so they normalize to different keys across imports:

| What you see | Normalizes to |
|---|---|
| `What's your sector` (straight apostrophe) | `whatsyoursector` |
| `What's your sector` (curly apostrophe `'` U+2019) | `what'syoursector` ← **mismatch** |
| `Revenue – 2024` (en dash) | `revenue–2024` ← **mismatch** |
| `Sector [Primary]` (square brackets) | `sector[primary]` ← **mismatch** |
| `Notes:` (colon) | `notes:` ← **mismatch** |
| `Email\u00A0Address` (non-breaking space) | `email\u00A0address` ← **mismatch** |

So fields with "plain" headers (Company Name, Email, First Name) get remembered, while fields with typographic punctuation — exactly the long form-question headers like the DMV question, "What topics are you most interested in…", "What's your most critical challenge?" — silently fail to match across imports.

There are also two smaller issues worth fixing while we're in this file:

- **Stale memory entries don't get removed.** If you map header X → field A, then later re-map header X → field B (or skip it), the old `X → A` entry stays in memory and can resurface in a future import.
- **The "remembered" badge in `ColumnMapper` lights up even when memory only confirmed what the auto-mapper already had.** Minor, but it makes it look like memory is working when actually the auto-mapper is doing the work.

### Fix

1. **`src/lib/mappingMemory.ts` — broaden `normalizeHeader`**
   - Replace the hand-picked character class with: lowercase, NFKD-normalize, strip combining marks, replace **all** non-alphanumerics with empty string. This collapses straight + curly quotes, all dash variants, brackets, colons, NBSP, em-spaces, etc., to the same key.
   - Concretely:
     ```ts
     function normalizeHeader(h: string): string {
       return h
         .normalize("NFKD")
         .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, "")
         .trim();
     }
     ```

2. **`src/lib/mappingMemory.ts` — prune stale entries on save**
   - In `rememberMapping`, before writing the new pairs, remove any existing memory entry whose **value (canonical field)** is one we're about to re-assign to a different header from the *current* CSV. This stops orphan entries from a previous import from hijacking future ones.
   - Also: if a CSV header is present in this CSV but the user explicitly left it unmapped (`""`), delete its entry from memory so we don't keep auto-mapping it back.

3. **`src/lib/mappingMemory.ts` — one-time migration of existing memory**
   - Old keys saved under the narrow normalizer won't match keys read by the broad normalizer. On first read after this change, walk the stored object and re-key every entry through the new normalizer (collapsing duplicates), then write it back. Gate this with a version flag (`mapping_memory_version`) so it runs once.

4. **`src/components/ColumnMapper.tsx` — tighter "remembered" badge**
   - Show the badge only for fields that were remembered **but the auto-mapper would not have found**. This requires passing the auto-map result alongside the remembered set, or computing "remembered AND not-in-autoMap" before passing it in. Optional polish — happy to skip if you'd rather keep it as is.

### Files touched

- **Updated**: `src/lib/mappingMemory.ts` (normalizer, pruning logic, one-time migration)
- **Updated** (optional polish): `src/components/ColumnMapper.tsx` + `src/pages/admin/FounderPool.tsx` + `src/components/PasteLeadsDialog.tsx` to make the "remembered" badge stricter

### What you should see after the fix

- Re-importing the same founder CSV (or any CSV with similar headers, even with curly quotes / dashes / brackets) should now restore every field you mapped last time, including the long form-question fields like the DMV one and "What topics…".
- If you re-map a header to a different field, the old association won't come back.
- Existing memory in your browser is preserved (migrated automatically on first load).