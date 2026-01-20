-- Create course_comments table
CREATE TABLE IF NOT EXISTS public.course_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.course_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_comments_course_id ON public.course_comments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_comments_parent_id ON public.course_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_course_comments_user_id ON public.course_comments(user_id);

-- Enable Row Level Security
ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Comments are viewable by enrolled learners and course creator
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

-- RLS Policy: Enrolled users can create comments
CREATE POLICY "Enrolled users can create comments"
ON public.course_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- User is enrolled in the course
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_comments.course_id 
      AND e.user_id = auth.uid()
    )
    OR
    -- Course is free
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_comments.course_id 
      AND c.is_free = true
    )
    OR
    -- User is the course creator
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_comments.course_id 
      AND c.creator_id = auth.uid()
    )
  )
);

-- RLS Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.course_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own comments, or course creator can delete any
CREATE POLICY "Users can delete own comments or creator can delete any"
ON public.course_comments
FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_comments.course_id 
    AND c.creator_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_course_comments_updated_at 
BEFORE UPDATE ON public.course_comments
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at_column();
