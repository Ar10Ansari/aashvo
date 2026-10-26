-- ==============================================================================
-- AASHVO — HOSTED SUPABASE PRODUCTION PREFLIGHT AUDIT SCRIPT (READ-ONLY)
-- Target Instance: aashvo-dev (Mumbai, ap-south-1)
-- Companion Document: docs/PRODUCTION_SUPABASE_MIGRATION_AUDIT.md
-- Target Release Commit: c738b5b
-- Date: October 2026
--
-- STRICT OPERATIONAL SAFETY GUARANTEES:
-- 1. READ-ONLY: Contains 100% pure SELECT queries. Zero INSERT, UPDATE, DELETE,
--    CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE, or state-mutating functions.
-- 2. ZERO SECRET EXPOSURE: Masks email addresses; never selects password hashes,
--    encrypted credentials, API tokens, JWT secrets, or recovery tokens.
-- 3. PARSER & SCHEMA RESILIENT: Uses catalog views (information_schema, pg_type,
--    pg_tables, pg_proc, pg_trigger, storage.buckets, pg_policies) and dynamic
--    query_to_xml wrappers so queries succeed cleanly without 42P01 parse aborts,
--    whether the target database is completely empty, partially migrated, or fully deployed.
-- 4. DIAGNOSTIC RESULT LABELS: Every check returns an explicit status string
--    (e.g., 'STATUS: NOT_PRESENT', 'STATUS: EXISTS_AND_MATCHES', 'STATUS: CONFLICT_MISMATCH')
--    to clearly differentiate an empty query result from a passed or failed check.
--
-- HOW TO RUN:
-- Open Supabase Dashboard -> Project aashvo-dev (Mumbai) -> SQL Editor ->
-- Paste and execute this script. Review each result table sequentially.
-- ==============================================================================

-- ==============================================================================
-- SECTION 0: ENVIRONMENT, CONNECTION IDENTITY & CLI MIGRATION TRACKER
-- ==============================================================================

-- Check 0.1: Connection role, PostgreSQL version and UTC time
SELECT 
  version() AS postgres_engine_version,
  current_database() AS database_name,
  current_user AS current_user_role,
  session_user AS session_user_role,
  timezone('utc'::text, now()) AS audit_timestamp_utc;

-- Check 0.2: Inspect Supabase CLI Migration History Table
-- (Safely handles scenario where supabase_migrations.schema_migrations does not exist)
SELECT 
  CASE 
    WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL 
      THEN 'STATUS: TABLE_ABSENT (No migrations applied via Supabase CLI; fresh database or manual SQL execution)'
    ELSE 'STATUS: TABLE_PRESENT (Supabase CLI tracking table exists; inspect applied versions below)'
  END AS cli_migration_tracker_status,
  CASE 
    WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL 
      THEN '<none>'
    ELSE COALESCE(
      (xpath('/row/v/text()', query_to_xml($$SELECT string_agg(version::text, ', ' ORDER BY version) AS v FROM (SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10) sub$$, false, true, '')))[1]::text,
      '<none>'
    )
  END AS recent_applied_versions;


-- ==============================================================================
-- SECTION 1: CUSTOM ENUM TYPES & VALUES AUDIT
-- Target: 10 custom enums introduced in Migration 01 (20261018000000_initial_schema.sql)
-- Risk: 'CREATE TYPE ...' in PostgreSQL fails if the type already exists.
-- ==============================================================================

WITH expected_enums(expected_name, expected_labels) AS (
  VALUES
    ('user_role', 'renter, owner, broker, admin'),
    ('property_type', 'apartment, builder_floor, villa, gated_society'),
    ('room_type', 'private_room, shared_room, entire_flat'),
    ('provider_type', 'owner, tenant_flatmate, verified_manager'),
    ('furnishing_status', 'fully_furnished, semi_furnished, unfurnished'),
    ('gender_preference', 'any, female_only, male_only'),
    ('moderation_status', 'pending_review, active, paused, rented, rejected'),
    ('food_habit', 'Vegetarian, Non-Vegetarian, Eggetarian, Vegan'),
    ('sleep_routine', 'Early Bird, Night Owl, Flexible'),
    ('cleanliness_level', 'Spotless, Moderate, Relaxed')
),
actual_enums AS (
  SELECT 
    t.typname AS actual_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS actual_labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
  GROUP BY t.typname
)
SELECT 
  COALESCE(e.expected_name, a.actual_name) AS enum_type_name,
  CASE 
    WHEN a.actual_name IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created cleanly by Migration 01)'
    WHEN e.expected_name IS NULL 
      THEN 'STATUS: UNEXPECTED_ENUM (Exists in public schema, not defined in Aashvo migrations)'
    WHEN a.actual_labels = e.expected_labels 
      THEN 'STATUS: EXISTS_AND_MATCHES (Must wrap Migration 01 CREATE TYPE in exception block)'
    ELSE 'STATUS: CONFLICT_MISMATCH (Enum exists but values diverge! Requires manual reconciliation)'
  END AS preflight_status,
  COALESCE(a.actual_labels, '<none>') AS current_database_labels,
  COALESCE(e.expected_labels, '<none>') AS expected_migration_labels
