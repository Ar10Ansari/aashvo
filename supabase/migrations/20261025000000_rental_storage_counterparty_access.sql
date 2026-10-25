-- ==============================================================================
-- Aashvo Migration: 20261025000000_rental_storage_counterparty_access.sql
-- Enables Scoped Counterparty Storage Access for Tenancy Agreements
-- ==============================================================================

-- 1. Counterparty SELECT policy for rental-documents
-- Allows access to:
--   a) Uploader in their own user folder: (storage.foldername(name))[1] = auth.uid()::text
--   b) Agreement participants in agreement folder: (storage.foldername(name))[1] = agreement.id
--   c) Platform administrators
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

-- 2. Scoped INSERT policy for rental-documents
-- Allows uploads to:
--   a) Uploader's own folder
--   b) Agreement folder by authenticated landlord or tenant of that agreement
--   c) Platform administrators
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
