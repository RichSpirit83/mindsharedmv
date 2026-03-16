

## Problem

Your account (`ade.omit@gmail.com`) was created during the earlier magic-link setup with a different password. The password you're entering now doesn't match what's stored. There's also no "Forgot Password" flow to reset it.

Additionally, your user has **no role** in the `user_roles` table, so even after logging in, the `assign_initial_role` function needs to correctly identify you as admin by email (it currently just checks if the table is empty).

## Plan

### 1. Fix `assign_initial_role` to check email
Update the database function so it assigns `admin` to `ade.omit@gmail.com` regardless of whether other users exist, and `pending` to everyone else (matching the original plan).

```sql
IF (SELECT email FROM auth.users WHERE id = auth.uid()) = 'ade.omit@gmail.com' THEN
  _role := 'admin';
ELSE
  _role := 'pending';
END IF;
```

### 2. Add Forgot Password + Reset Password flow
- Add a "Forgot password?" link on the login page that calls `supabase.auth.resetPasswordForEmail()`
- Create a `/reset-password` page that reads the recovery token from the URL and lets the user set a new password via `supabase.auth.updateUser({ password })`
- Add the `/reset-password` route to `App.tsx` as a public route

### 3. Delete stale user so you can re-register cleanly
Since the existing account was created with magic links and has no usable password, create a one-time database function to remove the stale record so you can sign up fresh with email + password. This avoids needing email to be configured for password reset.

### Files Changed

| File | Change |
|------|--------|
| DB migration | Update `assign_initial_role` to check email; one-time cleanup of stale user |
| `src/pages/Login.tsx` | Add "Forgot password?" link |
| `src/pages/ResetPassword.tsx` | New — password reset form |
| `src/App.tsx` | Add `/reset-password` route |

