# AASHVO — Backend Implementation & Migration Roadmap (Sprints 0–10)

**Program Goal:** Execute a disciplined, zero-data-loss migration from Supabase (`aashvo-dev`) to an independent NestJS + PostgreSQL (Prisma) + S3/R2 platform while preserving the existing frontend UX on `https://aashvo.vercel.app/` and keeping Supabase untouched as a safe standby.  
**Skills Applied:** `code-review-and-quality`, `vitest-skill`, `debugging-and-error-recovery`, `api-security`, `database-backups`

---

## 1. Non-Negotiable Cross-Sprint Engineering & Test Gates

Every backend PR merged across Sprints 1–10 must pass:
1. **Strict TypeScript + Lint + OpenAPI Check:** Zero `any` leaks on DTOs; regenerated OpenAPI 3.1 contract diff verified cleanly.
2. **Real PostgreSQL Integration Suite (Jest / Vitest + Supertest + Testcontainers PostgreSQL 16):** Tests **must execute against real PostgreSQL constraints & transactions** (including `0002_postgres_checks_and_gin_indexes.sql`), not solely mocked Prisma clients.
3. **Mandatory Negative Security Regression Suite (per module):**
   - *Privilege Escalation:* Non-admin `PATCH` attempting `role`, `phoneVerified`, `idVerified`, or listing `status: 'active'` rejected (`403`/`422`).
   - *Cross-Tenant IDOR / BOLA:* Tenant A cannot read/modify Tenant B's draft listings, sent/received inquiries, tenancy payments, disputes, private `rental-documents`, or `support-attachments`.
   - *JWT / Session Attack Matrix (`hunt-jwt-crypto` / `hunt-session`):* `alg: none` rejected, RS256→HS256 rejected, expired token rejected, replaying rotated refresh token immediately revokes entire `family_id`, logout & password-change kill active refresh sessions.
4. **Vitest Frontend Contract Parity:** `npm run typecheck`, `npm test`, and Playwright critical-path browser suite against staging API.

---

## 2. Sprint-by-Sprint Execution Plan

### Sprint 0 — Cloud Provisioning, DLT Legal Lead-Time & Hosted Supabase Inspection
- **Objectives:** Unblock external dependencies and inspect live `aashvo-dev` data read-only before writing migration code.
- **Tasks:**
  1. Finalize CTO infrastructure tier sign-off (`DigitalOcean BLR1 + Cloudflare R2` launch vs `AWS Mumbai ap-south-1`).
  2. Initiate **TRAI DLT Principal Entity + Sender ID + OTP Template** registration (5–10 business days external approval lead time!).
  3. Set up Google Cloud OAuth 2.0 production client credentials (`api.aashvo.in/api/v1/auth/oauth/google/callback`) + Resend/SES domain DKIM/SPF (`aashvo.in`).
  4. Run read-only preflight audit SQL on `aashvo-dev` (`auth.users` hash algorithms, `auth.identities`, duplicate checks, table row counts, `storage.objects` inventory).
- **Acceptance Criteria:** Written record of `aashvo-dev` schema parity & `auth.users` hash prefixes; provisioning credentials stored solely in Secrets Manager / CI encrypted secrets.
- **Rollback Trigger:** N/A (read-only preparation).

### Sprint 1 — NestJS Monolith Foundation, Prisma Schema & Observability
- **Objectives:** Establish production-ready backend repository (`aashvo-api`), database schema, migrations, health probes, structured logging, and audit core.
- **Target Modules:** `ConfigModule`, `PrismaModule`, `RedisModule`, `ObservabilityModule`, `AuditModule`, `HealthModule`.
- **Tasks:**
  1. Initialize strict NestJS 11 + TypeScript repository with Helmet, CORS allowlist, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, global `RequestIdInterceptor`, and standardized `GlobalExceptionFilter`.
  2. Implement complete `prisma/schema.prisma` + `0002_postgres_checks_and_gin_indexes.sql` matching `docs/POSTGRESQL_DATABASE_DESIGN.md`.
  3. Configure `aashvo_migrator` vs least-privilege `aashvo_app` DB roles (`audit_logs` append-only).
  4. Wire Pino JSON logger with field redaction, OpenTelemetry tracing, `/health/live`, `/health/ready`, and Swagger OpenAPI 3.1 generator.
- **Acceptance Criteria:** Migrations apply cleanly on blank Postgres 16; `GET /health/ready` returns `200` when Postgres+Redis healthy and `503` if degraded; append-only `audit_logs` prevents `UPDATE`/`DELETE` by `aashvo_app`.

