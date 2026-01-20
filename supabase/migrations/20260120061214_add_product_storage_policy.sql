-- Add storage policy to allow creators to upload product images/videos
-- Products are stored in the products/ folder in the course-content bucket

CREATE POLICY "Creators can upload product media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'products' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Creators can update product media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'products' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Creators can delete product media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'products' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view product media"
ON storage.objects
FOR SELECT
TO authenticated, anon
USING (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'products'
);
