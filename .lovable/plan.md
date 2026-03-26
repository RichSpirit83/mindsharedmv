

## Plan: Add "Paste Emails" Button to Pull Leads from Pool

### What
Add a new button in the Table Leads section header that lets the user paste a list of email addresses. The system matches each email against the Lead Pool and auto-populates the full lead profiles for any matches.

### Changes

**New file: `src/components/PasteEmailsDialog.tsx`**
- Dialog with a `Textarea` for pasting emails (one per line, or comma-separated)
- On submit, parse emails, query `lead_pool` for matching records
- Show results: matched leads (with name/company preview) and unmatched emails
- User confirms to add matched leads to the session

**File: `src/pages/admin/SessionConfig.tsx`**
- Add state for the new dialog (`emailPasteDialogOpen`)
- Add a new button in the Table Leads `headerRight` section: `<Mail /> Paste Emails`
- On confirm, add matched leads to the session leads array (same as `addFromPool` logic)
- Sync added leads to lead pool (already in session)

### Flow
1. User clicks "Paste Emails"
2. Pastes email addresses into textarea
3. Clicks "Look Up" — system queries lead_pool by email
4. Shows matched leads (checkable) and any unmatched emails
5. User confirms — leads are added to the session

### Technical Details
- Query: `supabase.from("lead_pool").select("*").in("email", parsedEmails)`
- Reuses existing `addFromPool()` helper to create `TableLead` objects
- Deduplicates against leads already in the session (same check as pool dialog)

| File | Change |
|------|--------|
| `src/components/PasteEmailsDialog.tsx` | New dialog component |
| `src/pages/admin/SessionConfig.tsx` | Add button + dialog integration |

