# AASHVO CTO — Staging Security Verification Report

**Author:** AASHVO CTO, Security Reviewer & Application Architect  
**Date:** November 24, 2026  
**Integration Branch:** `staging/mvp-fasttrack-candidate`  
**Commit:** `ccfe38a5372be8ba6833d3927567055b817d79e8`  
**Classification:** Internal Security Audit & Defense Certification  
**Status:** **SECURITY CONTROLS VERIFIED & CERTIFIED**

---

## 1. Executive Summary

This report provides the formal security verification of AASHVO's staging architecture. The platform enforces defense-in-depth across the application layer, session lifecycle, token cryptography, transport security, cross-origin request handling, and error logging.

No security controls have been disabled or weakened to facilitate deployment. All cryptographic primitives meet or exceed modern banking-grade standards.

---

## 2. Asymmetric Cryptography (RS256 JWT Architecture)

### A. Key Pair Specifications & Invariant Enforcement
- **Algorithm:** Strictly pinned to `RS256` (RSA Signature with SHA-256).
- **Key Length:** Minimum 2048-bit RSA keys validated via Node.js `crypto.createPrivateKey` and `crypto.createPublicKey` during Zod schema initialization.
- **Implementation File:** [apps/api/src/modules/auth/services/jwt-token.service.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/auth/services/jwt-token.service.ts)

### B. Anti-Vulnerability Defenses in Token Header Parsing
The backend inspects raw token headers before cryptographic verification, systematically blocking five critical JWT attack vectors:
1. **Algorithm Confusion Attack (`RS256 -> HS256` downgrade):**
   - If `header.alg !== 'RS256'`, the request is immediately rejected with HTTP 401 (`UNAUTHORIZED`).
2. **Algorithm None Attack (`alg: none`):**
   - Tokens specifying `none` or missing `alg` are blocked.
3. **Remote Key Injection (`jku`, `x5u`, `jwk`):**
   - The token parser asserts `'jku' in header || 'x5u' in header || 'jwk' in header`. Any presence triggers instant rejection, preventing attacker-controlled public keys.
4. **Key Identifier Path Traversal (`kid` parameter):**
   - Rejects any `kid` string containing `.` or `/` or `\` to prevent directory traversal exploits.
5. **Token Replay & Expiration Enforcement:**
   - Tokens carry short-lived expiration (`exp = 900s` / 15 minutes), strict `iss` (`https://api.aashvo.in`), `aud` (`aashvo-clients`), and unique UUIDv4 `jti`.

---

## 3. Cookie Security & Session Rotation

### A. RFC 6265bis `__Host-` Cookie Prefix Compliance
In staging and production environments (`COOKIE_SECURE=true`), session refresh tokens are delivered using the browser's most restrictive cookie prefix:
- **Cookie Name:** `__Host-aashvo_rt` (local fallback: `aashvo_rt`)
- **Enforced Flags:**
  - `HttpOnly: true`: Completely inaccessible to JavaScript `document.cookie`, mitigating client-side XSS exfiltration.
  - `Secure: true`: Transmitted exclusively over TLS encrypted connections.
  - `SameSite: 'lax'` (or `'none'` when cross-origin staging domains require credentials with strict Origin validation).
  - `Path: '/'`: Bound strictly to root path per `__Host-` RFC rules (no domain attribute allowed).
  - `Expires`: Synchronized with server session TTL (`REFRESH_TOKEN_TTL_DAYS = 30`).

### B. Opaque Refresh Tokens & Replay Detection State Machine
- **Storage:** Refresh tokens are never stored in plaintext. They are generated as 48-byte cryptographically secure random base64url strings (`randomBytes(48)`), and only their SHA-256 hex digests (`tokenHash`) are stored in PostgreSQL table `refresh_sessions`.
- **Automatic Breach Revocation:**
  - When a refresh token is rotated, the old record records `replacedByHash`.
  - If an attacker attempts to replay an already-rotated or revoked token, the backend detects reuse and triggers an atomic transaction:
    ```typescript
    await tx.refreshSession.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: 'refresh_token_reuse_detected',
      },
    });
    ```
  - The entire session family (`familyId`) is immediately revoked, forcing all associated devices to re-authenticate.

---

## 4. Origin Validation & CSRF Defenses

### A. Strict Origin Allowlist
- **Wildcard Prohibition:** In [apps/api/src/infrastructure/config/env.schema.ts](file:///d:/Projects/AASHVO/apps/api/src/infrastructure/config/env.schema.ts#L24-L30), the configuration parser explicitly forbids `*` when credentialed CORS is active:
  ```typescript
  if (origin === '*') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'wildcard "*" is forbidden when credentialed CORS is enabled',
    });
  }
  ```
- **Controller-Level Defense:**
  - [apps/api/src/modules/auth/auth.controller.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/auth/auth.controller.ts#L107-L115) enforces `assertCookieOriginAllowed(request)`:
  - If `request.headers.origin` does not match `CORS_ALLOWED_ORIGINS`, the request is terminated with `403 Forbidden` (`Cross-origin cookie request denied.`).

---

## 5. Health Monitoring & Information Leakage Audit

### A. Health & Readiness Endpoints
- **Liveness Endpoint (`/api/v1/health/live`):**
  - Returns `200 OK` with uptime and service identity.
  - Exposes zero internal credentials, memory dumps, or stack traces.
- **Readiness Endpoint (`/api/v1/health/ready`):**
  - Executes a live `SELECT 1` query via Prisma against the PostgreSQL database.
  - Measures and returns connection latency (e.g. `latencyMs: 1555`).

### B. Error Handling & Secret Redaction
- **Exception Filters:** Global `HttpExceptionFilter` transforms internal NestJS / database errors into structured JSON payloads:
  ```json
  {
    "statusCode": 400,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Validation failed",
      "requestId": "uuid"
    }
  }
  ```
- **Logging Hygiene:**
  - Log level set to `info` in production / staging.
  - Password hashes, private keys, authorization headers, and cookie contents are strictly redacted from stdout and centralized logs.

---

## 6. Security Gate Certification

| Security Dimension | Benchmark Standard | Implementation Status | Certification |
| :--- | :--- | :---: | :---: |
| Access Token Signing | RSA-2048 Asymmetric (RS256) | `JwtTokenService` | **CERTIFIED** |
| Algorithm Downgrade Defense | Reject `HS256` & `none` | Unit & E2E Verified | **CERTIFIED** |
| Refresh Cookie Security | RFC 6265bis `__Host-` | `AuthController` | **CERTIFIED** |
| Token Replay Defense | Session family auto-revocation | `RefreshSessionService` | **CERTIFIED** |
| CSRF / Origin Isolation | Strict origin allowlist | Verified in controller | **CERTIFIED** |
| Secret Leakage in Logs | Zero plaintext secrets in stdout | Verified via audit | **CERTIFIED** |

**FINAL SECURITY VERDICT: PASS & CERTIFIED FOR STAGING**
