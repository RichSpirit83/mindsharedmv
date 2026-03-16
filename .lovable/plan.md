

## Plan: Multi-Round Breakouts with Tab UI

### Database Changes

Add a `round_number` column to `breakout_tables` (default `1`) to associate each table with a specific round. No new tables needed — rounds are implicit groupings of existing tables.

**Migration:**
```sql
ALTER TABLE breakout_tables ADD COLUMN round_number integer NOT NULL DEFAULT 1;
```

### Matching Workspace Changes

**File: `src/pages/admin/MatchingWorkspace.tsx`**

1. Add `activeRound` state (default `1`) and compute `totalRounds` from session config (for speed_rounds, calculate from time; for deep_dive, default to 1 but allow adding rounds).
2. Render a **tab bar** above the table grid: "Round 1", "Round 2", ..., plus an "Add Round" button.
3. Filter displayed `tables` by `activeRound` — each round has its own independent set of table cards.
4. "Generate Matches" operates on the active round only, generating a fresh set of tables with `round_number = activeRound`.
5. When saving to DB, include `round_number` on each `breakout_tables` insert.
6. When loading from DB, group tables by `round_number`.
7. PDF export: one page per round, with "Round N" as the page header.

### Presentation View Changes

**File: `src/pages/admin/PresentationView.tsx`**

1. Group loaded tables by `round_number`.
2. The carousel becomes: **Round 1 Tables → Round 2 Tables → ... → Prompts → Timer**.
3. Each round's tables slide shows that round's grid layout.
4. Navigation dots update to: "Round 1", "Round 2", ..., "Prompts", "Timer".

### Session Config Changes

**File: `src/pages/admin/SessionConfig.tsx`**

For `speed_rounds` format, the calculated number of rounds drives how many round tabs appear in the workspace. For `deep_dive`, allow manually adding/removing rounds.

### Summary of File Changes

| File | Change |
|------|--------|
| Migration | Add `round_number` column to `breakout_tables` |
| `MatchingWorkspace.tsx` | Add round tabs, filter tables by round, generate per-round, multi-page PDF |
| `PresentationView.tsx` | Group tables by round, one carousel slide per round |
| `SessionConfig.tsx` | Minor — pass round count info through to workspace |