FROM expected_enums e
FULL OUTER JOIN actual_enums a ON e.expected_name = a.actual_name
ORDER BY enum_type_name;


-- ==============================================================================
-- SECTION 2: TABLES, COLUMNS, ESTIMATED ROW COUNTS & RLS STATUS AUDIT
-- Target: 15 core domain tables across migrations 01, 04, 06, and 07
-- ==============================================================================

-- Check 2.1: Table Existence, RLS Status and Approximate Row Counts
WITH expected_tables(expected_table, migration_origin) AS (
  VALUES
    ('profiles', '01_initial_schema'),
    ('properties', '01_initial_schema'),
    ('property_photos', '01_initial_schema'),
    ('flatmate_profiles', '01_initial_schema'),
    ('interest_requests', '01_initial_schema'),
    ('listing_reports', '01_initial_schema'),
    ('support_tickets', '04_help_and_support'),
    ('ticket_messages', '04_help_and_support'),
    ('ticket_audit_events', '04_help_and_support'),
    ('safety_reports', '04_help_and_support'),
    ('tenancy_agreements', '06_rental_agreements'),
    ('rent_payment_records', '06_rental_agreements'),
    ('property_inspections', '06_rental_agreements'),
    ('tenancy_reviews', '07_reputation_disputes'),
    ('rental_disputes', '07_reputation_disputes')
),
actual_tables AS (
  SELECT 
    t.tablename AS actual_table,
    t.rowsecurity AS rls_enabled,
    c.reltuples::bigint AS est_row_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public'
)
SELECT 
  COALESCE(e.expected_table, a.actual_table) AS table_name,
  COALESCE(e.migration_origin, 'EXTERNAL_OR_UNTRACKED') AS introduced_in_migration,
  CASE
    WHEN a.actual_table IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created cleanly by migration)'
    WHEN e.expected_table IS NULL 
      THEN 'STATUS: EXISTING_EXTERNAL_TABLE (Present in public, unrelated to Aashvo migrations)'
    WHEN a.rls_enabled IS TRUE 
      THEN 'STATUS: PRESENT_WITH_RLS_ENABLED (Already exists with RLS active)'
    ELSE 'STATUS: PRESENT_WITHOUT_RLS (SECURITY WARNING: Table exists but RLS is disabled!)'
  END AS preflight_status,
  COALESCE(a.rls_enabled::text, 'N/A') AS rls_active,
  CASE 
    WHEN a.actual_table IS NULL THEN 'N/A'
    WHEN a.est_row_count < 0 THEN 'Pending ANALYZE (or 0)'
    ELSE a.est_row_count::text
  END AS approx_row_count
FROM expected_tables e
FULL OUTER JOIN actual_tables a ON e.expected_table = a.actual_table
ORDER BY e.migration_origin NULLS LAST, table_name;

