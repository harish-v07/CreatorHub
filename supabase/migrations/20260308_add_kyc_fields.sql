-- Add KYC fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS kyc_document_url TEXT,
  ADD COLUMN IF NOT EXISTS kyc_document_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_full_name TEXT,
  ADD COLUMN IF NOT EXISTS kyc_mobile TEXT,
  ADD COLUMN IF NOT EXISTS kyc_address TEXT,
  ADD COLUMN IF NOT EXISTS kyc_id_number TEXT;

-- Recreate the view to include these new columns
DROP VIEW IF EXISTS public.public_profiles_with_roles;

CREATE VIEW public.public_profiles_with_roles AS
SELECT
  p.id,
  p.name,
  p.email,
  p.bio,
  p.avatar_url,
  p.banner_url,
  p.social_links,
  p.status,
  p.suspended_until,
  p.show_watermark,
  p.is_verified,
  p.verification_status,
  p.kyc_selfie_url,
  p.kyc_document_url,
  p.kyc_document_type,
  p.kyc_full_name,
  p.kyc_mobile,
  p.kyc_address,
  p.kyc_id_number,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;

-- Grant select to anon and authenticated
GRANT SELECT ON public.public_profiles_with_roles TO anon, authenticated;
