-- Allow public read access to user_roles table
-- This is needed so the Explore page can filter and display only creators
CREATE POLICY "Anyone can view user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated, anon
  USING (true);