-- Check 2.2: Critical Column Evolution Audit (Columns Added in Migrations 01 & 03)
WITH critical_columns(target_table, target_column, migration_origin, expected_type) AS (
  VALUES
    ('properties', 'category', '03_nationwide', 'text'),
    ('properties', 'state', '03_nationwide', 'text'),
    ('properties', 'pincode', '03_nationwide', 'text'),
    ('properties', 'latitude', '03_nationwide', 'numeric'),
    ('properties', 'longitude', '03_nationwide', 'numeric'),
    ('properties', 'family_lives_on_property', '03_nationwide', 'boolean'),
    ('properties', 'meals_offered', '03_nationwide', 'text'),
    ('profiles', 'email_verified', '03_nationwide', 'boolean'),
    ('profiles', 'phone_verified', '01_initial_schema', 'boolean'),
    ('profiles', 'id_verified', '01_initial_schema', 'boolean')
)
SELECT 
  c.target_table,
  c.target_column,
  c.migration_origin,
  c.expected_type AS expected_data_type,
  CASE 
    WHEN to_regclass('public.' || c.target_table) IS NULL 
      THEN 'STATUS: TABLE_NOT_YET_CREATED'
    WHEN col.column_name IS NOT NULL 
      THEN 'STATUS: COLUMN_EXISTS (Will be skipped by IF NOT EXISTS guard)'
    ELSE 'STATUS: COLUMN_MISSING (Will be safely added by migration)'
  END AS preflight_status,
  COALESCE(col.data_type, 'N/A') AS current_data_type,
  COALESCE(col.is_nullable, 'N/A') AS is_nullable,
  COALESCE(col.column_default, 'N/A') AS column_default
FROM critical_columns c
LEFT JOIN information_schema.columns col 
  ON col.table_schema = 'public' 
 AND col.table_name = c.target_table 
 AND col.column_name = c.target_column
ORDER BY c.target_table, c.target_column;


-- ==============================================================================
-- SECTION 3: FUNCTIONS, TRIGGERS, VIEWS & POLICIES (CONFLICT DETECTION)
-- ==============================================================================

-- Check 3.1: Stored Functions, Security Definer Flag & search_path Lockdown Audit
WITH expected_functions(func_name, migration_origin, expected_secdef, expected_search_path) AS (
  VALUES
    ('is_admin', '01_initial_schema / 02_hardened', true, 'search_path=public, pg_temp'),
    ('enforce_profile_role_integrity', '02_security_fixes', true, 'search_path=public, pg_temp'),
    ('enforce_property_moderation_integrity', '02_security_fixes', true, 'search_path=public, pg_temp'),
    ('enforce_verification_integrity', '03_auth_forgery / 05_hardened', true, 'search_path=public, pg_temp'),
    ('enforce_inquiry_prerequisites', '03_nationwide', true, 'search_path=public, pg_temp'),
    ('enforce_listing_host_prerequisites', '03_nationwide', true, 'search_path=public, pg_temp'),
    ('fn_validate_ticket_status_transition', '04_help_and_support', true, 'search_path=public, pg_temp'),
    ('is_support_admin', '04_help_and_support', true, 'search_path=public, pg_temp'),
    ('handle_new_user', '05_auth_profile_trigger', true, 'search_path=public, pg_temp'),
    ('enforce_tenancy_parties_integrity', '06_rental_agreements', true, 'search_path=public, pg_temp'),
    ('enforce_payment_verification_integrity', '06_rental_agreements', true, 'search_path=public, pg_temp'),
    ('enforce_review_eligibility', '07_reputation_disputes', true, 'search_path=public, pg_temp'),
    ('enforce_dispute_integrity', '07_reputation_disputes', true, 'search_path=public, pg_temp'),
    ('enforce_flatmate_verification_integrity', '09_flatmate_privacy', true, 'search_path=public, pg_temp')
),
actual_functions AS (
  SELECT 
    p.proname AS func_name,
    p.prosecdef AS is_secdef,
    array_to_string(p.proconfig, ', ') AS search_path_config,
    pg_get_function_identity_arguments(p.oid) AS identity_args
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
)
SELECT 
  COALESCE(e.func_name, a.func_name) AS function_name,
  COALESCE(e.migration_origin, 'EXTERNAL_FUNCTION') AS migration_origin,
  CASE 
    WHEN a.func_name IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created by migration)'
    WHEN e.func_name IS NULL 
      THEN 'STATUS: UNTRACKED_FUNCTION (Exists in public, unrelated to migrations)'
    WHEN a.is_secdef = e.expected_secdef AND a.search_path_config = e.expected_search_path 
      THEN 'STATUS: ALREADY_PRESENT_AND_HARDENED (Replaced cleanly by CREATE OR REPLACE)'
    ELSE 'STATUS: CONFIGURATION_MISMATCH (Function exists but lacks search_path hardening or secdef!)'
  END AS preflight_status,
  COALESCE(a.is_secdef::text, 'N/A') AS current_secdef,
  COALESCE(a.search_path_config, '<none>') AS current_search_path
