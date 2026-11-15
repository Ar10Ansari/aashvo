# AASHVO — THREE-ENVIRONMENT SCHEMA COMPARISON REPORT
**Local PostgreSQL (Port 5433) vs. Neon Staging (Singapore) vs. Supabase (Mumbai)**

**Author**: Senior Cloud Infrastructure Engineer & Database Migration Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: Comprehensive Tri-Environment Schema Audit  

---

## 1. High-Level Architecture Comparison Matrix

| Architectural Layer | Local PostgreSQL 16 (Port 5433) | Neon Staging (AWS Singapore) | Supabase Legacy / Target (AWS Mumbai) |
| :--- | :--- | :--- | :--- |
| **Engine Version** | PostgreSQL 16.16 | PostgreSQL 18.7 (a21afb5) | PostgreSQL 17.x |
| **Active Database** | `aashvo_test` / `aashvo_dev` | `neondb` | `postgres` |
| **Total Base Tables** | **33 tables** | **33 tables** | 0 (if fresh) or 15 (if legacy prototype) |
| **Application Tables** | **32 tables** | **32 tables** | 0 to 15 |
| **Migration Engine** | Prisma Migrate (`_prisma_migrations`) | Prisma Migrate (`_prisma_migrations`) | Legacy Supabase CLI (`schema_migrations`) or None |
| **Custom ENUM Types** | **38 enums** | **38 enums** | 10 enums in legacy prototype |
| **Installed Extensions**| `citext` (1.6), `plpgsql` (1.0) | `citext` (1.8), `plpgsql` (1.0) | `citext` available; `uuid-ossp`, `pgcrypto` built-in |
| **Auth System** | NestJS RS256 JWT (`users`, `refresh_sessions`) | NestJS RS256 JWT (`users`, `refresh_sessions`) | Dual capability: GoTrue `auth.users` vs NestJS `users` |
| **Storage Architecture**| Multi-cloud `StorageService` (Local/S3/R2) | Multi-cloud `StorageService` (Local/S3/R2) | Supabase Storage S3-compatible endpoints |
| **Row Count / Data** | 7 test users, seed listings, audit logs | **0 rows** (Clean schema slate) | Unknown pending live credential probe |

---

## 2. Table Count Reconciliation (32 vs. 33)

A core question in previous audits was whether the authoritative schema contains 32 or 33 tables. This audit confirms the exact technical breakdown:

- **Application Domain Tables**: Exactly **32 tables**.
- **Prisma Migration Tracker**: Exactly **1 table** (`_prisma_migrations`).
- **Mathematical Total**: `32 + 1 = 33` base tables in the PostgreSQL `public` schema.

When querying `information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`, the count is **33**. When listing domain entity tables only, the count is **32**. There is zero schema discrepancy.

---

## 3. Comprehensive Inventory of the 32 Application Tables

Below is the complete mapping of all 32 application tables, comparing local, Neon, and legacy Supabase prototype models:

