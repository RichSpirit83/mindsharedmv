

## Remember CSV column mappings across imports

Right now every CSV import on `/admin/founders` makes you re-map columns from scratch, even when the headers are nearly identical to last time. The auto-mapper (`autoMapHeaders` in `src/lib/founderFields.ts`) only knows the hardcoded aliases in `FIELD_ALIASES` — it has no memory of what *you* mapped last time.

I'll add a learning layer so mappings you confirm get remembered and re-applied automatically.

### What I'll change

1. **New file: `src/lib/mappingMemory.ts`**
   - Stores a dictionary of `{ normalizedCsvHeader → canonicalField }` in `localStorage` under key `founder_mapping_memory_v1`.
   - Exports `getRememberedMapping(headers)`, `rememberMapping(mapping, headers)`, and `clearMappingMemory()`.
   - Normalization (lowercase, strip punctuation/whitespace) matches what `fuzzyMatchHeader` already does, so "First Name", "first_name", and "FirstName" all collapse to the same key.

2. **Update `src/pages/admin/FounderPool.tsx`** (CSV upload handler around the auto-map step)
   - When CSV is parsed: build mapping by layering **(a) hardcoded aliases → (b) remembered user mappings**, with remembered taking precedence. This way headers never seen before still get the built-in fuzzy match, and headers you've mapped manually before get YOUR choice.
   - When the user clicks **Confirm Mapping**: call `rememberMapping(mapping, csvHeaders)` to persist every header→field pair they confirmed (skipping unmapped ones).

3. **Update `src/components/ColumnMapper.tsx`** — small UX additions:
   - Show a subtle badge "✓ Remembered from last import" next to fields whose value came from memory (so you know which ones to double-check).
   - Add a small **"Clear remembered mappings"** link in the header that calls `clearMappingMemory()` and resets the dropdowns to the hardcoded auto-map. Useful if you ever want a clean slate.

4. **Apply the same to leads (optional but cheap)** — `src/components/PasteLeadsDialog.tsx` has its own `autoMapHeaders`. I'll wire it to the same memory module under a separate key (`lead_mapping_memory_v1`) so leads imports also get smarter over time. Say no if you'd rather keep this scoped to founders only.

### What stays the same

- All existing hardcoded aliases in `FIELD_ALIASES` keep working as the baseline.
- The mapping UI, preview step, and import logic are unchanged — you can still override any remembered mapping before confirming.
- Memory is per-browser (localStorage). It's not synced across devices; that would need a new DB table, which I'd only add if you ask for it.

### After deploy — what you do

1. Upload your next founder CSV. Headers you've previously mapped will already be filled in (marked with the "Remembered" badge).
2. Adjust anything that's wrong, click **Confirm Mapping** — your tweaks become the new memory.
3. If headers ever get badly out of sync, click **Clear remembered mappings** in the mapper and start fresh.

### Files touched

- **New**: `src/lib/mappingMemory.ts`
- **Updated**: `src/pages/admin/FounderPool.tsx` (load memory on parse, save memory on confirm)
- **Updated**: `src/components/ColumnMapper.tsx` (badge + clear link, accepts optional `rememberedFields` prop)
- **Updated** (if you want it): `src/components/PasteLeadsDialog.tsx` (same pattern, separate storage key)

