

## Fix: Admin sent to /view instead of /admin

Your account IS admin in the database, confirmed:
```
user_id: 3f7bb5d7-6a36-4042-a9d3-391efccda544
email:   ade.omit@gmail.com
role:    admin
```

But the client is showing the viewer UI. The cause is in `src/contexts/AuthContext.tsx`: when `assign_initial_role` RPC fails or returns unexpectedly, `role` stays `null`, `isAdmin` becomes `false`, and `HomeRedirect` routes you to `/view`. There's no fallback that reads directly from `user_roles`.

### What I'll change

1. **`src/contexts/AuthContext.tsx`** — make role resolution resilient:
   - Replace the single `assign_initial_role` RPC call with a two-step fetch:
     - **Primary**: `SELECT role FROM user_roles WHERE user_id = auth.uid()` (allowed by the existing `users_read_own_role` policy). This is the source of truth and bypasses any RPC quirk.
     - **Fallback**: only if no row exists, call `assign_initial_role` to bootstrap.
   - Log the resolved role + any errors to the console so we can diagnose if it ever happens again.
   - Keep the existing deferred-`setTimeout` pattern and the `loading=false` safety release.

2. **`src/pages/ViewerBreakouts.tsx`** — add a small "Go to admin" link visible only when `isAdmin` is true, as a safety net so an admin who somehow lands on `/view` can click straight through to `/admin` without re-logging in.

### After deploy — what you do

1. Hard-refresh `/view` (Cmd/Ctrl+Shift+R).
2. You'll be auto-redirected to `/admin` (or you can click the new "Go to admin" link).
3. All your data (1 session, 40 companies, 8 tables, 22 leads) will be visible in the admin panel.

### Files touched
- `src/contexts/AuthContext.tsx` — direct `user_roles` query as primary, RPC as fallback, console logging
- `src/pages/ViewerBreakouts.tsx` — defensive "Go to admin" link for admin users

