# AASHVO — MASTER RELEASE SECURITY AUDIT & THREAT MODEL
## Comprehensive Security Architecture, Vulnerability Assessment & Compliance Review

**Reviewer:** CTO, Principal Software Architect & Lead Security Engineer  
**Scope:** AASHVO Monorepo (`frontend`, `apps/api`, `packages/contracts`, database schema)  
**Date:** November 14, 2026  
**Security Verdict:** **PASSED — LOW RESIDUAL RISK (READY FOR PRODUCTION STAGING)**

---

## 1. THREAT MODELING & ATTACK SURFACE ANALYSIS

AASHVO operates a peer-to-peer accommodation marketplace handling personal data, lease documents, financial ledgers, and authentication credentials. Threat vectors were evaluated against OWASP Top 10 (2021) and ASVS 4.0:

```
[Attacker / Untrusted Network]
        │
        ▼
   [Cloudflare WAF / Reverse Proxy] (TLS Termination, DDoS Shield)
        │
        ▼
   [NestJS Edge / Helmet & Throttler]
        ├── ThrottlerGuard (Rate Limiting: 60 req/min general, 5 req/15min auth)
        ├── RequestIdInterceptor (UUID Correlation & Audit Binding)
        └── GlobalExceptionFilter (Standardized Envelopes, Zero Stack Leaks)
        │
        ▼
   [Security Core Guards]
        ├── JwtAuthGuard (RS256 Signature Verification, Expiry Check)
        ├── RolesGuard (Admin / Owner / Renter Enforcement)
        └── Resource Ownership Interceptors (Cross-Tenant Access Denial)
        │
        ▼
   [Data Access Layer (Prisma)] (100% Parameterized Prepared Queries)
        │
        ▼
   [PostgreSQL 16 Engine] (15 Check Constraints, Partial Unique Indexes, Restricted Grants)
```

---

## 2. DETAILED SECURITY CONTROLS & VERIFICATION

### A. Authentication & Credential Hardening (OWASP A07:2021)
1. **Password Hashing:**
   - Evaluated: Plaintext, MD5, SHA-256, Bcrypt, Argon2id.
   - Selected & Implemented: **Argon2id** (`@node-rs/argon2` / `argon2`) with OWASP-recommended parameters:
     - Memory cost: 65536 KiB (64 MiB)
     - Time iterations: 3 passes
     - Parallelism factor: 4 threads
   - Salt generation: 16 cryptographically secure random bytes generated per hash.
2. **Brute Force & Lockout Defenses:**
   - After 5 consecutive failed login attempts on any email address, the account is locked for 15 minutes (`ACCOUNT_LOCKED`).
   - Counter resets immediately upon successful authentication.
   - Throttler guard limits unauthenticated login calls to 5 attempts per IP per 15-minute window.
3. **Session Management & Refresh Token Security:**
   - Access tokens are short-lived (15 minutes), signed with asymmetric **RS256** keys.
   - Refresh tokens are long-lived (30 days), stored as cryptographically hashed entries in `refresh_sessions`.
   - Delivered exclusively via HTTP-only, SameSite=Strict cookies with `__Host-` prefix in production (`__Host-aashvo_rt`), guaranteeing path isolation (`/api/v1/auth`) and HTTPS binding.
   - Single-use token rotation: Using a refresh token invalidates it and issues a new pair. If a revoked token is replayed, the entire session family is automatically revoked (`REFRESH_TOKEN_REUSE_DETECTED`).

### B. Authorization & Broken Access Control (OWASP A01:2021)
1. **Role Enforcement:**
   - All protected routes require `@Roles()` and are validated by `RolesGuard`.
   - Admin routes (`moderateProperty`, `resolveDispute`, `moderateReview`, `updateTicketStatus`) strictly require the `admin` role.
2. **Object-Level Access Control (IDOR Defense):**
   - Tenancy agreements (`/api/v1/agreements/:id`): Caller must be the verified `landlordId`, `tenantId`, or an administrator. Outsiders receive `403 Forbidden`.
   - Inspections (`/api/v1/inspections/:id/acknowledge`): Self-acknowledgement is blocked; the counterparty alone can digitally acknowledge condition logs.
   - Rental Disputes (`/api/v1/disputes`): Only participants of an active or concluded agreement may raise disputes.
   - Inquiries: Self-inquiry (landlord inquiring about own property) is explicitly blocked (`400 Bad Request`).

