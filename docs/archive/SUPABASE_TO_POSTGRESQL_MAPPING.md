# AASHVO — Supabase to Independent PostgreSQL & NestJS Mapping

**Scope:** Exact 1:1 and transformed mappings from the verified Supabase schema (`supabase/migrations/20261018000000` through `20261112000000`) to the target PostgreSQL + Prisma schema (`docs/POSTGRESQL_DATABASE_DESIGN.md`) and NestJS service layer (`docs/INDEPENDENT_BACKEND_ARCHITECTURE.md`).

---

## 1. Supabase `auth.*` Schema Mapping

| Supabase Source | Target PostgreSQL Table(s) | Exact Field Mapping & Transformation | Notes / Verification Gate |
|---|---|---|---|
| `auth.users.id` | `users.id` & `profiles.id` | Preserved 1:1 UUID (`uuid::uuid`) | **Mandatory:** Zero UUID re-generation so every existing FK stays valid. |
| `auth.users.email` | `users.email` & `profiles.email` | Lowercased Citext | Must deduplicate/verify uniqueness pre-cutover. |
| `auth.users.encrypted_password` | `users.password_hash` + `users.password_hash_algorithm` | Inspect prefix on `aashvo-dev`: if `$2a$`/`$2b$` (GoTrue bcrypt), copy and set `'bcrypt_migrated'`; if empty/incompatible/OAuth-only, set `NULL` / `'none'`. | **Unverified until hosted DB inspection.** See `docs/AUTHENTICATION_MIGRATION_PLAN.md` §3. |
| `auth.users.email_confirmed_at` | `profiles.email_verified` | `email_confirmed_at IS NOT NULL` (also `OR` with existing `profiles.email_verified`) | Preserves verified status for legacy accounts. |
| `auth.users.phone` / `phone_confirmed_at` | `profiles.phone_number` / `phone_verified` | Fallback merge only when `profiles.phone_number IS NULL` | `profiles.phone_number` & `phone_verified` take precedence if set. |
| `auth.users.banned_until` / `deleted_at` | `users.account_status`, `users.deleted_at` | `deleted_at IS NOT NULL` → `'deleted_pending'`; `banned_until > now()` → `'suspended'`; else `'active'` | Preserves bans/soft-deletes across migration. |
| `auth.identities` (`provider`, `provider_id`, `identity_data`) | `oauth_identities` (`provider`, `provider_subject`, `provider_email`, `email_verified`, `raw_claims`) | Filter `provider <> 'email'` (Google `sub` preserved) | Prevents duplicate Google account creation post-cutover. |
| `auth.sessions` / `auth.refresh_tokens` | *(Do NOT migrate active tokens)* | Start clean post-cutover in `refresh_sessions` | Existing browser JWTs expire naturally or re-auth cleanly on cutover; prevents mixed secret trust. |

---

## 2. Enums Mapping (10 Existing Preserved + New Normalizations)

| Supabase Enum (`public`) | Target Prisma Enum | Values Preserved? | Action |
|---|---|---|---|
| `user_role` | `UserRole` (`user_role`) | `'renter','owner','broker','admin'` | Identical 1:1 copy. |
| `property_type` | `PropertyType` (`property_type`) | `'apartment','builder_floor','villa','gated_society'` | Identical 1:1 copy. |
| `room_type` | `RoomType` (`room_type`) | `'private_room','shared_room','entire_flat'` | Identical 1:1 copy. |
| `provider_type` | `ProviderType` (`provider_type`) | `'owner','tenant_flatmate','verified_manager'` | Identical 1:1 copy. |
| `furnishing_status` | `FurnishingStatus` (`furnishing_status`) | `'fully_furnished','semi_furnished','unfurnished'` | Identical 1:1 copy. |
| `gender_preference` | `GenderPreference` (`gender_preference`) | `'any','female_only','male_only'` | Identical 1:1 copy. |
| `moderation_status` | `ModerationStatus` (`moderation_status`) | `'pending_review','active','paused','rented','rejected'` | Identical 1:1 copy. |
| `food_habit` | `FoodHabit` (`food_habit`) | `'Vegetarian','Non-Vegetarian','Eggetarian','Vegan'` | Mapped with `@map("Non-Vegetarian")`. |
| `sleep_routine` | `SleepRoutine` (`sleep_routine`) | `'Early Bird','Night Owl','Flexible'` | Mapped with `@map(...)`. |
| `cleanliness_level` | `CleanlinessLevel` (`cleanliness_level`) | `'Spotless','Moderate','Relaxed'` | Identical 1:1 copy. |
| *(Text CHECK constraints)* | Dedicated PostgreSQL Enums (`PropertyCategory`, `MealsOffered`, `InquiryStatus`, `TicketStatus`, `TicketPriority`, `TicketSenderRole`, `SafetyTargetType`, `SafetyReportStatus`, `AgreementStatus`, `PaymentCategory`, `PaymentVerificationStatus`, `InspectionType`, `TenancyReviewerRole`, `ReviewModerationStatus`, `DisputeType`, `DisputeStatus`) | Exact same allowed string literals | Eliminates typo risk while remaining 100% value-compatible with existing data. |

