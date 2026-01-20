-- Add RLS policy to allow creators to view enrollments for their courses
CREATE POLICY "Creators can view enrollments for own courses"
ON public.enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = enrollments.course_id
    AND courses.creator_id = auth.uid()
  )
);