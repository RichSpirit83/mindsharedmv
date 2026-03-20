

## Plan: Fix Login, Email-Only User Access, and Table Leads Not Loading

### Three issues to fix:

---

### 1. Login Error

Your account (`ade.omit@gmail.com`) exists and is confirmed in the database. The most likely cause is the password not matching what's stored. I'll use the `manage-users` edge function to add a `reset-password` action that lets an admin set a specific password for any user. Then I'll call it to reset your password to `Golf8888!`.

Alternatively, the simpler fix: add a `set-password` action to the edge function so admins can set passwords directly from User Management.

**Changes:**
- `supabase/functions/manage-users/index.ts` — Add a `set-password` action that uses `adminClient.auth.admin.updateUserById()` to set a new password
- `src/pages/admin/UserManagement.tsx` — Add a "Reset Password" button per user row

---

### 2. Add Users Who Login With Just Email (Magic Link)

When an admin adds a user, they should be able to log in without needing a password. I'll implement this by:

- Adding a **magic link login option** on the Login page — users enter their email and receive a login link
- When an admin invites a user via "Add User", the system creates the account (as it does now). The invited user can then use "Sign in with email link" to get a magic link sent to them — no password needed.

**Changes:**
- `src/pages/Login.tsx` — Add a "Sign in with email link" option that calls `supabase.auth.signInWithOtp({ email })` to send a magic link
- `supabase/functions/manage-users/index.ts` — When inviting, also send a magic link email so the user gets an immediate login link

---

### 3. Table Leads Not Loading in Matching Workspace

The `breakout_leads` table is empty (0 rows). The auto-save in `SessionConfig.tsx` deletes all leads then inserts, but the insert has no error handling — if it fails, leads are silently lost.

Root cause: the lead insert at line 290 doesn't check for errors. If the batch fails (payload size, network issue), the delete already ran, and data is gone.

**Changes:**
- `src/pages/admin/SessionConfig.tsx` — Add error handling to the lead save (lines 277-291):
  - Check the delete result for errors and toast on failure
  - Check the insert result for errors and toast on failure  
  - Batch lead inserts (like companies) to avoid payload limits

---

### Summary of File Changes

| File | Change |
|------|--------|
| `supabase/functions/manage-users/index.ts` | Add `set-password` action for admin password resets |
| `src/pages/admin/UserManagement.tsx` | Add "Reset Password" button with password input dialog |
| `src/pages/Login.tsx` | Add magic link sign-in option (`signInWithOtp`) |
| `src/pages/admin/SessionConfig.tsx` | Add error handling + batching to lead save logic |

