# AASHVO Google OAuth Implementation Report

**Date:** 2026-11-15
**Author:** Senior Security Engineer & Identity Architect
**Architecture:** Google Identity Services (GIS) ID-Token Flow → NestJS Backend Verification → RS256 Auth
**Status:** IMPLEMENTED, TESTED & PRODUCTION READY

---

## 1. Executive Summary & Identity Architecture

AASHVO requires a secure, modern Google OAuth identity mechanism that integrates with our authoritative NestJS authentication subsystem without introducing competing identity silos or fragmenting session management.

### Key Architectural Invariants:
1. **Authoritative NestJS Tokens:** The browser never relies on raw Google ID tokens or third-party cookies for session persistence. All client authorization continues to use AASHVO's high-security RS256 JWT access tokens (15-minute TTL) and rotating, opaque refresh tokens stored in HTTP-only, SameSite cookies (`__Host-aashvo_rt`).
2. **Backend Token Verification:** Google ID tokens emitted by Google Identity Services (GIS) are transmitted over TLS to `POST /api/v1/auth/google`, where the NestJS API verifies signatures, audience, issuer, expiration, and email claims against Google's authoritative tokeninfo service.
3. **Anti-Hijacking & Safe Account Linking:** An unverified Google email claim is strictly rejected. An existing local account registered via email/password is safely linked to the Google identity *only* when Google confirms the email address is verified (`email_verified: true`).
4. **Idempotency & Database Integrity:** Google users are represented in the `users`, `profiles`, and `oauth_identities` tables with zero schema regressions and zero reliance on local passwords.

---

## 2. Technical Design & Flow

```
+--------------------------------------------------------------------------------------------------+
|                                    AASHVO GOOGLE OAUTH FLOW                                      |
+--------------------------------------------------------------------------------------------------+

 [User Browser]                       [Google Identity Services]                  [NestJS API]
       |                                          |                                     |
       | 1. Click "Continue with Google"         |                                     |
       |----------------------------------------->|                                     |
       |                                          |                                     |
       | 2. User consents & authenticates         |                                     |
       |<-----------------------------------------|                                     |
       |    (returns credential: id_token)        |                                     |
       |                                          |                                     |
       | 3. POST /api/v1/auth/google              |                                     |
       |    { idToken }                           |                                     |
       |------------------------------------------------------------------------------->|
       |                                          |                                     |
       |                                          | 4. GET /oauth2/v1/tokeninfo         |
       |                                          |<------------------------------------|
       |                                          |    (verifies aud, iss, exp, email)  |
       |                                          |------------------------------------>|
       |                                          |                                     |
       |                                          |                               5. DB Transaction:
       |                                          |                                  - Find/Link OAuthIdentity
       |                                          |                                  - Update lastSignInAt
       |                                          |                                  - Issue RS256 JWT &
       |                                          |                                    Rotating Refresh Cookie
       |                                          |                                     |
       | 6. HTTP 200 OK                           |                                     |
       |    Set-Cookie: __Host-aashvo_rt (HttpOnly)|                                    |
       |    Body: { accessToken, user }           |                                     |
       |<-------------------------------------------------------------------------------|
```

---

## 3. Implementation Details

### 3.1 Backend Components

1. **Environment Schema (`apps/api/src/infrastructure/config/env.schema.ts`):**
   Added optional Google OAuth variables with Zod validation:
   - `GOOGLE_CLIENT_ID`: Google OAuth client ID string.
   - `GOOGLE_CLIENT_SECRET`: Optional server secret.

2. **Data Transfer Object (`apps/api/src/modules/auth/dto/auth.dto.ts`):**
   Defined `GoogleAuthDto` with class-validator:
   - `idToken`: Required, trimmed string, minimum 16 characters.

3. **Verification Service (`apps/api/src/modules/auth/services/google-token-verifier.service.ts`):**
   Implements `GoogleTokenVerifierPort` interface with dependency injection:
   - Probes `https://oauth2.googleapis.com/tokeninfo?id_token=...` with an 8-second abort signal timeout.
   - **Audience Verification:** Asserts `data.aud === expectedAudience`.
   - **Issuer Verification:** Asserts `data.iss === 'https://accounts.google.com'` or `'accounts.google.com'`.
   - **Expiration Verification:** Asserts `exp * 1000 > Date.now()`.
   - **Email Verification Claim:** Asserts `data.email_verified === true` or `'true'`.
   - **Subject Claim:** Extracts unique Google immutable subject `sub`.

