-- Helper: a user is "approved" if they have admin or viewer role
-- We replace the existing "Authenticated users can read" policies with role-aware ones.

-- founder_pool
DROP POLICY IF EXISTS "Authenticated users can read founder_pool" ON public.founder_pool;
CREATE POLICY "Approved users can read founder_pool" ON public.founder_pool
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- lead_pool
DROP POLICY IF EXISTS "Authenticated users can read lead_pool" ON public.lead_pool;
CREATE POLICY "Approved users can read lead_pool" ON public.lead_pool
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- breakout_rsvps
DROP POLICY IF EXISTS "Authenticated users can read breakout_rsvps" ON public.breakout_rsvps;
CREATE POLICY "Approved users can read breakout_rsvps" ON public.breakout_rsvps
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- breakout_table_leads
DROP POLICY IF EXISTS "Authenticated users can read breakout_table_leads" ON public.breakout_table_leads;
CREATE POLICY "Approved users can read breakout_table_leads" ON public.breakout_table_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- match_history
DROP POLICY IF EXISTS "Authenticated users can read match_history" ON public.match_history;
CREATE POLICY "Approved users can read match_history" ON public.match_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- breakout_sessions
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.breakout_sessions;
CREATE POLICY "Approved users can read sessions" ON public.breakout_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- breakout_tables
DROP POLICY IF EXISTS "Authenticated users can read tables" ON public.breakout_tables;
CREATE POLICY "Approved users can read tables" ON public.breakout_tables
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- breakout_briefings
DROP POLICY IF EXISTS "Authenticated users can read breakout_briefings" ON public.breakout_briefings;
CREATE POLICY "Approved users can read breakout_briefings" ON public.breakout_briefings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- prompt_pool
DROP POLICY IF EXISTS "Authenticated users can read prompt_pool" ON public.prompt_pool;
CREATE POLICY "Approved users can read prompt_pool" ON public.prompt_pool
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

-- legacy: breakout_companies, breakout_leads, breakout_table_assignments
DROP POLICY IF EXISTS "Authenticated users can read companies" ON public.breakout_companies;
CREATE POLICY "Approved users can read companies" ON public.breakout_companies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Authenticated users can read leads" ON public.breakout_leads;
CREATE POLICY "Approved users can read leads" ON public.breakout_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Authenticated users can read assignments" ON public.breakout_table_assignments;
CREATE POLICY "Approved users can read assignments" ON public.breakout_table_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));