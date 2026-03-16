

## Plan: Bulk Lead Import via CSV and Paste on Both Pages

### What to Build

Add two bulk import methods to both the Lead Pool page and the Session Config (breakouts) table leads section:

1. **CSV file upload** (already exists on Lead Pool; needs adding to Session Config table leads)
2. **Paste from clipboard** — a textarea where users can paste tab-separated or comma-separated rows copied from a spreadsheet (e.g. Excel, Google Sheets)

### How It Works

**Paste Import Flow:**
- New "Paste List" button alongside existing "Import CSV" / "Add Lead"
- Opens a dialog with a large textarea and format hint: "Paste rows from a spreadsheet. Expected columns: Name, Company, Title, Email, Website, LinkedIn URL"
- On submit, parse using PapaParse with `header: false` and delimiter detection (tab or comma)
- Show a preview table, then bulk insert

**CSV on Session Config Table Leads:**
- Add an "Import CSV" button next to "Add from Lead Pool" and "Add Lead"
- Reuse the same column mapper + preview pattern from LeadPool
- Map to table lead fields (name, company, title, email, website, linkedin_url, expertise_tags, background)
- Imported leads get added to the session's leads array AND auto-synced to lead_pool

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/LeadPool.tsx` | Add "Paste List" button + dialog with textarea parser, bulk insert to lead_pool |
| `src/pages/admin/SessionConfig.tsx` | Add "Import CSV" button + "Paste List" button for table leads section; CSV uses column mapper; paste uses textarea parser; both auto-sync to lead_pool |
| `src/components/PasteLeadsDialog.tsx` | New shared component: textarea input, PapaParse parsing, preview, returns parsed rows to parent callback |

