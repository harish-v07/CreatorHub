-- Add watermark field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN show_watermark boolean NOT NULL DEFAULT false;