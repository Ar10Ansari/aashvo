-- ====================================================================
-- Aashvo Migration: 20261026000000_flatmate_profiles_rls_and_anti_forgery.sql
-- Description: Least-Privilege RLS, Public View & Anti-Forgery Defenses for Flatmate Profiles
-- Target Tables: public.flatmate_profiles, public.interest_requests
-- Target Views: public.public_flatmates
-- Version: 2.0.0
-- ====================================================================

-- 1. ROLE GRANTS (LEAST PRIVILEGE)
-- Direct access to base table is restricted to authenticated account owners and service role.
-- Anonymous visitors MUST use public.public_flatmates view and have NO direct base-table privileges.
REVOKE ALL ON public.flatmate_profiles FROM anon;
REVOKE ALL ON public.flatmate_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flatmate_profiles TO authenticated;
GRANT ALL ON public.flatmate_profiles TO service_role;

-- 2. ROW LEVEL SECURITY POLICIES FOR FLATMATE PROFILES BASE TABLE
ALTER TABLE public.flatmate_profiles ENABLE ROW LEVEL SECURITY;

-- 2.1 SELECT Policy: Account owners can read own profile; administrators can read all
DROP POLICY IF EXISTS "Flatmate profiles are viewable by everyone" ON public.flatmate_profiles;
DROP POLICY IF EXISTS "Users can view own flatmate profile or admins view all" ON public.flatmate_profiles;
CREATE POLICY "Users can view own flatmate profile or admins view all"
ON public.flatmate_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- 2.2 INSERT Policy: Authenticated users can insert only their own profile with unverified initial state
DROP POLICY IF EXISTS "Users can insert own flatmate profile" ON public.flatmate_profiles;
CREATE POLICY "Users can insert own flatmate profile"
ON public.flatmate_profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  verified = false
);

-- 2.3 UPDATE Policy: Owners or admins can update profile, but client cannot elevate verification flag
DROP POLICY IF EXISTS "Users can update own flatmate profile" ON public.flatmate_profiles;
CREATE POLICY "Users can update own flatmate profile"
ON public.flatmate_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 2.4 DELETE Policy: Owners or admins can delete flatmate profile
DROP POLICY IF EXISTS "Users can delete own flatmate profile" ON public.flatmate_profiles;
CREATE POLICY "Users can delete own flatmate profile"
ON public.flatmate_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ====================================================================
-- 3. ANTI-FORGERY VERIFICATION TRIGGER FOR FLATMATE PROFILES
-- ====================================================================
CREATE OR REPLACE FUNCTION public.enforce_flatmate_verification_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Administrators can manage flatmate verification status
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Block forgery on INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.verified IS TRUE THEN
      RAISE EXCEPTION 'Privilege escalation rejected: flatmate profile verification status cannot be self-asserted on creation.';
    END IF;
  END IF;

  -- Block forgery on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified THEN
      RAISE EXCEPTION 'Privilege escalation rejected: flatmate profile verification status requires official administrative review.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_flatmate_verification_forgery ON public.flatmate_profiles;
CREATE TRIGGER trg_prevent_flatmate_verification_forgery
BEFORE INSERT OR UPDATE OF verified ON public.flatmate_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_flatmate_verification_integrity();

-- ====================================================================
-- 4. INTEGRITY CONSTRAINT ON INTEREST REQUESTS
-- Ensures an inquiry targets at least a property or a flatmate
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_interest_request_target'
  ) THEN
    ALTER TABLE public.interest_requests
    ADD CONSTRAINT chk_interest_request_target
    CHECK (property_id IS NOT NULL OR target_flatmate_id IS NOT NULL);
  END IF;
END $$;

-- ====================================================================
-- 5. SECURE PUBLIC VIEW FOR FLATMATE DISCOVERY
-- Protects private user contact fields while exposing verified badges & lifestyle
-- Note: user_id is deliberately excluded from public exposure to shield internal auth UUIDs.
-- ====================================================================
DROP VIEW IF EXISTS public.public_flatmates;
CREATE VIEW public.public_flatmates AS
SELECT
  f.id,
  p.full_name,
  p.avatar_url,
  p.id_verified,
  p.phone_verified,
  f.occupation,
  f.age,
  f.gender,
  f.has_room,
  f.room_details,
  f.target_localities,
  f.budget_max,
  f.food_habit,
  f.sleep_routine,
  f.cleanliness,
  f.pet_friendly,
  f.smoking,
  f.bio,
  f.interests,
  f.verified,
  f.created_at
FROM public.flatmate_profiles f
JOIN public.public_profiles p ON p.id = f.user_id;

-- Grant least-privilege SELECT on public view to anon and authenticated
REVOKE ALL ON public.public_flatmates FROM anon;
REVOKE ALL ON public.public_flatmates FROM authenticated;
GRANT SELECT ON public.public_flatmates TO anon, authenticated;
GRANT ALL ON public.public_flatmates TO service_role;
