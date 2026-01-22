-- Add show_watermark to public_profiles view
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  name,
  bio,
  avatar_url,
  banner_url,
  social_links,
  show_watermark,
  created_at,
  updated_at
FROM public.profiles;

-- Update public_profiles_with_roles view to include show_watermark
CREATE OR REPLACE VIEW public.public_profiles_with_roles AS
SELECT 
  p.id,
  p.name,
  p.bio,
  p.avatar_url,
  p.banner_url,
  p.social_links,
  p.show_watermark,
  p.created_at,
  p.updated_at,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;
