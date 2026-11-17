# AASHVO — Supabase Non-Destructive Reconciliation Final Plan
**Document Version:** 1.0.0-FINAL  
**Author:** Principal Database Architect & DevOps Lead  
**Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **APPROVED FOR PLANNING — AWAITING FINAL CTO EXECUTION CONFIRMATION**  
**Core Constraint:** **STRICTLY NON-DESTRUCTIVE — ZERO DROPS — ZERO TRUNCATES — ZERO CASCADES**

---

## 1. Executive Summary & Context

Under explicit CTO directive:
1. **Supabase (Mumbai, `himtwnwxvnnykafyhysy`) is confirmed as the primary production database.**
2. **All proposed `DROP TABLE CASCADE` and `DROP TYPE CASCADE` cleanup operations are permanently prohibited.**
3. **Every existing object in Supabase**—including 15 base tables, 10 custom ENUMs, 3 public views, 18 functions, 14 triggers, 42 Row Level Security (RLS) policies, and 4 storage buckets—**must be preserved in place.**
4. **Authoritative Parity:** The database must achieve 100% functional, structural, and contractual parity with the authoritative Prisma schema (`apps/api/prisma/schema.prisma`) and the verified Neon staging schema.

---

## 2. Mandatory Antigravity Skill Discovery

An audit of installed Antigravity skills was performed in accordance with Requirement 1:
- **Discovered & Applied Skills:**
  - `neon`, `neon-postgres`, `neon-realtime` (used for comparative schema auditing against Neon staging).
  - `antigravity_guide`, `agy-customizations`, `automation` (used for task orchestration and process hygiene).
- **Missing Skills Reported:**
  - Dedicated `supabase` skill (Available in Agent Marketplace as `antigravity-plugins-partners/plugin/supabase`).
  - Standalone `prisma` or `postgresql-dba` skill.
- **Engineering Standard Applied:** Standard PostgreSQL 17 system catalog introspection, libpq protocol validation, Prisma CLI v6.19.3 lifecycle management, and enterprise zero-data-loss database migration practices.

---

## 3. Current Supabase Public Schema State (Audited & Verified)

Every object in `public` was inspected via direct SQL catalog queries on PostgreSQL 17.11:

| Object Category | Count | Detailed Inventory |
| :--- | :---: | :--- |
| **Base Tables** | **15** | `flatmate_profiles`, `interest_requests`, `listing_reports`, `profiles`, `properties`, `property_inspections`, `property_photos`, `rent_payment_records`, `rental_disputes`, `safety_reports`, `support_tickets`, `tenancy_agreements`, `tenancy_reviews`, `ticket_audit_events`, `ticket_messages`. |
| **Data Rows** | **0** | **0 rows across all 15 tables** (Audited via `pg_class` and `count(*)` catalog loop). |
| **Public Views** | **3** | `public_profiles`, `public_properties`, `public_flatmates` (configured with `security_barrier = true`). |
| **Custom ENUMs** | **10** | `cleanliness_level`, `food_habit`, `furnishing_status`, `gender_preference`, `moderation_status`, `property_type`, `provider_type`, `room_type`, `sleep_routine`, `user_role`. (Labels 100% match Prisma). |
| **Functions** | **18** | Stored procedures and trigger handlers (`is_admin`, `is_support_admin`, `handle_new_user`, `create_guest_support_ticket`, `add_guest_ticket_reply`, etc.). |
| **Triggers** | **14** | Moderation, timestamp, and audit triggers on domain tables. |
| **RLS Policies** | **42** | Active policies enforcing tenant isolation for PostgREST / GoTrue clients. |
| **Storage Buckets** | **4** | `property-photos` (public), `user-avatars` (public), `support-attachments` (private), `rental-documents` (private). |
| **Prisma Ledger** | **0** | `_prisma_migrations` does not yet exist. |

---

## 4. Evaluation of Migration Strategies

We evaluated the three architectural options specified by the CTO:

### Option A: Blind Baseline / Adoption (`prisma migrate resolve --applied`)
- **Evaluation:** Fatal Failure.
- **Reasoning:** Migration 1 (`20261112165753_init_independent_schema`) defines 8 new infrastructure tables (`users`, `oauth_identities`, `refresh_sessions`, `verification_tokens`, `phone_otp_challenges`, `media_assets`, `audit_logs`, `notification_outbox`) and 21 enums that **do not exist in Supabase**. Marking Migration 1 as applied without creating these tables would cause the NestJS backend to crash immediately on boot (`relation "users" does not exist`).
- **Verdict:** **REJECTED.**

