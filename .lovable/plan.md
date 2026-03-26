

## Plan: Back Button + Editable Table Names on Presentation View

### Changes

**File: `src/pages/admin/PresentationView.tsx`**

1. **Back button** — Add an `ArrowLeft` icon button in the header (top-left, absolute positioned) that navigates back to `/admin/match/${sessionId}` using `useNavigate`.

2. **Editable table names** — Add an `editingTableId` state. When a user double-clicks a table name (`table_name`), it switches to an inline `<input>` field. On blur or Enter, it saves the updated name to the `breakout_tables` table via Supabase and updates local state. The input is styled to match the dark presentation theme (transparent bg, white text, subtle border).

3. **Add `table_id` to TableDisplay interface** — Need the table's DB `id` to update the correct row. Will store it during the initial data load.

### Technical Details

| Area | Detail |
|------|--------|
| Navigation | `useNavigate` from react-router-dom, `ArrowLeft` from lucide-react |
| Edit trigger | Double-click on table name text |
| Save | `supabase.from("breakout_tables").update({ table_name }).eq("id", tableId)` on blur/Enter |
| State | `editingTableId: string | null`, `editingName: string` |

### Files Modified
- `src/pages/admin/PresentationView.tsx`

