-- Create a view that shows public profile information with role
-- This allows the Explore page to filter creators without RLS restrictions
CREATE OR REPLACE VIEW public.public_profiles_with_roles AS
SELECT 
  p.id,
  p.name,
  p.bio,
  p.avatar_url,
  p.banner_url,
  p.social_links,
  p.created_at,
  p.updated_at,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;

-- Grant access to the view
GRANT SELECT ON public.public_profiles_with_roles TO authenticated, anon;
