## Goal

On the Matching Workspace page, add two small visual tags to every company chip — **Revenue** and **Capital Raised** — so you can see each founder's stage at a glance without opening the profile dialog. Back up your Round 1 work first so nothing is lost.

## What you'll see after

Each company chip in a table goes from:

```
Acme Inc.                 Jane
```

to:

```
Acme Inc.   [$1–5M] [Seed $2M]   Jane  ✕
```

- **Revenue** badge (green tint) — pulled from `mapped_data.revenue` (e.g. "$1–5M", "Pre-revenue").
- **Capital Raised** badge (blue tint) — pulled from `mapped_data.capital_raised` (e.g. "$2M", "Bootstrapped").
- Empty/missing values are hidden — no badge if the founder didn't fill it in.
- Badges are tiny (text-[9px], h-4) so chips stay compact. They don't trigger drag/click — clicking still opens the founder profile.

## Plan

### Step 1 — Snapshot current Round 1 (safety backup)

Before any code change, duplicate the current 5 Round 1 tables + 38 assignments into `breakout_tables` rows tagged:
- `is_backup = true`
- `backup_label = "Pre-tags backup (2026-04-24)"`

These rows are filtered out of the workspace UI (already done), so you won't see them. They're recoverable if anything goes sideways.

### Step 2 — Add Revenue + Capital Raised badges to the chip

In `src/pages/admin/MatchingWorkspace.tsx` around line 1483 (the company chip render), insert two `<Badge>` components between the company name and the founder first-name. Source the values from `c.mapped_data?.revenue` and `c.mapped_data?.capital_raised`. Use distinct subtle colors so the two are easy to tell apart.

### Step 3 — Mirror the same badges in the left "Companies" panel (optional, low cost)

The left-side searchable list (lines 945-959) currently shows just the sector badge. Add the revenue + capital badges there too so the panel matches the table cards.

## Technical Details

**File touched**: `src/pages/admin/MatchingWorkspace.tsx` only.

**Chip change** (line ~1483):
```tsx
<div className="flex items-center gap-1.5 min-w-0">
  <span className="font-medium truncate">{c.company_name}</span>
  {c.mapped_data?.revenue && (
    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shrink-0">
      {c.mapped_data.revenue}
    </Badge>
  )}
  {c.mapped_data?.capital_raised && (
    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300 shrink-0">
      {c.mapped_data.capital_raised}
    </Badge>
  )}
</div>
```

**Backup**: a one-shot data insert into `breakout_tables` + `breakout_table_assignments` for session `f0833640-…`, Round 1 only, with `is_backup = true`. No schema migration needed (columns already exist).

**No DB schema changes**, no edge function changes, no impact on matching logic, drag/drop, or CSV export.

Approve and I'll back up your work, then make the chip edit.