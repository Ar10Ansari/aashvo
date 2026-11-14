# AASHVO — Authentication & Identity Migration Plan

**Scope:** Transitioning from Supabase GoTrue (`auth.users`, `auth.identities`, Supabase client JWTs) to an owned **NestJS `AuthModule` + PostgreSQL Identity Store** while preserving user UUIDs, verification state, OAuth linkages, and login continuity.  
**Skills Applied:** `hunt-jwt-crypto`, `hunt-oauth`, `hunt-session`, `api-security`, `cc-skill-security-review`, `audit-logging`

---

## 1. Current State & Privileged Inspection Gate

### 1.1 Verified Codebase Findings
- `src/services/authService.ts` currently binds authentication to Supabase GoTrue (`signUpWithSupabase`, `signInWithSupabase`, `initiateGoogleOAuthWithSupabase`, `resetPasswordWithSupabase`, `updatePasswordWithSupabase`) and keeps a client-side simulated SMS OTP generator (`const code = '654321'` at `authService.ts:435`) plus `verifiedPhoneRegistry` in memory.
- `src/components/auth/AuthModal.tsx` renders quick-fill `Demo Personas` in the UI regardless of environment unless gated explicitly.

### 1.2 Hosted `auth.users` Unverified State (Explicit Dependency Gate)
Because `aashvo-dev` (`himtwnwxvnnykafyhysy`, `ap-south-1`) has no credentials, `.env`, or Supabase CLI session in this workstation, we could **not** read live rows from `auth.users` or `auth.identities`.  
Before executing Phase 7 migration, an authorized operator with direct read-only Postgres access to `aashvo-dev` **must run**:
```sql
SELECT
  count(*) AS total_users,
  count(*) FILTER (WHERE encrypted_password LIKE '$2a$%' OR encrypted_password LIKE '$2b$%') AS bcrypt_hashes,
  count(*) FILTER (WHERE encrypted_password IS NULL OR encrypted_password = '') AS empty_passwords,
  count(*) FILTER (WHERE email_confirmed_at IS NOT NULL) AS verified_emails,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted
FROM auth.users;

SELECT provider, count(*)
FROM auth.identities
GROUP BY provider;
```
**This plan safely handles all possible query outcomes without risking lockouts or duplicate accounts.**

---

## 2. Target Independent Authentication Architecture

### 2.1 Password Hashing & Legacy Bcrypt Upgrade Strategy
- **Primary Hasher (New & Reset Passwords):** `argon2` (`Argon2id`, `memoryCost: 65536` (64 MiB), `timeCost: 3`, `parallelism: 1`, global server pepper concatenated via HMAC if configured).
- **Seamless Legacy Password Migration (`bcrypt_migrated` → `argon2id`):**
  - Supabase GoTrue hashes email/password credentials with standard **bcrypt** (`$2a$` or `$2b$`).
  - During DB migration, standard `$2a$`/`$2b$` hashes are copied verbatim into `users.password_hash` with `password_hash_algorithm = 'bcrypt_migrated'`.
  - When a migrated user logs in to NestJS `POST /api/v1/auth/login`:
    1. `AuthService` verifies the candidate password against `bcrypt.compare(plain, hash)`.
    2. On success, in the same login transaction, `AuthService` re-hashes the plaintext password using **Argon2id** and updates `password_hash` + sets `password_hash_algorithm = 'argon2id'`.
    3. Within weeks of normal login traffic, active users upgrade transparently with **zero forced password reset**.
- **Fallback If Hash Inspection Finds Incompatible/Empty Hashes (`password_hash IS NULL`):**
  - OAuth-only users (`oauth_identities` present, `password_hash IS NULL`) authenticate seamlessly via Google OAuth (`password_reset_required = false`).
  - Non-OAuth accounts missing transferable bcrypt hashes get `password_reset_required = true`; attempting password login triggers a clear verified-email `"Complete security upgrade — set new password"` flow using single-use reset email links — **never** creating a second user row or dropping historical listings/agreements.