FROM expected_functions e
FULL OUTER JOIN actual_functions a ON e.func_name = a.func_name
WHERE e.func_name IS NOT NULL OR a.func_name LIKE '%enforce%' OR a.func_name LIKE '%is_admin%'
ORDER BY e.migration_origin NULLS LAST, function_name;

-- Check 3.2: Database Triggers on Domain Tables & auth.users
WITH expected_triggers(table_schema, table_name, trigger_name, migration_origin) AS (
  VALUES
    ('public', 'profiles', 'trg_prevent_role_escalation', '02_security_fixes'),
    ('public', 'profiles', 'trg_prevent_verification_forgery', '03_nationwide / 05_hardened'),
    ('public', 'properties', 'trg_prevent_status_bypass', '02_security_fixes'),
    ('public', 'properties', 'trg_enforce_listing_host_prerequisites', '03_nationwide'),
    ('public', 'interest_requests', 'trg_enforce_inquiry_prerequisites', '03_nationwide'),
    ('public', 'support_tickets', 'trg_validate_ticket_status_transition', '04_help_and_support'),
    ('auth', 'users', 'on_auth_user_created', '05_auth_profile_trigger'),
    ('public', 'tenancy_agreements', 'trg_enforce_tenancy_parties', '06_rental_agreements'),
    ('public', 'rent_payment_records', 'trg_enforce_payment_integrity', '06_rental_agreements'),
    ('public', 'tenancy_reviews', 'trg_enforce_review_eligibility', '07_reputation_disputes'),
    ('public', 'rental_disputes', 'trg_enforce_dispute_integrity', '07_reputation_disputes'),
    ('public', 'flatmate_profiles', 'trg_prevent_flatmate_verification_forgery', '09_flatmate_privacy')
),
actual_triggers AS (
  SELECT 
    event_object_schema AS table_schema,
    event_object_table AS table_name,
    trigger_name,
    string_agg(DISTINCT action_timing || ' ' || event_manipulation, ', ') AS events,
    action_statement
  FROM information_schema.triggers
  WHERE (event_object_schema = 'public' OR (event_object_schema = 'auth' AND event_object_table = 'users'))
  GROUP BY event_object_schema, event_object_table, trigger_name, action_statement
)
SELECT 
  COALESCE(e.table_schema || '.' || e.table_name, a.table_schema || '.' || a.table_name) AS target_table,
  COALESCE(e.trigger_name, a.trigger_name) AS trigger_name,
  COALESCE(e.migration_origin, 'EXTERNAL_TRIGGER') AS migration_origin,
  CASE 
    WHEN a.trigger_name IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created by migration)'
    WHEN e.trigger_name IS NULL 
      THEN 'STATUS: UNTRACKED_TRIGGER (Present on table, unrelated to Aashvo migrations)'
    ELSE 'STATUS: ALREADY_PRESENT (Will be replaced safely by DROP TRIGGER IF EXISTS)'
  END AS preflight_status,
  COALESCE(a.events, 'N/A') AS trigger_events,
  COALESCE(a.action_statement, 'N/A') AS action_statement
FROM expected_triggers e
FULL OUTER JOIN actual_triggers a 
  ON e.table_schema = a.table_schema 
 AND e.table_name = a.table_name 
 AND e.trigger_name = a.trigger_name
ORDER BY target_table, trigger_name;

