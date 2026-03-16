

## Plan: Add Matching Logic Explanation to Workspace Header

### What to Build

Add a brief, dynamic explanation below the session name in the right panel header that summarizes the current matching approach based on the active settings (grouping priority, stage mixing, competitor avoidance, lead matching mode).

### Implementation

**File: `src/pages/admin/MatchingWorkspace.tsx`** (lines 563-569)

Below the session name `<p>` tag, add a short descriptive paragraph that dynamically reflects the current matching settings. Something like:

> "Tables are grouped using a **hybrid** approach — balancing sector alignment, stage diversity, and shared challenges. Leads are matched **flexibly** to tables where their expertise aligns with founders' needs. Direct competitors are kept apart."

The text adapts based on `sessionConfig` values:
- `grouping_priority`: explains whether grouping favors sector, stage, need, or a hybrid mix
- `allow_stage_mixing`: mentions whether early/growth stages are mixed for mentorship or kept separate
- `avoid_competitors`: notes competitor separation rule
- `lead_matching_mode`: explains flexible vs strict lead assignment
- Lead count: mentions how many leads will be distributed

Styled as `text-xs text-muted-foreground max-w-2xl` to keep it subtle and compact.

### Single file change

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Add dynamic matching logic summary text below the header title (lines ~564-569) |

