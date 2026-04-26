# Fix Prompts for mindsharedmv

Sequential prompts to paste into Lovable to bring the existing repo in line with the multi-breakout spec. Run them in order — each builds on the previous.

Read `MINDSHAREDMV_AUDIT.md` first so you understand what's broken and why.

---

## Prompt 1 — Migrate schema to global pools + match history

> The current schema has `breakout_companies` and `breakout_leads` tied to `session_id`, which means founders and leads can't be reused across breakouts. Restructure the schema to support a multi-breakout platform:
>
> Create new global tables:
> - `founder_pool` (id uuid pk, company_name text, first_name text, last_name text, email text, sector jsonb, business_type text, customer_type jsonb, revenue text, capital_raised text, last_round text, icp text, linkedin_url text, raw_data jsonb, mapped_data jsonb, active boolean default true, created_at, updated_at)
> - `lead_pool` (id uuid pk, name text, linkedin_url text, default_stage text, sector_strengths jsonb, bio text, network_strengths text, expertise_tags jsonb, profile_pdf_url text, active boolean default true, created_at, updated_at)
> - `breakout_rsvps` (id uuid pk, breakout_id uuid → breakout_sessions, founder_id uuid → founder_pool, rsvpd boolean default false, attended boolean default false, manual_table_override uuid → breakout_tables, created_at, unique(breakout_id, founder_id))
> - `breakout_table_leads` (id uuid pk, breakout_id uuid → breakout_sessions, lead_id uuid → lead_pool, table_id uuid → breakout_tables, stage text, created_at, unique(breakout_id, lead_id))
> - `match_history` (id uuid pk, founder_id uuid → founder_pool, lead_id uuid → lead_pool, breakout_id uuid → breakout_sessions, table_id uuid → breakout_tables, created_at, unique(founder_id, lead_id, breakout_id))
>
> Migrate existing data:
> - For each row in `breakout_companies`, create or upsert a row in `founder_pool` (deduplicate by Company Name + email), then create a `breakout_rsvps` row linking that founder to the original `session_id` with rsvpd=true.
> - For each row in `breakout_leads`, create or upsert a row in `lead_pool` (deduplicate by name + linkedin_url), then create a `breakout_table_leads` row.
> - For each row in `breakout_table_assignments`, create a `match_history` row connecting the founder to whatever lead is at that table for that breakout.
>
> Keep `breakout_companies`, `breakout_leads`, `breakout_table_assignments` for now (mark as deprecated in a comment) so the existing UI doesn't crash. We'll migrate the UI in subsequent prompts.
>
> Tighten RLS: replace `USING (true) WITH CHECK (true)` with policies that:
> - founder_pool, lead_pool, match_history: admins can read/write, viewers can read only
> - breakout_rsvps, breakout_table_leads: admins can write, viewers can read rows for breakouts they have access to
> Use the existing role check pattern from AuthContext.

---

## Prompt 2 — Update Founder Pool and Lead Pool pages to use global tables

> Update `src/pages/admin/FounderPool.tsx` and `src/pages/admin/LeadPool.tsx` to read from and write to the new `founder_pool` and `lead_pool` tables (not the session-scoped `breakout_companies` / `breakout_leads`).
>
> Add a "Used in N breakouts" badge per row by joining against `breakout_rsvps` (founders) and `breakout_table_leads` (leads).
>
> Add a navigation link in `AdminLayout` for "Founder Pool" and "Lead Pool" at the top level (not nested under a session).
>
> The existing CSV import flow should now upsert into `founder_pool` keyed on (company_name + email). On duplicate, merge non-empty fields rather than overwriting.

---

## Prompt 3 — Implement generate-matches edge function

