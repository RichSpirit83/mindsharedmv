

## Plan: Per-Round Match Settings with Shuffle Control

### Problem
Currently, matching settings (grouping priority, stage mixing, etc.) are stored on the session level and apply globally. They need to be per-round. Additionally, there's no control over what gets reshuffled between rounds (founders, leads, or both).

### Approach
Store per-round settings in a new JSON column on `breakout_sessions` and move the settings UI to be scoped to the active round. Add a "Round Shuffle Mode" control (founders only, leads only, both).

### Database Change

Add a `round_settings` JSONB column to `breakout_sessions`:

```sql
ALTER TABLE public.breakout_sessions 
ADD COLUMN round_settings jsonb NOT NULL DEFAULT '{}';
```

Structure: `{ "1": { grouping_priority, allow_stage_mixing, num_tables, target_per_table, avoid_competitors, lead_matching_mode, shuffle_mode }, "2": { ... } }`

The existing session-level columns remain as defaults for Round 1 / backward compatibility.

### Code Changes

**File: `src/pages/admin/MatchingWorkspace.tsx`**

1. **Per-round settings state**: Derive active round's settings from `sessionConfig.round_settings[activeRound]`, falling back to session-level defaults.
2. **`updateMatchingSettings`**: Write to `round_settings[activeRound]` instead of session-level columns.
3. **Settings popover header**: Show "Round N Settings" instead of "Matching Settings".
4. **New "Shuffle Mode" control** in the settings popover under a "Multi-Round" section:
   - **Founders only** — keep leads at same tables, reshuffle founders
   - **Leads only** — keep founders at same tables, reshuffle leads
   - **Both** (default) — reshuffle everything
5. **`generateMatches`**: Read settings from the active round's config, pass `shuffle_mode` to the edge function.

**File: `supabase/functions/generate-matches/index.ts`**

Add handling for `shuffleMode` in the prompt:
- `"founders"`: Include instruction to keep leads assigned as in previous round, only reshuffle companies
- `"leads"`: Include instruction to keep companies at same tables, only reassign leads  
- `"both"` / default: Current behavior

### Files Changed

| File | Change |
|------|--------|
| Migration | Add `round_settings` JSONB column to `breakout_sessions` |
| `MatchingWorkspace.tsx` | Per-round settings read/write, shuffle mode UI, round label in popover |
| `generate-matches/index.ts` | Handle `shuffleMode` in prompt construction |