### Sprint 2 — Authentication, Sessions, Google OAuth & India SMS OTP
- **Objectives:** Deliver full independent identity lifecycle replacing GoTrue and simulated `'654321'` OTP.
- **Target Modules:** `AuthModule`, `UsersModule`, `ProfilesModule`, `NotificationsModule` (auth emails & SMS adapter).
- **Tasks:**
  1. Implement `AuthService`: Argon2id hashing + transparent `$2a$`/`$2b$` bcrypt verification & upgrade-on-login + `password_reset_required` flow if empty hash.
  2. Implement asymmetric EdDSA/RS256 JWT (15m) + `JwtAuthGuard` (global `APP_GUARD`) + `RolesGuard` (DB/Redis suspension check).
  3. Implement opaque rotating `RefreshSession` service with family reuse detection, `__Host-aashvo_rt` web cookie + mobile bearer flow, `/logout`, `/logout-all`, password-change invalidation.
  4. Implement Google OAuth2 PKCE + `state`/`nonce` + strict `email_verified` linking guard + 30s one-time handoff exchange.
  5. Implement `PhoneOtpService` (`crypto.randomInt`, 60s cooldown, 4/hr cap, 5-attempt lockout, MSG91 DLT integration) + `ProfilesModule` whitelist & DPDP delete workflow.
- **Security & Test Gate:** Automated integration tests for `alg: none`, refresh replay family kill, OAuth CSRF/pre-hijack block, OTP brute-force lockout, and anti-forgery `PATCH /profiles/me` (`role: 'admin'` rejected).

### Sprint 3 — Object Storage & Media Security (`MediaModule`)
- **Objectives:** Implement S3/R2 presigned upload/download service and magic-byte verification for all 4 buckets.
- **Target Modules:** `MediaModule`.
- **Tasks:**
  1. Build S3 SDK v3 adapter compatible with both Cloudflare R2 and AWS S3.
  2. Implement `POST /media/presign-upload` (size & MIME checks), `POST /media/:id/confirm` (4KB header magic-byte check via `file-type` + SHA-256 + spoofed-file rejection), and `POST /media/:id/presign-download` (15m signed GET after authorization check).
  3. Add BullMQ daily orphan cleanup worker purging unconfirmed `pending_upload` objects > 24h old.
- **Security & Test Gate:** Test uploading renamed `.html` as `.jpg` (must reject `422` & delete bucket object); verify stranger attempting `presign-download` on private `rental-documents` or `support-attachments` receives `403`.

### Sprint 4 — Core Marketplace (`Properties`, `FamilyStays`, `Flatmates`, `Locations`)
- **Objectives:** Migrate property discovery, listing submission, Family Stays eligibility rules, and flatmate matching.
- **Target Modules:** `LocationsModule`, `PropertiesModule`, `FamilyStaysModule`, `FlatmatesModule`.
- **Tasks:**
  1. Implement `PropertiesService` (`PublicPropertyDto` excluding `ownerId` and masking `addressShort`, city/budget/category/geo/amenities GIN filters, atomic create with photos in `pending_review`, material-edit re-review trigger, availability freshness endpoint).
  2. Implement `FamilyStaysService` enforcing `providerType === 'owner'`, `familyLivesOnProperty === true`, and meal pricing validation.
  3. Implement `FlatmatesService` (1:1 `userId` upsert, server-derived `verified`, compatibility calculation).
- **Security & Test Gate:** Verify `GET /api/v1/properties` never serializes `owner_id`, `email`, or phone number; verify non-owner cannot `PATCH`/`DELETE` or force `status: 'active'`.

### Sprint 5 — Inquiries & Reliable Outbox Notifications
- **Objectives:** Complete inquiry workflows, host phone verification gates, and contact reveal rules.
- **Target Modules:** `InquiriesModule`, `NotificationsModule`.
- **Tasks:**
  1. Implement `POST /inquiries` checking prerequisite verified email + phone inside DB transaction, enforcing `chk_interest_request_target` and non-self-inquiry, supporting `Idempotency-Key`.
  2. Implement `PATCH /inquiries/:id/status` (`accepted`/`declined` by listing owner or target flatmate) enabling selective owner phone reveal on accepted inquiries.
  3. Wire `NotificationOutbox` + BullMQ worker dispatching Resend/SES emails and SMS alerts cleanly with exponential backoff and zero secret logging.

### Sprint 6 — Support Desk, Confidential Safety Reports & Admin Moderation
- **Objectives:** Replace guest RPCs, internal message isolation, safety triage, and admin workflows.
- **Target Modules:** `SupportModule`, `SafetyModule`, `AdminModule`.
- **Tasks:**
  1. Implement authenticated + guest support ticket creation (`ASH-TKT-XXXXXX`), case-insensitive `POST /support/tickets/guest-lookup` (strictly stripping `isInternal` messages & audit events), state machine transitions (`VALID_STATUS_TRANSITIONS`), and staff replies.
  2. Implement `SafetyModule` duplicate check, severity auto-triage, and total invisibility from the reported user/owner.
  3. Implement `AdminModule` moderation endpoints (listing approve/reject with reason, safety resolution + optional listing suspension, user KYC verification/suspension, `AuditLog` persistence).
- **Security & Test Gate:** Automated test asserting guest lookup returns `404` on email mismatch and never exposes `isInternal = true` messages or `ticket_audit_events`; reported user cannot query `safety_reports`.

