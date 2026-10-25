-- ====================================================================
-- Aashvo — Rental Trust: Two-Sided Reputation & Rental Dispute Management
-- Migration: 20261024000000_rental_reputation_and_disputes.sql
-- Version: 2.2.0-ReputationDisputes
-- Security: Row Level Security (RLS) & Anti-Forgery Triggers Enabled
-- ====================================================================

-- 1. TWO-SIDED RENTAL REVIEWS TABLE
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

CREATE INDEX IF NOT EXISTS idx_reviews_agreement ON public.tenancy_reviews(agreement_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.tenancy_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.tenancy_reviews(reviewer_id);

-- 2. RENTAL DISPUTES & MEDIATION LEDGER
CREATE TABLE IF NOT EXISTS public.rental_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_number TEXT UNIQUE NOT NULL,
  agreement_id UUID NOT NULL REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  respondent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL
    CHECK (dispute_type IN (
      'security_deposit',
      'unauthorized_deduction',
      'repair_maintenance',
      'agreement_terms',
      'property_damage',
      'privacy_unauthorized_entry',
      'misrepresentation'
    )),
  disputed_amount NUMERIC(10, 2) DEFAULT 0 CHECK (disputed_amount >= 0),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'mediation_in_progress', 'resolved', 'closed', 'appealed')),
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  resolution_summary TEXT,
  assigned_moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT chk_dispute_distinct_parties CHECK (initiator_id <> respondent_id)
);

CREATE INDEX IF NOT EXISTS idx_disputes_agreement ON public.rental_disputes(agreement_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator ON public.rental_disputes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON public.rental_disputes(respondent_id);

-- ====================================================================
-- 3. INTEGRITY & ELIGIBILITY TRIGGERS
-- ====================================================================

-- 3.1 Tenancy Review Eligibility Trigger
CREATE OR REPLACE FUNCTION public.enforce_review_eligibility()
RETURNS TRIGGER AS $$
DECLARE
  ag_record RECORD;
BEGIN
  -- Lookup agreement
  SELECT landlord_id, tenant_id, agreement_status INTO ag_record
  FROM public.tenancy_agreements
  WHERE id = NEW.agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy agreement does not exist.';
  END IF;

  -- Verify tenancy is genuine and confirmed (not draft)
  IF ag_record.agreement_status = 'draft' THEN
    RAISE EXCEPTION 'Reviews cannot be submitted for draft agreements. Tenancy must be active, expired, or terminated.';
  END IF;

  -- Ensure reviewer is a confirmed party on this agreement
  IF NEW.reviewer_id NOT IN (ag_record.landlord_id, ag_record.tenant_id) THEN
    RAISE EXCEPTION 'Unauthorized: only confirmed tenancy parties can review counterparties.';
  END IF;

  -- Ensure reviewee is the opposing party
  IF NEW.reviewer_id = ag_record.tenant_id THEN
    NEW.reviewer_role := 'tenant';
    NEW.reviewee_id := ag_record.landlord_id;
  ELSE
    NEW.reviewer_role := 'landlord';
    NEW.reviewee_id := ag_record.tenant_id;
  END IF;

  -- Calculate overall rating as mathematical average of 4 metrics if not provided
  IF NEW.overall_rating IS NULL THEN
    NEW.overall_rating := ROUND(
      (NEW.communication_rating + NEW.maintenance_rating + NEW.property_care_rating + NEW.agreement_clarity_rating)::numeric / 4.0,
      1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_review_eligibility ON public.tenancy_reviews;
CREATE TRIGGER trg_enforce_review_eligibility
BEFORE INSERT ON public.tenancy_reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_eligibility();

-- 3.2 Dispute Parties & Reference Code Generator Trigger
CREATE OR REPLACE FUNCTION public.enforce_dispute_integrity()
RETURNS TRIGGER AS $$
DECLARE
  ag_record RECORD;
BEGIN
  -- Lookup agreement
  SELECT landlord_id, tenant_id INTO ag_record
  FROM public.tenancy_agreements
  WHERE id = NEW.agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated tenancy agreement does not exist.';
  END IF;

  -- Ensure initiator is a party to the agreement
  IF NEW.initiator_id NOT IN (ag_record.landlord_id, ag_record.tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only tenancy parties can initiate a dispute.';
  END IF;

  -- Assign opposing counterparty as respondent
  IF NEW.initiator_id = ag_record.tenant_id THEN
    NEW.respondent_id := ag_record.landlord_id;
  ELSE
    NEW.respondent_id := ag_record.tenant_id;
  END IF;

  -- Generate unique dispute code if not present
  IF NEW.dispute_number IS NULL OR NEW.dispute_number = '' THEN
    NEW.dispute_number := 'ASH-DSP-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_dispute_integrity ON public.rental_disputes;
CREATE TRIGGER trg_enforce_dispute_integrity
BEFORE INSERT ON public.rental_disputes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dispute_integrity();

-- ====================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.tenancy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_disputes ENABLE ROW LEVEL SECURITY;

-- 4.1 Tenancy Reviews RLS
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

-- 4.2 Rental Disputes RLS
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
