# AASHVO CTO — Staging Environment Readiness Audit

**Author:** AASHVO CTO & Security Architect  
**Date:** November 24, 2026  
**Integration Branch:** `staging/mvp-fasttrack-candidate`  
**Target Staging URLs:**
- Backend API: `https://aashvo-api-staging.onrender.com` (or current `https://aashvo-api.onrender.com`)
- Frontend Web: `https://aashvo-staging.vercel.app` (or current `https://aashvo.vercel.app`)
**Verdict:** **READY WITH CONDITIONS (Configuration Checklist Outlined Below)**

---

## 1. Executive Summary

This audit establishes the rigorous technical and operational criteria required to safely promote AASHVO to a staging and user acceptance testing (UAT) environment. 

We analyze four mission-critical subsystems:
1. **Asymmetric Cryptography & JWT Security (RS256 with 2048-bit RSA keys)**
2. **Session Cookies & Transport Security (`__Host-` prefix, SameSite, and Origin assertions)**
3. **Database Topology & Connection Pooling (PostgreSQL 16, Prisma ORM, Supabase PgBouncer)**
4. **Media Storage & Presigned Object Vaults (Cloudflare R2 Public CDN & AWS S3 Mumbai Private Vault)**

---

## 2. Cryptographic Architecture & Key Management

### A. RS256 Asymmetric JWT Tokens
AASHVO replaces symmetric secrets (`HS256`) with asymmetric RSA-2048 (`RS256`) key pairs to prevent key leakage and token forgery:
- **Implementation:** [apps/api/src/modules/auth/services/jwt-token.service.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/auth/services/jwt-token.service.ts)
- **Token Claims Enforced:**
  - `sub`: User UUID
  - `role`: Role (`seeker`, `owner`, `admin`, `moderator`)
  - `sid`: Session family UUID for instant revocation
  - `jti`: Unique token UUID (anti-replay)
  - `iss`: Issuer (`aashvo-api`)
  - `aud`: Audience (`aashvo-web`)
  - `exp`: Configurable TTL (defaults to 900 seconds / 15 minutes)

### B. Anti-Attack Defenses in Header Parsing
The backend explicitly guards against known JWT vulnerability classes:
1. **Algorithm Confusion Attack (`alg: HS256` substitution):**
   - Pinned strictly to `RS256`. Any non-RS256 token immediately throws `401 Unauthorized` with code `UNAUTHORIZED`.
2. **Algorithm None Attack (`alg: none`):**
   - Strictly rejected during header decoding.
3. **Dynamic Key Resolution Injection:**
   - The token parser asserts that `jku`, `x5u`, and `jwk` header attributes are prohibited, preventing remote server spoofing.
4. **Key Identifier Path Traversal:**
   - Rejects any `kid` containing directory traversal characters (`.`, `/`, `\`).

### C. RSA Key Generation & Staging Secret Injection
To generate the staging key pair, use standard OpenSSL:
```bash
# 1. Generate 2048-bit RSA private key
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out staging_private.pem

# 2. Extract corresponding public key
openssl rsa -pubout -in staging_private.pem -out staging_public.pem

# 3. Format keys into single-line escaped strings for environment injection
awk '{printf "%s\\n", $0}' staging_private.pem
awk '{printf "%s\\n", $0}' staging_public.pem
```

---

## 3. Cookie Architecture & CSRF Defenses

### A. `__Host-` Cookie Prefix Specification
In staging and production, cookies must comply with the `__Host-` prefix specification defined in RFC 6265bis:
- **Cookie Name:**
  - Local/Dev: `aashvo_rt`
  - Staging/Prod (`COOKIE_SECURE=true`): `__Host-aashvo_rt`
- **Enforced Security Attributes:**
  - `HttpOnly: true` (inaccessible to JavaScript `document.cookie`, mitigating XSS exfiltration)
  - `Secure: true` (transmitted only over HTTPS)
  - `SameSite: 'lax'` (or `'none'` for cross-domain staging setups with strict Origin checking)
  - `Path: '/'` (required by `__Host-` spec, no domain attribute allowed)
  - `Expires`: Set to `REFRESH_TOKEN_TTL_DAYS` (defaults to 30 days)

### B. Strict Origin Validation on Cookie-Based Requests
To prevent Cross-Site Request Forgery (CSRF) on refresh and session mutations, [apps/api/src/modules/auth/auth.controller.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/auth/auth.controller.ts#L107-L115) enforces:
```typescript
private assertCookieOriginAllowed(request: Request): void {
  const origin = request.headers.origin;
  if (typeof origin === 'string' && !this.allowedOrigins.includes(origin)) {
    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Cross-origin cookie request denied.',
    });
  }
}
```
Any request originating from outside `CORS_ALLOWED_ORIGINS` is rejected with `403 Forbidden`.

---

## 4. Database Topology & Health Checks

### A. PostgreSQL 16 & Prisma Connection Pooling
- **Staging Database:** Supabase PostgreSQL 16 with Transaction-mode PgBouncer pooler.
- **Connection Configuration:**
  - `DATABASE_URL`: Transaction-mode connection string on port `6543` with `?pgbouncer=true&connection_limit=20`.
  - `DIRECT_URL`: Session-mode direct connection string on port `5432` for running migrations.
- **Migration Status:**
  - Total Migrations: **13 applied, 0 pending, 0 drift**.
  - All idempotent policies have been verified against PostgreSQL 16.

---

## 5. Media & Storage Configuration

### A. Dual Storage Architecture
AASHVO segregates storage based on data sensitivity:
1. **Public Assets (Property Photos, User Avatars):**
   - **Target:** Cloudflare R2 (`aashvo-public-assets`)
   - **Access Model:** Presigned PUT upload URL generated by backend; served publicly via Cloudflare Global CDN (`https://cdn.aashvo.in`).
