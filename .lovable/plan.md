
## Security & Auth Plan

### Current State
- All admin routes are publicly accessible — no login required
- robots.txt explicitly *allows* all crawlers including Google, Bing, Twitter, Facebook
- PresentationView is a full standalone page (no AdminLayout sidebar) — good, it's already separate
- No auth system exists anywhere in the codebase

### Access Model
```
/login                      → Public (magic link form)
/admin (editing routes)     → Admin only (you, the first user to sign in)
/admin/present/:sessionId   → Any logged-in user (viewers you invite)
/s/:sessionSlug             → Public (attendee view — no login needed)
/                           → Redirect: logged-in → /admin, else → /login
```

---

## Changes

### 1. Database Migration
Create `user_roles` table (never on `profiles` — per security rules):
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Users can read their own role only
CREATE POLICY "users_read_own_role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

A `has_role()` security-definer function and an `assign_initial_role()` RPC function:
- First user to call it → gets `admin`
- All subsequent users → get `viewer`
- No trigger on `auth.users` (reserved schema)

### 2. New: `src/contexts/AuthContext.tsx`
- Wraps the whole app; listens to `onAuthStateChange`
- After auth: calls `assign_initial_role` RPC if user has no role yet, then fetches their role
- Exposes `{ user, isAdmin, loading, signIn, signOut }`

### 3. New: `src/pages/Login.tsx`
- Clean magic-link login page (email field + "Send me a login link" button)
- Two-state UI: form → confirmation ("Check your email")
- Matches app aesthetic (card, Mindshare branding)

### 4. New: `src/components/RequireAuth.tsx` + `RequireAdmin.tsx`
- `RequireAuth`: if not logged in → redirect to `/login`; else render children
- `RequireAdmin`: if not logged in → redirect to `/login`; if logged in but not admin → show "Access Denied" page; else render children

### 5. Update `src/App.tsx`
- Wrap with `AuthProvider`
- Admin editing routes → `<RequireAdmin><AdminLayout/></RequireAdmin>` (no present inside)
- Present route → `<RequireAuth><PresentationView/></RequireAuth>` (separate, outside AdminLayout)
- `/login` → public route
- `/` → smart redirect based on auth state

### 6. Update `src/components/AdminLayout.tsx`
- Add user email display + Logout button to sidebar footer
- Pulls `user` and `signOut` from `useAuth()`

### 7. Block Web Crawlers
**`public/robots.txt`** — disallow all:
```
User-agent: *
Disallow: /
```
**`index.html`** — add noindex meta:
```html
<meta name="robots" content="noindex, nofollow" />
```

---

## Files Changed

| File | Change |
|------|--------|
| DB migration | `user_roles` table, `app_role` enum, `has_role()`, `assign_initial_role()` RPC |
| `src/contexts/AuthContext.tsx` | New — auth state + role management |
| `src/pages/Login.tsx` | New — magic link login page |
| `src/components/RequireAuth.tsx` | New — auth guard |
| `src/components/RequireAdmin.tsx` | New — admin-only guard |
| `src/App.tsx` | Wrap with AuthProvider, protect routes |
| `src/components/AdminLayout.tsx` | Add logout + user display |
| `public/robots.txt` | Disallow all crawlers |
| `index.html` | Add noindex, nofollow meta |

**Note**: The public attendee view `/s/:sessionSlug` remains fully public — no login required for event attendees. The magic link flow means there's no password to manage; you just enter your email and click the link.
