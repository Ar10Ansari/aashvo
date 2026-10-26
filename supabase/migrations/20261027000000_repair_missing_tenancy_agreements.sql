-- ====================================================================
-- Aashvo — REPAIR MIGRATION: Missing Tenancy Agreements & Dependent Objects
-- Migration: 20261027000000_repair_missing_tenancy_agreements.sql
-- Target Instance: aashvo-dev (Mumbai, ap-south-1)
-- Companion: docs/PRODUCTION_PREFLIGHT_READ_ONLY.sql
--
-- Objective:
--   Fully and idempotently repair hosted Supabase where migrations 06–08
--   partially executed, creating rent_payment_records and rental_disputes
--   while leaving tenancy_agreements uncreated and without foreign keys.
--
-- Operational & Security Guarantees:
--   1. Transactional Atomicity: Entire script is wrapped in BEGIN ... COMMIT.
--   2. Zero Data Loss: Never drops, truncates, or recreates existing tables.
--   3. Idempotent & Re-runnable: Uses CREATE IF NOT EXISTS, DROP IF EXISTS,
--      CREATE OR REPLACE, and ON CONFLICT DO UPDATE throughout.
--   4. Dynamic Foreign Key Integrity: Verifies constraint absence and
--      confirms zero orphan rows before establishing validated FKs.
--   5. Immutability Defenses: Anti-forgery triggers prohibit reassignment of
--      tenancy parties or payment references on UPDATE.
--   6. Least-Privilege Grants: Explicit REVOKE on anon for sensitive tables;
--      strict RLS policies with anti-forgery triggers and search_path hardening.
--   7. Storage Confidentiality: rental-documents bucket is private; access
--      strictly scoped to confirmed tenancy counterparties and admins.
--   8. Automated Post-Repair Assertions: DO block asserts schema completeness
--      and RLS enforcement before final COMMIT.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. STORAGE BUCKET: rental-documents (PRIVATE)
-- Source: Migration 06, lines 9–20
-- ====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-documents',
  'rental-documents',
  false, -- Private bucket: strictly restricted to agreement parties & admins
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

-- ====================================================================
-- 2. CREATE TABLE: tenancy_agreements
-- Source: Migration 06, lines 23–40
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.tenancy_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_rent NUMERIC(10, 2) NOT NULL CHECK (monthly_rent > 0),
  security_deposit NUMERIC(10, 2) NOT NULL CHECK (security_deposit >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  agreement_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (agreement_status IN ('draft', 'active', 'terminated', 'expired')),
  document_url TEXT,
  terms_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_tenancy_distinct_parties CHECK (landlord_id <> tenant_id),
  CONSTRAINT chk_tenancy_date_range CHECK (end_date > start_date)
);

-- ====================================================================
-- 3. CREATE TABLE: property_inspections (if missing)
-- Source: Migration 06, lines 71–86
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.property_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL
    CHECK (inspection_type IN ('move_in', 'move_out', 'interim')),
  conducted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_name TEXT NOT NULL,
  condition_rating TEXT NOT NULL
    CHECK (condition_rating IN ('pristine', 'good', 'fair', 'damaged')),
  damage_notes TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  acknowledged_by_counterparty BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 4. CREATE TABLE: tenancy_reviews (if missing)
-- Source: Migration 07, lines 9–28
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.tenancy_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('tenant', 'landlord')),
  communication_rating INT NOT NULL CHECK (communication_rating BETWEEN 1 AND 5),
  maintenance_rating INT NOT NULL CHECK (maintenance_rating BETWEEN 1 AND 5),
  property_care_rating INT NOT NULL CHECK (property_care_rating BETWEEN 1 AND 5),
  agreement_clarity_rating INT NOT NULL CHECK (agreement_clarity_rating BETWEEN 1 AND 5),
  overall_rating NUMERIC(2, 1) NOT NULL CHECK (overall_rating BETWEEN 1.0 AND 5.0),
  review_title TEXT NOT NULL,
  review_content TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  moderation_status TEXT NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('published', 'flagged', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_unique_agreement_reviewer UNIQUE (agreement_id, reviewer_id),
  CONSTRAINT chk_review_distinct_parties CHECK (reviewer_id <> reviewee_id)
);

