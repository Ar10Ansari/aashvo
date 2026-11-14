# AASHVO — Migration Acceptance, Security Readiness & India DLT Checklist (Sprint 0)

**Scope:** Mandatory verification gates across Database Migration (C), Security & Operations Readiness (E), and Indian TRAI SMS DLT + MSG91 Preparation (F).  
**Rule on SLAs & External Proof:** RPO (`≤ 5 min`) and RTO (`< 15 min`) are **explicitly treated as unverified design targets until demonstrated by an executed staging restore test**. Zero fabricated DLT entity details or untested guarantees are permitted.  
**Skills Applied:** `postgresql-devsec`, `database-security`, `database-backups`, `backup-recovery`, `api-security`, `hunt-jwt-crypto`, `hunt-oauth`, `hunt-session`, `security-and-hardening`, `audit-logging`, `observability-and-instrumentation`, `data-privacy-controls`, `email-security`

---

## Part C — Database & Migration Acceptance Verification Checklist

### C.1 Schema & Constraint Coverage (`15 Existing + 8 Independent Tables`)
| Gate ID | Verification Item | Status in Blueprint | Required Proof Before Cutover |
|---|---|---|---|
| **DB-01** | All **15 existing `public.*` tables** (`profiles`, `properties`, `property_photos`, `flatmate_profiles`, `interest_requests`, `listing_reports` archive, `support_tickets`, `ticket_messages`, `ticket_audit_events`, `safety_reports`, `tenancy_agreements`, `rent_payment_records`, `property_inspections`, `tenancy_reviews`, `rental_disputes`) mapped 1:1 with preserved PK UUIDs. | Verified in `POSTGRESQL_DATABASE_DESIGN.md` | Target Postgres schema diff & zero dropped historical columns. |
| **DB-02** | All **8 new independent tables** (`users`, `oauth_identities`, `refresh_sessions`, `verification_tokens`, `phone_otp_challenges`, `media_assets`, `audit_logs`, `notification_outbox`) provisioned cleanly. | Verified in `POSTGRESQL_DATABASE_DESIGN.md` | `prisma migrate deploy` + `0002_postgres_checks_and_gin_indexes.sql` pass cleanly on empty Postgres 16. |
| **DB-03** | Foreign keys (`support_*`/`safety_reports` retargeted to `users.id` via preserved UUIDs), `UNIQUE (flatmate_profiles.user_id)`, `UNIQUE (agreement_id, reviewer_id)`, `uq_active_dispute_per_agreement_type`, `GIN` array indexes, and all `CHECK` constraints enforced at PostgreSQL engine level. | Verified in `0002_postgres_checks_and_gin_indexes.sql` | SQL tests confirming DB rejects invalid `chk_family_stay_eligibility`, self-inquiry, duplicate active dispute, and rating out-of-bounds. |
| **DB-04** | **3 Views** (`public_profiles`, `public_properties`, `public_flatmates`) replaced by field-allowlisted DTO projections excluding `owner_id`, `email`, exact `address_short`, and private phone numbers. | Mapped in `SUPABASE_TO_POSTGRESQL_MAPPING.md` | Supertest assertions verifying zero private fields in public API JSON responses. |
| **DB-05** | **3 Guest Support RPCs** (`create_guest_support_ticket`, `lookup_support_ticket`, `add_guest_ticket_reply`) replaced by rate-limited NestJS endpoints preserving `ASH-TKT-XXXXXX` + `email` match + `isInternal = false` filtering. | Mapped in `SUPABASE_TO_POSTGRESQL_MAPPING.md` | Integration tests for valid guest lookup, wrong-email `404`, closed ticket reply rejection, and internal note exclusion. |
| **DB-06** | **15 Triggers / Security Helpers** replaced by NestJS transactional guards + DB constraints (`handle_new_user`, `is_admin`, `enforce_profile_role_integrity`, `enforce_verification_integrity`, `enforce_property_moderation_integrity`, `enforce_listing_host_prerequisites`, `enforce_inquiry_prerequisites`, `enforce_flatmate_verification_integrity`, `fn_validate_ticket_status_transition`, `enforce_tenancy_parties_integrity`, `enforce_payment_verification_integrity`, `enforce_review_eligibility`, `enforce_dispute_integrity`, `fn_touch_updated_at`). | Mapped in `SUPABASE_TO_POSTGRESQL_MAPPING.md` | Automated negative regression test for every trigger invariant previously tested in Supabase migrations. |