4. **Service Logic (`apps/api/src/modules/auth/auth.service.ts`):**
   `loginWithGoogle(dto: GoogleAuthDto, meta: RequestMetadata)` handles three transactional branches:
   - **Branch A (Existing Google Identity):** Finds record in `oauth_identities`. Updates `lastSignInAt`, `rawClaims`, marks profile `emailVerified = true`.
   - **Branch B (Safe Account Linking):** Identity does not exist, but a `User` exists with matching verified email. Links `OAuthIdentity` to existing user, marks profile `emailVerified = true`.
   - **Branch C (New Registration):** Creates `User` with `role: 'renter'`, `accountStatus: 'active'`, `passwordHash: null`. Creates associated `Profile` and `OAuthIdentity`.
   - Records audit log event `auth.oauth_login`.
   - Creates opaque rotating refresh session in `refresh_sessions` table and signs RS256 access JWT.

5. **Controller Endpoint (`apps/api/src/modules/auth/auth.controller.ts`):**
   - `@Post('google')`, `@Public()`, `@HttpCode(200)`
   - Rate limited with `@Throttle({ default: { limit: 15, ttl: 900000 } })` (15 attempts per 15 minutes).
   - Injects refresh token into secure cookie (`__Host-aashvo_rt` in production, `aashvo_rt` in development) via `toClientResponse`.

### 3.2 Frontend Components

1. **Authentication Service (`src/services/authService.ts`):**
   - `signInWithGoogleBackend(idToken: string)`: Posts to `/auth/google` using `apiClient`. Stores access token in memory, sets user context, handles errors gracefully.

2. **Modal Component (`src/components/auth/AuthModal.tsx`):**
   - Injects Google Identity Services (GIS) SDK dynamically if not already cached.
   - Initialises `google.accounts.id.initialize` with `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
   - If `VITE_GOOGLE_CLIENT_ID` is missing from the environment, shows a user-friendly notice without crashing.
   - Invokes backend token exchange on successful Google user consent.

3. **Index HTML (`index.html`):**
   - Added pre-loaded Google Identity Services script: `<script src="https://accounts.google.com/gsi/client" async defer></script>`.

---

## 4. Test Evidence & Automated Coverage

### 4.1 Backend Integration Tests
Implemented in `apps/api/test/security-authorization.postgres.integration.spec.ts` (PostgreSQL 16):

```
  7. Google OAuth Authentication & Safe Account Linking
    √ registers a new user and issues access/refresh tokens upon valid Google ID token (16 ms)
    √ logs into existing user idempotently on subsequent Google ID token presentations (12 ms)
    √ safely links Google identity to an existing account with verified email matching (166 ms)
    √ rejects Google authentication when Google email is unverified (3 ms)
    √ rejects invalid or forged Google ID tokens with 401 Unauthorized (4 ms)
    √ rejects malformed or short tokens with 400 Bad Request (3 ms)
```

### 4.2 Frontend Unit Tests
Implemented in `src/test/realAuthenticationRepair.test.ts` (Vitest):

```
  8. Google OAuth Integration & Security Invariants
    ✓ successfully processes Google ID token exchange with backend API (12 ms)
    ✓ returns honest error message when Google authentication backend rejects token (3 ms)
```

---

## 5. Deployment Configuration Guide

To activate Google OAuth in production:

1. **Google Cloud Console:**
   - Create OAuth 2.0 Client ID (Web Application).
   - Authorized JavaScript origins: `https://aashvo.vercel.app` (and `http://localhost:5173` for testing).
   - Authorized redirect URIs: None required for GIS popup/token flow.

2. **Render Dashboard (Backend Environment):**
   - `GOOGLE_CLIENT_ID`: `<client-id>.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET`: `<client-secret>` (optional)

3. **Vercel Dashboard (Frontend Environment):**
   - `VITE_GOOGLE_CLIENT_ID`: `<client-id>.apps.googleusercontent.com`
