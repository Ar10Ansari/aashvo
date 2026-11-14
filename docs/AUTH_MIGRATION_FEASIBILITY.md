# AASHVO — Authentication Migration Feasibility & Cryptographic Proof (Sprint 0)

**Scope:** Proving identity preservation, password hash compatibility (or safe fallback), OAuth continuity, duplicate prevention, and zero-hash-exposure discipline when migrating from Supabase GoTrue (`aashvo-dev`, ref `himtwnwxvnnykafyhysy`) to NestJS `AuthModule`.  
**Skills Applied:** `postgres-readonly-queries`, `hunt-jwt-crypto`, `hunt-oauth`, `hunt-session`, `security-and-hardening`, `audit-logging`

---

## 1. Local Supabase Auth Schema & Configuration Findings (Verified)

Inspection of the actual repository (`D:\Projects\AASHVO`) established the following verified auth baseline:

1. **Auth Config Baseline (`supabase/config.toml:156-325`):**
   - `enable_signup = true`, `enable_anonymous_sign_ins = false`, `enable_manual_linking = false`.
   - `jwt_expiry = 3600` (1 hour in GoTrue config; will harden to `900s` / 15 min in NestJS).
   - `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10` (target NestJS removes 10s replay grace for strict family revocation).
   - `minimum_password_length = 6` in local Supabase config (migrated passwords may be 6–7 chars; enforce ≥ 8 chars on *new* signups/resets while allowing valid existing hashes to verify and upgrade cleanly).
   - `[auth.email] enable_confirmations = false` in local dev config (hosted `aashvo-dev` may contain both confirmed `email_confirmed_at IS NOT NULL` and unconfirmed accounts).
   - `[auth.sms] enabled = false` — SMS OTP was **never** enabled in Supabase GoTrue (`src/services/authService.ts:435` runs a local mock `'654321'` code).

2. **Database Foreign-Key Coupling to `auth.users` (Verified Across 12 Migrations):**
   - `public.profiles(id)` references `auth.users(id) ON DELETE CASCADE`, populated by `handle_new_user()` trigger (`20261018`, `20261022`).
   - `support_tickets.user_id`, `ticket_messages.sender_id`, `ticket_audit_events.actor_id`, and `safety_reports.reporter_id` reference `auth.users(id)` directly (`20261021`).
   - Every other domain table (`properties`, `flatmate_profiles`, `interest_requests`, `tenancy_agreements`, `rent_payment_records`, `property_inspections`, `tenancy_reviews`, `rental_disputes`) references `public.profiles(id)`.

3. **Hosted `auth.users` Access Status (Explicit Unverified Dependency):**
   - No `.env`, `SUPABASE_ACCESS_TOKEN`, DB password, MCP account (`list_plugin_accounts` empty), or running Docker Postgres container exists in this workstation.
   - Therefore **live `auth.users` and `auth.identities` rows on hosted `aashvo-dev` could NOT be inspected yet**. Seamless password migration is explicitly conditioned on passing the read-only preflight check in §2.

---

## 2. Password Hash Verification & Upgrade Proof (`bcrypt` → `Argon2id`)

### 2.1 Why Supabase GoTrue Bcrypt Hashes Are Verifiable in Node.js (Subject to Preflight Proof)
Supabase GoTrue (`supabase/auth`, written in Go using `golang.org/x/crypto/bcrypt`) generates standard OpenBSD Blowfish bcrypt Modular Crypt Format hashes (`$2a$10$...` or `$2b$10$...`, 60 ASCII characters).  
In Node.js (`bcrypt` or `bcryptjs` C/JS implementations):
- `$2a$` and `$2b$` hashes produced by Go's `bcrypt.GenerateFromPassword` are **cryptographically identical and directly verifiable** via `bcrypt.compare(candidatePassword, storedHash)` (matching UTF-8 byte handling and standard 72-byte bcrypt input semantics).
- Should any legacy record carry `$2y$` (PHP variant), normalizing the prefix `$2y$` → `$2b$` yields identical verification behavior.

### 2.2 Read-Only Preflight Classification Gate (Zero Hash Values Exposed!)
Before guaranteeing zero-reset migration for all users, an authorized operator executes this **aggregate-only read-only SQL check** against `aashvo-dev` (never printing or exporting raw `encrypted_password` strings):

```sql
-- Safe aggregate classification ONLY — outputs counts, zero credential material
SELECT
  count(*) AS total_auth_users,
  count(*) FILTER (
    WHERE encrypted_password ~ '^\$2[aby]\$[0-9]{2}\$.{53}$'
  ) AS valid_bcrypt_users,
  count(*) FILTER (
    WHERE (encrypted_password IS NULL OR encrypted_password = '')
      AND EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = u.id AND i.provider <> 'email'
      )
  ) AS oauth_only_no_password,
  count(*) FILTER (
    WHERE (encrypted_password IS NULL OR encrypted_password = '' OR encrypted_password !~ '^\$2[aby]\$[0-9]{2}\$.{53}$')
      AND NOT EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = u.id AND i.provider <> 'email'
      )
  ) AS requires_password_reset_fallback,
  count(*) FILTER (WHERE email IS NULL) AS missing_email_anomalies
FROM auth.users u;
```

