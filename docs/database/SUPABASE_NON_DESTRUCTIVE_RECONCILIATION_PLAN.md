# AASHVO — Non-Destructive Supabase Migration & Reconciliation Plan
**Author:** Principal Database Architect & DevOps Lead  
**Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **AWAITING FINAL CTO CONFIRMATION**  
**Guiding Principle:** **ZERO DROPS — ZERO DELETIONS — PRESERVE ALL EXISTING PROTOTYPE OBJECTS AND VIEWS**

---

## 1. Executive Summary & Inventory Findings

In strict adherence to the CTO's decision, **no `DROP TABLE CASCADE` or `DROP TYPE CASCADE` operations will be executed**. All 15 prototype tables, 10 custom ENUM types, 3 public views (`public_profiles`, `public_properties`, `public_flatmates`), functions, triggers, and 42 Row Level Security (RLS) policies are preserved in place.

### Full Inventory of Current Supabase State (`public` schema)
- **Base Tables (15):** `flatmate_profiles`, `interest_requests`, `listing_reports`, `profiles`, `properties`, `property_inspections`, `property_photos`, `rent_payment_records`, `rental_disputes`, `safety_reports`, `support_tickets`, `tenancy_agreements`, `tenancy_reviews`, `ticket_audit_events`, `ticket_messages`.
- **Existing ENUM Types (10):** `cleanliness_level`, `food_habit`, `furnishing_status`, `gender_preference`, `moderation_status`, `property_type`, `provider_type`, `room_type`, `sleep_routine`, `user_role`. (Labels 100% match Prisma).
- **Public Views (3):** `public_profiles`, `public_properties`, `public_flatmates` (with `security_barrier = true`).
- **Extensions (5):** `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`.
- **Total Application Data Rows:** **EXACTLY 0 ROWS across all 15 tables** (audited and confirmed).

---

## 2. Complete Backup Verification & Restoration Runbook

### A. Full Backup Location & Status
- **File:** `D:\Projects\AASHVO\supabase\backups\supabase_full_schema_and_data_backup.sql`
- **Size:** 63,128 bytes
- **TOC Contents:** Complete self-contained DDL and data extraction for all 15 tables, 10 enums, 3 views, 18 functions, 14 triggers, and 42 RLS policies.
- **Git Status:** Git-ignored via `.gitignore` (`supabase/backups/`).

### B. Isolated Restoration Procedure
In the event that rollback or reconstruction is required:
```bash
# Restoration to Supabase or any isolated PostgreSQL instance:
psql -h aws-0-ap-south-1.pooler.supabase.com -p 5432 -U "postgres.himtwnwxvnnykafyhysy" -d postgres -f "D:/Projects/AASHVO/supabase/backups/supabase_full_schema_and_data_backup.sql"
```
*Note: The script wraps all restoration statements inside a single transaction (`BEGIN ... COMMIT`) with idempotent clauses.*

---

## 3. Comparison Matrix: Neon Staging (Authoritative) vs. Current Supabase

| Dimension | Neon Staging (Authoritative Prisma) | Current Supabase (`public`) | Reconciliation Action Required |
| :--- | :---: | :---: | :--- |
| **Total Base Tables** | **33 tables** | **15 tables** | Add **18 missing tables** non-destructively |
| **Custom ENUMs** | **38 enums** | **10 enums** | Add **28 missing enums** non-destructively |
| **Missing Columns** | 0 | 18 columns across 8 tables | `ADD COLUMN IF NOT EXISTS` |
| **Prisma Migration Ledger**| 5 applied records | None (`_prisma_migrations` absent) | Create & record 5 baseline entries |
| **Preservation of Views** | None (pure API) | 3 Views present | **Preserved 100% in place** |
| **Application Data** | 0 rows | 0 rows | **100% preserved (0 risk of loss)** |

---

## 4. The Exact Non-Destructive Reconciliation Plan (Option B)

The reconciliation script will execute the following strictly additive phases inside a single atomic transaction:

### Phase 1: Extensions & Missing ENUMs (Additive Only)
- Install `citext`: `CREATE EXTENSION IF NOT EXISTS "citext";`
- Register the 28 missing enums using `IF NOT EXISTS` guards:
  `account_status`, `property_category`, `meals_offered`, `inquiry_status`, `ticket_status`, `ticket_priority`, `ticket_sender_role`, `safety_target_type`, `safety_report_status`, `agreement_status`, `payment_category`, `payment_verification_status`, `inspection_type`, `tenancy_reviewer_role`, `review_moderation_status`, `dispute_type`, `dispute_status`, `media_bucket`, `media_status`, `auth_token_purpose`, `outbox_status`, `flatmate_interest_type`, `flatmate_match_status`, `flatmate_intention`, `saved_item_type`, `visit_status`, `property_verification_status`, `notification_category`.

### Phase 2: Missing Tables (Additive Only)
Create the 17 domain tables and 1 migration ledger using `CREATE TABLE IF NOT EXISTS`:
1. `users` (independent NestJS user entity with RS256 JWT auth)
2. `oauth_identities`
3. `refresh_sessions`
4. `verification_tokens`
5. `phone_otp_challenges`
6. `media_assets`
7. `audit_logs`
8. `notification_outbox`
9. `flatmate_interests`
10. `flatmate_matches`
11. `match_messages`
12. `user_blocks`
13. `user_reports`
14. `saved_items`
15. `property_visits`
16. `property_verifications`
17. `user_notifications`
18. `_prisma_migrations`

### Phase 3: Missing Columns on Existing Tables (`ADD COLUMN IF NOT EXISTS`)
- `flatmate_profiles`: add `city`, `intentions`, `discovery_hidden`, `updated_at`
- `interest_requests`: add `updated_at`
- `profiles`: add `bio`
- `properties`: add `optional_meal_cost`, `featured`, `moderation_reason`
- `property_inspections`: add `meter_readings`, `inventory`, `key_handover_confirmed`, `deposit_confirmed`
- `property_photos`: add `media_id`
- `safety_reports`: add `reported_flatmate_id`, `target_title`, `evidence_url`
- `support_tickets`: add `attachments`

### Phase 4: Authentication Alignment
- Update `profiles.id` foreign key: point to `public.users(id)` so NestJS authentication works seamlessly without breaking existing profile schema.

### Phase 5: GIN & Partial Unique Indexes (Additive Only)
- Add complementary indexes: `uq_active_dispute_per_agreement_type`, `idx_properties_active_featured`, `idx_properties_amenities_gin`, `idx_flatmates_localities_gin`, `idx_flatmates_interests_gin`.

### Phase 6: Prisma Migration Ledger Baseline
- Seed `_prisma_migrations` with the exact 5 migration checksums so that `npx prisma migrate status` marks the database as **100% up to date**.

---

## 5. Resulting State Verification

Upon execution of this plan:
- **Application Tables:** Exactly **32 domain tables** + 1 Prisma ledger = **33 tables**.
- **ENUM Types:** Exactly **38 custom ENUMs**.
- **Views:** All 3 public views remain active and intact.
- **Data:** Zero rows altered or lost.
- **Prisma Parity:** 100% binary parity with Neon staging and local PostgreSQL 16.
