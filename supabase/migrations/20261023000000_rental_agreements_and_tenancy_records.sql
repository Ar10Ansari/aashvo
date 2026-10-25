-- ====================================================================
-- Aashvo — Rental Trust: Tenancy Agreements, Payment Records & Property Inspections
-- Migration: 20261023000000_rental_agreements_and_tenancy_records.sql
-- Version: 2.1.0-RentalTrust
-- Security: Row Level Security (RLS) & Anti-Forgery Triggers Enabled
-- ====================================================================

-- 1. STORAGE BUCKET FOR RENTAL DOCUMENTS & INSPECTION EVIDENCE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-documents',
  'rental-documents',
  false, -- Private bucket: strictly restricted to agreement parties
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

-- 2. TENANCY AGREEMENTS TABLE
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

-- Indexing for fast party lookups
CREATE INDEX IF NOT EXISTS idx_tenancy_landlord ON public.tenancy_agreements(landlord_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_tenant ON public.tenancy_agreements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_property ON public.tenancy_agreements(property_id);

-- 3. RENT PAYMENT RECORDS & EVIDENCE TABLE
CREATE TABLE IF NOT EXISTS public.rent_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.tenancy_agreements(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_category TEXT NOT NULL DEFAULT 'rent'
    CHECK (payment_category IN ('rent', 'security_deposit', 'utility', 'maintenance', 'move_out_settlement')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  transaction_reference TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (verification_status IN ('pending_confirmation', 'confirmed_by_landlord', 'disputed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_distinct_parties CHECK (payer_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_agreement ON public.rent_payment_records(agreement_id);
CREATE INDEX IF NOT EXISTS idx_payment_payer ON public.rent_payment_records(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_recipient ON public.rent_payment_records(recipient_id);

-- 4. PROPERTY CONDITION INSPECTIONS (MOVE-IN / MOVE-OUT)
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

CREATE INDEX IF NOT EXISTS idx_inspections_agreement ON public.property_inspections(agreement_id);

-- ====================================================================
-- 5. ANTI-FORGERY & INTEGRITY TRIGGERS
-- ====================================================================

-- 5.1 Enforce Tenancy Parties Verification Integrity
CREATE OR REPLACE FUNCTION public.enforce_tenancy_parties_integrity()
RETURNS TRIGGER AS $$
DECLARE
  l_phone BOOLEAN;
  t_phone BOOLEAN;
BEGIN
  -- Landlord and Tenant cannot be the same account
  IF NEW.landlord_id = NEW.tenant_id THEN
    RAISE EXCEPTION 'Landlord and Tenant must be distinct user accounts.';
  END IF;

  -- Landlord must have phone verified
  SELECT phone_verified INTO l_phone FROM public.profiles WHERE id = NEW.landlord_id;
  IF l_phone IS NOT TRUE AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Landlord must have verified phone number before creating tenancy agreement.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_tenancy_parties ON public.tenancy_agreements;
CREATE TRIGGER trg_enforce_tenancy_parties
BEFORE INSERT OR UPDATE ON public.tenancy_agreements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenancy_parties_integrity();

-- 5.2 Payment Status Forgery Defense
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

  -- On INSERT: Payer must be tenant or landlord, cannot mark confirmed unless landlord or admin
  IF TG_OP = 'INSERT' THEN
    IF NEW.payer_id <> auth.uid() AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Payment record must be submitted by the authenticated payer.';
    END IF;

    -- Tenant cannot create payment already marked 'confirmed_by_landlord'
    IF NEW.verification_status = 'confirmed_by_landlord' AND auth.uid() <> agreement_row.landlord_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only the landlord or administrator can confirm rent payments.';
    END IF;
  END IF;

  -- On UPDATE: Only landlord or admin can mark 'confirmed_by_landlord'
  IF TG_OP = 'UPDATE' THEN
    IF NEW.verification_status = 'confirmed_by_landlord' AND OLD.verification_status <> 'confirmed_by_landlord' THEN
      IF auth.uid() <> agreement_row.landlord_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Privilege escalation rejected: only the landlord can confirm receipt of payment.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_payment_integrity ON public.rent_payment_records;
CREATE TRIGGER trg_enforce_payment_integrity
BEFORE INSERT OR UPDATE ON public.rent_payment_records
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_verification_integrity();

-- ====================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.tenancy_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;

-- 6.1 Tenancy Agreements RLS
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

-- 6.2 Rent Payment Records RLS
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

-- 6.3 Property Inspections RLS
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

-- 6.4 Rental Documents Storage Policies (Private Bucket)
DROP POLICY IF EXISTS "Rental documents accessible by uploader or agreement parties" ON storage.objects;
CREATE POLICY "Rental documents accessible by uploader or agreement parties"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    public.is_admin()
  )
);

DROP POLICY IF EXISTS "Rental documents uploadable by authenticated user to own folder" ON storage.objects;
CREATE POLICY "Rental documents uploadable by authenticated user to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rental-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Rental documents deletable by owner or admin" ON storage.objects;
CREATE POLICY "Rental documents deletable by owner or admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rental-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    public.is_admin()
  )
);