### C.2 Repeatable Idempotent Migration, Reconciliation & Storage Recovery
- [ ] **MIG-01 (Topological ETL Order):** Verified 4-wave FK import (`auth.users -> users/oauth_identities/profiles -> properties/flatmate_profiles -> property_photos/interest_requests/tenancy_agreements/support_tickets/listing_reports -> payments/inspections/reviews/disputes/ticket_messages/ticket_audit_events/safety_reports`) wrapped in idempotent `ON CONFLICT (id) DO NOTHING` / delta timestamp upsert.
- [ ] **MIG-02 (Reconciliation Script Parity):** `verify-migration.ts` asserts `source_count === target_count` on every table, exact equality on `SUM(rent_amount)`, `SUM(monthly_rent)`, `SUM(amount)`, `SUM(disputed_amount)`, and `0` orphaned FKs.
- [ ] **MIG-03 (Storage SHA-256 Verification):** Every Supabase Storage object transferred to R2 (`property-photos`, `user-avatars`) or S3 Mumbai (`rental-documents`, `support-attachments`) is hashed with SHA-256 before & after upload (`byteLength` + `ETag`/checksum match) and recorded in `media_assets`.
- [ ] **MIG-04 (Missing-File Recovery Protocol):**
  - If ETL encounters a DB URL referencing a missing/404 object in Supabase Storage:
    1. Log structured exception `{ table, rowId, column, bucket, objectKey, error: 'MISSING_SOURCE_OBJECT' }` into an isolated `migration_storage_exceptions.json` report (**do NOT halt bulk valid rows**).
    2. Retry up to `3` times with exponential backoff on transient 5xx.
    3. For optional photo array items (`property_photos`), retain non-missing photos and flag listing for owner/admin re-upload; for critical agreement/dispute documents (`tenancy_agreements.document_url`), keep row linked cleanly and surface admin remediation banner before cutover sign-off.
- [ ] **MIG-05 (Rollback Triggers Verified):** Documented Stage A (pre-cutover abort = 0 impact), Stage B (instant `< 60s` Vercel `VITE_API_PROVIDER=supabase` revert within 30m), and Stage C (reverse-delta export script before flipping back within 7d), with Supabase untouched for `>= 30 days`.

---

## Part E — Security & Operational Readiness Verification Gates

*(All tests below must run automatically inside CI or Staging pre-cutover QA — never assumed.)*

