-- Create table to track completed lessons
CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own lesson completions"
ON public.lesson_completions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own completions
CREATE POLICY "Users can create own lesson completions"
ON public.lesson_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_lesson_completions_user_course ON public.lesson_completions(user_id, course_id);

-- Create function to update enrollment progress
CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_lessons INTEGER;
  completed_lessons INTEGER;
  progress_percentage INTEGER;
BEGIN
  -- Count total lessons in the course
  SELECT COUNT(*) INTO total_lessons
  FROM lessons
  WHERE course_id = NEW.course_id;

  -- Count completed lessons for this user and course
  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_completions
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  -- Calculate progress percentage
  IF total_lessons > 0 THEN
    progress_percentage := (completed_lessons * 100) / total_lessons;
  ELSE
    progress_percentage := 0;
  END IF;

  -- Update enrollment progress
  UPDATE enrollments
  SET progress = progress_percentage
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update progress when lesson is completed
CREATE TRIGGER trigger_update_enrollment_progress
AFTER INSERT ON public.lesson_completions
FOR EACH ROW
EXECUTE FUNCTION public.update_enrollment_progress();