### 2.2 Short-Lived Access JWT Hardening (`hunt-jwt-crypto` Defenses)
- **Algorithm:** **EdDSA (Ed25519)** or **RS256** asymmetric keypair managed via KMS / Secrets Manager (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` + `kid` rotation table). Zero symmetric HS256 shared secrets on API edges.
- **Strict Verifier Configuration (mandatory):**
  - Explicit algorithm allowlist: `algorithms: ['EdDSA']` (or `['RS256']`) — **blocks `alg: none` and RS256→HS256 key confusion**.
  - Reject unverified `jku`, `x5u`, embedded `jwk`, or file-path `kid` headers; lookup signing keys strictly from server memory allowlist indexed by `kid`.
  - Mandatory claims enforced on verification: `iss: 'https://api.aashvo.in'`, `aud: 'aashvo-clients'`, `exp` (**15 minutes**), `iat`, `jti` (UUIDv4), `sub` (`user.id` UUID).
  - Do **not** embed mutable authorization PII or large objects inside JWT payload beyond `{ sub, role, sid }`; `RolesGuard` checks authoritative `accountStatus` + `role` against short-TTL Redis revocation cache + DB.

### 2.3 Rotating Opaque Refresh Sessions (`hunt-session` Defenses)
Every login mints a cryptographic opaque refresh token (`crypto.randomBytes(48).toString('base64url')`, ≥ 256 bits entropy) stored ONLY as its `SHA-256` digest inside `refresh_sessions`:
- **Token Family Reuse Detection:** Each login initializes a `family_id`. Calling `POST /api/v1/auth/refresh` atomically:
  1. Validates `token_hash` exists, `expires_at > now()`, and `revoked_at IS NULL`.
  2. **If `replaced_by_hash IS NOT NULL` (already rotated token replayed!):** Immediately revokes **ALL** active sessions in that `family_id` (`revoked_reason = 'refresh_token_reuse_detected'`), logs a high-severity `AuditLog`, and returns `401 Unauthorized`.
  3. Otherwise marks current row `revoked_at = now()`, links `replaced_by_hash`, and issues a fresh `(accessToken, newRefreshToken)` pair within the same `family_id` (30-day rolling TTL, max 90-day absolute lifetime).
- **Web vs. Mobile Delivery Strategy (Same Backend):**
  - **Web SPA (`X-Client-Platform: web`):** Refresh token delivered via `__Host-aashvo_rt` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`) — never accessible to JavaScript (`document.cookie`) or `localStorage`. `POST /auth/refresh` verifies `Origin` / `Referer` header against exact allowed origins to block cross-site refresh CSRF. Access token stays in **React memory** only (restored cleanly on tab reload via `POST /auth/refresh`).
  - **Future iOS / Android Native Apps (`X-Client-Platform: ios|android`):** Receive refresh token in JSON response body and persist strictly in **iOS Keychain / Android EncryptedSharedPreferences**.
- **Lifecycle Invalidation Guarantees:**
  - `POST /api/v1/auth/logout` revokes the active `family_id` server-side immediately.
  - Password reset, password change, role promotion/demotion, or admin suspension (`account_status = 'suspended'`) immediately revokes **all** `refresh_sessions` for `userId` and adds `userId` to a 15-minute Redis access-token revocation cut-off timestamp (`tokens_valid_after`), closing stolen JWT access windows.

---

## 3. Google OAuth 2.0 + Account Linking Safety (`hunt-oauth` Defenses)

Migrated users with existing Google accounts in `auth.identities` retain uninterrupted one-click Google sign-in:
1. **Initiation (`GET /api/v1/auth/oauth/google`):**
   - Backend generates PKCE `code_verifier` + `S256` `code_challenge`, cryptographic `state` (≥ 128-bit), and OIDC `nonce`, storing `{ codeVerifier, nonce, originRedirect, platform }` in Redis for 5 minutes keyed by `state`.
   - Exact `redirect_uri` fixed in backend configuration (`https://api.aashvo.in/api/v1/auth/oauth/google/callback`) — never accepted as an arbitrary query parameter from the client.