---

## 3. All 15 Existing `public.*` Tables Mapping

| Supabase Table | Target Table | Column-Level Transformation & Additions | Dependency Order |
|---|---|---|---|
| `public.profiles` | `users` + `profiles` | `role`, `email`, `created_at`, `updated_at` mirrored onto `users`; all profile attributes copied 1:1 (`id`, `email`, `full_name`, `phone_number`, `role`, `bio`, `avatar_url`, `email_verified`, `phone_verified`, `id_verified`, `created_at`, `updated_at`). | Phase 1 (after `auth.users`) |
| `public.properties` | `properties` | All 29 columns copied 1:1; adds `featured BOOLEAN DEFAULT false` and `moderation_reason TEXT NULL`. Retains `chk_family_stay_eligibility`. | Phase 2 |
| `public.property_photos` | `property_photos` (+ `media_assets`) | Copy all columns 1:1 (`id`, `property_id`, `photo_url`, `room_tag`, `is_primary`, `sort_order`, `created_at`); rewrite Supabase Storage URLs to target CDN/R2 URLs and link nullable `media_id` where asset is migrated to R2/S3 (Unsplash external seed URLs keep external URL & `media_id = NULL`). | Phase 3 |
| `public.flatmate_profiles` | `flatmate_profiles` | Copy all 18 columns 1:1; add `updated_at` defaulting to `created_at`. Pre-migration check ensures zero duplicate `user_id` rows before `UNIQUE (user_id)`. | Phase 2 |
| `public.interest_requests` | `interest_requests` | Copy all columns 1:1; add `updated_at` defaulting to `created_at`. Enforce `chk_interest_request_target`. | Phase 3 |
| `public.listing_reports` | `listing_reports` | Historical rows copied 1:1 as read-only legacy archive (`ON DELETE SET NULL`). | Phase 3 |
| `public.support_tickets` | `support_tickets` | Copy all columns 1:1. FK `user_id` remapped from `auth.users(id)` to `users(id)` (same UUID!). | Phase 3 |
| `public.ticket_messages` | `ticket_messages` | Copy all columns 1:1. FK `sender_id` remapped from `auth.users(id)` to `users(id)` (same UUID!). | Phase 4 |
| `public.ticket_audit_events` | `ticket_audit_events` | Copy all columns 1:1. FK `actor_id` remapped from `auth.users(id)` to `users(id)`. | Phase 4 |
| `public.safety_reports` | `safety_reports` | Copy all columns 1:1. FK `reporter_id` remapped from `auth.users(id)` to `users(id)`. Re-point `evidence_url` / private object keys to `media_assets` if stored in `support-attachments`. | Phase 4 |
| `public.tenancy_agreements` | `tenancy_agreements` | Copy all 12 columns 1:1; rewrite `document_url` if pointing to `rental-documents` bucket into stable object key / `media_id` lookup. | Phase 3 |
| `public.rent_payment_records` | `rent_payment_records` | Copy all 12 columns 1:1; rewrite `receipt_url` if in `rental-documents` bucket. | Phase 4 |
| `public.property_inspections` | `property_inspections` | Copy all 11 columns 1:1; rewrite `photo_urls[]` elements hosted in Supabase `rental-documents` bucket. | Phase 4 |
| `public.tenancy_reviews` | `tenancy_reviews` | Copy all 14 columns 1:1; keep `UNIQUE (agreement_id, reviewer_id)`. | Phase 4 |
| `public.rental_disputes` | `rental_disputes` | Copy all 14 columns 1:1; rewrite `evidence_urls[]` hosted in Supabase Storage; retain `uq_active_dispute_per_agreement_type`. | Phase 4 |

