-- ============================================================
-- Seller Verification System
-- ============================================================

-- 1. Add verification fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 2. RLS: Creators can set their own verification_status to 'pending' (applying)
DO $$ BEGIN
  CREATE POLICY "Creators can apply for verification"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
      verification_status = 'pending'
      AND is_verified = false  -- they cannot self-verify
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Admins can update verification fields (covered by existing "Admins can update any profile" policy)
-- No additional policy needed as the admin policy allows any profile update.

-- 4. Update the public_profiles_with_roles view to include verification fields
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
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;

-- Grant select to anon and authenticated
GRANT SELECT ON public.public_profiles_with_roles TO anon, authenticated;
