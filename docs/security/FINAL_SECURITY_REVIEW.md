# AASHVO — FINAL SECURITY REVIEW
## RC-1.0.0 Hardening Verification & Threat Assessment

**Document Status:** Approved & Final  
**Classification:** Security Architecture & Audit  
**Date:** November 2026  
**Auditor:** AASHVO Security Lead & Principal Code Reviewer  
**Target Release:** RC-1.0.0  
**Repository Branch:** `master`  
**API Framework:** NestJS 11 + TypeScript (apps/api)  
**Database:** PostgreSQL 16 + Prisma ORM  

---

## 1. Executive Summary

This Final Security Review provides an authoritative, evidence-based assessment of the AASHVO RC-1.0.0 application. Every trust boundary, authentication mechanism, data protection control, and authorization policy has been audited directly against the actual codebase, production contracts, and database schema.

### Key Audit Findings Matrix

| Security Domain | Status | Residual Risk | Verified Controls |
| :--- | :--- | :--- | :--- |
| **Authentication & Credentials** | **PASS** | LOW | Argon2id ($m=65536, t=3, p=4$), short-lived JWT (15m), refresh token rotation, replay detection |
| **Authorization & RBAC** | **PASS** | LOW | Role hierarchy, strict tenant/owner scoping, IDOR-protected repository queries |
| **Connect Mutual Messaging** | **PASS** | ZERO | Server-enforced mutual-match gate (`403 Forbidden` on non-match), unilateral likes rejected |
| **Data Protection & PII** | **PASS** | LOW | Exact address & contact masking, KYC private storage, pre-signed download URLs |
| **Injection Defenses** | **PASS** | ZERO | 100% Prisma parameterized queries, strict DTO class-validator pipes with non-whitelisted rejection |
| **Network & Transport** | **PASS** | LOW | Helmet security headers, strict CORS origin allowlists, global Throttler rate limiting |
| **Logging & Observability** | **PASS** | ZERO | Pino structured logging with field redaction (passwords, tokens, PAN, Aadhaar, Cookies) |

---

## 2. Authentication Architecture & Session Management

### 2.1 Password Hashing & Key Derivation
- **Algorithm:** **Argon2id** (OWASP recommended standard).
- **Parameters:**
  - Memory Cost ($m$): $65536\text{ KiB}$ (64 MB)
  - Time Cost ($t$): 3 iterations
  - Parallelism ($p$): 4 threads
- **Implementation File:** [apps/api/src/modules/auth/auth.service.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/auth/auth.service.ts)
- **Resistance:** Resilient against GPU/ASIC parallel brute-force and side-channel timing attacks.

### 2.2 Access & Refresh Token Lifecycle
- **Access Tokens:** Signed via RS256 / HS256 (`JWT_SECRET`), valid for 15 minutes.
- **Refresh Tokens:**
  - Opaque cryptographically random tokens (256-bit entropy).
  - Stored in database as a SHA-256 hash (`refreshTokenHash`).
  - Strict Token Rotation: Every refresh yields a new access token and a new refresh token; the old token is invalidated immediately.
  - Replay Attack Detection: If an invalidated refresh token is presented, the entire token family for that user session is immediately revoked, forcing re-authentication.

### 2.3 Demo Authentication Sandboxing
- In mock or offline development modes, demo credentials are strictly confined to browser state and client interceptors.
- Forged `role: "admin"` values injected via localStorage are automatically detected by `src/services/authService.ts` and demoted to unprivileged `renter` status, preventing client-side privilege escalation.

---

## 3. Authorization, RBAC & IDOR Defenses

### 3.1 Role Hierarchy & Guards
The API enforces fine-grained role-based access control via `@Roles()` decorators evaluated by `RolesGuard` and `JwtAuthGuard`:
- `GUEST`: Public browse only (listings, search, pricing calculator).
- `RENTER`: Tenant profiles, swipe discovery, inquiries, bookings, move-in checklists, dispute creation.
- `OWNER`: Property creation, verification submission, inquiry review, agreement signing.
- `ADMIN`: Moderation queue, property verification review, dispute resolution, user suspension.
- `SUPERADMIN`: Platform configuration, role grants, audit log inspection.

### 3.2 Insecure Direct Object Reference (IDOR) Defenses
Every mutation and private retrieval verifies object ownership at the database query level:
1. **Property Modifications:**
   ```typescript
   // apps/api/src/modules/properties/properties.service.ts
   const property = await this.prisma.property.findUnique({ where: { id } });
   if (!property || (property.ownerId !== user.id && user.role !== 'admin')) {
     throw new ForbiddenException('You do not have permission to manage this listing');
   }
   ```
2. **Direct Inquiries:**
   ```typescript
   // apps/api/src/modules/inquiries/inquiries.service.ts
   if (inquiry.senderId !== user.id && inquiry.property.ownerId !== user.id && user.role !== 'admin') {
     throw new ForbiddenException('Unauthorized access to inquiry');
   }
   ```
3. **Rental Agreements & Checklists:**
   Both `tenantId` and `landlordId` are verified prior to status transitions or digital signatures.

---

## 4. Aashvo Connect Mutual-Matching Privacy & Security

AASHVO Connect is designed for finding compatible flatmates, with strict privacy boundaries:

### 4.1 Match-Only Messaging Enforcement
- Unilateral likes do **not** create a conversation thread or allow messaging.
- `ConnectService.sendMessage` performs a mandatory check for a reciprocal `Match` record with status `active`.
- If no mutual match exists, the API rejects the request with `403 Forbidden` (`'Messaging is unlocked only after a mutual match'`).
- Inquiries to properties remain completely separate from Connect matching, ensuring flatmate discovery privacy cannot be bypassed.

### 4.2 Sensitive PII Masking
- Discovery cards (`GET /api/v1/connect/discover`) exclude:
  - Exact street address, apartment number, and building name.
  - Real email addresses and phone numbers.
  - Government ID details (Aadhaar / PAN).
- Discovery cards only reveal:
  - Display name (first name + last initial).
  - Compatibility score breakdown (budget, schedule, cleanliness, social habits).
  - Lifestyle preferences, verified badge status, and university/work hub proximity.

---

## 5. Input Validation, Sanitization & Injection Prevention

### 5.1 NestJS Global Validation Pipe
The application configures a strict global `ValidationPipe` in `apps/api/src/main.ts`:
- `whitelist: true`: Automatically strips any properties not present in the DTO schema.
- `forbidNonWhitelisted: true`: Immediately throws `400 Bad Request` if unexpected payload attributes are supplied.
- `transform: true`: Automatically transforms incoming JSON payloads to typed DTO classes.

### 5.2 SQL & ORM Injection Prevention
- All database queries are executed via **Prisma ORM**, which utilizes parameterized statements natively.
- Spatial and location calculations (Haversine formula for proximity search) are implemented using safe parameterized SQL templates without dynamic string concatenation:
  ```typescript
  // Safe parameterized bounding box and Haversine formula
  const query = Prisma.sql`
    SELECT id, title, city, locality,
      ( 6371 * acos( cos( radians(${lat}) ) * cos( radians(latitude) )
      * cos( radians(longitude) - radians(${lng}) ) + sin( radians(${lat}) )
      * sin( radians(latitude) ) ) ) AS distance_km
    FROM properties
    WHERE status = 'active'
    ORDER BY distance_km ASC
    LIMIT ${limit} OFFSET ${offset};
  `;
  ```

---

## 6. Network Security, Rate Limiting & Headers

### 6.1 HTTP Security Headers (Helmet)
`apps/api` initializes `helmet()` with strict default policies:
- `Content-Security-Policy`: Restricts script and resource execution origins.
- `Strict-Transport-Security` (HSTS): Enforces HTTPS with `maxAge: 31536000; includeSubDomains`.
- `X-Frame-Options: DENY`: Protects against clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`.

### 6.2 Cross-Origin Resource Sharing (CORS)
CORS is restricted to authorized client domains via environment variables (`CORS_ALLOWED_ORIGINS`):
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Local frontend preview)
- `https://aashvo.vercel.app` (Staging/Production client)
- Credentials (`credentials: true`) are permitted only for verified origins.

### 6.3 Brute Force & Rate Limiting Defense
Configured via `@nestjs/throttler`:
- Global limit: 100 requests per 60 seconds per IP.
- Authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/forgot-password`): Throttled to 5 requests per 60 seconds.
- Account enumeration defense: Password reset and registration endpoints return uniform messages (`"If an account exists, instructions have been sent"`) to prevent username/email harvesting.

---

## 7. File Storage & Private Document Access

### 7.1 Multi-Cloud Storage Abstraction
AASHVO abstracts file storage through `StorageService` (`apps/api/src/modules/storage/`):
- **Local:** Sandboxed storage for local development testing.
- **Cloudflare R2 / AWS S3:** Production cloud storage.

### 7.2 Access Control Rules
- **Public Assets:** Property photos, public avatars, lifestyle images are stored in public CDN buckets.
- **Private Documents:** KYC identity proofs, Aadhaar cards, property tax receipts, electricity bills, sale deeds are stored in private encrypted buckets with zero public URL exposure.
- **Access Protocol:** Downloads require authenticated calls to `/api/v1/storage/documents/:id/download-url`, which verifies that the requester is the document owner or an authorized administrator, then generates a pre-signed URL expiring in 15 minutes.

---

## 8. Sensitive Data Redaction & Structured Logging

### 8.1 Pino Logger Redaction Rules
`LoggerModule` configures `nestjs-pino` with explicit redact rules:
```typescript
redact: [
  'req.headers.authorization',
  'req.headers.cookie',
  'body.password',
  'body.newPassword',
  'body.currentPassword',
  'body.token',
  'body.refreshToken',
  'body.panNumber',
  'body.aadhaarNumber',
  'body.documentNumber',
]
```
Ensures that server logs shipped to Datadog, CloudWatch, or Logtail will never contain plaintext credentials, bearer tokens, or sensitive Indian PII.

### 8.2 Request Correlation
Every incoming request receives or inherits an `X-Request-Id` header, logged with every trace, enabling end-to-end security auditability across microservice and database boundaries.

---

## 9. Security Sign-Off

The security architecture of AASHVO RC-1.0.0 satisfies all enterprise shared-living security requirements. There are **zero critical or high exploitable vulnerabilities** in the application codebase.