-- ====================================================================
-- 5. DYNAMIC FOREIGN KEY CONSTRAINTS (IDEMPOTENT & PREFLIGHT-AWARE)
-- Enforces referential integrity to tenancy_agreements(id) across all
-- 4 dependent tables: rent_payment_records, rental_disputes,
-- property_inspections, and tenancy_reviews.
-- ====================================================================
DO $$
BEGIN
  -- 5.1 FK on rent_payment_records.agreement_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'rent_payment_records'
      AND c.contype = 'f'
      AND c.confrelid = 'public.tenancy_agreements'::regclass
  ) THEN
    -- Verify absence of orphan rows (preflight confirmed 0 rows in production)
    IF NOT EXISTS (
      SELECT 1 FROM public.rent_payment_records rpr
      WHERE rpr.agreement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tenancy_agreements ta WHERE ta.id = rpr.agreement_id)
    ) THEN
      ALTER TABLE public.rent_payment_records DROP CONSTRAINT IF EXISTS rent_payment_records_agreement_id_fkey;
      ALTER TABLE public.rent_payment_records
        ADD CONSTRAINT rent_payment_records_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE;
      RAISE NOTICE 'SUCCESS: Validated FK rent_payment_records_agreement_id_fkey added.';
    ELSE
      ALTER TABLE public.rent_payment_records DROP CONSTRAINT IF EXISTS rent_payment_records_agreement_id_fkey;
      ALTER TABLE public.rent_payment_records
        ADD CONSTRAINT rent_payment_records_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE
        NOT VALID;
      RAISE WARNING 'rent_payment_records contains orphan agreement_id rows; FK added as NOT VALID.';
    END IF;
  ELSE
    RAISE NOTICE 'SKIP: FK on rent_payment_records.agreement_id already established.';
  END IF;

  -- 5.2 FK on rental_disputes.agreement_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'rental_disputes'
      AND c.contype = 'f'
      AND c.confrelid = 'public.tenancy_agreements'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rental_disputes rd
      WHERE rd.agreement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tenancy_agreements ta WHERE ta.id = rd.agreement_id)
    ) THEN
      ALTER TABLE public.rental_disputes DROP CONSTRAINT IF EXISTS rental_disputes_agreement_id_fkey;
      ALTER TABLE public.rental_disputes
        ADD CONSTRAINT rental_disputes_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE;
      RAISE NOTICE 'SUCCESS: Validated FK rental_disputes_agreement_id_fkey added.';
    ELSE
      ALTER TABLE public.rental_disputes DROP CONSTRAINT IF EXISTS rental_disputes_agreement_id_fkey;
      ALTER TABLE public.rental_disputes
        ADD CONSTRAINT rental_disputes_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE
        NOT VALID;
      RAISE WARNING 'rental_disputes contains orphan agreement_id rows; FK added as NOT VALID.';
    END IF;
  ELSE
    RAISE NOTICE 'SKIP: FK on rental_disputes.agreement_id already established.';
  END IF;

  -- 5.3 FK on property_inspections.agreement_id (if table existed previously without FK)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'property_inspections')
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'property_inspections'
      AND c.contype = 'f'
      AND c.confrelid = 'public.tenancy_agreements'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.property_inspections pi
      WHERE pi.agreement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tenancy_agreements ta WHERE ta.id = pi.agreement_id)
    ) THEN
      ALTER TABLE public.property_inspections DROP CONSTRAINT IF EXISTS property_inspections_agreement_id_fkey;
      ALTER TABLE public.property_inspections
        ADD CONSTRAINT property_inspections_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE;
      RAISE NOTICE 'SUCCESS: Validated FK property_inspections_agreement_id_fkey added.';
    ELSE
      ALTER TABLE public.property_inspections DROP CONSTRAINT IF EXISTS property_inspections_agreement_id_fkey;
      ALTER TABLE public.property_inspections
        ADD CONSTRAINT property_inspections_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE
        NOT VALID;
      RAISE WARNING 'property_inspections contains orphan agreement_id rows; FK added as NOT VALID.';
    END IF;
  ELSE
    RAISE NOTICE 'SKIP: FK on property_inspections.agreement_id already established.';
  END IF;

  -- 5.4 FK on tenancy_reviews.agreement_id (if table existed previously without FK)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenancy_reviews')
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'tenancy_reviews'
      AND c.contype = 'f'
      AND c.confrelid = 'public.tenancy_agreements'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenancy_reviews tr
      WHERE tr.agreement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tenancy_agreements ta WHERE ta.id = tr.agreement_id)
    ) THEN
      ALTER TABLE public.tenancy_reviews DROP CONSTRAINT IF EXISTS tenancy_reviews_agreement_id_fkey;
      ALTER TABLE public.tenancy_reviews
        ADD CONSTRAINT tenancy_reviews_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE;
      RAISE NOTICE 'SUCCESS: Validated FK tenancy_reviews_agreement_id_fkey added.';
    ELSE
      ALTER TABLE public.tenancy_reviews DROP CONSTRAINT IF EXISTS tenancy_reviews_agreement_id_fkey;
      ALTER TABLE public.tenancy_reviews
        ADD CONSTRAINT tenancy_reviews_agreement_id_fkey
        FOREIGN KEY (agreement_id) REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE
        NOT VALID;
      RAISE WARNING 'tenancy_reviews contains orphan agreement_id rows; FK added as NOT VALID.';
    END IF;
  ELSE
    RAISE NOTICE 'SKIP: FK on tenancy_reviews.agreement_id already established.';
  END IF;