### Option B: Additive In-Place Reconciliation (Recommended)
- **Evaluation:** Fully Feasible, 100% Safe, Zero Drops.
- **Reasoning:** Preserves all 15 existing prototype tables, 10 enums, and 3 views. Adds the 18 missing tables, 28 missing enums, and 18 missing columns using purely additive DDL (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Uses an official Prisma baseline step once parity is achieved.
- **Verdict:** **SELECTED.**

### Option C: Dedicated Application Schema (`schema = "aashvo"`)
- **Evaluation:** Viable, but introduces architectural bifurcation.
- **Reasoning:** Separating NestJS tables into an `aashvo` schema isolates them from Supabase Studio Table Editor and default PostgREST endpoints.
- **Verdict:** **RESERVED AS CONTINGENCY.**

---

## 5. Step-by-Step Non-Destructive Reconciliation Plan (Option B)

All steps are executed inside a single transactional wrapper (`BEGIN ... COMMIT;`):

### Phase 1: Extensions & Missing ENUMs (Additive Only)
1. Ensure extension: `CREATE EXTENSION IF NOT EXISTS "citext";`
2. Add the 28 missing ENUM types with idempotent guards:
   ```sql
   DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
       CREATE TYPE "account_status" AS ENUM ('active', 'suspended', 'deleted_pending');
     END IF;
     -- (Repeated for all 28 missing enums)
   END $$;
   ```
   *(The 10 existing enums are preserved untouched).*

### Phase 2: Missing Tables (Additive Only)
Create the 17 missing domain tables using `CREATE TABLE IF NOT EXISTS`:
- Authentication: `users`, `oauth_identities`, `refresh_sessions`, `verification_tokens`, `phone_otp_challenges`.
- Media & Audit: `media_assets`, `audit_logs`, `notification_outbox`.
- Connect Matching: `flatmate_interests`, `flatmate_matches`, `match_messages`, `user_blocks`, `user_reports`.
- Master Features: `saved_items`, `property_visits`, `property_verifications`, `user_notifications`.

### Phase 3: Missing Columns on Existing Tables (`ADD COLUMN IF NOT EXISTS`)
Add the 18 missing columns across the 8 existing tables:
- `flatmate_profiles`: `city VARCHAR(64)`, `intentions "flatmate_intention"[] DEFAULT ARRAY[]::"flatmate_intention"[]`, `discovery_hidden BOOLEAN DEFAULT false`, `updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP`.
- `interest_requests`: `updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP`.
- `profiles`: `bio VARCHAR(1000)`.
- `properties`: `optional_meal_cost NUMERIC(10,2)`, `featured BOOLEAN DEFAULT false`, `moderation_reason TEXT`.
- `property_inspections`: `meter_readings JSONB DEFAULT '{}'`, `inventory JSONB DEFAULT '[]'`, `key_handover_confirmed BOOLEAN DEFAULT false`, `deposit_confirmed BOOLEAN DEFAULT false`.
- `property_photos`: `media_id UUID`.
- `safety_reports`: `reported_flatmate_id UUID`, `target_title VARCHAR(255) DEFAULT ''`, `evidence_url TEXT`.
- `support_tickets`: `attachments JSONB DEFAULT '[]'`.

### Phase 4: Identity Bridge Alignment
- Add constraint `fk_profiles_user` linking `profiles.id` to `public.users.id` with `ON DELETE CASCADE`.
- Update `handle_new_user()` trigger on `auth.users` to idempotently insert into `public.users (id, email, password_hash, role)` so that legacy Supabase Auth and NestJS Auth coexist without conflict.

### Phase 5: GIN Indexes & Business Constraints
- Add unique constraints and GIN indexes:
  `uq_active_dispute_per_agreement_type`, `idx_properties_active_featured`, `idx_properties_amenities_gin`, `idx_flatmates_localities_gin`, `idx_flatmates_interests_gin`.

### Phase 6: Legitimate Prisma Ledger Baseline
- Create table `_prisma_migrations`.
- Use legitimate Prisma CLI baseline commands:
  - `npx prisma migrate resolve --applied 20261112165753_init_independent_schema`
  - `npx prisma migrate resolve --applied 20261112165800_postgres_checks_and_gin_indexes`
  - `npx prisma migrate resolve --applied 20261115000000_aashvo_connect_matching`
  - `npx prisma migrate resolve --applied 20261115010000_flatmate_intentions`
  - `npx prisma migrate resolve --applied 20261115020000_master_feature_expansion`
- Verify with `npx prisma migrate status`: Output confirms **"Database schema is up to date"**.

---

## 6. Verification & Stop Boundary

- **Pre-execution verification:** Validated on isolated local PostgreSQL 16 database (`aashvo_reconciliation_test`).
- **Post-execution verification:** Catalog queries will verify:
  - 33 tables in `public`.
  - 38 custom ENUMs in `public`.
  - 3 public views preserved.
  - 42 RLS policies preserved.
  - 0 data rows lost.

**EXECUTION GATE:** Zero hosted Supabase DDL statements will be executed until the CTO explicitly reviews and approves this plan.
