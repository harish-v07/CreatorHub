-- Add lesson_id column to course_comments table
ALTER TABLE public.course_comments
ADD COLUMN lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE;

-- Create index for lesson_id
CREATE INDEX IF NOT EXISTS idx_course_comments_lesson_id ON public.course_comments(lesson_id);

-- Update the RLS policy for viewing comments to include creator access
DROP POLICY IF EXISTS "Comments viewable by enrolled users and creator" ON public.course_comments;

CREATE POLICY "Comments viewable by enrolled users and creator"
ON public.course_comments
FOR SELECT
USING (
  -- User is the course creator
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_comments.course_id 
    AND c.creator_id = auth.uid()
  )
  OR
  -- User is enrolled in the course
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = course_comments.course_id 
    AND e.user_id = auth.uid()
  )
  OR
  -- Course is free (auto-enrollment)
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_comments.course_id 
    AND c.is_free = true
  )
);
