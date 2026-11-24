-- ====================================================================
-- Aashvo — Reconcile Profiles View Policy & Ensure Idempotent RLS
-- Version: 1.0.8
-- Date: 2026-11-24
-- Migration: 20261124100000_reconcile_profiles_view_policy.sql
-- Description: Reconcile and guarantee idempotent definition of
--              "Users can view only own private profile or admins can view all"
--              on public.profiles to prevent SQLSTATE 42710 across all branches.
-- ====================================================================

-- 1. Ensure RLS is enabled on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy broad read policy if still present in any branch
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;

-- 3. Idempotently drop and recreate the hardened profile view policy
DROP POLICY IF EXISTS "Users can view only own private profile or admins can view all" ON public.profiles;

CREATE POLICY "Users can view only own private profile or admins can view all"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- 4. Re-grant SELECT on public.profiles to authenticated role
GRANT SELECT ON public.profiles TO authenticated;
