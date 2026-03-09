
## What's There Now

The left sidebar has a `<Collapsible>` section at the bottom with only 2 settings:
- Grouping Priority (select)
- Allow Stage Mixing (toggle)

The `num_tables` and `target_per_table` fields already exist in the DB but are not editable in the workspace. Two useful new AI behavior constraints are entirely missing.

---

## Proposed Settings Popover — 6 Settings Total

```
┌─ Matching Settings ──────────────────────┐
│                                          │
│  TABLE STRUCTURE                         │
│  Number of Tables        [  5  ▲▼]       │
│  Target per Table        [  6  ▲▼]       │
│                                          │
│  GROUPING                                │
│  Priority      [Hybrid         ▾]        │
│  Allow Stage Mixing    [  ●  ] ON        │
│                                          │
│  AI BEHAVIOR                             │
│  Avoid Direct Competitors  [  ●  ] ON    │
│  Lead Matching   [Flexible     ▾]        │
│    Flexible = preferred alignment        │
│    Strict  = expertise must match theme  │
│                                          │
└──────────────────────────────────────────┘
```

---

## Two New Settings Explained

**Avoid Direct Competitors** — the edge function already has this hardcoded. Making it a toggle lets you intentionally seat competitors together for competitive-intelligence discussions if you want.

**Lead Matching Mode**:
- `flexible` (default) — AI prefers to match lead expertise to table theme, but can override
- `strict` — AI is explicitly instructed that a lead MUST only be assigned to a table where their expertise tags directly align with the theme

---

## Changes Required

### 1. DB Migration
Add 2 columns to `breakout_sessions`:
```sql
ALTER TABLE breakout_sessions 
  ADD COLUMN avoid_competitors boolean DEFAULT true,
  ADD COLUMN lead_matching_mode text DEFAULT 'flexible';
```

### 2. `MatchingWorkspace.tsx`
- Remove `Collapsible` imports, add `Popover / PopoverContent / PopoverTrigger`
- Add `Settings` icon (lucide `Settings2`)
- Replace the bottom collapsible section with a `Popover`-triggered button at the bottom of the left panel
- Add `num_tables` and `target_per_table` as number inputs (auto-save on blur)
- Add `avoid_competitors` switch and `lead_matching_mode` select
- Extend `updateMatchingSettings` type to include the 4 total fields
- Pass `avoidCompetitors` and `leadMatchingMode` in the `sessionConfigForAi` object to the edge function

### 3. `generate-matches/index.ts`
Read `avoidCompetitors` and `leadMatchingMode` from `sessionConfig`, then:
- When `avoidCompetitors = false`: remove "Direct competitors should NOT be at the same table"
- When `leadMatchingMode = 'strict'`: replace "assign one per table where possible" with "Each lead MUST be assigned only to the table whose theme most closely matches their expertise tags. Do not assign any lead to a table where their expertise does not align."

---

## Files Changed

| File | Change |
|------|--------|
| DB migration | Add `avoid_competitors`, `lead_matching_mode` columns |
| `src/pages/admin/MatchingWorkspace.tsx` | Replace collapsible with Popover; expose 6 settings; pass new fields to edge function |
| `supabase/functions/generate-matches/index.ts` | Conditionally apply competitor constraint + lead strictness |
