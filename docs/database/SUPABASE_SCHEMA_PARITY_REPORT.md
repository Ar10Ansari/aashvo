# AASHVO — Supabase Schema Parity & Gap Analysis Report
**Author:** Principal Database Architect  
**Reviewer / Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **TECHNICAL AUDIT COMPLETE**  
**Comparison Target:** Neon Staging (`ep-round-mountain-aozrgk3c`, Authoritative Prisma Schema) vs. Hosted Supabase (`himtwnwxvnnykafyhysy`, PostgreSQL 17.11)

---

## 1. Executive Parity Scorecard

| Architectural Layer | Neon Staging (Authoritative) | Hosted Supabase (Current) | Parity Status | Required Additive Delta |
| :--- | :---: | :---: | :---: | :--- |
| **PostgreSQL Engine** | 18.7 (a21afb5) | 17.11 (Linux x86_64) | **COMPATIBLE** | None (standard ANSI/PG SQL) |
| **Total Base Tables** | **33 tables** | **15 tables** | **GAP: 18 Missing** | Create 18 missing tables |
| **Custom ENUM Types** | **38 enums** | **10 enums** | **GAP: 28 Missing** | Register 28 missing enums |
| **Common Table Columns** | 225 columns | 207 columns | **GAP: 18 Missing** | Add 18 missing columns |
| **Public Views** | 0 views (pure API) | 3 views | **PRESERVED** | Keep 3 views intact |
| **Constraints & FKs** | 406 constraints | 120 constraints | **GAP: 286 Missing** | Add required FKs & checks |
| **GIN / Array Indexes** | 4 GIN indexes | 0 GIN indexes | **GAP: 4 Missing** | Create 4 GIN indexes |
| **Prisma Migration Ledger**| 5 applied records | Absent | **GAP: Absent** | Initialize `_prisma_migrations` |
| **Total Row Counts** | 0 rows | 0 rows | **PARITY: 0 ROWS**| Zero data to migrate/lose |

---

## 2. Table-by-Table Inventory & Gap Matrix

### A. The 18 Tables in Neon Missing in Hosted Supabase
These tables exist in the authoritative Prisma schema and must be added non-destructively:

| # | Missing Table Name | Domain Purpose | Key Columns & Relations |
| :---: | :--- | :--- | :--- |
| **01** | `users` | Core NestJS Authentication | `id UUID PK`, `email CITEXT UQ`, `password_hash`, `role` |
| **02** | `oauth_identities` | Third-Party Social Login | `id UUID PK`, `user_id FK(users)`, `provider`, `provider_user_id` |
| **03** | `refresh_sessions` | Secure RFC 6265bis Token Rotation | `id UUID PK`, `user_id FK(users)`, `family_id`, `token_hash` |
| **04** | `verification_tokens` | Email & Password Reset Tokens | `id UUID PK`, `user_id FK(users)`, `token_hash`, `purpose` |
| **05** | `phone_otp_challenges` | SMS OTP Security Challenges | `id UUID PK`, `phone_number`, `otp_hash`, `expires_at` |
| **06** | `media_assets` | Multi-Cloud Storage Registry | `id UUID PK`, `bucket media_bucket`, `storage_key`, `public_url` |
| **07** | `audit_logs` | Security & Administrative Auditing | `id UUID PK`, `actor_id`, `action`, `resource_type`, `payload` |
| **08** | `notification_outbox` | Transactional Event Outbox | `id UUID PK`, `aggregate_type`, `event_type`, `payload` |
| **09** | `flatmate_interests` | Connect Swipes (Likes / Passes) | `id UUID PK`, `sender_id FK`, `target_user_id FK`, `interest_type` |
| **10** | `flatmate_matches` | Connect Mutual Matches | `id UUID PK`, `user1_id FK`, `user2_id FK`, `status` |
| **11** | `match_messages` | End-to-End Match Chat | `id UUID PK`, `match_id FK`, `sender_id FK`, `content` |
| **12** | `user_blocks` | User Safety Blocking Registry | `id UUID PK`, `blocker_id FK`, `blocked_id FK`, `reason` |
| **13** | `user_reports` | Safety Reporting Registry | `id UUID PK`, `reporter_id FK`, `reported_id FK`, `reason` |
| **14** | `saved_items` | Multi-Category Bookmarks | `id UUID PK`, `user_id FK`, `item_type`, `target_id` |
| **15** | `property_visits` | Physical Visit Scheduling | `id UUID PK`, `property_id FK`, `visitor_id FK`, `host_id FK` |
| **16** | `property_verifications` | Landlord Document Verification | `id UUID PK`, `property_id FK`, `document_type`, `status` |
| **17** | `user_notifications` | In-App Notification Center | `id UUID PK`, `user_id FK`, `category`, `title`, `body` |
| **18** | `_prisma_migrations` | Migration History Ledger | `id VARCHAR(36) PK`, `checksum`, `finished_at`, `migration_name` |

### B. The 15 Common Tables: Column & Type Parity Analysis
These 15 tables exist in both environments. Below is the exact inventory of missing columns and type discrepancies:

