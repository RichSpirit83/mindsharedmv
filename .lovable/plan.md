

## Plan: Session Config Refinements + Column Mapping Fix

### Changes Overview

**1. Simplify Session Details** — Remove "Event Start" time field; keep only Breakout Start and Breakout End.

**2. Speed Rounds auto-calculation** — When "Speed Rounds" is selected, auto-calculate the number of rounds and duration per round based on breakout time window and participant count. Display this as a read-only summary (e.g., "3 rounds × 20 min" or "4 rounds × 15 min") instead of hardcoding "3× 20-minute rotations."

**3. Engagement Prompts — Generate or Custom** — Replace the current static prompts section with a toggle: "Generate from data" (AI-generates prompts after CSV upload using aggregated challenges/topics) or "Write your own" (manual entry, current behavior). The "Generate" button calls an AI model with the aggregated `critical_challenges` and `topics_of_interest` from uploaded CSV data to produce 3 tailored prompts.

**4. Fix "Continue to Matching" button** — Currently the button is disabled until CSV + session name are filled, but it doesn't navigate anywhere. Wire it to use `react-router-dom`'s `useNavigate` to go to `/admin/match`, passing session config + CSV data via route state (or a shared context/store).

**5. Update canonical fields and column mapping** — Replace the current `CANONICAL_FIELDS` list with the actual columns from the user's spreadsheet. Implement robust fuzzy matching (normalize, alias-based) so headers like `"Company Name"`, `"Primary Market Served"`, `"Last round raised"`, `"Product / Market Fit?"`, `"# Employees"`, and the long objective column names auto-map correctly. Drop `website` from required fields; add `company_description`, `company_address`, `city`, `state_province`, `zip_postal_code`, `country`, `dmv_area`, `customer_type`, `icp`, `sales_leadership_area`, `additional_info`.

### Technical Details

**File: `src/pages/admin/SessionConfig.tsx`**
- Remove `eventStartTime` state and its UI input
- For speed rounds: compute `totalMinutes = breakoutEnd - breakoutStart`, then derive rounds (e.g., `Math.floor(totalMinutes / 20)`) with a min round duration of 15 min. Show computed info below the format selector.
- Engagement Prompts: add `promptMode` state (`"generate" | "custom"`). When "generate" is clicked post-CSV-upload, call a Lovable AI edge function with aggregated challenges/topics to produce 3 prompts. Show loading state during generation.
- Import `useNavigate` and wire "Continue to Matching →" button's `onClick` to navigate to `/admin/match` with state containing `{ sessionConfig, csvData, columnMapping, leads }`.
- Replace `CANONICAL_FIELDS` with updated list + alias map for fuzzy matching.

**File: `src/components/ColumnMapper.tsx`** — No structural changes needed; it already works with whatever `CANONICAL_FIELDS` are passed.

**New: `supabase/functions/generate-prompts/index.ts`** — Edge function that takes aggregated challenge/topic text and calls a Lovable AI model to generate 3 engagement prompts.

**File: `src/pages/admin/MatchingWorkspace.tsx`** — Read session config from `useLocation().state` so it has access to CSV data and config passed from SessionConfig.

