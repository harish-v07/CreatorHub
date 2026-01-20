-- Update products table to support multiple media URLs (images/videos)
-- Change from single image_url to array of media_urls

-- Add new column for media URLs array
ALTER TABLE products 
  ADD COLUMN media_urls TEXT[] DEFAULT '{}';

-- Migrate existing image_url data to media_urls array
UPDATE products 
  SET media_urls = ARRAY[image_url]
  WHERE image_url IS NOT NULL AND image_url != '';

-- Drop old image_url column
ALTER TABLE products DROP COLUMN image_url;
