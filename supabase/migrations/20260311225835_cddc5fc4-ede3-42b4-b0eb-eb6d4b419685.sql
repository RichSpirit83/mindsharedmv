
-- Replace overly permissive RLS policies with auth-based ones

-- breakout_sessions
DROP POLICY IF EXISTS "Allow all access to breakout_sessions" ON public.breakout_sessions;
CREATE POLICY "Authenticated users can read sessions" ON public.breakout_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify sessions" ON public.breakout_sessions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- breakout_companies
DROP POLICY IF EXISTS "Allow all access to breakout_companies" ON public.breakout_companies;
CREATE POLICY "Authenticated users can read companies" ON public.breakout_companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify companies" ON public.breakout_companies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- breakout_leads
DROP POLICY IF EXISTS "Allow all access to breakout_leads" ON public.breakout_leads;
CREATE POLICY "Authenticated users can read leads" ON public.breakout_leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify leads" ON public.breakout_leads
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- breakout_tables
DROP POLICY IF EXISTS "Allow all access to breakout_tables" ON public.breakout_tables;
CREATE POLICY "Authenticated users can read tables" ON public.breakout_tables
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify tables" ON public.breakout_tables
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- breakout_table_assignments
DROP POLICY IF EXISTS "Allow all access to breakout_table_assignments" ON public.breakout_table_assignments;
CREATE POLICY "Authenticated users can read assignments" ON public.breakout_table_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify assignments" ON public.breakout_table_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
