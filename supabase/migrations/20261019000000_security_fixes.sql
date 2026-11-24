-- ====================================================================
-- Aashvo — Security Hardening & Authorization Remediation Migration
-- Version: 1.0.2
-- Date: 2026-10-19
-- Status: Verified Defenses (Not applied to live DB during review)
-- ====================================================================

-- 1. HARDEN SECURITY DEFINER SEARCH PATHS
-- In PostgreSQL, all SECURITY DEFINER functions must lock search_path to prevent hijacking
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. PROFILE ROLE INTEGRITY & PRIVILEGE ESCALATION DEFENSE
-- Prevent unauthorized setting or altering of the role column on both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.enforce_profile_role_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT: regular users cannot register themselves as admin or manager
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'renter'::public.user_role AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Privilege escalation rejected: initial profile role must be renter unless created by an administrator.';
    END IF;
  END IF;

  -- For UPDATE: regular users cannot alter their role
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only administrators can alter account roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_role_integrity();

-- 3. EDITORIAL MODERATION INTEGRITY (DIRECT API BYPASS DEFENSE)
-- Prevent owners from publishing listings directly to 'active' on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.enforce_property_moderation_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting status to 'active', verify actor is admin
  IF NEW.status = 'active' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active') THEN
      IF NOT public.is_admin() THEN
        -- Force pending_review status to ensure editorial review cannot be bypassed
        NEW.status := 'pending_review'::public.moderation_status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_status_bypass ON public.properties;
CREATE TRIGGER trg_prevent_status_bypass
BEFORE INSERT OR UPDATE OF status ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.enforce_property_moderation_integrity();

-- 4. PRIVATE CONTACT PROTECTION & PHONE MASKING
-- Restrict direct SELECT on public.profiles to own record or admin; provide safe public view
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view only own private profile or admins can view all" ON public.profiles;
CREATE POLICY "Users can view only own private profile or admins can view all"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- Secure Public View: Exposes only non-sensitive identity badges (no phone, no email)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  role,
  avatar_url,
  id_verified,
  phone_verified,
  created_at
FROM public.profiles;

-- Grant public view read permissions to anonymous and authenticated users
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 5. FLATMATE INTEREST REQUEST VISIBILITY REMEDIATION
-- Ensure recipient flatmate can view connection requests addressed to them
DROP POLICY IF EXISTS "Users can view their sent or received interest requests" ON public.interest_requests;
CREATE POLICY "Users can view their sent or received interest requests"
ON public.interest_requests FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = interest_requests.property_id AND p.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.flatmate_profiles f
    WHERE f.id = interest_requests.target_flatmate_id AND f.user_id = auth.uid()
  ) OR
  public.is_admin()
);

-- 6. STORAGE BUCKET ISOLATION & OBJECT OWNERSHIP CONTROLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('property-photos', 'property-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('user-avatars', 'user-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Property Photos: Public read access
DROP POLICY IF EXISTS "Property photos are publicly viewable" ON storage.objects;
CREATE POLICY "Property photos are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'property-photos');

-- Property Photos: Scoped upload (user folder)
DROP POLICY IF EXISTS "Authenticated users can upload property photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload property photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Property Photos: Scoped delete (only the uploader or admin can delete)
DROP POLICY IF EXISTS "Users can delete own property photos" ON storage.objects;
CREATE POLICY "Users can delete own property photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-photos' AND 
  (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
);

-- Avatars: Public read access
DROP POLICY IF EXISTS "User avatars are publicly viewable" ON storage.objects;
CREATE POLICY "User avatars are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

-- Avatars: Scoped upload
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatars: Scoped update/delete
DROP POLICY IF EXISTS "Users can manage their own avatar" ON storage.objects;
CREATE POLICY "Users can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'user-avatars' AND 
  (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
);
