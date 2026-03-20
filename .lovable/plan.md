

## Plan: Add Sorting to Lead Pool + Founder Participants Page

### 1. Sorting for Lead Pool Table

**File: `src/pages/admin/LeadPool.tsx`**

Add clickable column headers that toggle sort direction (asc/desc/none). State: `sortField` and `sortDir`. Apply sorting to `filteredLeads` via `useMemo` before rendering. Sortable columns: Name, Company, Tags count, Background. Use a small arrow icon indicator on the active sort column.

### 2. Founder Participants Page

Create a new page at `/admin/founders` that displays all companies from `breakout_companies` in a table layout similar to Lead Pool. Each row shows the founder's name, company, sector, stage, revenue, and key metrics extracted from `mapped_data`.

Clicking a founder row opens the existing `FounderProfileDialog` with their `mapped_data`.

**New file: `src/pages/admin/FounderPool.tsx`**
- Query `breakout_companies` table, extract `mapped_data` for display columns
- Table columns: Name (first + last), Company, Sector, Stage, Revenue, Location
- Each row is clickable → opens `FounderProfileDialog`
- Include search/filter input at the top
- Add sorting (same pattern as Lead Pool)
- Show which session each company belongs to (join with `breakout_sessions` for session name)

**File: `src/App.tsx`**
- Add route: `<Route path="founders" element={<FounderPool />} />`

**File: `src/components/AdminLayout.tsx`**
- Add nav item: `{ title: "Founders", url: "/admin/founders", icon: Building2 }`

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/LeadPool.tsx` | Add sort state + clickable column headers with sort indicators |
| `src/pages/admin/FounderPool.tsx` | New page — founder table with search, sort, clickable rows opening FounderProfileDialog |
| `src/App.tsx` | Add `/admin/founders` route |
| `src/components/AdminLayout.tsx` | Add "Founders" nav item |