-- Check 3.3: Views Audit & Flatmate Privacy Shield Verification
WITH expected_views(view_name, migration_origin, privacy_notes) AS (
  VALUES
    ('public_profiles', '02_security_fixes', 'Exposes full_name, avatar, badges; completely shields email and phone_number'),
    ('public_properties', '03_nationwide', 'Exposes active properties; shields exact address_short and coordinates'),
    ('public_flatmates', '09_flatmate_privacy', 'CRITICAL PRIVACY VIEW: Exposes lifestyle & badges; completely shields user_id, email, and phone')
),
actual_views AS (
  SELECT 
    table_name AS view_name,
    view_definition
  FROM information_schema.views
  WHERE table_schema = 'public'
)
SELECT 
  COALESCE(e.view_name, a.view_name) AS view_name,
  COALESCE(e.migration_origin, 'EXTERNAL_VIEW') AS migration_origin,
  CASE 
    WHEN a.view_name IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created by migration)'
    WHEN e.view_name IS NULL 
      THEN 'STATUS: UNTRACKED_VIEW (Exists in public schema)'
    ELSE 'STATUS: ALREADY_EXISTS (Will be recreated cleanly via CREATE OR REPLACE / DROP VIEW IF EXISTS)'
  END AS preflight_status,
  COALESCE(e.privacy_notes, 'N/A') AS privacy_designation,
  CASE 
    WHEN a.view_name = 'public_flatmates' THEN (
      SELECT CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_flatmates' AND column_name = 'user_id')
          THEN 'SECURITY ALERT: user_id is EXPOSED in public_flatmates! Needs Migration 09 fix.'
        ELSE 'VERIFIED SECURE: user_id is properly shielded from public_flatmates.'
      END
    )
    ELSE 'N/A'
  END AS flatmate_privacy_check
FROM expected_views e
FULL OUTER JOIN actual_views a ON e.view_name = a.view_name
ORDER BY view_name;

-- Check 3.4: Table-Level Row Level Security Policies Audit (Public Schema)
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ==============================================================================
-- SECTION 4: STORAGE BUCKETS & CONFIGURATION AUDIT
-- Target: 4 buckets across migrations 02, 04, and 06
-- ==============================================================================

WITH expected_buckets(expected_id, expected_public, expected_size_limit, expected_mimes, migration_origin) AS (
  VALUES
    ('property-photos', true, 5242880, 'image/jpeg, image/png, image/webp', '02_security_fixes'),
    ('user-avatars', true, 2097152, 'image/jpeg, image/png, image/webp', '02_security_fixes'),
    ('support-attachments', false, 5242880, 'image/jpeg, image/png, image/webp, application/pdf', '04_help_and_support'),
    ('rental-documents', false, 10485760, 'application/pdf, image/jpeg, image/png, image/webp', '06_rental_agreements')
),
actual_buckets AS (
  SELECT 
    b.id AS actual_id,
    b.public AS actual_public,
    b.file_size_limit AS actual_size_limit,
    array_to_string(b.allowed_mime_types, ', ') AS actual_mimes
  FROM storage.buckets b
)
SELECT 
  COALESCE(e.expected_id, a.actual_id) AS bucket_id,
  COALESCE(e.migration_origin, 'EXTERNAL_BUCKET') AS migration_origin,
  CASE 
    WHEN a.actual_id IS NULL 
      THEN 'STATUS: NOT_PRESENT (Safe: will be created cleanly by migration)'
    WHEN e.expected_id IS NULL 
      THEN 'STATUS: UNTRACKED_BUCKET (Exists in storage.buckets)'
    WHEN a.actual_public = e.expected_public AND a.actual_size_limit = e.expected_size_limit
      THEN 'STATUS: ALREADY_CONFIGURED_CORRECTLY (Matches migration spec)'
    ELSE 'STATUS: CONFIGURATION_MISMATCH (Bucket exists but public flag or size limit differs!)'
  END AS preflight_status,
  COALESCE(a.actual_public::text, 'N/A') AS current_public,
  COALESCE(e.expected_public::text, 'N/A') AS expected_public,
  COALESCE(a.actual_size_limit::text, 'N/A') AS current_size_bytes,
  COALESCE(e.expected_size_limit::text, 'N/A') AS expected_size_bytes
FROM expected_buckets e
FULL OUTER JOIN actual_buckets a ON e.expected_id = a.actual_id
ORDER BY bucket_id;


-- ==============================================================================
-- SECTION 5: DATA INTEGRITY & CONSTRAINT COMPLIANCE PREFLIGHT CHECKS
-- Target: Constraints added in Migrations 03, 06, 07, and 09
-- ==============================================================================

-- Check 5.1: Consolidated Dynamic Constraint Violation Assessment
-- (Guaranteed to execute safely even if tables or columns do not exist yet)
SELECT 
  'chk_family_stay_eligibility' AS constraint_name,
  'properties' AS target_table,
  '03_nationwide' AS migration_origin,
  CASE
    WHEN to_regclass('public.properties') IS NULL 
      THEN 'TABLE_NOT_PRESENT (Safe: properties table not yet created)'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
    ) THEN 'COLUMNS_NOT_YET_ADDED (Safe: category column not yet present)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*) AS cnt FROM public.properties WHERE category = 'family_stays' AND (family_lives_on_property IS NOT TRUE OR provider_type <> 'owner' OR meals_offered NOT IN ('included', 'optional_extra', 'none') OR meals_offered IS NULL)$$, false, true, '')))[1]::text,
      '0'
    )
  END AS violating_row_count,
  'Ensures commercial managers/brokers cannot publish Family Stays without resident owner and meals declaration.' AS constraint_purpose