2. **Callback Verification (`GET /api/v1/auth/oauth/google/callback`):**
   - Strictly validates `state` exists once in Redis (`GETDEL`) — prevents OAuth login CSRF.
   - Exchanges authorization `code` + `code_verifier` directly server-to-server with Google (`client_secret` stays solely on NestJS).
   - Verifies Google OIDC `id_token` signature, `aud === GOOGLE_CLIENT_ID`, `iss`, `nonce`, and `exp`.
3. **Anti-Takeover Identity Resolution Matrix:**
   - **Case A (`oauth_identities` match on `('google', sub)`):** Sign in existing `userId` immediately.
   - **Case B (No `sub` match, email matches existing `users.email`):**
     - If Google's `email_verified === true` **AND** existing `profiles.email_verified === true`: Link new `oauth_identities` row (`('google', sub)`) to existing `userId` cleanly.
     - If existing AASHVO email was **not verified** (`profiles.email_verified === false`): **DO NOT auto-link** (prevents pre-hijacking where an attacker pre-registered an unverified email). Either require password proof to link or reset unverified shell account per strict security policy.
   - **Case C (Brand-new Google user):** Atomic `$transaction` creates `users`, `profiles` (`emailVerified = true` from verified Google claim), and `oauth_identities`.
4. **Safe Token Handoff:** Redirects to `https://aashvo.vercel.app/auth/callback?code=<one_time_opaque_code>` (30-second Redis TTL) — **never puts JWTs or refresh tokens in URL query/fragment** (prevents `Referer` leakage!). Frontend exchanges the short-lived handoff code via `POST /api/v1/auth/oauth/exchange` to receive the `__Host-` refresh cookie + memory access JWT.

---

## 4. Email Verification, Password Reset & Real India SMS OTP

### 4.1 Email Verification & Password Reset (`VerificationToken`)
- Tokens generated via `crypto.randomBytes(32).toString('base64url')`; only `SHA-256(token)` is persisted in `verification_tokens` (`purpose`: `email_verification` TTL 24h, `password_reset` TTL 30m).
- Consuming a token uses atomic conditional `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now()`.
- `POST /forgot-password` and `POST /resend-verification` always return HTTP `202` with generic text regardless of email registration status to prevent account enumeration.

### 4.2 Replacing Simulated SMS OTP (`authService.ts:435`) with Production DLT Service
- Replaces hardcoded `'654321'` and `Map`/`Set` in-memory simulation with **`PhoneOtpService`**:
  1. Validates strict Indian E.164/10-digit mobile regex `^(\+91)?[6-9]\d{9}$`, canonicalized to `+91XXXXXXXXXX`.
  2. Checks Redis & `phone_otp_challenges` DB history: **60-second cooldown** + **max 4 requests / hour / phone** + **max 10 requests / hour / user**.
  3. Generates cryptographic 6-digit code via `crypto.randomInt(100000, 1000000)` and stores `HMAC-SHA256(OTP_PEPPER, userId + ':' + phone + ':' + otp)` in `phone_otp_challenges` (`expiresAt = now + 10m`, `attemptsRemaining = 5`).
  4. Enqueues `notification_outbox` job to **MSG91 / Twilio** using TRAI-registered DLT Principal Entity ID & approved OTP template (`{#var#}`).
  5. Verification uses constant-time comparison (`crypto.timingSafeEqual`) inside DB transaction, atomically decrements `attemptsRemaining` on mismatch, and updates `profiles.phone_number` + `profiles.phone_verified = true` + `flatmate_profiles.verified` recomputation + `AuditLog` on match.
- **No Demo Persona Auth in Production:** `AuthModal.tsx` quick-fill demo persona buttons must be disabled when `VITE_APP_ENV === 'production'` (or behind an explicit `VITE_ENABLE_DEMO_PERSONAS=false` flag) so production users only interact with real authenticated accounts.