END $$;

-- ====================================================================
-- 6. PERFORMANCE & LOOKUP INDEXES
-- ====================================================================
-- tenancy_agreements
CREATE INDEX IF NOT EXISTS idx_tenancy_landlord ON public.tenancy_agreements(landlord_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_tenant ON public.tenancy_agreements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_property ON public.tenancy_agreements(property_id);

-- rent_payment_records
CREATE INDEX IF NOT EXISTS idx_payment_agreement ON public.rent_payment_records(agreement_id);
CREATE INDEX IF NOT EXISTS idx_payment_payer ON public.rent_payment_records(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_recipient ON public.rent_payment_records(recipient_id);

-- property_inspections
CREATE INDEX IF NOT EXISTS idx_inspections_agreement ON public.property_inspections(agreement_id);

-- tenancy_reviews
CREATE INDEX IF NOT EXISTS idx_reviews_agreement ON public.tenancy_reviews(agreement_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.tenancy_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.tenancy_reviews(reviewer_id);

-- rental_disputes
CREATE INDEX IF NOT EXISTS idx_disputes_agreement ON public.rental_disputes(agreement_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator ON public.rental_disputes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON public.rental_disputes(respondent_id);

-- ====================================================================
-- 7. SECURITY DEFINER FUNCTIONS & INTEGRITY DEFENSES
-- search_path is strictly locked to public, pg_temp to prevent hijack
-- ====================================================================

-- 7.1 Enforce Tenancy Parties Integrity (Migration 06 + Party Immutability)
CREATE OR REPLACE FUNCTION public.enforce_tenancy_parties_integrity()
RETURNS TRIGGER AS $$
DECLARE
  l_phone BOOLEAN;
BEGIN
  -- Distinct parties check
  IF NEW.landlord_id = NEW.tenant_id THEN
    RAISE EXCEPTION 'Landlord and Tenant must be distinct user accounts.';
  END IF;

  -- Verify landlord phone verification status
  SELECT phone_verified INTO l_phone FROM public.profiles WHERE id = NEW.landlord_id;
  IF l_phone IS NOT TRUE AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Landlord must have verified phone number before creating tenancy agreement.';
  END IF;

  -- Immutability defense: Counterparties cannot be silently reassigned on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.landlord_id IS DISTINCT FROM OLD.landlord_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Privilege escalation rejected: tenancy agreement counterparties cannot be modified after creation.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7.2 Enforce Payment Verification Integrity (Migration 06 + Reference Immutability)
CREATE OR REPLACE FUNCTION public.enforce_payment_verification_integrity()
RETURNS TRIGGER AS $$
DECLARE
  agreement_row RECORD;
BEGIN
  SELECT landlord_id, tenant_id INTO agreement_row
  FROM public.tenancy_agreements
  WHERE id = NEW.agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated tenancy agreement not found.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.payer_id <> auth.uid() AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Payment record must be submitted by the authenticated payer.';
    END IF;

    IF NEW.verification_status = 'confirmed_by_landlord' AND auth.uid() <> agreement_row.landlord_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only the landlord or administrator can confirm rent payments.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Immutability defense: Payer, recipient, and agreement reference cannot be altered
    IF (NEW.agreement_id IS DISTINCT FROM OLD.agreement_id OR
        NEW.payer_id IS DISTINCT FROM OLD.payer_id OR
        NEW.recipient_id IS DISTINCT FROM OLD.recipient_id)
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Privilege escalation rejected: payment record counterparties and agreement reference cannot be altered.';
    END IF;

    -- Verification confirmation defense: Only landlord or admin can mark confirmed
    IF NEW.verification_status = 'confirmed_by_landlord' AND OLD.verification_status <> 'confirmed_by_landlord' THEN
      IF auth.uid() <> agreement_row.landlord_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Privilege escalation rejected: only the landlord can confirm receipt of payment.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7.3 Enforce Tenancy Review Eligibility (Migration 07)
CREATE OR REPLACE FUNCTION public.enforce_review_eligibility()
RETURNS TRIGGER AS $$
DECLARE
  ag_record RECORD;
BEGIN
  SELECT landlord_id, tenant_id, agreement_status INTO ag_record
  FROM public.tenancy_agreements
  WHERE id = NEW.agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy agreement does not exist.';
  END IF;

  IF ag_record.agreement_status = 'draft' THEN
    RAISE EXCEPTION 'Reviews cannot be submitted for draft agreements. Tenancy must be active, expired, or terminated.';
  END IF;

  IF NEW.reviewer_id NOT IN (ag_record.landlord_id, ag_record.tenant_id) THEN
    RAISE EXCEPTION 'Unauthorized: only confirmed tenancy parties can review counterparties.';
  END IF;

  IF NEW.reviewer_id = ag_record.tenant_id THEN
    NEW.reviewer_role := 'tenant';
    NEW.reviewee_id := ag_record.landlord_id;
  ELSE
    NEW.reviewer_role := 'landlord';
    NEW.reviewee_id := ag_record.tenant_id;
  END IF;

  IF NEW.overall_rating IS NULL THEN
    NEW.overall_rating := ROUND(
      (NEW.communication_rating + NEW.maintenance_rating + NEW.property_care_rating + NEW.agreement_clarity_rating)::numeric / 4.0,
      1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7.4 Enforce Rental Dispute Integrity (Migration 07)
CREATE OR REPLACE FUNCTION public.enforce_dispute_integrity()
RETURNS TRIGGER AS $$
DECLARE
  ag_record RECORD;
BEGIN
  SELECT landlord_id, tenant_id INTO ag_record
  FROM public.tenancy_agreements
  WHERE id = NEW.agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated tenancy agreement not found.';
  END IF;

  IF NEW.initiator_id NOT IN (ag_record.landlord_id, ag_record.tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only tenancy parties can initiate a dispute.';
  END IF;

  IF NEW.initiator_id = ag_record.tenant_id THEN
    NEW.respondent_id := ag_record.landlord_id;
  ELSE
    NEW.respondent_id := ag_record.tenant_id;
  END IF;

  IF NEW.dispute_number IS NULL OR NEW.dispute_number = '' THEN
    NEW.dispute_number := 'ASH-DSP-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ====================================================================
-- 8. INTEGRITY TRIGGERS (DROP IF EXISTS + CREATE — IDEMPOTENT)
-- ====================================================================

DROP TRIGGER IF EXISTS trg_enforce_tenancy_parties ON public.tenancy_agreements;
CREATE TRIGGER trg_enforce_tenancy_parties
BEFORE INSERT OR UPDATE ON public.tenancy_agreements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenancy_parties_integrity();

DROP TRIGGER IF EXISTS trg_enforce_payment_integrity ON public.rent_payment_records;
CREATE TRIGGER trg_enforce_payment_integrity
BEFORE INSERT OR UPDATE ON public.rent_payment_records
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_verification_integrity();

DROP TRIGGER IF EXISTS trg_enforce_review_eligibility ON public.tenancy_reviews;
CREATE TRIGGER trg_enforce_review_eligibility
BEFORE INSERT ON public.tenancy_reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_eligibility();

DROP TRIGGER IF EXISTS trg_enforce_dispute_integrity ON public.rental_disputes;
CREATE TRIGGER trg_enforce_dispute_integrity
BEFORE INSERT ON public.rental_disputes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dispute_integrity();

-- ====================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.tenancy_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_disputes ENABLE ROW LEVEL SECURITY;

-- 9.1 Tenancy Agreements RLS (Migration 06)
DROP POLICY IF EXISTS "Agreements viewable only by landlord, tenant, or admin" ON public.tenancy_agreements;
CREATE POLICY "Agreements viewable only by landlord, tenant, or admin"
ON public.tenancy_agreements FOR SELECT
TO authenticated
USING (
  auth.uid() = landlord_id OR
  auth.uid() = tenant_id OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Agreements insertable by authenticated landlord or admin" ON public.tenancy_agreements;
CREATE POLICY "Agreements insertable by authenticated landlord or admin"
ON public.tenancy_agreements FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = landlord_id OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Agreements updatable by landlord, tenant, or admin" ON public.tenancy_agreements;
CREATE POLICY "Agreements updatable by landlord, tenant, or admin"
ON public.tenancy_agreements FOR UPDATE
TO authenticated
USING (
  auth.uid() = landlord_id OR
  auth.uid() = tenant_id OR
  public.is_admin()
);

-- 9.2 Rent Payment Records RLS (Migration 06)
DROP POLICY IF EXISTS "Payment records viewable by agreement parties or admin" ON public.rent_payment_records;
CREATE POLICY "Payment records viewable by agreement parties or admin"
ON public.rent_payment_records FOR SELECT
TO authenticated
USING (
  auth.uid() = payer_id OR
  auth.uid() = recipient_id OR
  EXISTS (
    SELECT 1 FROM public.tenancy_agreements ta
    WHERE ta.id = rent_payment_records.agreement_id
      AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
  ) OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Payment records insertable by agreement parties or admin" ON public.rent_payment_records;
CREATE POLICY "Payment records insertable by agreement parties or admin"
ON public.rent_payment_records FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = payer_id AND EXISTS (
    SELECT 1 FROM public.tenancy_agreements ta
    WHERE ta.id = agreement_id
      AND (ta.tenant_id = auth.uid() OR ta.landlord_id = auth.uid())
  )) OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Payment records updatable by recipient landlord or admin" ON public.rent_payment_records;
CREATE POLICY "Payment records updatable by recipient landlord or admin"
ON public.rent_payment_records FOR UPDATE
TO authenticated
USING (
  auth.uid() = recipient_id OR
  public.is_admin()
);

-- 9.3 Property Inspections RLS (Migration 06)
DROP POLICY IF EXISTS "Inspections viewable by agreement parties or admin" ON public.property_inspections;
CREATE POLICY "Inspections viewable by agreement parties or admin"
ON public.property_inspections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenancy_agreements ta
    WHERE ta.id = property_inspections.agreement_id
      AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
  ) OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Inspections insertable by agreement parties or admin" ON public.property_inspections;
CREATE POLICY "Inspections insertable by agreement parties or admin"
ON public.property_inspections FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = conducted_by AND EXISTS (
    SELECT 1 FROM public.tenancy_agreements ta
    WHERE ta.id = agreement_id
      AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
  )) OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Inspections updatable by agreement parties or admin" ON public.property_inspections;
CREATE POLICY "Inspections updatable by agreement parties or admin"
ON public.property_inspections FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenancy_agreements ta
    WHERE ta.id = property_inspections.agreement_id
      AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
  ) OR
  public.is_admin()
);

-- 9.4 Tenancy Reviews RLS (Migration 07)
DROP POLICY IF EXISTS "Public can view published reviews" ON public.tenancy_reviews;
CREATE POLICY "Public can view published reviews"
ON public.tenancy_reviews FOR SELECT
TO anon, authenticated
USING (
  moderation_status = 'published' OR
  auth.uid() = reviewer_id OR
  auth.uid() = reviewee_id OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Tenancy parties can insert review" ON public.tenancy_reviews;
CREATE POLICY "Tenancy parties can insert review"
ON public.tenancy_reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
);

DROP POLICY IF EXISTS "Admin can moderate reviews" ON public.tenancy_reviews;
CREATE POLICY "Admin can moderate reviews"
ON public.tenancy_reviews FOR UPDATE
TO authenticated
USING (
  public.is_admin()
);

-- 9.5 Rental Disputes RLS (Migration 07)
DROP POLICY IF EXISTS "Disputes viewable by involved parties or admin" ON public.rental_disputes;
CREATE POLICY "Disputes viewable by involved parties or admin"
ON public.rental_disputes FOR SELECT
TO authenticated
USING (
  auth.uid() = initiator_id OR
  auth.uid() = respondent_id OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Tenancy parties can file disputes" ON public.rental_disputes;
CREATE POLICY "Tenancy parties can file disputes"
ON public.rental_disputes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = initiator_id
);

DROP POLICY IF EXISTS "Disputes updatable by parties or admin" ON public.rental_disputes;
CREATE POLICY "Disputes updatable by parties or admin"
ON public.rental_disputes FOR UPDATE
TO authenticated
USING (
  auth.uid() = initiator_id OR
  auth.uid() = respondent_id OR
  public.is_admin()
);

-- ====================================================================
-- 10. STORAGE POLICIES: rental-documents (PRIVATE BUCKET)
-- Source: Migration 06 (base) + Migration 08 (counterparty folder upgrade)
-- ====================================================================

-- 10.1 SELECT: Uploader in user folder, counterparties in agreement folder, or admin
DROP POLICY IF EXISTS "Rental documents accessible by uploader or agreement parties" ON storage.objects;
CREATE POLICY "Rental documents accessible by uploader or agreement parties"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-documents' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    EXISTS (
      SELECT 1 FROM public.tenancy_agreements ta
      WHERE ta.id::text = (storage.foldername(name))[1]
        AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
    )
    OR
    public.is_admin()
  )
);