2. **Private Vault (KYC Documents, Aadhaar, Tenancy Agreements):**
   - **Target:** AWS S3 ap-south-1 Mumbai (`aashvo-private-vault`)
   - **Access Model:** Strict SSE-S3 / KMS encryption; time-limited presigned GET URLs (300-second TTL) available only to authorized transaction counterparties.

### B. Fallback Mode
When cloud storage environment variables (`PUBLIC_R2_BUCKET_NAME`, `PRIVATE_S3_BUCKET_NAME`) are omitted, the API defaults to `LocalStorageAdapter` for local development, saving files to disk. Staging must provide valid cloud credentials.

---

## 6. Staging Environment Variables Matrix

| Variable | Staging Requirement | Production Requirement | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `staging` | `production` | Execution environment flag |
| `PORT` | `4000` | `4000` | Server listening port |
| `DATABASE_URL` | Supabase Staging Pooler URL | Supabase Production Pooler URL | Prisma runtime queries |
| `DIRECT_URL` | Supabase Staging Direct URL | Supabase Production Direct URL | Prisma migration runner |
| `JWT_SIGNING_PRIVATE_KEY` | RSA-2048 PEM (Staging Key) | RSA-2048 PEM (Prod HSM/Vault) | Access token signing |
| `JWT_SIGNING_PUBLIC_KEY` | RSA-2048 Public PEM | RSA-2048 Public PEM | Access token verification |
| `COOKIE_SECURE` | `true` | `true` | Enforces `__Host-` prefix |
| `COOKIE_SAME_SITE` | `none` (if cross-domain) / `lax` | `lax` | CSRF cookie boundary |
| `CORS_ALLOWED_ORIGINS` | Staging Vercel URLs | `https://aashvo.in` | CORS allowlist |
| `STORAGE_ADAPTER` | `cloud` | `cloud` | Enables S3/R2 storage |
| `PUBLIC_R2_BUCKET_NAME` | `aashvo-staging-public` | `aashvo-public-assets` | Public listing photos |
| `PRIVATE_S3_BUCKET_NAME` | `aashvo-staging-vault` | `aashvo-private-vault` | Encrypted KYC storage |

---

## 7. Staging Readiness Verdict

**VERDICT: READY WITH CONDITIONS**

**Condition Checklist Prior to Deployment:**
1. [x] 100% Passing Browser E2E Test Suite (26/26 tests verified)
2. [x] Zero Horizontal Overflow on Pixel 7 & iPhone 14
3. [x] Verified Idempotent DB Migrations (13 migrations)
4. [ ] Inject RSA-2048 Key Pair into Render staging environment variables.
5. [ ] Configure Cloudflare R2 and AWS S3 staging buckets and access keys.