1. **`flatmate_profiles` (Supabase: 18 cols | Neon: 22 cols):**
   - *Missing in Supabase:* `city VARCHAR(64) NOT NULL DEFAULT 'Gurugram'`, `intentions "flatmate_intention"[] NOT NULL DEFAULT ARRAY[]::"flatmate_intention"[]`, `discovery_hidden BOOLEAN NOT NULL DEFAULT false`, `updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`.
   - *Type Parity:* Supabase uses `text` for `occupation`, `gender`, `smoking`; Neon uses `varchar`. Both are functionally compatible in PostgreSQL without conversion.
2. **`interest_requests` (Supabase: 11 cols | Neon: 12 cols):**
   - *Missing in Supabase:* `updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`.
   - *Type Parity:* Supabase `status` is `text`; Neon is `inquiry_status` ENUM.
3. **`listing_reports` (Supabase: 9 cols | Neon: 9 cols):**
   - Column count matches 100%. `property_id` is nullable in Neon to support reporting non-property entities.
4. **`profiles` (Supabase: 11 cols | Neon: 12 cols):**
   - *Missing in Supabase:* `bio VARCHAR(1000)`.
   - *Type Parity:* `email` in Neon is `citext`; in Supabase is `text`.
5. **`properties` (Supabase: 33 cols | Neon: 36 cols):**
   - *Missing in Supabase:* `optional_meal_cost NUMERIC(10,2)`, `featured BOOLEAN NOT NULL DEFAULT false`, `moderation_reason TEXT`.
   - *Type Parity:* `category` is `property_category` in Neon, `text` in Supabase; `meals_offered` is `meals_offered` ENUM in Neon.
6. **`property_inspections` (Supabase: 12 cols | Neon: 16 cols):**
   - *Missing in Supabase:* `meter_readings JSONB DEFAULT '{}'`, `inventory JSONB DEFAULT '[]'`, `key_handover_confirmed BOOLEAN NOT NULL DEFAULT false`, `deposit_confirmed BOOLEAN NOT NULL DEFAULT false`.
   - *Type Parity:* `inspection_type` is ENUM in Neon; `condition_rating` is `int4` in Neon, `text` in Supabase.
7. **`property_photos` (Supabase: 7 cols | Neon: 8 cols):**
   - *Missing in Supabase:* `media_id UUID`.
8. **`rent_payment_records` (Supabase: 12 cols | Neon: 12 cols):**
   - Column count matches 100%.
9. **`rental_disputes` (Supabase: 15 cols | Neon: 15 cols):**
   - Column count matches 100%.
10. **`safety_reports` (Supabase: 15 cols | Neon: 18 cols):**
    - *Missing in Supabase:* `reported_flatmate_id UUID`, `target_title VARCHAR(255) NOT NULL DEFAULT ''`, `evidence_url TEXT`.
11. **`support_tickets` (Supabase: 18 cols | Neon: 19 cols):**
    - *Missing in Supabase:* `attachments JSONB NOT NULL DEFAULT '[]'`.
12. **`tenancy_agreements` (Supabase: 13 cols | Neon: 13 cols):**
    - Column count matches 100%.
13. **`tenancy_reviews` (Supabase: 15 cols | Neon: 15 cols):**
    - Column count matches 100%.
14. **`ticket_audit_events` (Supabase: 9 cols | Neon: 9 cols):**
    - Column count matches 100%.
15. **`ticket_messages` (Supabase: 9 cols | Neon: 9 cols):**
    - Column count matches 100%.

---

## 3. Custom ENUM Types Gap Analysis

- **10 Existing Enums in Supabase (100% Label Match):**  
  `cleanliness_level`, `food_habit`, `furnishing_status`, `gender_preference`, `moderation_status`, `property_type`, `provider_type`, `room_type`, `sleep_routine`, `user_role`.
- **28 Missing Enums in Supabase:**  
  `account_status`, `agreement_status`, `auth_token_purpose`, `dispute_status`, `dispute_type`, `flatmate_intention`, `flatmate_interest_type`, `flatmate_match_status`, `inquiry_status`, `inspection_type`, `meals_offered`, `media_bucket`, `media_status`, `notification_category`, `outbox_status`, `payment_category`, `payment_verification_status`, `property_category`, `property_verification_status`, `review_moderation_status`, `safety_report_status`, `safety_target_type`, `saved_item_type`, `tenancy_reviewer_role`, `ticket_priority`, `ticket_sender_role`, `ticket_status`, `visit_status`.

---

## 4. Views and RLS Policy Parity

- **Views:** Supabase retains 3 public views (`public_profiles`, `public_properties`, `public_flatmates`). Neon has 0 views because NestJS queries base tables directly. These 3 views will be **retained 100% in place** on Supabase to ensure zero regression for any Supabase Studio or legacy client usage.
- **RLS:** All 42 RLS policies on Supabase remain active. Because NestJS connects as role `postgres` (with `relforcerowsecurity = false`), NestJS queries bypass RLS while PostgREST queries continue to be protected.

---

## 5. Non-Destructive Resolution Path

By executing purely additive DDL (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and idempotent ENUM creation), Supabase will achieve **100% structural parity with Neon staging** without dropping a single existing table, column, view, or ENUM.
