-- ====================================================================
-- Aashvo — Audit Remediation, Schema Completeness & RLS Security Hardening
-- Migration: 20261112000000_audit_remediation_and_rls_fixes.sql
--
-- Forward-only, idempotent remediation migration:
--   1. Adds flatmate_profiles.city and unique user_id constraint for safe upserts
--   2. Enables security_barrier on public discovery views
--   3. Provides SECURITY DEFINER RPCs for guest support ticket creation & replies
--      without weakening SELECT RLS on public.support_tickets or ticket_messages
--   4. Adds missing PostgreSQL foreign-key indexes for JOIN/CASCADE performance
--   5. Adds automatic updated_at triggers on core mutable tables
--
-- Zero destructive SQL: never drops tables, truncates data, or drops columns.
-- ====================================================================

BEGIN;

-- 1. FLATMATE PROFILES SCHEMA ALIGNMENT
ALTER TABLE public.flatmate_profiles
  ADD COLUMN IF NOT EXISTS city TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'flatmate_profiles'
      AND c.conname = 'uq_flatmate_profiles_user_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.flatmate_profiles
      GROUP BY user_id
      HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE public.flatmate_profiles
        ADD CONSTRAINT uq_flatmate_profiles_user_id UNIQUE (user_id);
    ELSE
      RAISE WARNING 'Duplicate user_id rows exist in flatmate_profiles; skipped uq_flatmate_profiles_user_id constraint.';
    END IF;
  END IF;
END $$;

-- Recreate public_flatmates view with security_barrier and city column
DROP VIEW IF EXISTS public.public_flatmates;
CREATE VIEW public.public_flatmates
WITH (security_barrier = true) AS
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
  f.city,
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

REVOKE ALL ON public.public_flatmates FROM PUBLIC;
GRANT SELECT ON public.public_flatmates TO anon, authenticated;
GRANT ALL ON public.public_flatmates TO service_role;

-- Harden security_barrier on existing public discovery views
ALTER VIEW public.public_profiles SET (security_barrier = true);
ALTER VIEW public.public_properties SET (security_barrier = true);

-- 2. SECURE GUEST SUPPORT TICKET CREATION RPC
-- Allows unauthenticated visitors to submit a support ticket and initial message
-- without granting SELECT access on support_tickets or ticket_messages to anon.
CREATE OR REPLACE FUNCTION public.create_guest_support_ticket(
  p_ticket_number TEXT,
  p_user_email TEXT,
  p_user_name TEXT,
  p_user_phone TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'other',
  p_subject TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_reference_listing_id UUID DEFAULT NULL,
  p_reference_user_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_initial_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ticket_number TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket_id UUID;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_subject TEXT;
  v_clean_description TEXT;
  v_clean_ticket_number TEXT;
  v_priority TEXT;
  v_now TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_user_email, '')));
  v_clean_name := TRIM(COALESCE(p_user_name, ''));
  v_clean_subject := TRIM(COALESCE(p_subject, ''));
  v_clean_description := TRIM(COALESCE(p_description, ''));
  v_clean_ticket_number := UPPER(TRIM(COALESCE(p_ticket_number, '')));

  IF v_clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'A valid contact email address is required.';
  END IF;

  IF char_length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Name must be at least 2 characters.';
  END IF;

  IF char_length(v_clean_subject) < 5 THEN
    RAISE EXCEPTION 'Subject must be at least 5 characters.';
  END IF;

  IF char_length(v_clean_description) < 10 THEN
    RAISE EXCEPTION 'Description must be at least 10 characters.';
  END IF;

  IF v_clean_ticket_number = '' THEN
    v_clean_ticket_number := 'ASH-TKT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));
  END IF;

  v_priority := CASE
    WHEN p_priority IN ('low', 'normal', 'high', 'urgent') THEN p_priority
    ELSE 'normal'
  END;

  INSERT INTO public.support_tickets (
    ticket_number,
    user_id,
    user_email,
    user_name,
    user_phone,
    category,
    subject,
    description,
    reference_listing_id,
    reference_user_id,
    priority,
    status,
    attachments,
    created_at,
    updated_at
  ) VALUES (
    v_clean_ticket_number,
    auth.uid(),
    v_clean_email,
    v_clean_name,
    NULLIF(TRIM(COALESCE(p_user_phone, '')), ''),
    p_category,
    v_clean_subject,
    v_clean_description,
    p_reference_listing_id,
    p_reference_user_id,
    v_priority,
    'open',
    '[]'::jsonb,
    v_now,
    v_now
  )
  RETURNING support_tickets.id INTO v_ticket_id;

  IF p_initial_message IS NOT NULL AND char_length(TRIM(p_initial_message)) >= 1 THEN
    INSERT INTO public.ticket_messages (
      ticket_id,
      sender_id,
      sender_name,
      sender_role,
      message,
      is_internal,
      created_at
    ) VALUES (
      v_ticket_id,
      auth.uid(),
      v_clean_name,
      'user',
      TRIM(p_initial_message),
      FALSE,
      v_now
    );
  END IF;

  RETURN QUERY
  SELECT
    st.id,
    st.ticket_number,
    st.status,
    st.priority,
    st.created_at,
    st.updated_at
  FROM public.support_tickets st
  WHERE st.id = v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_support_ticket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_support_ticket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- 3. SECURE GUEST SUPPORT REPLY RPC
