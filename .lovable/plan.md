

## Fix: Login screen stuck after password reset

The login page is stuck on "Loading…" because of a race condition in the auth flow. After your password recovery, Supabase fires a `PASSWORD_RECOVERY` / `SIGNED_IN` event, and our `AuthContext` calls the `assign_initial_role` RPC inside the `onAuthStateChange` callback. If that RPC hangs or the event fires before the session is fully restored, `loading` never flips back to `false` — so the Login page renders the "Loading…" state forever and you can't even submit the form.

**Please do NOT share your password.** I never need it — I'll fix the stuck screen directly so you can sign in normally.

### What I'll change

1. **`src/contexts/AuthContext.tsx`** — make auth initialization bulletproof:
   - Set up `onAuthStateChange` listener FIRST, then call `getSession()` (correct Supabase order).
   - Never `await` async work inside the `onAuthStateChange` callback (known deadlock pitfall) — defer the `assign_initial_role` RPC with `setTimeout(..., 0)`.
   - Always flip `loading` to `false` once the initial session check resolves, even if the role fetch is still in flight or fails. Role fetch updates state independently when it returns.
   - Wrap the RPC in try/catch so a transient failure can't freeze the UI.
   - On `SIGNED_OUT`, clear user + role immediately.

2. **`src/pages/Login.tsx`** — defensive timeout:
   - If `loading` is still true after ~3 seconds, show the login form anyway with a small "Session check timed out — try signing in" hint, so you're never trapped on the spinner again.

3. **`src/pages/ResetPassword.tsx`** — no logic change needed; it already handles the recovery event correctly.

### After deploy — what you do

1. Hard refresh the `/login` page (Cmd/Ctrl+Shift+R) to clear any stale session state.
2. Make sure the **Email** tab is selected (not Username) and the **Sign In** sub-tab is active (not Request Access).
3. Enter `ade.omit@gmail.com` and the new password you just set.
4. You'll land on `/admin` and all your data (1 session, 40 companies, 8 tables, 22 leads) will be visible again.

If sign-in still fails with "Invalid login credentials" after the fix, the password reset email link may have expired before you submitted the new password — in that case use "Forgot password" once more, click the fresh link, set a password, and sign in immediately.

### Files touched
- `src/contexts/AuthContext.tsx` (rework init + role fetch)
- `src/pages/Login.tsx` (loading-state safety timeout)

