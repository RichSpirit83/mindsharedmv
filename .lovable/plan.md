

## Plan: Table Lead Toggle in Lead Pool + Smart Selection in Matching

### Problem
There's no way to designate which leads from the pool should serve as table leads. When more leads are marked than tables available, users need to choose which ones to assign.

### Approach

Use the existing `tags` system on `lead_pool` to mark table leads — specifically the tag `"Table Lead"`. Add a visible toggle column and integrate this into the matching workspace.

### Changes

**1. Lead Pool — Table Lead Toggle Column**

**File: `src/pages/admin/LeadPool.tsx`**

- Add a new column "Table Lead" between the checkbox and name columns with a toggle switch (or star icon)
- Clicking the toggle adds/removes the `"Table Lead"` tag on that lead (reuses existing `toggleLeadTag` function)
- Add `"Table Lead"` to the `TAG_COLORS` map with a distinct color (e.g., gold/yellow)
- Bulk action: add a "Set as Table Lead" / "Remove Table Lead" quick button when leads are selected
- The tag filter bar already supports filtering by any tag, so filtering for Table Leads works automatically

**2. Matching Workspace — Prioritize Tagged Table Leads**

**File: `src/pages/admin/MatchingWorkspace.tsx`**

- When loading leads for a session, cross-reference with `lead_pool` to check which leads have the `"Table Lead"` tag
- If the number of tagged table leads equals the number of tables, auto-assign them 1:1
- If tagged leads exceed the number of tables, show a selection dialog:
  - List all tagged table leads with checkboxes
  - Header: "You have N table leads selected but only M tables. Please choose M."
  - Disable the confirm button until exactly M are checked
- Pass the prioritized lead list to the `generate-matches` edge function so the AI knows which leads are designated table heads

**3. Selection Dialog Component**

**New file: `src/components/LeadSelectionDialog.tsx`**

- Props: `leads`, `maxSelectable`, `open`, `onConfirm`, `onCancel`
- Shows a checklist of leads with name, company, title
- Counter: "Selected X of Y required"
- Confirm button disabled until exactly `maxSelectable` are checked

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/LeadPool.tsx` | Add Table Lead toggle column + bulk action button |
| `src/pages/admin/MatchingWorkspace.tsx` | Load table lead tags, show selection dialog when over-assigned, pass to matching |
| `src/components/LeadSelectionDialog.tsx` | New — selection dialog for choosing which leads to assign when count exceeds tables |