-- 10.2 INSERT: Uploader to user folder, counterparties to agreement folder, or admin
DROP POLICY IF EXISTS "Rental documents uploadable by authenticated user to own folder" ON storage.objects;
CREATE POLICY "Rental documents uploadable by authenticated user to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rental-documents' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    EXISTS (
      SELECT 1 FROM public.tenancy_agreements ta
      WHERE ta.id::text = (storage.foldername(name))[1]
        AND (ta.landlord_id = auth.uid() OR ta.tenant_id = auth.uid())
    )
    OR
    public.is_admin()
  )
);

-- 10.3 DELETE: Uploader or admin only (counterparties cannot delete each other's files)
DROP POLICY IF EXISTS "Rental documents deletable by owner or admin" ON storage.objects;
CREATE POLICY "Rental documents deletable by owner or admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rental-documents' AND (
    (auth.uid())::text = (storage.foldername(name))[1] OR
    public.is_admin()
  )
);

-- ====================================================================
-- 11. ROLE PERMISSIONS & LEAST-PRIVILEGE GRANTS
-- Strictly restricts anon privileges. Authenticated accounts operate
-- exclusively within RLS boundaries.
-- ====================================================================

-- 11.1 tenancy_agreements
REVOKE ALL ON public.tenancy_agreements FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.tenancy_agreements TO authenticated;
GRANT ALL ON public.tenancy_agreements TO service_role;

