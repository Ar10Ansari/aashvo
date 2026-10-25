-- ====================================================================
-- Aashvo Migration: 20261022000000_auth_profile_trigger_and_insert_policy.sql
-- Description: Automated Profile Provisioning, Anti-Forgery Defense & Controlled Self-Insert RLS
-- Target: Supabase Auth (auth.users) <-> Public Profiles (public.profiles)
-- Version: 1.0.5 (Hardened: Zero reliance on pg_trigger_depth, strict session_user validation)
-- ====================================================================

-- 1. CONTROLLED PROFILE INSERT POLICY
-- Allows authenticated users to self-insert exclusively their own matching profile record.
-- Strict WITH CHECK guarantees that role is strictly 'renter' and verification flags
-- (phone_verified, id_verified, email_verified) cannot be forged or elevated by the client.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id AND
  role = 'renter'::public.user_role AND
  phone_verified = FALSE AND
  id_verified = FALSE AND
  email_verified = FALSE
);

-- 2. HARMONIZED ANTI-FORGERY VERIFICATION TRIGGER
-- Hardens enforce_verification_integrity against both INSERT and UPDATE manipulation.
-- SECURITY RULE: Does NOT rely on pg_trigger_depth(), which is vulnerable to nested trigger bypass.
-- Instead, requires BOTH explicit internal auth context setting AND an authentic system session_user
-- (supabase_auth_admin or postgres). Untrusted clients connecting via PostgREST (session_user = authenticator)
-- can NEVER satisfy this check, even within cascading triggers.
CREATE OR REPLACE FUNCTION public.enforce_verification_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Explicit internal auth provisioning validation:
  -- Requires BOTH the local transaction setting AND an authorized system session role.
  IF (
    current_setting('aashvo.auth_context', true) = 'internal_provisioning' AND
    session_user IN ('supabase_auth_admin', 'postgres')
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Allow system administrators to manage verification status
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 3. Prevent client forgery on INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.phone_verified IS TRUE THEN
      RAISE EXCEPTION 'Privilege escalation rejected: phone_verified cannot be set on client registration.';
    END IF;
    IF NEW.id_verified IS TRUE THEN
      RAISE EXCEPTION 'Privilege escalation rejected: id_verified cannot be set on client registration.';
    END IF;
    IF NEW.email_verified IS TRUE THEN
      RAISE EXCEPTION 'Privilege escalation rejected: email_verified cannot be set on client registration.';
    END IF;
  END IF;

  -- 4. Prevent client forgery on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Privilege escalation rejected: verification status cannot be mutated by user request. Phone must be verified via cryptographic OTP gateway.';
    END IF;

    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
      RAISE EXCEPTION 'Privilege escalation rejected: verification status cannot be mutated by user request. Email must be confirmed via Supabase Auth email verification.';
    END IF;

    IF NEW.id_verified IS DISTINCT FROM OLD.id_verified THEN
      RAISE EXCEPTION 'Privilege escalation rejected: verification status cannot be mutated by user request. ID verification requires admin review.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_verification_forgery ON public.profiles;
CREATE TRIGGER trg_prevent_verification_forgery
BEFORE INSERT OR UPDATE OF phone_verified, email_verified, id_verified ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verification_integrity();

-- 3. AUTOMATED PROFILE PROVISIONING TRIGGER (handle_new_user)
-- Listens on auth.users for new signups (Email or OAuth) and automatically
-- inserts/upserts corresponding public.profiles row in a single atomic transaction.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_avatar TEXT;
  v_email TEXT;
  v_role public.user_role;
BEGIN
  -- Explicitly set transaction-scoped internal auth context (expires at transaction end)
  PERFORM set_config('aashvo.auth_context', 'internal_provisioning', true);

  -- Safely extract email or construct fallback to prevent NOT NULL violation on public.profiles.email
  v_email := COALESCE(
    NEW.email,
    CASE
      WHEN NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN trim(NEW.phone) || '@phone.aashvo.in'
      ELSE NEW.id::text || '@auth.aashvo.in'
    END
  );

  -- Safely extract user metadata across OAuth (Google) and Email signups
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1),
    'Aashvo Member'
  );
  v_phone := NEW.raw_user_meta_data->>'phone_number';
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Initial role is strictly 'renter' for consumer protection
  v_role := 'renter'::public.user_role;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    role,
    avatar_url,
    phone_verified,
    id_verified,
    email_verified
  ) VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_phone,
    v_role,
    v_avatar,
    COALESCE(NEW.phone_confirmed_at IS NOT NULL, FALSE),
    FALSE,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    phone_verified = CASE
      WHEN EXCLUDED.phone_verified = TRUE THEN TRUE
      ELSE public.profiles.phone_verified
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    full_name = CASE
      WHEN public.profiles.full_name = 'Aashvo Member' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    updated_at = TIMEZONE('utc'::text, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. BIND TRIGGER TO auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE OF email, email_confirmed_at, phone_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. FUNCTION & TABLE PRIVILEGES (PRINCIPLE OF LEAST PRIVILEGE)
-- Ensure authenticated clients can invoke RLS policies without relation-level permission failures
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Revoke execution from PUBLIC, anon, and authenticated to prevent direct PostgREST RPC invocation.
-- Grant execution strictly to internal system roles that manage authentication.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_auth_admin, service_role;
