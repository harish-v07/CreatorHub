-- Add is_free field to courses table
ALTER TABLE public.courses ADD COLUMN is_free boolean DEFAULT false NOT NULL;

-- Create storage bucket for course content
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-content',
  'course-content',
  false,
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/wav']
);

-- RLS policies for course-content bucket

-- Creators can upload to their own courses
CREATE POLICY "Creators can upload to own courses"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-content' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.creator_id = auth.uid()
  )
);

-- Creators can update their own course content
CREATE POLICY "Creators can update own course content"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-content' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.creator_id = auth.uid()
  )
);

-- Creators can delete their own course content
CREATE POLICY "Creators can delete own course content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-content' AND
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id::text = (storage.foldername(name))[1]
    AND courses.creator_id = auth.uid()
  )
);

-- Enrolled users or creators can view course content for paid courses
CREATE POLICY "Enrolled users can view course content"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content' AND
  (
    -- Creator of the course
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.creator_id = auth.uid()
    )
    OR
    -- Enrolled in a paid course
    EXISTS (
      SELECT 1 FROM public.courses c
      INNER JOIN public.enrollments e ON c.id = e.course_id
      WHERE c.id::text = (storage.foldername(name))[1]
      AND e.user_id = auth.uid()
      AND c.is_free = false
    )
    OR
    -- Free course - anyone authenticated can view
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.is_free = true
      AND c.status = 'published'
    )
  )
);

-- Update enrollments policies to allow enrollment in free courses
CREATE POLICY "Users can enroll in free courses"
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  (
    -- Either it's a free course
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_id
      AND courses.is_free = true
      AND courses.status = 'published'
    )
    -- Or user has paid (future implementation would check orders table)
  )
);