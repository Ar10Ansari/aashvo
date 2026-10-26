-- ====================================================================
-- Aashvo — Backend Contract Reconciliation
-- Migration: 20261027100000_backend_contract_reconciliation.sql
--
-- Aligns the deployed application contract with the relational schema:
--   * optional family-stay meal pricing
--   * property photo aggregation for public discovery
--   * safety-report target metadata
--   * support-ticket attachment metadata
--   * secure guest support-ticket lookup
--
-- This migration is forward-only and does not remove customer data.
-- ====================================================================

BEGIN;

-- 1. Marketplace fields represented by the application.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS optional_meal_cost NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (optional_meal_cost >= 0);

-- 2. Safety-report fields used for display and evidence references.
ALTER TABLE public.safety_reports
  ADD COLUMN IF NOT EXISTS reported_flatmate_id UUID REFERENCES public.flatmate_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_title TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- 3. Attachment metadata is stored on the ticket; binaries remain in Storage.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Public listing discovery must not expose owner IDs or exact address fields.
DROP VIEW IF EXISTS public.public_properties;
CREATE VIEW public.public_properties AS
SELECT
  p.id,
  p.title,
  p.description,
  p.category,
  p.property_type,
  p.room_type,
  p.furnishing,
  p.rent_amount,
  p.deposit_amount,
  p.maintenance_charge,
  p.electricity_rate_per_unit,
  p.brokerage_fee,
  p.provider_type,
  COALESCE(owner_profile.full_name, 'Verified Provider') AS provider_name,
  p.family_lives_on_property,
  p.meals_offered,
  p.optional_meal_cost,
  p.gender_preference,
  p.bedrooms,
  p.bathrooms,
  p.available_from,
  p.amenities,
  p.house_rules,
  p.locality,
  p.city,
  p.state,
  p.pincode,
  CONCAT(p.locality, ', ', p.city) AS address_short,
  COALESCE(photo_list.images, ARRAY[]::TEXT[]) AS images,
  p.status,
  p.last_availability_check,
  p.created_at
FROM public.properties p
LEFT JOIN public.public_profiles owner_profile ON owner_profile.id = p.owner_id
LEFT JOIN LATERAL (
  SELECT ARRAY_AGG(pp.photo_url ORDER BY pp.sort_order, pp.created_at) AS images
  FROM public.property_photos pp
  WHERE pp.property_id = p.id
) photo_list ON TRUE
WHERE p.status = 'active';

GRANT SELECT ON public.public_properties TO anon, authenticated;

-- 5. Guest support lookup requires both an exact ticket reference and email.
-- The function returns only public ticket messages and is intentionally read-only.
CREATE OR REPLACE FUNCTION public.lookup_support_ticket(
  p_ticket_number TEXT,
  p_user_email TEXT
)
RETURNS TABLE (
  id UUID,
  ticket_number TEXT,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_phone TEXT,
  category TEXT,
  subject TEXT,
  description TEXT,
  reference_listing_id UUID,
  reference_user_id UUID,
  priority TEXT,
  status TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  attachments JSONB,
  messages JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    st.id,
    st.ticket_number,
    NULL::UUID AS user_id,
    st.user_email,
    st.user_name,
    NULL::TEXT AS user_phone,
    st.category,
    st.subject,
    st.description,
    st.reference_listing_id,
    NULL::UUID AS reference_user_id,
    st.priority,
    st.status,
    NULL::UUID AS assigned_to,
    st.created_at,
    st.updated_at,
    st.resolved_at,
    NULL::UUID AS resolved_by,
    '[]'::jsonb AS attachments,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', tm.id,
          'ticket_id', tm.ticket_id,
          'sender_id', NULL,
          'sender_name', tm.sender_name,
          'sender_role', tm.sender_role,
          'message', tm.message,
          'is_internal', FALSE,
          'created_at', tm.created_at
        ) ORDER BY tm.created_at
      ) FILTER (WHERE tm.id IS NOT NULL),
      '[]'::jsonb
    ) AS messages
  FROM public.support_tickets st
  LEFT JOIN public.ticket_messages tm
    ON tm.ticket_id = st.id AND tm.is_internal = FALSE
  WHERE UPPER(st.ticket_number) = UPPER(TRIM(p_ticket_number))
    AND LOWER(st.user_email) = LOWER(TRIM(p_user_email))
  GROUP BY st.id;
$$;

REVOKE ALL ON FUNCTION public.lookup_support_ticket(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_support_ticket(TEXT, TEXT) TO anon, authenticated;

COMMIT;