-- Requires exact match of ticket_number + user_email, forbids closed tickets and internal notes.
CREATE OR REPLACE FUNCTION public.add_guest_ticket_reply(
  p_ticket_number TEXT,
  p_user_email TEXT,
  p_sender_name TEXT,
  p_message TEXT
)
RETURNS TABLE (
  id UUID,
  ticket_id UUID,
  sender_name TEXT,
  sender_role TEXT,
  message TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket RECORD;
  v_msg_id UUID;
  v_now TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
BEGIN
  IF char_length(TRIM(COALESCE(p_message, ''))) < 1 THEN
    RAISE EXCEPTION 'Reply message cannot be empty.';
  END IF;

  SELECT st.id, st.status, st.user_id, st.user_name
  INTO v_ticket
  FROM public.support_tickets st
  WHERE UPPER(st.ticket_number) = UPPER(TRIM(COALESCE(p_ticket_number, '')))
    AND LOWER(st.user_email) = LOWER(TRIM(COALESCE(p_user_email, '')))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching support ticket not found.';
  END IF;

  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'Closed tickets cannot accept new replies.';
  END IF;

  IF v_ticket.user_id IS NOT NULL AND (auth.uid() IS NULL OR auth.uid() <> v_ticket.user_id) AND NOT public.is_support_admin() THEN
    RAISE EXCEPTION 'Please sign in to reply to this account-owned support ticket.';
  END IF;

  INSERT INTO public.ticket_messages (
    ticket_id,
    sender_id,
    sender_name,
    sender_role,
    message,
    is_internal,
    created_at
  ) VALUES (
    v_ticket.id,
    auth.uid(),
    COALESCE(NULLIF(TRIM(p_sender_name), ''), v_ticket.user_name),
    'user',
    TRIM(p_message),
    FALSE,
    v_now
  )
  RETURNING ticket_messages.id INTO v_msg_id;

  IF v_ticket.status = 'awaiting_user' THEN
    UPDATE public.support_tickets
    SET status = 'in_review', updated_at = v_now
    WHERE support_tickets.id = v_ticket.id;
  ELSE
    UPDATE public.support_tickets
    SET updated_at = v_now
    WHERE support_tickets.id = v_ticket.id;
  END IF;

  RETURN QUERY
  SELECT
    tm.id,
    tm.ticket_id,
    tm.sender_name,
    tm.sender_role,
    tm.message,
    tm.created_at
  FROM public.ticket_messages tm
  WHERE tm.id = v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_guest_ticket_reply(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_guest_ticket_reply(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4. FOREIGN KEY INDEXES FOR PERFORMANCE & CASCADE SAFETY
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON public.property_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_interest_requests_sender_id ON public.interest_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_interest_requests_property_id ON public.interest_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_interest_requests_flatmate_id ON public.interest_requests(target_flatmate_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_property_id ON public.listing_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_reporter_id ON public.listing_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ref_listing ON public.support_tickets(reference_listing_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_safety_reports_flatmate_id ON public.safety_reports(reported_flatmate_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter_id ON public.safety_reports(reporter_id);

-- 5. AUTOMATIC UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_touch_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_properties_touch_updated_at ON public.properties;
CREATE TRIGGER trg_properties_touch_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_tenancy_agreements_touch_updated_at ON public.tenancy_agreements;
CREATE TRIGGER trg_tenancy_agreements_touch_updated_at
BEFORE UPDATE ON public.tenancy_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at();

COMMIT;

