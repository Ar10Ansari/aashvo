# AASHVO — Sprint 3.5 Security & Performance Review
## Trust Boundaries, OWASP Top 10 Mitigation, Performance & Query Optimization

**Author:** Principal Security Reviewer & Performance Engineer  
**Date:** 2026-11-14  
**Workspace:** `D:\Projects\AASHVO`  
**Engine:** NestJS 11, PostgreSQL 16.16, Prisma 6.19.3  
**Status:** **AUDITED & VERIFIED**

---

## 1. Security Architecture & Threat Mitigation

### 1.1 Authentication & Session Integrity
- **Asymmetric RS256 Signatures:** Access tokens are signed using RSA 2048-bit private keys (`JWT_SIGNING_PRIVATE_KEY`) and verified using corresponding public keys. The verification algorithm is strictly pinned to `RS256`, completely mitigating algorithm confusion attacks (`alg: "none"` or HMAC-RS256 key confusion).
- **Session Family Invalidation on Replay:** Refresh tokens are single-use opaque cryptographic strings. When an already-rotated token is submitted (indicating token theft or replay), the entire session family is instantly revoked across all devices in a single atomic database transaction.
- **RFC 6265bis Cookie Compliance:** In production, refresh tokens are delivered via `__Host-aashvo_rt` cookies with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and **no Domain attribute**, preventing subdomain hijacking and cross-site scripting access.
- **Account Lockout:** Five consecutive failed authentication attempts trigger an automated account lockout with audit trail recording (`auth.account_locked`), preventing brute-force dictionary attacks.

### 1.2 Access Control & Object-Level Authorization (BOLA / IDOR)
- **Strict Ownership Checks:** Every mutative operation (`PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id`, `PATCH /api/v1/inquiries/:id/status`, `GET /api/v1/media/:id/download`) verifies that the authenticated user (`req.user.id`) matches the resource's owner or possesses the `admin` role. Non-owners receive an immediate `403 Forbidden` (`FORBIDDEN`).
- **Public Profile Projection Sanitization:** Public lookups (`GET /api/v1/profiles/:userId`) exclude `phoneNumber`, `email`, `passwordHash`, and verification tokens at the Prisma query level.
- **Inquiry Contact Masking:** The `InquiriesService` masks phone numbers (`+91 ***** *3210`) on received inquiries while in `pending` or `rejected` state. Only when an owner accepts the inquiry is the telephone number unmasked.

### 1.3 Media Vault Isolation
- **Public Media vs Private Document Storage:**
  - **Public Media (`property-photos`, `user-avatars`):** Routed to public CDN endpoints (Cloudflare R2).
  - **Private Documents (`rental-agreements`, `kyc-documents`, `dispute-evidence`):** Encrypted in private AWS S3 Mumbai (`ap-south-1`) buckets. The `publicUrl` database column is permanently null. Downloading requires authenticated API calls that generate presigned URLs valid for at most 300 seconds.
- **MIME & Size Ceilings:** Strict MIME type validation (allowing only `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`) and strict payload limits (10MB for photos, 25MB for PDFs).

---

## 2. Performance & Query Optimization

### 2.1 Elimination of N+1 Query Anti-Patterns
A common performance pitfall in modular architectures is querying child relations in sequential loops. All services in `apps/api` utilize Prisma relationship includes or `$transaction` batching:
- **`PropertiesService.searchProperties`**: Fetches properties and associated photos in a single optimized SQL join via `include: { photos: true }`.
- **`FlatmatesService.searchFlatmates`**: Fetches flatmate profiles and parent user profiles in a single query via `include: { profile: { select: { fullName: true, avatarUrl: true, idVerified: true, phoneVerified: true } } }`.
- **Count & List Concurrency**: Paginated queries execute `prisma.property.count` and `prisma.property.findMany` concurrently via `prisma.$transaction([ ... ])`, cutting database round-trip latency in half.

### 2.2 Indexing Architecture in PostgreSQL 16
The database index strategy combines B-tree, Partial B-tree, and GIN indexes:

| Table | Index | Index Type | Query Target |
|---|---|---|---|
| `flatmate_profiles` | `idx_flatmates_interests_gin` | GIN | `interests @> ARRAY[...]` (Lifestyle matching) |
| `flatmate_profiles` | `idx_flatmates_localities_gin` | GIN | `target_localities @> ARRAY[...]` (Locality search) |
| `properties` | `idx_properties_amenities_gin` | GIN | `amenities @> ARRAY[...]` (Amenity filters) |
| `properties` | `idx_properties_active_featured` | Partial B-tree | `WHERE moderation_status = 'active' AND is_featured = true` |
| `properties` | `idx_properties_city_locality` | Compound B-tree | Composite search on `(city, locality)` |
| `interest_requests`| `chk_interest_request_target` | CHECK Constraint | Single target XOR constraint (`property_id` XOR `flatmate_profile_id`) |
| `disputes` | `uq_active_dispute_per_agreement_type` | Partial Unique | Prevents duplicate open disputes for a single agreement |

### 2.3 Rate Limiting & DoS Protection
The backend configures `@nestjs/throttler` globally:
- Default: 120 requests per 60-second window per IP.
- Express `Helmet` middleware sets security headers: CSP, HSTS, X-Content-Type-Options (`nosniff`), and frameguard (`DENY`).

---

## 3. Known Limitations & Recommendations

1. **Storage Adapters:** The local development and test environment uses `LocalStorageAdapter` for deterministic local execution. Live production deployments will configure `CloudStorageAdapter` with AWS and Cloudflare credentials once authorization for paid cloud services is granted.
2. **Email Delivery Port:** In local tests, `NoopMailer` is utilized. In production, this binds to an SES or SMTP provider.
3. **Transitive Dependency Advisories:** Transitive advisories in `deepmerge-ts` (<8.0.0 via Prisma) and `zod` (<4.6.6) remain unpatched to avoid breaking changes to `prisma@7` and `zod@4`. These dependencies are not exposed to untrusted external schema generation.

