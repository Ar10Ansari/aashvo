-- ====================================================================
-- Aashvo Authentication Trust-Boundary Test Harness
-- File: docs/test_auth_trust_boundary.sql
-- Status: DISPOSABLE TEST ENVIRONMENT ONLY — NEVER RUN ON PRODUCTION
-- ====================================================================
--
-- PURPOSE:
-- 1. Verifies that public.profiles provisioning works reliably from auth.users.
-- 2. Proves that authenticated clients CANNOT escalate role to admin or mutate verification flags.
-- 3. Proves that client GUC setting cannot bypass anti-forgery defenses.
-- 4. Eliminates false positives by asserting specific PostgreSQL SQLSTATE and SQLERRM messages.
-- 5. Captures real runtime session_user and current_user to verify GoTrue execution identity.
--
-- IMPORTANT DISTINCTION:
-- Part 1 tests the PostgreSQL engine triggers and RLS policies via direct SQL simulation.
-- Part 2 tests genuine GoTrue HTTP authentication endpoints and email confirmation.
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. PREREQUISITE SANITY CHECK
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() NOT LIKE '%test%' AND current_database() NOT LIKE '%disposable%' AND current_database() NOT LIKE '%dev%' AND current_database() NOT LIKE '%postgres%' THEN
    RAISE EXCEPTION 'SAFETY INTERLOCK: This script must only be run against a designated test or disposable database. Current database is: %', current_database();
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 1. TRIGGER IDENTITY AUDIT INSTRUMENTATION
-- Captures runtime execution identity to differentiate manual SQL from GoTrue
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._auth_trigger_audit (
    id SERIAL PRIMARY KEY,
    captured_session_user TEXT NOT NULL,
    captured_current_user TEXT NOT NULL,
    event_op TEXT NOT NULL,
    auth_user_id UUID NOT NULL,
    is_gotrue_api BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public._audit_capture_hook()
RETURNS TRIGGER AS $$
DECLARE
  v_is_gotrue BOOLEAN;
BEGIN
  -- Differentiate real GoTrue execution (connecting as supabase_auth_admin) from manual psql session
  v_is_gotrue := (session_user = 'supabase_auth_admin');

  INSERT INTO public._auth_trigger_audit (
    captured_session_user,
    captured_current_user,
    event_op,
    auth_user_id,
    is_gotrue_api
  ) VALUES (
    session_user,
    current_user,
    TG_OP,
    NEW.id,
    v_is_gotrue
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_auth_users ON auth.users;
CREATE TRIGGER trg_audit_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public._audit_capture_hook();


-- ====================================================================
-- PART 1: POSTGRESQL ENGINE RLS & TRIGGER ISOLATION TESTS (DIRECT SQL)
-- ====================================================================

-- --------------------------------------------------------------------
-- TEST 1: Profile Provisioning on User Creation
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_prof RECORD;
BEGIN
  -- Insert into auth.users (simulating GoTrue user creation)
  INSERT INTO auth.users (
    id, email, raw_user_meta_data, email_confirmed_at, phone_confirmed_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    'renter.verification.test@aashvo.in',
    '{"full_name": "Verified Test User"}'::jsonb,
    NULL,
    NULL,
    NOW(),
    NOW()
  );

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_user_id;

  IF v_prof.id IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: public.profiles row was not created by trigger.';
  END IF;

  IF v_prof.role <> 'renter'::public.user_role THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Initial role was %, expected renter.', v_prof.role;
  END IF;

  IF v_prof.phone_verified IS NOT FALSE OR v_prof.email_verified IS NOT FALSE OR v_prof.id_verified IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Verification flags must be FALSE on initial registration.';
  END IF;

  RAISE NOTICE '>>> TEST 1 PASSED: Unconfirmed user profile provisioned safely.';
END $$;


-- --------------------------------------------------------------------
-- TEST 2: Email Confirmation & Verification Sync
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID;
  v_prof RECORD;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'renter.verification.test@aashvo.in';

  -- Simulate confirmation update on auth.users
  UPDATE auth.users
  SET email_confirmed_at = NOW(), updated_at = NOW()
  WHERE id = v_user_id;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_user_id;

  IF v_prof.email_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 2 FAILED: email_verified was not synchronized to TRUE on email confirmation.';
  END IF;

  RAISE NOTICE '>>> TEST 2 PASSED: Email confirmation synchronized to profile.';
END $$;


-- --------------------------------------------------------------------
-- TEST 3: Phone-Only Signup Resilient Fallback
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_phone_user_id UUID := gen_random_uuid();
  v_prof RECORD;
BEGIN
  -- GoTrue phone-only signup has email = NULL
  INSERT INTO auth.users (
    id, email, phone, raw_user_meta_data, phone_confirmed_at, created_at, updated_at
  ) VALUES (
    v_phone_user_id,
    NULL,
    '+919811122233',
    '{"full_name": "Phone Member"}'::jsonb,
    NOW(),
    NOW(),
    NOW()
  );

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_phone_user_id;

  IF v_prof.id IS NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Phone-only signup profile was not provisioned.';
  END IF;

  IF v_prof.email IS NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Email must not be null (fallback was not applied).';
  END IF;

  IF v_prof.phone_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3 FAILED: phone_verified should be TRUE for confirmed phone.';
  END IF;

  RAISE NOTICE '>>> TEST 3 PASSED: Phone-only signup fallback operates without constraint violation.';
END $$;


-- --------------------------------------------------------------------
-- TEST 4: Authenticated Client Role Escalation Blocked (No False Positives)
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
  v_rejected_for_expected_reason BOOLEAN := FALSE;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_user_id, 'regular.user@aashvo.in', NOW());

  -- Switch role to authenticated to simulate real client
  SET LOCAL ROLE authenticated;
  EXECUTE format('SET LOCAL "request.jwt.claim.sub" = %L', v_user_id::text);
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  BEGIN
    -- Client attempts to alter role to admin
    UPDATE public.profiles SET role = 'admin' WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_sqlstate := SQLSTATE;
    v_err_msg := SQLERRM;

    -- Assert specific failure reason:
    IF v_err_msg LIKE '%Privilege escalation rejected: only administrators can alter account roles%' THEN
      v_rejected_for_expected_reason := TRUE;
    ELSE
      RESET ROLE;
      RAISE EXCEPTION 'TEST 4 FALSE POSITIVE: Update failed for unexpected reason: [%] %', v_err_sqlstate, v_err_msg;
    END IF;
  END;

  RESET ROLE;

  IF NOT v_rejected_for_expected_reason THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Attacker successfully escalated role to admin!';
  END IF;

  RAISE NOTICE '>>> TEST 4 PASSED: Role escalation explicitly rejected with expected security error.';
END $$;


-- --------------------------------------------------------------------
-- TEST 5: Authenticated Client Verification Forgery Blocked (No False Positives)
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_err_msg TEXT;
  v_update_rejected_correctly BOOLEAN := FALSE;
  v_insert_rejected_correctly BOOLEAN := FALSE;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_user_id, 'client.attacker@aashvo.in', NOW());

  SET LOCAL ROLE authenticated;
  EXECUTE format('SET LOCAL "request.jwt.claim.sub" = %L', v_user_id::text);
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  -- 5A: Forgery via UPDATE
  BEGIN
    UPDATE public.profiles SET phone_verified = TRUE WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    IF v_err_msg LIKE '%Privilege escalation rejected: verification status cannot be mutated%' THEN
      v_update_rejected_correctly := TRUE;
    ELSE
      RESET ROLE;
      RAISE EXCEPTION 'TEST 5A FALSE POSITIVE: UPDATE failed for unexpected reason: %', v_err_msg;
    END IF;
  END;

  -- 5B: Forgery via direct INSERT
  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, role, phone_verified, id_verified, email_verified
    ) VALUES (
      v_user_id, 'client.attacker@aashvo.in', 'Attacker', 'renter', TRUE, TRUE, TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    -- Must fail by RLS WITH CHECK policy or trigger anti-forgery
    IF v_err_msg LIKE '%violates row-level security policy%' OR v_err_msg LIKE '%Privilege escalation rejected%' THEN
      v_insert_rejected_correctly := TRUE;
    ELSE
      RESET ROLE;
      RAISE EXCEPTION 'TEST 5B FALSE POSITIVE: INSERT failed for unexpected reason: %', v_err_msg;
    END IF;
  END;

  RESET ROLE;

  IF NOT v_update_rejected_correctly THEN
    RAISE EXCEPTION 'TEST 5A FAILED: Attacker forged phone_verified via UPDATE!';
  END IF;

  IF NOT v_insert_rejected_correctly THEN
    RAISE EXCEPTION 'TEST 5B FAILED: Attacker forged verification flags via direct INSERT!';
  END IF;

  RAISE NOTICE '>>> TEST 5 PASSED: Verification forgery blocked on UPDATE and INSERT with expected error.';
END $$;


-- --------------------------------------------------------------------
-- TEST 6: Client Setting GUC Cannot Bypass Protections (No False Positives)
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_err_msg TEXT;
  v_rejected_correctly BOOLEAN := FALSE;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_user_id, 'guc.tamperer@aashvo.in', NOW());

  SET LOCAL ROLE authenticated;
  EXECUTE format('SET LOCAL "request.jwt.claim.sub" = %L', v_user_id::text);
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  -- Attacker executes set_config to inject transaction-local setting:
  PERFORM set_config('aashvo.auth_context', 'internal_provisioning', true);

  BEGIN
    UPDATE public.profiles SET phone_verified = TRUE WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    IF v_err_msg LIKE '%Privilege escalation rejected: verification status cannot be mutated%' THEN
      v_rejected_correctly := TRUE;
    ELSE
      RESET ROLE;
      RAISE EXCEPTION 'TEST 6 FALSE POSITIVE: UPDATE failed for unexpected reason: %', v_err_msg;
    END IF;
  END;

  RESET ROLE;

  IF NOT v_rejected_correctly THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Client GUC setting bypassed verification protections!';
  END IF;

  RAISE NOTICE '>>> TEST 6 PASSED: Client GUC tampering safely rejected because session_user != supabase_auth_admin.';