| Control ID | Requirement | Required Automated / Operational Proof |
|---|---|---|
| **SEC-01** | **JWT Algorithm Pinning & `alg: none` Rejection** | Supertest suite sends forged tokens with `alg: "none"`, `alg: "None"`, `RS256->HS256` symmetric key confusion, injected `kid: "../../../../dev/null"`, injected `jku`/`jwk` headers, missing `exp`, and wrong `aud`/`iss`. Every case **must return `401`**. |
| **SEC-02** | **Refresh Rotation & Family Replay Detection** | Integration test logs in (`RT1`), refreshes to get `RT2`, then replays `RT1`: server **must return `401`** AND revoke the entire `family_id` so subsequent use of valid `RT2` **also fails (`401`)**! Verify `/logout`, `/logout-all`, password change, and user suspension immediately invalidate sibling refresh sessions and trigger Redis access cutoff. |
| **SEC-03** | **IDOR / Ownership & BFLA Authorization** | Negative tests proving User A receives `403`/`404` when reading/updating/deleting User B's draft listings, inquiries, flatmate profile, tenancy agreement, rent payments (and tenant self-confirming own payment), inspections, disputes, or admin moderation endpoints. Verify reported user cannot read `safety_reports`. |
| **SEC-04** | **Private File Authorization & Magic-Byte Validation** | Test 1: Stranger calling `POST /media/:id/presign-download` for `rental-documents` or `support-attachments` receives `403`. Landlord & Tenant counterparties receive 15m presigned URL (`200`).<br>Test 2: Uploading `.html` or `.svg` spoofed as `image/jpeg` fails `POST /media/:id/confirm` (`422`) and deletes the bucket object immediately. |
| **SEC-05** | **Least-Privilege PostgreSQL Roles** | Automated SQL privilege check running as runtime role `aashvo_app`: `CREATE TABLE`, `DROP TABLE`, and `DELETE FROM audit_logs` / `UPDATE audit_logs` **must fail with permission denied (`42501`)**. |
| **SEC-06** | **Rate Limiting & Brute-Force Protection** | Automated Supertest burst tests against Upstash-backed `@nestjs/throttler`: login throttling & lockout increment, OTP 60s cooldown + 4/hr cap + 5-attempt lockout, guest ticket lookup rate limit returning `429` + `Retry-After`. |
| **SEC-07** | **Secret Management & Client Bundle Hygiene** | `apps/api` validates all required env secrets at startup (Zod/Joi fail-fast); zero secrets in `packages/contracts`, `vercel.json`, or `VITE_*`; CI runs secret scanning; built `dist/` grep verifies zero backend keys/JWT signing keys shipped to browser. |
| **OPS-01** | **Backup Restoration & DR Test *(Targets Only Until Proven)*** | **Important:** **RPO ≤ 5 minutes** and **RTO < 15 minutes** are unverified architectural **targets** until Sprint 8 executes and times a full Staging drill:<br>1. Restore DO Managed PG PITR fork + S3 Mumbai encrypted `restic pg_dump` into isolated DB.<br>2. Measure wall-clock elapsed time (`target < 15m`) and verified transaction currency (`target ≤ 5m`).<br>3. Verify row counts, Prisma schema parity, and checksums match source. |
| **OPS-02** | **PII-Redacted Structured Logging & Correlation** | Assert every HTTP response carries `X-Request-ID`; inspect Pino logs captured during test suite verifying **zero occurrences** of plaintext passwords, `$2b$`/`$argon2id$` hashes, OTP codes, JWT/refresh tokens, `Authorization` headers, cookies, or full phone numbers. |
| **OPS-03** | **Email Deliverability & Spoofing Controls** | Before production cutover: verify `SPF`, `DKIM` (2048-bit), and `DMARC` (`p=quarantine` progressing to `p=reject`) DNS records for `aashvo.in` sending domain on Resend / Amazon SES (`ap-south-1`). |

---

## Part F — Indian SMS TRAI DLT Registration & MSG91 Integration Design

> [!IMPORTANT]
> **Compliance Rule:** No DLT applications, payments, or legal details have been submitted or invented. Replace all `[PLACEHOLDER]` fields strictly from verified corporate incorporation/tax documents before portal submission.

### F.1 Required Entity Documents & Registration Checklist (Operator DLT Portal: Jio / Airtel / Vi / BSNL)
1. **Legal Entity Prerequisites (Fill with Official Documents Only):**
   - Legal Entity Name: `[LEGAL_ENTITY_NAME]`
   - Entity Type: `[Pvt Ltd / LLP / Sole Proprietorship / Partnership]`
   - Corporate PAN: `[ENTITY_PAN]`
   - GSTIN *(if registered)*: `[ENTITY_GSTIN]`
   - CIN / Udyam / Shop & Establishment Cert: `[REGISTRATION_DOCUMENT_ID]`
   - Authorized Signatory Name, Official Email & Mobile: `[SIGNATORY_NAME / EMAIL / PHONE]`
   - Letter of Authorization (signed on company letterhead authorizing `[SIGNATORY_NAME]`)
   - Official Website & App Proof: `https://aashvo.vercel.app/` *(or `https://aashvo.in/` once linked)*