### Sprint 7 — Tenancy Agreements & Rental Trust Ecosystem
- **Objectives:** Deliver full parity for agreements, payment verification, inspections, reviews, and disputes.
- **Target Modules:** `TenancyModule`, `RentalTrustModule`.
- **Tasks:**
  1. Implement `TenancyService` (distinct-party check, date validation, status transitions, payment recording + landlord-only confirmation).
  2. Implement `RentalTrustService` (inspections + non-author counterparty acknowledgment, single-per-party reviews for non-draft agreements with server-computed `overallRating`, itemized disputes `ASH-DSP-XXXXXX` with active-type uniqueness and admin resolution).
  3. Wire `MediaModule` counterparty authorization resolver for `rental-documents` presigned downloads.
- **Security & Test Gate:** Non-party third user receives `403`/`404` across all agreement/payment/inspection/dispute/document endpoints; tenant cannot self-confirm own rent payment (`403`).

### Sprint 8 — Data & Storage Migration Tooling + Dry-Run Verification
- **Objectives:** Build idempotent migration & reconciliation scripts and prove zero-data-loss transfer in Staging.
- **Deliverables:** `scripts/migrate-storage.ts`, `scripts/migrate-db.ts`, `scripts/verify-migration.ts`, `scripts/rollback-export-delta.ts`.
- **Tasks:**
  1. Execute full ETL + R2/S3 sync from a non-destructive read snapshot of `aashvo-dev` into Staging PostgreSQL + R2/S3.
  2. Run `verify-migration.ts` verifying 100% row parity, sum parity, zero orphans, SHA-256 storage checksums, and legacy bcrypt login upgrade.
  3. Execute full Staging **Backup & `pg_restore` Disaster Recovery Drill** to confirm RTO `< 15m` / RPO `<= 5m`.
- **Acceptance Criteria:** Reconciliation script exits `0` with zero discrepancies; Stage C reverse-delta rollback script verified in Staging.

### Sprint 9 — Frontend API Adapter Integration & Staging E2E QA
- **Objectives:** Implement `src/shared/api-client/` behind `VITE_API_PROVIDER` without altering existing UI/UX.
- **Target Repo:** `D:\Projects\AASHVO`.
- **Tasks:**
  1. Add `httpClient.ts` (in-memory token, single-flight refresh, `X-Request-ID`), generated OpenAPI types, and NestJS service adapters (`Auth`, `Marketplace`, `Support`, `Rental`, `Media`).
  2. Gate `Demo Personas` & `SEED_*` / `localStorage` mocks cleanly out of production (`VITE_APP_ENV=production`).
  3. Update `vercel.json` CSP allowlist for `api.aashvo.in` and `media.aashvo.in` (in Staging/Preview PR).
  4. Run full Playwright + Vitest suite against Staging NestJS API (`0` failed/skipped tests on real API).

### Sprint 10 — Production Cutover, Monitoring & Supabase Cooling Period
- **Objectives:** Execute clean production switch with instant rollback safety.
- **Tasks:**
  1. *T-24h:* Pre-sync storage objects & run final baseline read-only audit on `aashvo-dev`.
  2. *Cutover Window (off-peak):* Enable brief maintenance freeze (5–10m) → run incremental DB + Storage delta ETL → run `verify-migration.ts` → promote Vercel `VITE_API_PROVIDER=nestjs` (`https://aashvo.vercel.app/`) → run production read/auth/presign smoke suite → lift freeze.
  3. Monitor latency, 5xx rates, Redis/PG pool health, email/SMS delivery, and auth error rates for 72h–30d.
  4. Keep `aashvo-dev` Supabase untouched in standby for ≥ 30 days; only decommission `@supabase/supabase-js` & Supabase project after explicit CTO sign-off.
- **Rollback Trigger:** Any unhandled auth failure > 2%, `5xx` > 1%, or payment/ticket persistence failure → execute Stage B/C rollback from `docs/DATA_MIGRATION_AND_ROLLBACK_PLAN.md`.

---

## 3. Open Questions & CTO Decisions Required Before Sprint 1 Coding

1. **Hosting Stage Selection:** Approve **Stage 1 (`DigitalOcean BLR1 + Cloudflare R2`, ~$55–85/mo)** for initial launch vs immediate **Stage 2 (`AWS ECS Fargate + RDS Multi-AZ ap-south-1`, ~$120–200+/mo)**?
2. **Private Document Data Residency:** Should `rental-documents` and `support-attachments` reside strictly on Indian servers (**AWS S3 `ap-south-1` Mumbai**) for DPDP/legal comfort even if `property-photos` stays on zero-egress Cloudflare R2?
3. **Repository Structure:** Should NestJS live inside a clean monorepo directory (`apps/api`, `packages/contracts` alongside `apps/web` in `Ar10Ansari/aashvo`) or a separate repository (`Ar10Ansari/aashvo-api`)? *(Monorepo or shared `@aashvo/contracts` OpenAPI package minimizes web + mobile type drift.)*
4. **TRAI DLT Entity Details:** Confirm corporate entity / GSTIN / PAN owner initiating MSG91 & DLT registration immediately in Sprint 0 so India SMS OTP is never blocked at Sprint 2.
5. **Legacy Admin & Seed User Disposition:** On hosted `aashvo-dev`, confirm which existing emails should retain `role = 'admin'` and whether existing synthetic `SEED_PROPERTIES` should be kept as curated demo listings or pruned prior to public marketing launch.