> Create `supabase/functions/generate-matches/index.ts`. It should:
>
> 1. Accept POST body: `{ breakoutId: string, commit?: boolean }`
> 2. Use the service role key (not the anon key) so it can read across RLS.
> 3. Fetch:
>    - The breakout from `breakout_sessions`
>    - RSVP'd founders for this breakout: `breakout_rsvps` joined to `founder_pool` where `breakout_id = breakoutId AND rsvpd = true`
>    - Tables for this breakout: `breakout_tables` joined to `breakout_table_leads` joined to `lead_pool`
>    - Match history for these founders: `match_history` rows where `founder_id IN (founders we just fetched)`
>
> 4. Classify each founder by stage:
>    - Growth if `revenue ∈ {2M-5M, 6M-10M, 11M-20M}` OR `capital_raised ∈ {6M-10M, 11M-20M, 21M-50M, 51M+}`
>    - Otherwise Early
>
> 5. Build a Map<founderId, Set<leadId>> of prior matches from `match_history`.
>
> 6. Run greedy assignment within each tier:
>    - Sort founders ascending by count of eligible (non-prior-matched) tables in their tier
>    - For each founder, score each table: `score = INF if leadAtTable is in priorMatches; else 1.0 * sectorOverlap + 0.5 * tableLoad + 2.0 * sectorHomogeneity + (1000 if over capacity)`
>      - sectorOverlap = count of already-assigned founders at that table sharing any sector with this founder
>      - tableLoad = count of founders already assigned
>      - sectorHomogeneity = sectorOverlap / max(1, tableLoad)
>    - Pick min-score table. If all tables in tier are prior-matched, allow re-match and add a warning.
>
> 7. If `commit === true`:
>    - Insert rows into `match_history` for each new (founder, lead, breakout, table) tuple
>    - Update `breakout_rsvps.manual_table_override = NULL` so override layer is reset (or skip if you want to preserve overrides)
>
> 8. Return `{ assignments: [{ founderId, tableId, leadId, warnings: string[] }], summary: { total, growthCount, earlyCount, rematchCount } }`
>
> CORS: allow the app's origin. Set Cache-Control: no-store.
>
> In `MatchingWorkspace.tsx`, replace whatever currently runs the matching logic client-side with a call to `supabase.functions.invoke('generate-matches', { body: { breakoutId, commit: false } })`. Add a separate "Save assignments" button that calls it again with `commit: true`.

---

## Prompt 4 — Implement generate-briefing edge function

> Create `supabase/functions/generate-briefing/index.ts`. It should:
>
> 1. Accept POST body: `{ breakoutId: string, leadId?: string }` (if leadId omitted, generate for all leads at this breakout)
> 2. For each (lead, table) pair at this breakout, fetch the founders assigned to that table from `breakout_rsvps.manual_table_override` OR from the latest `match_history` rows for this breakout.
> 3. For each lead, build a markdown briefing with:
>    - Lead's name, role, sector strengths
>    - Founders at their table: company name, founder name, sector, stage, ICP one-liner, revenue/capital band, top challenge from raw_data if present
>    - 3 suggested discussion prompts derived from common challenges or sector overlap
>    - "Has not previously matched with: [list]" — pulled from match_history
> 4. Save the markdown to a new `breakout_briefings` table (create if missing: id, breakout_id, lead_id, markdown, generated_at, unique(breakout_id, lead_id)).
> 5. Return `{ briefings: [{ leadId, leadName, markdown, generatedAt }] }`.
>
> Update `LeadBriefings.tsx` to invoke this function and render the markdown using the existing `react-markdown` dependency. Add an "Export as PDF" button that uses jspdf + html2canvas (already in package.json) to render the briefing for printing.

---

## Prompt 5 — Implement generate-prompts edge function

> Create `supabase/functions/generate-prompts/index.ts`. It should:
>
> 1. Accept POST body: `{ breakoutId: string, tableId?: string }` (if tableId omitted, generate for all tables)
> 2. For each table, fetch the founders assigned + the lead.
> 3. Generate 3–5 discussion prompts per table, tailored to:
>    - The shared challenges across founders (look at raw_data fields like "What are your most critical challenges...")
>    - The lead's sector strengths
>    - The session's `session_format` (deep_dive, peer_advice, etc. from breakout_sessions)
> 4. Save into `breakout_sessions.prompts` jsonb column (already exists), keyed by tableId.
> 5. Return `{ prompts: { [tableId]: string[] } }`.
>
> Add a "Generate Prompts" button in `SessionConfig.tsx` or a new tab in MatchingWorkspace that invokes this and renders the result.

---

## Prompt 6 — Implement manage-users edge function