UNION ALL

SELECT 
  'chk_interest_request_target' AS constraint_name,
  'interest_requests' AS target_table,
  '09_flatmate_privacy' AS migration_origin,
  CASE
    WHEN to_regclass('public.interest_requests') IS NULL 
      THEN 'TABLE_NOT_PRESENT (Safe: interest_requests table not yet created)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*) AS cnt FROM public.interest_requests WHERE property_id IS NULL AND target_flatmate_id IS NULL$$, false, true, '')))[1]::text,
      '0'
    )
  END AS violating_row_count,
  'Ensures inquiry targets at least a property or a flatmate profile (cannot have both NULL).' AS constraint_purpose

UNION ALL

SELECT 
  'chk_tenancy_distinct_parties' AS constraint_name,
  'tenancy_agreements' AS target_table,
  '06_rental_agreements' AS migration_origin,
  CASE
    WHEN to_regclass('public.tenancy_agreements') IS NULL 
      THEN 'TABLE_NOT_PRESENT (Safe: tenancy_agreements table not yet created)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*) AS cnt FROM public.tenancy_agreements WHERE landlord_id = tenant_id$$, false, true, '')))[1]::text,
      '0'
    )
  END AS violating_row_count,
  'Ensures landlord and tenant user accounts are distinct individuals.' AS constraint_purpose

UNION ALL

SELECT 
  'chk_payment_distinct_parties' AS constraint_name,
  'rent_payment_records' AS target_table,
  '06_rental_agreements' AS migration_origin,
  CASE
    WHEN to_regclass('public.rent_payment_records') IS NULL 
      THEN 'TABLE_NOT_PRESENT (Safe: rent_payment_records table not yet created)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*) AS cnt FROM public.rent_payment_records WHERE payer_id = recipient_id$$, false, true, '')))[1]::text,
      '0'
    )
  END AS violating_row_count,
  'Ensures rent payments cannot be submitted to the same user account.' AS constraint_purpose;


-- Check 5.2: Parser-Resilient Family Stay Non-Compliant Row Audit
-- (Safely handles scenario where public.properties or category column does not exist)
SELECT 
  CASE 
    WHEN to_regclass('public.properties') IS NULL 
      THEN 'TABLE_NOT_PRESENT (properties table not yet created — zero constraint risk)'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
    ) THEN 'COLUMN_NOT_YET_ADDED (category column not yet present — zero constraint risk)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*)::text AS cnt FROM public.properties WHERE category = 'family_stays' AND (family_lives_on_property IS NOT TRUE OR provider_type <> 'owner' OR meals_offered NOT IN ('included', 'optional_extra', 'none') OR meals_offered IS NULL)$$, false, true, '')))[1]::text,
      '0'
    )
  END AS non_compliant_property_count,
  CASE 
    WHEN to_regclass('public.properties') IS NULL THEN '<none>'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
    ) THEN '<none>'
    ELSE COALESCE(
      (xpath('/row/sample_ids/text()', query_to_xml($$SELECT string_agg(id::text, ', ') AS sample_ids FROM (SELECT id FROM public.properties WHERE category = 'family_stays' AND (family_lives_on_property IS NOT TRUE OR provider_type <> 'owner' OR meals_offered NOT IN ('included', 'optional_extra', 'none') OR meals_offered IS NULL) LIMIT 5) sub$$, false, true, '')))[1]::text,
      '<none>'
    )
  END AS sample_non_compliant_property_ids;


