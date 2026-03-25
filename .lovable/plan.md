

## Plan: Fix Presentation View Page

### Problem
The "Present" button in the workspace navigation uses `window.open()` to open the presentation view in a new tab. In the Lovable preview iframe environment, `window.open()` may not work correctly, and the page may fail to load.

Additionally, there may be no clear way to navigate back or test the page directly.

### Approach
Two changes to make the presentation view accessible:

**1. Add a direct route within the admin layout** (or make it navigable without `window.open`)

In `WorkspaceNav.tsx`, change the Present button from `window.open` to a standard `navigate()` call using React Router, or provide both options (navigate + open in new tab).

**2. Verify the page renders correctly**

The page code itself looks correct. The `breakout_table_assignments` table returns empty results for this session, so tables will show "0 participants" — but the page structure (header, carousel, prompts, timer) should still render.

### Changes

| File | Change |
|------|--------|
| `src/components/WorkspaceNav.tsx` | Change the Present button to use `navigate()` instead of `window.open()`, or add a fallback link |

### Alternative
If the issue is specifically a build/runtime error not visible in current logs, I can use browser tools to navigate directly to the present page and capture the actual error. Would you like me to test the page first before making changes?
