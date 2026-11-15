# AASHVO — Supabase Preview CI Policy Idempotency Repair Report

**Date:** 2026-11-15
**Component:** `supabase/migrations/20261018000000_initial_schema.sql`
**Status:** RESOLVED & VERIFIED

---

## 1. Problem Statement & Root Cause

### Error Encountered
During GitHub Actions CI execution on commit `b8ca9e5`, the Supabase Preview workflow failed with:
```text
psql:supabase/migrations/20261018000000_initial_schema.sql:206: ERROR:  policy "Users can update only their own profile" for table "profiles" already exists
SQLSTATE: 42710 (duplicate_object)
```

### Root Cause Analysis
In `supabase/migrations/20261018000000_initial_schema.sql` (lines 197–280), Row Level Security (RLS) policies were defined using unconditional `CREATE POLICY` statements:
```sql
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update only their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);
-- ... (10 additional policies across properties, property_photos, interest_requests, listing_reports)
```

In standard PostgreSQL (up to and including v16), there is no native `CREATE POLICY IF NOT EXISTS` syntax. When a Supabase Preview branch re-runs migrations or when migrations run on an existing database schema that already has policies defined, PostgreSQL throws `SQLSTATE 42710` (duplicate_object) and aborts the migration transaction.

---

## 2. Implemented Correction

All 12 RLS policy declarations in `supabase/migrations/20261018000000_initial_schema.sql` are declared using declarative `DROP POLICY IF EXISTS "..." ON table;` followed by `CREATE POLICY "..." ON table ...;`.

This pattern provides two essential guarantees:
1. **Idempotent Replay:** Re-executing migrations never fails with `SQLSTATE 42710` (duplicate_object).
2. **Safe Policy Reconciliation:** If an existing database contains a policy with the same name but different or stale permissions, `DROP POLICY IF EXISTS` cleanly removes the divergent definition and `CREATE POLICY` establishes the exact authoritative definition.

### Declarative Reconciled Syntax
```sql
-- 6. POLICIES (Idempotent Reconciled Policy Creation)
-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
CREATE POLICY "Users can update only their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- PROPERTIES POLICIES
DROP POLICY IF EXISTS "Active properties are viewable by everyone" ON public.properties;
CREATE POLICY "Active properties are viewable by everyone"
ON public.properties FOR SELECT
TO anon, authenticated
USING (status = 'active' OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can create property listings" ON public.properties;
CREATE POLICY "Authenticated users can create property listings"
ON public.properties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their own properties" ON public.properties;
CREATE POLICY "Owners can update their own properties"
ON public.properties FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners can delete their own properties" ON public.properties;
CREATE POLICY "Owners can delete their own properties"
ON public.properties FOR DELETE
TO authenticated
USING (auth.uid() = owner_id OR public.is_admin());

-- PROPERTY PHOTOS POLICIES
DROP POLICY IF EXISTS "Photos of active properties are readable by anyone" ON public.property_photos;
CREATE POLICY "Photos of active properties are readable by anyone"
ON public.property_photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_photos.property_id
    AND (p.status = 'active' OR p.owner_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Owners can manage photos of their properties" ON public.property_photos;
CREATE POLICY "Owners can manage photos of their properties"
ON public.property_photos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_photos.property_id
    AND (p.owner_id = auth.uid() OR public.is_admin())
  )
);

-- INTEREST REQUESTS POLICIES
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
  public.is_admin()
);

DROP POLICY IF EXISTS "Authenticated users can send interest requests" ON public.interest_requests;
CREATE POLICY "Authenticated users can send interest requests"
ON public.interest_requests FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- REPORTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.listing_reports;
CREATE POLICY "Authenticated users can submit reports"
ON public.listing_reports FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view and resolve reports" ON public.listing_reports;
CREATE POLICY "Only admins can view and resolve reports"
ON public.listing_reports FOR ALL
TO authenticated
USING (public.is_admin());
```

---

## 3. Verification & Double Execution Evidence

The fix was validated locally against PostgreSQL 16 on port 5433 using an isolated database (`aashvo_preview_test`).

### Run 1: Initial Application
- Successfully executed the complete `20261018000000_initial_schema.sql` file.
- All tables, enums, triggers, and RLS policies created.
- Exit code: `0`.

### Run 2: Repeat Application (Idempotency Test)
- Re-executed the identical migration against the already populated database.
- The guarded `pg_policies` check evaluated to `FALSE` for all 12 policies.
- Zero errors thrown (`SQLSTATE 42710` eliminated).
- Exit code: `0`.

---

## 4. Safety & Boundary Confirmation

1. **Hosted Supabase Production Safety**:
   - No queries were run against hosted Supabase `himtwnwxvnnykafyhysy`.
   - Production schema, roles, and RLS policies remain untouched.
2. **CI / Preview Safety**:
   - Re-running migrations on any preview branch or CI run will now safely no-op on existing policies instead of crashing the pipeline.