### 2.3 Progressive On-Login Hash Upgrade State Machine
1. During Phase 7 ETL, `encrypted_password` matching `^\$2[aby]\$` copies inside a TLS-encrypted direct DB stream into `users.password_hash` with `password_hash_algorithm = 'bcrypt_migrated'` (never stored in CSV/JSON logs or console output).
2. On `POST /api/v1/auth/login`:
   - If `password_hash_algorithm === 'argon2id'` → verify via `argon2.verify(hash, plain)`.
   - If `password_hash_algorithm === 'bcrypt_migrated'` → verify via `bcrypt.compare(plain, normalizedHash)`. On **valid password match**, compute `argon2.hash(plain, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 })` and atomically update `password_hash` + set `password_hash_algorithm = 'argon2id'` inside the login transaction.
   - If verification fails → increment `failed_login_attempts`, apply progressive lockout if threshold reached, and return generic `401 Invalid credentials`.
3. **Zero External Bcrypt Proof Exception:** Until the preflight query above returns `requires_password_reset_fallback = 0` AND a non-production golden sample test passes Node `bcrypt.compare()` in Staging, **passwordless transparent login for legacy password users remains an explicit condition (`READY WITH CONDITIONS`)**.

---

## 3. Secure Password-Reset Fallback (Unverified / Empty / Non-Bcrypt Accounts)

For any row flagged as `requires_password_reset_fallback` (or empty/corrupted/incompatible hash):
1. ETL sets `users.password_hash = NULL`, `users.password_hash_algorithm = 'none'`, and `users.password_reset_required = true`.
2. Attempting password login does **not** leak hash state externally or fail silently — if credentials fail because `password_reset_required = true` and user's email matches a verified account, the backend returns HTTP `403` (`PASSWORD_UPGRADE_REQUIRED`) and prompts `"We upgraded our security platform — check your email to set a new password"`, automatically throttling & emailing a single-use 30-minute SHA-256-hashed reset token (`verification_tokens`).
3. Users with unverified emails must first prove mailbox ownership via the `email_verification` flow before setting a password.
4. Completing password reset writes an **Argon2id** hash, flips `password_reset_required = false`, sets `profiles.email_verified = true`, and revokes all sessions.

---

## 4. OAuth Identity Migration Approach (`Google OAuth 2.0`)

1. **Identity Preservation:** `auth.identities` rows where `provider <> 'email'` (specifically `google`) migrate directly into `oauth_identities(user_id, provider, provider_subject, provider_email, email_verified, raw_claims)`, mapping Supabase `provider_id` (or `identity_data->>'sub'`) → `provider_subject` with a `UNIQUE (provider, provider_subject)` index.
2. **Runtime PKCE + State/Nonce Flow:**
   - Exact static callback URI (`https://api.aashvo.in/api/v1/auth/oauth/google/callback`) — wildcard/client-supplied `redirect_uri` rejected.
   - Server generates cryptographic `state`, PKCE `code_verifier` (`S256`), and OIDC `nonce` persisted in Upstash Redis (5m TTL, single-use `GETDEL`).
   - Google OAuth `client_secret` stays strictly on NestJS backend containers.
3. **Anti-Pre-Hijacking Account Linking Rule (`hunt-oauth`):**
   - Match `(provider: 'google', providerSubject: sub)` first → seamless login into migrated `userId`.
   - If no `(provider, sub)` row exists, check `users.email` (Citext case-insensitive match):
     - **Verified-to-Verified Link Only:** Auto-link `oauth_identities` ONLY when Google `email_verified === true` **AND** existing `profiles.email_verified === true`.
     - If existing AASHVO account has `profiles.email_verified === false`: **Block automatic linking!** Require existing account password verification (or explicit verified-email cleanup) so an attacker cannot pre-register a victim's unverified email and hijack their future Google sign-in.

---

## 5. Duplicate-Account Prevention & User-ID Preservation Guarantees

1. **1:1 Preserved UUID Contract:**
   - `users.id` == `profiles.id` == original `auth.users.id`.
   - `support_tickets.user_id`, `ticket_messages.sender_id`, `ticket_audit_events.actor_id`, and `safety_reports.reporter_id` cleanly retarget to `users.id` with identical UUID values (`0` broken history).
2. **Preflight Duplicate Email / Phone Check:**
   - Before migration, check `SELECT lower(email), count(*) FROM auth.users GROUP BY 1 HAVING count(*) > 1;` and verify `auth.users.id` vs `public.profiles.id` have 100% 1:1 pairing (flag any orphaned `auth.users` missing `profiles` row or vice versa).
3. **Database-Level Uniqueness Enforcement:**
   - `users.email` (`@db.Citext @unique`) and `profiles.email` (`@db.Citext @unique`) enforce case-insensitive uniqueness natively at the PostgreSQL layer (`Alice@x.com` == `alice@x.com`).
   - `oauth_identities` enforces `UNIQUE (provider, provider_subject)`.
   - `flatmate_profiles` enforces `UNIQUE (user_id)`.
4. **Zero Credential Exposure Rule:**
   - Prisma queries explicitly omit `passwordHash` from default user projections; Pino logger redacts `password`, `passwordHash`, `encrypted_password`, `otp`, `token`, `refreshToken`, and `authorization` headers across every log stream and migration script.