| # | Table Name | Prisma Model | Columns | Local State | Neon Staging State | Legacy Supabase Prototype (`supabase/migrations`) |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **01** | `users` | `User` | 13 | 7 rows | 0 rows (active) | Replaced legacy `auth.users` dependency with independent user entity |
| **02** | `profiles` | `Profile` | 12 | 7 rows | 0 rows (active) | Present in `20261018000000_initial_schema.sql` (was linked to `auth.users`) |
| **03** | `oauth_identities` | `OAuthIdentity` | 9 | 0 rows | 0 rows (active) | Added in independent NestJS schema |
| **04** | `refresh_sessions` | `RefreshSession` | 12 | 8 rows | 0 rows (active) | Added in independent NestJS schema (replaces GoTrue refresh tokens) |
| **05** | `verification_tokens` | `VerificationToken` | 8 | 7 rows | 0 rows (active) | Added in independent NestJS schema (email/reset tokens) |
| **06** | `phone_otp_challenges` | `PhoneOtpChallenge` | 8 | 0 rows | 0 rows (active) | Added in independent NestJS schema (SMS OTP) |
| **07** | `properties` | `Property` | 36 | 3 rows | 0 rows (active) | Present in `20261018000000_initial_schema.sql` (extended for nationwide) |
| **08** | `property_photos` | `PropertyPhoto` | 8 | 3 rows | 0 rows (active) | Present in `20261018000000_initial_schema.sql` |
| **09** | `flatmate_profiles` | `FlatmateProfile` | 22 | 4 rows | 0 rows (active) | Present in `initial`, extended in `connect` & `intentions` |
| **10** | `interest_requests` | `InterestRequest` | 12 | 2 rows | 0 rows (active) | Present in `20261018000000_initial_schema.sql` |
| **11** | `media_assets` | `MediaAsset` | 11 | 0 rows | 0 rows (active) | Added in independent NestJS schema (multi-cloud storage metadata) |
| **12** | `tenancy_agreements` | `TenancyAgreement` | 13 | 1 row | 0 rows (active) | Present in `20261023000000_rental_agreements` |
| **13** | `rent_payment_records` | `RentPaymentRecord` | 12 | 0 rows | 0 rows (active) | Present in `20261023000000_rental_agreements` |
| **14** | `property_inspections` | `PropertyInspection` | 16 | 1 row | 0 rows (active) | Present in `20261023000000`, extended in `master_feature_expansion` |
| **15** | `tenancy_reviews` | `TenancyReview` | 15 | 0 rows | 0 rows (active) | Present in `20261024000000_rental_reputation` |
| **16** | `rental_disputes` | `RentalDispute` | 15 | 1 row | 0 rows (active) | Present in `20261024000000_rental_reputation` |
| **17** | `support_tickets` | `SupportTicket` | 19 | 1 row | 0 rows (active) | Present in `20261021000000_help_and_support` |
| **18** | `ticket_messages` | `TicketMessage` | 9 | 2 rows | 0 rows (active) | Present in `20261021000000_help_and_support` |
| **19** | `ticket_audit_events` | `TicketAuditEvent` | 9 | 0 rows | 0 rows (active) | Present in `20261021000000_help_and_support` |
| **20** | `safety_reports` | `SafetyReport` | 18 | 0 rows | 0 rows (active) | Present in `20261021000000_help_and_support` |
| **21** | `listing_reports` | `ListingReport` | 9 | 0 rows | 0 rows (active) | Present in `20261018000000_initial_schema.sql` |
| **22** | `audit_logs` | `AuditLog` | 11 | 31 rows | 0 rows (active) | Added in independent NestJS schema |
| **23** | `notification_outbox` | `NotificationOutbox` | 11 | 6 rows | 0 rows (active) | Added in independent NestJS schema (transactional outbox) |
| **24** | `flatmate_interests` | `FlatmateInterest` | 6 | 2 rows | 0 rows (active) | Added in `20261115000000_aashvo_connect_matching` |
| **25** | `flatmate_matches` | `FlatmateMatch` | 8 | 1 row | 0 rows (active) | Added in `20261115000000_aashvo_connect_matching` |
| **26** | `match_messages` | `MatchMessage` | 7 | 2 rows | 0 rows (active) | Added in `20261115000000_aashvo_connect_matching` |
| **27** | `user_blocks` | `UserBlock` | 5 | 0 rows | 0 rows (active) | Added in `20261115000000_aashvo_connect_matching` |
| **28** | `user_reports` | `UserReport` | 7 | 0 rows | 0 rows (active) | Added in `20261115000000_aashvo_connect_matching` |
| **29** | `saved_items` | `SavedItem` | 6 | 1 row | 0 rows (active) | Added in `20261115020000_master_feature_expansion` |
| **30** | `property_visits` | `PropertyVisit` | 12 | 1 row | 0 rows (active) | Added in `20261115020000_master_feature_expansion` |
| **31** | `property_verifications` | `PropertyVerification` | 15 | 1 row | 0 rows (active) | Added in `20261115020000_master_feature_expansion` |
| **32** | `user_notifications` | `UserNotification` | 10 | 5 rows | 0 rows (active) | Added in `20261115020000_master_feature_expansion` |

---

## 4. Key Architectural Divergence: Prototype Supabase vs. Production Prisma

The comparison highlights two structural divergence points:

### 1. Authentication Decoupling
- **Legacy Prototype (Supabase)**: `profiles.id` was a foreign key referencing `auth.users.id`. RLS policies relied on `auth.uid()`.
- **Production Schema (Prisma on Neon/Local/Target)**: `profiles.id` is a foreign key referencing `public.users.id`. The NestJS backend manages authentication via standard asymmetric RS256 JWT tokens. This decouples the core database from proprietary Supabase GoTrue internals.

### 2. Multi-Intention and Connect Features
- The 5 Prisma migrations incorporate the entire **Aashvo Connect** matching engine (`flatmate_interests`, `flatmate_matches`, `match_messages`, `user_blocks`, `user_reports`, multi-intentions) and **Master Feature Expansion** (`property_visits`, `saved_items`, `property_verifications`).
- The legacy `supabase/migrations` did not contain these tables. Applying the 5 Prisma migrations upgrades any database directly to the authoritative feature set.