---

## 4. Public Views Mapping (`public_*` Views → NestJS DTO Projections)

| Supabase View | Replaced By NestJS Endpoint & Projection | Security Parity Guarantee |
|---|---|---|
| `public.public_profiles` | `ProfilesModule.toPublicProfileDto()` used across `GET /profiles/:id/public`, `GET /properties`, `GET /flatmates` | Selects strictly `id`, `fullName`, `role`, `avatarUrl`, `bio`, `idVerified`, `phoneVerified`, `createdAt`. Never selects `email` or `phoneNumber`. |
| `public.public_properties` | `GET /api/v1/properties` (`PropertiesService.findPublicFeed()`) | Filters `status = 'active'`; aggregates `property_photos` ordered by `(isPrimary DESC, sortOrder ASC)`; joins `owner` using `PublicProfileDto`; excludes `ownerId` and masks `addressShort` (`maskAddressForPublicView`). |
| `public.public_flatmates` | `GET /api/v1/flatmates` (`FlatmatesService.findPublicFeed()`) | Joins `profile` using `PublicProfileDto`; excludes email/phone; computes verified badge cleanly. |

---

## 5. RPC Functions Mapping → NestJS Endpoints

| Supabase RPC Function | Target NestJS Endpoint | Behavioral Parity & Hardening Improvements |
|---|---|---|
| `create_guest_support_ticket(p_user_email, p_user_name, p_user_phone, p_category, p_subject, p_description, p_reference_listing_id, p_priority, p_attachments)` | `POST /api/v1/support/tickets` | Generates unique `ASH-TKT-XXXXXX`, validates `referenceListingId` exists if provided, persists `ticket_messages` initial record or `ticket_audit_events` inside one Prisma `$transaction`, and returns a signed/hashed **guest ticket receipt token** in addition to ticket data. |
| `lookup_support_ticket(p_ticket_number, p_user_email)` | `POST /api/v1/support/tickets/guest-lookup` | Case-insensitive `ticketNumber` + `userEmail` exact verification (`Citext`), rate-limited (`10 req / 15m`), excludes all `ticket_messages` with `isInternal = true` and omits `ticket_audit_events`. |
| `add_guest_ticket_reply(p_ticket_number, p_user_email, p_sender_name, p_message, p_attachments)` | `POST /api/v1/support/tickets/:id/messages` (accepts JWT or validated guest `{ ticketNumber, userEmail }`) | Enforces `status !== 'closed'`, forces `isInternal = false` and `senderRole = 'user'`, updates `support_tickets.updated_at` and appends `ticket_audit_events` atomically. |

---

## 6. Database Functions, Triggers & RLS Mapping → Target Architecture

