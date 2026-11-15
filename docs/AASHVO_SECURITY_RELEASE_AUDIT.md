# AASHVO Security & Authentication Release Audit

**Scope:** Google Identity Services (GIS), OAuth Integrity, JWT Session Management, RLS & Client Defenses
**Date:** November 15, 2026
**Auditor:** AASHVO Engineering (Security & Backend Architecture)
**Status:** **APPROVED FOR PRODUCTION**

---

## 1. Google OAuth & Account Takeover Mitigation

### 1.1 The Vulnerability (Pre-Patch State)
In earlier prototype implementations, an incoming Google OAuth token was automatically linked to an existing AASHVO account solely on the basis of a matching email address. This presented a **HIGH Severity Account Takeover (ATO)** vulnerability: if an attacker registered or possessed an unverified Google account with a victim's email address, they could gain immediate unauthorized access to the victim's AASHVO account without knowing the victim's password.

### 1.2 Implemented Security Architecture
The vulnerability was completely eliminated in `apps/api/src/modules/auth/auth.service.ts` and `GoogleTokenVerifierService`:

1. **Cryptographic Token Verification:**
   - Google ID Tokens are cryptographically validated against Google's public JWKS keys (`https://www.googleapis.com/oauth2/v3/certs`) using RS256 signature verification.
   - Audience claims (`aud`) must strictly match `GOOGLE_CLIENT_ID`.
   - Issuer claims (`iss`) must strictly match `accounts.google.com` or `https://accounts.google.com`.
   - Token timestamps (`exp`, `iat`) are strictly validated against clock skew.
   - The `email_verified` claim must be boolean `true`.
2. **Stable Subject Identity (`sub`):**
   - The immutable Google `sub` identifier is the sole primary key for OAuth identity lookup.
   - If `sub` matches an existing `oauth_identities` record, authentication succeeds immediately.
3. **Strict Account Takeover Defense:**
   - If no OAuth identity exists for the `sub`, but an existing AASHVO password account exists with the matching email:
     - **The account is NOT automatically linked.**
     - **No session or JWT token is issued.**
     - **The email verification status of the existing account is unchanged.**
     - The API returns an HTTP 409 Conflict with a security directive:
       `"An account with this email already exists. Please sign in with your email and password, then connect Google in account settings."`
4. **Authorized Account Linking:**
   - A user can only link their Google account while possessing an authenticated, valid JWT session.
   - The linking endpoint verifies the Google ID token and creates the link within a database transaction.
5. **Concurrency & Race Condition Defenses:**
   - A unique constraint on `(provider, provider_subject)` in the PostgreSQL schema prevents duplicate identities during concurrent OAuth attempts.
   - Prisma transactions (`run_sql_transaction` / `prisma.$transaction`) ensure atomicity.

---

## 2. Token Storage & Session Lifecycle Hardening

1. **Dual-Token Architecture:**
   - **Access Tokens:** Short-lived JWTs (15-minute expiration) carrying user identity, role, and permissions. Signed with HMAC SHA-256 (`JWT_SECRET`).
   - **Refresh Tokens:** Long-lived, cryptographically random 64-byte tokens hashed via SHA-256 before storage in `public.refresh_sessions`.
2. **Refresh Token Rotation & Reuse Detection:**
   - Every refresh request rotates the token: the old token is marked revoked (`"rotated"`), and a new token is issued within the same `familyId`.
   - If an already-revoked refresh token is re-submitted (indicating token theft or replay attack), the entire session family is immediately invalidated (`"refresh_token_reuse_detected"`), forcing re-authentication across all compromised devices.
3. **Session Revocation on Password Change:**
   - Password reset immediately invalidates all existing refresh sessions for that user ID.

---

## 3. Client-Side Security & Privilege Escalation Defenses

1. **LocalStorage Sanitization:**
   - If a malicious user manually tampers with `localStorage` (e.g., setting `role: "admin"`), the client runtime detects the untrusted claim upon initialization and automatically demotes the session to `renter`.
   - A security notice is logged, and privileged UI elements remain hidden.
2. **Server-Side Authorization Authority:**
   - The NestJS API enforces `RolesGuard` and `JwtAuthGuard` on all administrative and privileged endpoints.
   - Client-side role claims are completely ignored by the backend; all authorization decisions are derived exclusively from the verified JWT payload.

---

## 4. Environment Variable & Secret Hygiene

- `apps/api/.env.supabase` is strictly excluded in `.gitignore`.
- No Google Client Secrets, database passwords, or JWT secrets exist in tracked Git files.
- Client bundles (`dist/assets/index-*.js`) were audited: only public environment variables prefixed with `VITE_` (`VITE_GOOGLE_CLIENT_ID`, `VITE_API_BASE_URL`) are bundled.

---

## 5. Security Release Verdict

**VERDICT: APPROVED FOR PRODUCTION (ZERO UNRESOLVED VULNERABILITIES)**
