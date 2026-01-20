-- Update the course-content bucket to be public so media files can be accessed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'course-content';