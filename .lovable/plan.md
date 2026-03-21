

## Plan: Add Consistent Workspace Navigation to All Breakout Pages

### Problem
The matching workspace has a navigation bar, but Session Config and Lead Briefings don't. Need the same nav bar across all three session-scoped pages.

### Approach
Extract the navigation bar into a shared component, then use it in all three pages.

### Changes

**New file: `src/components/WorkspaceNav.tsx`**
- Shared component accepting `sessionId` and `activePage` ("config" | "matching" | "briefings") props
- Renders the same horizontal tab bar currently in MatchingWorkspace: Session Config, Matching, Lead Briefings, Present (new tab), PDF download
- Active page gets the underline style; others are clickable links
- Optional `rightContent` slot for page-specific actions (e.g., Save/Generate buttons)

**File: `src/pages/admin/SessionConfig.tsx`**
- Import and render `<WorkspaceNav sessionId={sessionId} activePage="config" />` at the top of the page, replacing the current header
- Move the save status indicator into the nav's right content area

**File: `src/pages/admin/LeadBriefings.tsx`**
- Import and render `<WorkspaceNav sessionId={sessionId} activePage="briefings" />` replacing the current "Back to Matching" button and header
- Move the "Generate All Briefings" button into the nav's right content area

**File: `src/pages/admin/MatchingWorkspace.tsx`**
- Replace the inline nav bar (lines 857-888) with `<WorkspaceNav sessionId={sessionId} activePage="matching" />` and pass the Lock All / Generate buttons as right content

### Summary

| File | Change |
|------|--------|
| `src/components/WorkspaceNav.tsx` | New shared workspace navigation bar component |
| `src/pages/admin/SessionConfig.tsx` | Add WorkspaceNav at top |
| `src/pages/admin/LeadBriefings.tsx` | Replace back button with WorkspaceNav |
| `src/pages/admin/MatchingWorkspace.tsx` | Extract inline nav into shared WorkspaceNav |