END $$;


-- --------------------------------------------------------------------
-- TEST 7: Idempotency & Duplicate Execution Resilience
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_count INT;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_user_id, 'idempotent.test@aashvo.in', NULL);

  -- Simulate multiple trigger invocations (e.g. metadata updates, repeated auth events)
  UPDATE auth.users SET updated_at = NOW() WHERE id = v_user_id;
  UPDATE auth.users SET updated_at = NOW() + INTERVAL '1 second' WHERE id = v_user_id;

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id = v_user_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Duplicate profile rows found for user (count=%)', v_count;
  END IF;

  RAISE NOTICE '>>> TEST 7 PASSED: Idempotent profile provisioning verified without duplicates.';
END $$;


-- ====================================================================
-- PART 2: GENUINE GOTRUE API CLIENT VERIFICATION (HTTP REQUESTS REQUIRED)
-- ====================================================================
--
-- Instructions for running Part 2 against a running Supabase stack:
--
-- 1. Email/Password Signup via GoTrue:
--    curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
--      -H "apikey: <ANON_KEY>" \
--      -H "Content-Type: application/json" \
--      -d '{"email":"api.user@aashvo.in","password":"SecurePassword123!","data":{"full_name":"API User"}}'
--
-- 2. Inspect Audit Log for Real GoTrue Role:
--    SELECT captured_session_user, captured_current_user, is_gotrue_api, auth_user_id
--    FROM public._auth_trigger_audit
--    ORDER BY created_at DESC LIMIT 5;
--
--    EXPECTED RESULT FOR LIVE GOTRUE:
--    captured_session_user = 'supabase_auth_admin'
--    captured_current_user = 'postgres' (SECURITY DEFINER)
--    is_gotrue_api         = true
--
-- 3. Confirm Email:
--    Extract confirmation token from local InBucket mail viewer (http://127.0.0.1:54324)
--    and navigate to confirmation URL or invoke GoTrue verify endpoint.
-- ====================================================================