2. **DLT Portal Step-by-Step Sequence (Allow 5–10 Business Days Lead Time):**
   - [ ] **Step 1 — Principal Entity (PE) Registration:** Submit KYC documents on chosen primary operator DLT portal and obtain verified **19-digit Principal Entity (PE) ID**.
   - [ ] **Step 2 — Alphabetic Sender ID (Header) Registration:** Register 6-character uppercase **Service Implicit / Transactional** header (candidate: `AASHVO` + fallback e.g. `ASHVOO` if taken; OTP/transactional traffic cannot use numeric promotional headers).
   - [ ] **Step 3 — PE-Telemarketer (PE-TM) Chain Binding:** Inside the DLT portal, approve/bind **MSG91's Telemarketer ID** in the PE→TM delivery chain *(mandatory per TRAI PE-TM traceability enforcement — messages fail carrier scrubbing without an approved chain!)*.
   - [ ] **Step 4 — Mandatory Content Template Approvals (`{#var#}` syntax, max 30 chars per variable):**

| Template Key | DLT Route Category | Draft Approved-Format SMS Text *(Submit Exact Text)* | Purpose |
|---|---|---|---|
| `otp_verification` | Service Implicit (Transactional) | `Your Aashvo verification code is {#var#}. Valid for 10 minutes. Do not share this OTP with anyone. - Aashvo` | Phone verification (`AuthModule`) replacing `'654321'` mock |
| `inquiry_alert` | Service Implicit | `New interest received on Aashvo for {#var#}. Sign in to review and respond safely. - Aashvo` | Optional SMS alert to phone-verified host *(if enabled later)* |
| `support_ticket_ack` | Service Implicit | `Your Aashvo support ticket {#var#} has been logged. Track updates in Help Center. - Aashvo` | Support confirmation *(optional)* |

*(Keep fixed brand name `- Aashvo` and exact punctuation identical between the DLT template portal and MSG91 API payload — even a trailing space mismatch causes TRAI DLT scrubber drops!)*

### F.2 MSG91 Integration Architecture (Vendor-Independent Security Design)
- **Key Architectural Choice:** Use MSG91 **Flow / Transactional SMS API v5** as a pure *delivery transport* while **NestJS `AuthModule` owns OTP generation, hashing, expiry, cooldown, and verification**!
  - *Why:* Avoids vendor lock-in inside MSG91's own OTP widget, guarantees OTP codes never leak plaintext into logs or DB, preserves instant provider swap (`MSG91` ↔ `Twilio` ↔ `Kaleyra`) behind `ISmsGateway`, and uses our audited `phone_otp_challenges` table + Redis rate limiter consistently.
- **Exact Flow:**
  1. `POST /api/v1/auth/phone/send-otp` validates `+91[6-9]\d{9}`, checks `60s` cooldown & `4/hr` cap, generates `crypto.randomInt(100000, 1000000)`, stores `HMAC-SHA256` inside `phone_otp_challenges` (`10m` TTL, `5` attempts), and writes `notification_outbox` (`templateKey: 'otp_verification'`, masked phone + template variables).
  2. Outbox dispatcher calls `POST https://control.msg91.com/api/v5/flow` with header `authkey: <MSG91_AUTH_KEY>`, `template_id: <MSG91_FLOW_ID>`, `sender: <APPROVED_6_CHAR_HEADER>`, `DLT_TE_ID: <DLT_TEMPLATE_ID>`, `recipients: [{ mobiles: "91XXXXXXXXXX", var1: otp }]`.
  3. **Timeout & Failure Hygiene:** 5-second HTTP timeout (`AbortSignal.timeout(5000)`); log only delivery request ID + status code — **never log `otp` or `authkey`** (`security-and-hardening`).
  4. **Local/CI Mode:** `SMS_PROVIDER=sandbox` routes to an in-memory/test-only sink (`SandboxSmsAdapter`, strictly forbidden at boot if `NODE_ENV === 'production'`).

