-- ====================================================================
-- Aashvo — Nationwide Marketplace, Family Stays & Progressive Auth Hardening
-- Migration: 20261020000000_nationwide_auth_and_family_stays.sql
-- Version: 1.0.3
-- Status: Verified Defenses (Not applied to live DB during review)
-- ====================================================================

-- 1. NATIONWIDE MARKETPLACE & FAMILY STAY SCHEMA EXTENSIONS
DO $$
BEGIN
  -- Category column on properties ('flats_rooms', 'family_stays')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.properties 
    ADD COLUMN category TEXT NOT NULL DEFAULT 'flats_rooms' 
    CHECK (category IN ('flats_rooms', 'family_stays'));
  END IF;

  -- Nationwide geography columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'state'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN state TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN pincode TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN latitude NUMERIC(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN longitude NUMERIC(10, 7);
  END IF;

  -- Family Stay resident declarations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'family_lives_on_property'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN family_lives_on_property BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Family Stay meal policy declaration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'meals_offered'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN meals_offered TEXT DEFAULT 'none' 
    CHECK (meals_offered IN ('included', 'optional_extra', 'none'));
  END IF;

  -- Email verified column on public.profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. FAMILY STAY ELIGIBILITY CONSTRAINT
-- Commercial managers, non-resident landlords, and brokers are strictly barred from Family Stays
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS chk_family_stay_eligibility;
ALTER TABLE public.properties ADD CONSTRAINT chk_family_stay_eligibility
CHECK (
  category <> 'family_stays' OR (
    category = 'family_stays' AND 
    family_lives_on_property = TRUE AND 
    provider_type = 'owner' AND
    meals_offered IN ('included', 'optional_extra', 'none')
  )
);

-- 3. PROGRESSIVE VERIFICATION INTEGRITY (ANTI-FORGERY TRIGGER)
-- Ensures clients cannot forge phone_verified or email_verified via direct REST updates
CREATE OR REPLACE FUNCTION public.enforce_verification_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent client forgery of phone_verified
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Verification status cannot be mutated by user request. Phone must be verified via cryptographic OTP gateway.';
    END IF;
  END IF;

  -- Prevent client forgery of email_verified
  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Verification status cannot be mutated by user request. Email must be confirmed via Supabase Auth email verification.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_verification_forgery ON public.profiles;
CREATE TRIGGER trg_prevent_verification_forgery
BEFORE UPDATE OF phone_verified, email_verified ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verification_integrity();

-- 4. WORKFLOW-ENFORCED INQUIRY SECURITY
-- Inquiries require authenticated users with verified credentials
CREATE OR REPLACE FUNCTION public.enforce_inquiry_prerequisites()
RETURNS TRIGGER AS $$
DECLARE
  sender_prof RECORD;
BEGIN
  SELECT email_verified, phone_verified INTO sender_prof
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender profile not found.';
  END IF;

  -- Rule: Email verification required before submitting inquiries
  IF sender_prof.email_verified IS NOT TRUE AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unverified email: Please verify your email address before contacting property providers.';
  END IF;

  -- Rule: Phone verification required before submitting inquiries
  IF sender_prof.phone_verified IS NOT TRUE AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unverified phone: Please complete SMS phone verification before contacting property providers.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_inquiry_prerequisites ON public.interest_requests;
CREATE TRIGGER trg_enforce_inquiry_prerequisites
BEFORE INSERT ON public.interest_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inquiry_prerequisites();

-- 5. WORKFLOW-ENFORCED LISTING CREATION (HOST PREREQUISITES)
-- Hosts must have a verified phone number before publishing a listing
CREATE OR REPLACE FUNCTION public.enforce_listing_host_prerequisites()
RETURNS TRIGGER AS $$
DECLARE
  host_prof RECORD;
BEGIN
  SELECT email_verified, phone_verified INTO host_prof
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Host profile not found.';
  END IF;

  IF host_prof.phone_verified IS NOT TRUE AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Host phone verification required: Please verify your phone number via OTP before creating listings.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_listing_host_prerequisites ON public.properties;
CREATE TRIGGER trg_enforce_listing_host_prerequisites
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.enforce_listing_host_prerequisites();

-- 6. LOCATION PRIVACY PUBLIC VIEW
-- Mask exact door/flat numbers from unauthenticated or non-approved viewers
CREATE OR REPLACE VIEW public.public_properties AS
SELECT 
  id,
  owner_id,
  title,
  description,
  category,
  property_type,
  room_type,
  furnishing,
  rent_amount,
  deposit_amount,
  maintenance_charge,
  electricity_rate_per_unit,
  brokerage_fee,
  provider_type,
  family_lives_on_property,
  meals_offered,
  gender_preference,
  bedrooms,
  bathrooms,
  available_from,
  amenities,
  house_rules,
  locality,
  city,
  state,
  pincode,
  status,
  last_availability_check,
  created_at
FROM public.properties
WHERE status = 'active';

GRANT SELECT ON public.public_properties TO anon, authenticated;