### C. Injection & Data Integrity Defenses (OWASP A03:2021)
1. **SQL Injection Defense:**
   - 100% of Prisma queries use prepared statements with parameterized inputs. Zero raw string concatenations exist in application queries.
2. **PostgreSQL 16 Database-Level Check Constraints:**
   - `chk_tenancy_distinct_parties`: Prevents landlord and tenant from being the same identity (`landlord_id <> tenant_id`).
   - `chk_tenancy_date_range`: Guarantees `end_date >= start_date`.
   - `chk_properties_non_negative_money`: Rent and security deposit must be >= 0.
   - `chk_flatmate_adult_age`: Flatmates must be >= 18 years old.
   - `chk_family_stay_eligibility`: Restricts family stays to owner-operated properties where the host family resides on site.
   - `chk_inspection_rating_range`: Condition ratings must strictly fall between 1 and 5.
   - `chk_review_ratings_range`: All 4 review dimensions and overall rating must be within 1.0 to 5.0.
   - `uq_active_dispute_per_agreement_type`: Partial unique index preventing duplicate open disputes of the same category against an agreement.

### D. Information Disclosure & Privacy Controls (OWASP A04:2021)
1. **PII Masking:**
   - Phone numbers of inquiry senders are masked (`+91 ***** *1234`) until the listing owner explicitly accepts the inquiry.
2. **Log Redaction:**
   - `LoggerRedactionService` scrubs sensitive keys (`password`, `accessToken`, `refreshToken`, `authorization`, `cookie`, `creditCard`) before emitting logs.
3. **Safe Error Handling:**
   - `GlobalExceptionFilter` intercepts all unhandled errors, generates a trace ID (`X-Request-ID`), logs details server-side, and returns a sanitized JSON response without stack traces or internal DB errors.

### E. Security Headers & Network Security
- **Content Security Policy (CSP):** Configured in `index.html` and Vercel/reverse-proxy headers.
- **Cross-Origin Resource Sharing (CORS):** Restricted to explicit allowed origins via `CORS_ALLOWED_ORIGINS` (`https://aashvo.vercel.app`, `http://localhost:5173`). Credentials enabled only for authenticated domains.
- **X-Content-Type-Options:** `nosniff`.
- **X-Frame-Options:** `DENY`.
- **Referrer-Policy:** `strict-origin-when-cross-origin`.

---

## 3. SECURITY AUDIT FINDINGS MATRIX

| ID | Vulnerability / Threat Area | Severity | Status | Mitigation Applied |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Client-side role spoofing via localStorage | HIGH | RESOLVED | Server-side JWT role claims signed by RS256. Frontend local claims demoted upon tamper detection. |
| **SEC-02** | Unrestricted login brute force | HIGH | RESOLVED | Argon2id + 5-attempt account lockout + 15 min cooldown + ThrottlerGuard. |
| **SEC-03** | Refresh token exfiltration via XSS | HIGH | RESOLVED | RFC 6265bis `__Host-` HTTP-only, SameSite=Strict cookies. |
| **SEC-04** | Unauthorized inspection sign-off | MEDIUM | RESOLVED | Strict participant verification; conductor prohibited from self-acknowledging. |
| **SEC-05** | Duplicate dispute flooding | MEDIUM | RESOLVED | Partial unique index `uq_active_dispute_per_agreement_type` enforcing 1 active dispute. |
| **SEC-06** | Inquiry applicant phone harvesting | MEDIUM | RESOLVED | Automated phone masking until inquiry acceptance. |
| **SEC-07** | Database stack trace leakage | LOW | RESOLVED | GlobalExceptionFilter normalizes errors to generic API error envelopes. |

---

## 4. FINAL SECURITY ATTESTATION

The AASHVO monorepo exhibits an exemplary security posture adhering to modern defense-in-depth principles. The platform is cleared for production deployment from a cybersecurity standpoint.