| Supabase Trigger / Helper | Source Migration | Target Replacement Strategy |
|---|---|---|
| `is_admin()` / `is_support_admin()` | `20261019` / `20261021` / `20261112` | **`RolesGuard` + `UsersService`** validating `user.role === 'admin'` AND `user.accountStatus === 'active'` from authoritative DB/short-TTL cache. |
| `handle_new_user()` | `20261018` / `20261022` | **`AuthService.register()` & `handleGoogleCallback()`** execute an atomic `prisma.$transaction` inserting `users` + `profiles` + `verification_tokens` (or `oauth_identities`) together. |
| `enforce_profile_role_integrity()` & `enforce_verification_integrity()` | `20261019` / `20261020` | **`UpdateProfileDto` whitelist** (`fullName`, `bio`, `avatarUrl`, `phoneNumber` resetting `phoneVerified=false` if changed) + strict admin-only endpoint (`PATCH /admin/users/:id/verification`) auditing every change. |
| `enforce_property_moderation_integrity()` | `20261019` / `20261112` | **`PropertiesService.create()`** hardcodes `status = 'pending_review'`; **`update()`** resets to `'pending_review'` if material fields change for non-admins; **`updateStatus()`** allows owner transitions strictly between `'active'`, `'paused'`, `'rented'` only after prior approval. |
| `enforce_listing_host_prerequisites()` & `enforce_inquiry_prerequisites()` | `20261020` | **`PropertiesService` / `FamilyStaysService` / `InquiriesService`** call shared `EligibilityService` reading fresh DB `profiles` (`emailVerified`, `phoneVerified`, `accountStatus`) inside the transaction before writing. |
| `enforce_flatmate_verification_integrity()` | `20261026` | **`FlatmatesService.upsertMyProfile()`** ignores client `verified` boolean and derives `verified = Boolean(profile.phoneVerified && profile.idVerified)`. |
| `fn_validate_ticket_status_transition()` | `20261021` | **`SupportService.transitionStatus()`** enforces `VALID_STATUS_TRANSITIONS` map (`open -> in_review|awaiting_user|resolved|closed`, etc.) inside `$transaction` and writes `TicketAuditEvent`. |
| `enforce_tenancy_parties_integrity()` | `20261023` / `20261027` | **`TenancyService.createAgreement()`** verifies `landlordId !== tenantId`, caller is `landlordId`, `tenantId`, or `admin`, and referenced `propertyId` exists. Plus SQL `CHECK (landlord_id <> tenant_id)`. |
| `enforce_payment_verification_integrity()` | `20261023` / `20261027` | **`TenancyService.recordPayment()`** forces `pending_confirmation`; **`verifyPayment()`** requires caller `=== agreement.landlordId` (or `admin`). |
| `enforce_review_eligibility()` | `20261024` | **`RentalTrustService.submitReview()`** verifies non-draft agreement participation, computes `overallRating = round((comm+maint+care+clarity)/4, 1)` server-side, and relies on `UNIQUE (agreement_id, reviewer_id)`. |
| `enforce_dispute_integrity()` | `20261024` | **`RentalTrustService.fileDispute()`** derives `respondentId` from the agreement counterparty (never trusting client body), generates `ASH-DSP-XXXXXX`, and relies on `uq_active_dispute_per_agreement_type`. |
| `fn_touch_updated_at()` | `20261018` / `20261021` | Handled by Prisma `@updatedAt` + DB `DEFAULT now()` for direct SQL writes. |

---

## 7. Storage Buckets & Policies Mapping

| Supabase Bucket | Access Model | Size / MIME Policy | Target Object Storage & Access Guard |
|---|---|---|---|
| `property-photos` | Public read / Auth owner write (`{userId}/*`) | 5 MB (`image/jpeg`, `image/png`, `image/webp`) | Public S3/R2 bucket behind CDN (`media.aashvo.in/property-photos/...`), uploaded only via `MediaModule` authenticated presigned PUT + confirmed by owner. |
| `user-avatars` | Public read / Auth owner write (`{userId}/*`) | 2 MB (`image/jpeg`, `image/png`, `image/webp`) | Public S3/R2 bucket behind CDN (`media.aashvo.in/user-avatars/...`). |
| `support-attachments` | Private read (owner + support admin + guest ticket uploader) | 5 MB (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) | **Private S3/R2 bucket** (Block Public Access = ON); downloads strictly served via 15m presigned GET from `POST /api/v1/media/:id/presign-download` after verifying ticket ownership/guest receipt or staff role. |
| `rental-documents` | Private read (agreement `landlord_id`, `tenant_id`, or `admin`) | 10 MB (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) | **Private S3/R2 bucket** (Block Public Access = ON); `MediaModule.presignDownload()` checks `TenancyAgreement` / `RentPaymentRecord` / `PropertyInspection` / `RentalDispute` participation before issuing 15m presigned GET. |