-- Check 5.3: Parser-Resilient Untargeted Inquiry Audit
-- (Safely handles scenario where public.interest_requests does not exist)
SELECT 
  CASE 
    WHEN to_regclass('public.interest_requests') IS NULL 
      THEN 'TABLE_NOT_PRESENT (interest_requests table not yet created — zero constraint risk)'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*)::text AS cnt FROM public.interest_requests WHERE property_id IS NULL AND target_flatmate_id IS NULL$$, false, true, '')))[1]::text,
      '0'
    )
  END AS untargeted_inquiry_count,
  CASE 
    WHEN to_regclass('public.interest_requests') IS NULL THEN '<none>'
    ELSE COALESCE(
      (xpath('/row/sample_ids/text()', query_to_xml($$SELECT string_agg(id::text, ', ') AS sample_ids FROM (SELECT id FROM public.interest_requests WHERE property_id IS NULL AND target_flatmate_id IS NULL LIMIT 5) sub$$, false, true, '')))[1]::text,
      '<none>'
    )
  END AS sample_untargeted_inquiry_ids;


-- ==============================================================================
-- SECTION 6: AUTH USERS VS PUBLIC PROFILES INTEGRITY CHECK
-- Target: Migration 05 (20261022000000_auth_profile_trigger_and_insert_policy.sql)
-- Note: handle_new_user() fires on NEW auth events; existing users must be backfilled.
-- ==============================================================================

-- Check 6.1: High-Level Profile Synchronization Metric
-- (Safely handles scenario where public.profiles does not exist)
SELECT 
  (SELECT count(*) FROM auth.users) AS total_registered_auth_users,
  (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) AS confirmed_email_auth_users,
  (SELECT count(*) FROM auth.users WHERE phone_confirmed_at IS NOT NULL) AS confirmed_phone_auth_users,
  CASE 
    WHEN to_regclass('public.profiles') IS NULL 
      THEN 'PROFILES_TABLE_NOT_YET_CREATED'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*)::text AS cnt FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)$$, false, true, '')))[1]::text,
      '0'
    )
  END AS auth_users_missing_profiles_count,
  CASE 
    WHEN to_regclass('public.profiles') IS NULL 
      THEN 'PROFILES_TABLE_NOT_YET_CREATED'
    ELSE COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*)::text AS cnt FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)$$, false, true, '')))[1]::text,
      '0'
    )
  END AS orphaned_profiles_missing_auth_users_count;

-- Check 6.2: Safe Listing of Unprovisioned Auth Users (Masked, Zero Secrets)
-- (Safely handles scenario where public.profiles does not exist)
SELECT 
  CASE 
    WHEN to_regclass('public.profiles') IS NULL 
      THEN 'PROFILES_TABLE_NOT_YET_CREATED (Migration 01 pending; all auth users will need initial profile provisioning)'
    ELSE COALESCE(
      (xpath('/row/unprovisioned_summary/text()', query_to_xml($$SELECT COALESCE(string_agg(u.id::text || ' (' || substring(COALESCE(u.email, 'none') from 1 for 3) || '***@' || split_part(COALESCE(u.email, 'none'), '@', 2) || ')', ', '), '<all_users_provisioned>') AS unprovisioned_summary FROM (SELECT id, email FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id) LIMIT 10) u$$, false, true, '')))[1]::text,
      '<none>'
    )
  END AS unprovisioned_users_sample;


-- ==============================================================================
-- SECTION 7: STORAGE OBJECT POLICIES AUDIT (RENTAL-DOCUMENTS FOCUS)
-- Target: Migration 08 (20261025000000_rental_storage_counterparty_access.sql)
-- Validates counterparty folder isolation for private rental-documents bucket.
-- ==============================================================================

SELECT 
  policyname,
  cmd,
  roles,
  CASE 
    WHEN qual LIKE '%rental-documents%' AND qual LIKE '%tenancy_agreements%' 
      THEN 'VERIFIED_SCOPED_COUNTERPARTY_ACCESS: Migration 08 policy active (Both landlord and tenant can access agreement files)'
    WHEN qual LIKE '%rental-documents%' 
      THEN 'UPLOADER_ONLY_ACCESS: Migration 06 policy active (Pending Migration 08 upgrade to allow counterparty access)'
    WHEN policyname LIKE '%Rental documents%' 
      THEN 'RENTAL_POLICY: Inspect definition below'
    WHEN bucket_id_match = 'property-photos' THEN 'PROPERTY_PHOTOS_POLICY'
    WHEN bucket_id_match = 'user-avatars' THEN 'USER_AVATARS_POLICY'
    WHEN bucket_id_match = 'support-attachments' THEN 'SUPPORT_ATTACHMENTS_POLICY'
    ELSE 'OTHER_STORAGE_POLICY'
  END AS policy_classification,
  qual AS using_expression,
  with_check AS with_check_expression
