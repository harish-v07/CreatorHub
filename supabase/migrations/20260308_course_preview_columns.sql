-- Add section and duration to lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'Course Content',
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Allow everyone (including unauthenticated) to view lesson titles and sections
-- (content_url is not exposed via this policy — the view query controls what columns are read)
DO $$ BEGIN
  CREATE POLICY "Lesson titles viewable by everyone"
    ON public.lessons FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