-- 11.2 rent_payment_records
REVOKE ALL ON public.rent_payment_records FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.rent_payment_records TO authenticated;
GRANT ALL ON public.rent_payment_records TO service_role;

-- 11.3 property_inspections
REVOKE ALL ON public.property_inspections FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.property_inspections TO authenticated;
GRANT ALL ON public.property_inspections TO service_role;

-- 11.4 tenancy_reviews (anon can read published reviews via RLS)
REVOKE ALL ON public.tenancy_reviews FROM anon;
GRANT SELECT ON public.tenancy_reviews TO anon;
GRANT SELECT, INSERT, UPDATE ON public.tenancy_reviews TO authenticated;
GRANT ALL ON public.tenancy_reviews TO service_role;

-- 11.5 rental_disputes
REVOKE ALL ON public.rental_disputes FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.rental_disputes TO authenticated;
GRANT ALL ON public.rental_disputes TO service_role;

-- ====================================================================
-- 12. POST-REPAIR INTEGRITY ASSERTIONS
-- Validates that all objects exist and are properly secured before
-- committing transaction. If any assertion fails, the transaction aborts.
-- ====================================================================
DO $$
DECLARE
  v_missing TEXT[] := '{}';
BEGIN
  -- Verify all 5 Rental Trust tables exist
  IF to_regclass('public.tenancy_agreements') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tenancy_agreements');
  END IF;
  IF to_regclass('public.property_inspections') IS NULL THEN
    v_missing := array_append(v_missing, 'public.property_inspections');
  END IF;
  IF to_regclass('public.tenancy_reviews') IS NULL THEN
    v_missing := array_append(v_missing, 'public.tenancy_reviews');
  END IF;
  IF to_regclass('public.rent_payment_records') IS NULL THEN
    v_missing := array_append(v_missing, 'public.rent_payment_records');
  END IF;
  IF to_regclass('public.rental_disputes') IS NULL THEN
    v_missing := array_append(v_missing, 'public.rental_disputes');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'POST-REPAIR VALIDATION FAILED: Missing tables: %', array_to_string(v_missing, ', ');
  END IF;

  -- Verify RLS is active on all 5 tables
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('tenancy_agreements', 'rent_payment_records', 'property_inspections', 'tenancy_reviews', 'rental_disputes')
      AND c.relrowsecurity IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'POST-REPAIR VALIDATION FAILED: One or more tables do not have Row Level Security enabled!';
  END IF;

  -- Verify private storage bucket exists
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'rental-documents' AND public = false
  ) THEN
    RAISE EXCEPTION 'POST-REPAIR VALIDATION FAILED: rental-documents private storage bucket is missing or marked public!';
  END IF;

  RAISE NOTICE 'POST-REPAIR ASSERTIONS PASSED: All 5 Rental Trust tables exist, RLS is active, and rental-documents bucket is private.';
END $$;

COMMIT;

-- ====================================================================
-- END OF REPAIR MIGRATION
-- ====================================================================