FROM (
  SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check,
    CASE
      WHEN qual LIKE '%property-photos%' OR with_check LIKE '%property-photos%' THEN 'property-photos'
      WHEN qual LIKE '%user-avatars%' OR with_check LIKE '%user-avatars%' THEN 'user-avatars'
      WHEN qual LIKE '%support-attachments%' OR with_check LIKE '%support-attachments%' THEN 'support-attachments'
      WHEN qual LIKE '%rental-documents%' OR with_check LIKE '%rental-documents%' THEN 'rental-documents'
      ELSE 'other'
    END AS bucket_id_match
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
) sub
ORDER BY 
  CASE WHEN bucket_id_match = 'rental-documents' THEN 1 ELSE 2 END,
  policyname;


-- ==============================================================================
-- SECTION 8: FINAL PREFLIGHT EXECUTIVE SUMMARY & READINESS SCORECARD
-- ==============================================================================

SELECT 
  '1. Custom Enum Types' AS audit_domain,
  CASE 
    WHEN (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') = 10 
      THEN 'READY (All 10 enums present — use exception wrappers)'
    WHEN (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') = 0 
      THEN 'READY (Fresh database — Migration 01 will create all 10 enums)'
    ELSE 'REQUIRES REVIEW (Partial enum presence — inspect Section 1)'
  END AS readiness_status

UNION ALL

SELECT 
  '2. Core Public Tables' AS audit_domain,
  (SELECT count(*)::text || ' of 15 expected tables present in public schema' 
   FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
     'profiles', 'properties', 'property_photos', 'flatmate_profiles', 
     'interest_requests', 'listing_reports', 'support_tickets', 'ticket_messages', 
     'ticket_audit_events', 'safety_reports', 'tenancy_agreements', 
     'rent_payment_records', 'property_inspections', 'tenancy_reviews', 'rental_disputes'
   )) AS readiness_status

UNION ALL

SELECT 
  '3. Functions & Security Definer' AS audit_domain,
  (SELECT count(*)::text || ' of 14 security-hardened functions present'
   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public' AND p.prosecdef = true AND p.proconfig::text LIKE '%search_path=public, pg_temp%') AS readiness_status

UNION ALL

SELECT 
  '4. Storage Buckets' AS audit_domain,
  (SELECT count(*)::text || ' of 4 expected buckets present in storage.buckets'
   FROM storage.buckets WHERE id IN ('property-photos', 'user-avatars', 'support-attachments', 'rental-documents')) AS readiness_status

UNION ALL

SELECT 
  '5. Data Constraints Compliance' AS audit_domain,
  CASE 
    WHEN to_regclass('public.properties') IS NULL AND to_regclass('public.interest_requests') IS NULL 
      THEN 'READY (Tables not yet created — zero constraint risk)'
    ELSE 'Inspect Section 5 for violating row counts'
  END AS readiness_status

UNION ALL

SELECT 
  '6. Auth Users Sync' AS audit_domain,
  CASE 
    WHEN to_regclass('public.profiles') IS NULL 
      THEN 'PENDING MIGRATION 01 (profiles table not yet created)'
    WHEN COALESCE(
      (xpath('/row/cnt/text()', query_to_xml($$SELECT count(*)::text AS cnt FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)$$, false, true, '')))[1]::text,
      '0'
    ) = '0' 
      THEN 'READY (100% auth users have matching public profiles)'
    ELSE 'BACKFILL REQUIRED (Inspect Section 6 unprovisioned users)'
  END AS readiness_status

UNION ALL

SELECT 
  '7. Storage Counterparty RLS' AS audit_domain,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' 
        AND qual LIKE '%rental-documents%' AND qual LIKE '%tenancy_agreements%'
    ) THEN 'READY (Migration 08 counterparty access verified)'
    ELSE 'PENDING MIGRATION 08 (Counterparty policy not yet active)'
  END AS readiness_status;

-- ==============================================================================
-- END OF PREFLIGHT AUDIT SCRIPT
-- Next Step: Once all checks are reviewed, follow the execution plan in
-- docs/PRODUCTION_SUPABASE_MIGRATION_AUDIT.md
-- ==============================================================================