> Create `supabase/functions/manage-users/index.ts`. It should:
>
> 1. Accept POST body with one of these actions: `{ action: 'invite', email: string, role: 'admin'|'viewer' }`, `{ action: 'remove', userId: string }`, `{ action: 'update_role', userId: string, role: 'admin'|'viewer' }`.
> 2. Use service role key.
> 3. For 'invite': create the user via `supabase.auth.admin.inviteUserByEmail`, then upsert role into the user_roles table (the existing AuthContext should know which table this is — match the existing pattern).
> 4. For 'remove': delete from auth.users.
> 5. For 'update_role': upsert the role.
> 6. Return success/error.
>
> Wire `UserManagement.tsx` to use this. Add proper error toasts via the existing sonner setup.

---

## Prompt 7 — Update MatchingWorkspace to use new pools

> Refactor `src/pages/admin/MatchingWorkspace.tsx`:
>
> 1. Load data from new tables: founders via `breakout_rsvps` joined to `founder_pool` filtered to this breakout where `rsvpd = true`. Tables/leads via `breakout_table_leads` joined to `lead_pool` and `breakout_tables`.
> 2. Replace any client-side matching logic with a call to the `generate-matches` edge function (Prompt 3).
> 3. Drag-and-drop overrides: when a user drags a founder to a different table, write the new `manual_table_override` to the `breakout_rsvps` row for that founder. This persists across viewers, not just localStorage.
> 4. Add a "Reset overrides" button that nullifies all `manual_table_override` for this breakout.
> 5. Add a warning badge on founders whose assignment came from the algorithm's "re-match fallback" (the warnings array from generate-matches).
> 6. Keep the file under 500 lines if possible — extract sub-components into `src/components/matching/`.

---

## Prompt 8 — Public projection page improvements

> Update `src/pages/PublicAttendeeView.tsx` and `src/pages/admin/PresentationView.tsx` to read assignments from the new model:
>
> - Pull `breakout_rsvps` joined to `founder_pool` filtered to this breakout
> - Group by `manual_table_override` first, falling back to the most recent `match_history` row's table_id
> - Render in a clean, projector-friendly layout: large title, table cards with lead name (large), founders listed underneath (Company Name — Founder Name)
> - Auto-refresh every 30 seconds
> - The PublicAttendeeView at `/s/:sessionSlug` should not require any auth and should not query any data the user shouldn't see (no raw_data, no emails, no private notes — only what's needed for the projection).
>
> Make sure the public route works without a signed-in Supabase session — if the table needs auth to read, add a public RLS policy or make the read happen via an edge function with service role.

---

## Prompt 9 — Tighten RLS

> Replace the permissive `USING (true) WITH CHECK (true)` policies on all tables with role-aware policies:
>
> - `founder_pool`, `lead_pool`, `match_history`, `breakout_sessions`, `breakout_tables`, `breakout_table_leads`, `breakout_rsvps`: admins (per existing role check) can SELECT/INSERT/UPDATE/DELETE; viewers can SELECT only; no anon access except for the public projection path.
> - For the public projection: instead of opening RLS, route reads through an edge function (`get-public-breakout`) that uses service role and returns only safe fields.
>
> Test that:
> - A viewer cannot insert rows into founder_pool
> - A viewer cannot modify match_history
> - An anon user cannot read raw_data or emails

---

## Prompt 10 — Cleanup

> 1. Delete the deprecated `breakout_companies`, `breakout_leads`, `breakout_table_assignments` tables once you've verified all data has migrated.
> 2. Update Supabase TypeScript types: run `supabase gen types typescript`.
> 3. Add a `.env` to .gitignore and create `.env.example` with the same VITE_ variable names but blank values.
> 4. Add a README section explaining the data model and how to deploy the edge functions (`supabase functions deploy <name>` for each).
> 5. Run `npm run lint` and fix any errors introduced. Run `npm run test` to make sure nothing's broken.

---

## Order matters

If you only do a few prompts, do them in this order:

1. **Prompt 1 (schema)** — required foundation for everything else
2. **Prompt 3 (generate-matches)** — biggest UX win, fixes the headline broken feature
3. **Prompt 7 (MatchingWorkspace refactor)** — connects the dots
4. **Prompt 8 (public projection)** — polishes the user-facing piece

Prompts 4, 5, 6, 9, 10 are independently runnable in any order after the foundation is in place.
