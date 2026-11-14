# AASHVO — Sprint 3 Security Review & Trust Boundary Architecture
## Domain Services, Media Vault & Marketplace Access Control

**Date:** 2026-11-14  
**Author:** Principal Security Engineer & Software Architect  
**Scope:** AASHVO Backend API (`apps/api`), PostgreSQL 16.16 Domain Constraints, and Storage Vaults  
**Status:** **AUDITED & VERIFIED PASS**

---

## 1. Threat Model & Trust Boundaries

Sprint 3 introduces complex user interactions: user profiles, public property listings, room-sharing personal advertisements, sensitive tenancy documents, and direct renter-to-owner inquiries.

### Key Threat Vectors Addressed:
1. **Broken Object Level Authorization (BOLA / IDOR):** Malicious users attempting to update or delete listings, profiles, or inquiries owned by other parties.
2. **PII & Contact Data Harvest:** Scraping phone numbers, email addresses, or government identification documents via public endpoints.
3. **Privilege Escalation:** Listing creators attempting to self-approve properties to `active` without administrative moderation.
4. **Malicious File Uploads & Unrestricted Media Access:** Uploading executable or spoofed files, or unauthorized downloading of private tenancy contracts.
5. **Spam & Harassment:** Flood inquiries, duplicate pending requests, and fraudulent "family stay" commercial listings.
6. **Minor Safety Violation:** Underage users listing themselves for shared flatmate living.

---

## 2. Authorization & RBAC Matrix

| Endpoint | Method | Public / Auth | Allowed Roles | Enforcement Mechanism |
|---|---|---|---|---|
| `/api/v1/profiles/me` | GET | Authenticated | All (`renter`, `owner`, `admin`) | Current user token claims (`req.user.id`) |
| `/api/v1/profiles/me` | PATCH | Authenticated | All | Current user token claims; unique phone check |
| `/api/v1/profiles/:userId` | GET | Public | Anonymous / All | Sanitized public DTO (strips email, phone, passwords) |
| `/api/v1/locations/cities` | GET | Public | Anonymous / All | Read-only catalog with dynamic active inventory count |
| `/api/v1/locations/localities` | GET | Public | Anonymous / All | Read-only catalog lookup |
| `/api/v1/properties` | GET | Public | Anonymous / All | Filtered to `moderationStatus: 'active'` only |
| `/api/v1/properties` | POST | Authenticated | `owner`, `admin` | RolesGuard & JwtAuthGuard; sets `pending_review` |
| `/api/v1/properties/mine` | GET | Authenticated | `owner`, `admin` | Scoped strictly to `ownerId === req.user.id` |
| `/api/v1/properties/:id` | GET | Public | Anonymous / All | Active listings public; inactive requires owner or admin |
| `/api/v1/properties/:id` | PATCH | Authenticated | Owner | Ownership validation; throws 403 `FORBIDDEN` if non-owner |
| `/api/v1/properties/:id` | DELETE | Authenticated | Owner / Admin | Ownership validation or `admin` role |
| `/api/v1/properties/:id/moderate` | PATCH | Authenticated | `admin` strictly | RolesGuard(`admin`); updates moderation status |
| `/api/v1/media/presigned-upload` | POST | Authenticated | All | Validates MIME allowlist and size limits (10MB / 25MB) |
| `/api/v1/media/confirm` | POST | Authenticated | All | Records confirmed asset with ownership bound to `req.user.id` |
| `/api/v1/media/:id/download` | GET | Authenticated | Owner / Admin | Private bucket download requires asset ownership or admin |
| `/api/v1/flatmates` | GET | Public (Opt-Auth) | Anonymous / All | Public search; optional auth computes compatibility |
| `/api/v1/flatmates/me` | GET | Authenticated | All | Current user flatmate profile |
| `/api/v1/flatmates/me` | POST | Authenticated | All | Age `>= 18` verification; single profile per user |
| `/api/v1/flatmates/me` | PATCH | Authenticated | All | Age `>= 18` verification; updates user's profile |
| `/api/v1/flatmates/:id` | GET | Public (Opt-Auth) | Anonymous / All | Public view; optional auth computes compatibility |
| `/api/v1/family-stays` | GET | Public | Anonymous / All | Filtered to `familyLivesOnProperty: true` and `active` |
| `/api/v1/family-stays/:id` | GET | Public | Anonymous / All | Verified family stay details |
| `/api/v1/inquiries` | POST | Authenticated | All | Single target XOR validation; anti-spam duplicate defense |
| `/api/v1/inquiries/sent` | GET | Authenticated | All | Scoped strictly to `senderId === req.user.id` |
| `/api/v1/inquiries/received` | GET | Authenticated | All | Scoped strictly to properties or flatmates owned by user |
| `/api/v1/inquiries/:id/status` | PATCH | Authenticated | Recipient | Only listing owner can accept/reject inquiry |

---

## 3. Detailed Security Controls

### 3.1 Contact Privacy & Phone Number Masking
- **Public Profile Sanitization:** When querying `GET /api/v1/profiles/:userId`, the backend returns `PublicProfileResponseDto`. Fields `email`, `phoneNumber`, `passwordHash`, and verification token relationships are omitted from the database projection entirely.
- **Inquiry Contact Masking:** Listing owners reviewing received inquiries (`GET /api/v1/inquiries/received`) cannot see the applicant's raw phone number while the inquiry is `pending` or `rejected`. The phone number is masked as:
  ```text
  +91 98765 43210  -->  +91 ***** *3210
  ```
  Only when the recipient explicitly transitions the inquiry to `accepted` is the full contact number unmasked.

### 3.2 Media Vault Isolation (Public Media vs Private Document Storage)
- **Bucket Partitioning:**
  - **Public Assets (`user-avatars`, `property-photos`):** Stored in Cloudflare R2. Presigned upload URLs are generated with short expiration (15 minutes). Permanent public CDN URLs are returned upon confirmation.
  - **Private Documents (`rental-agreements`, `kyc-documents`, `dispute-evidence`):** Stored in AWS S3 Mumbai (`ap-south-1`). `publicUrl` is permanently `null`. Download access requires calling `GET /api/v1/media/:id/download`, which verifies that the requesting user is the document owner or an administrator, generating a short-lived presigned download URL (valid for 300 seconds).
- **MIME & Size Enforcement:**
  - Images (`image/jpeg`, `image/png`, `image/webp`): Maximum 10MB.
  - Documents (`application/pdf`, `image/jpeg`, `image/png`): Maximum 25MB.
  - All other MIME types return `400 UNSUPPORTED_MEDIA_TYPE`.

### 3.3 Adult Age Validation & PostgreSQL Check Constraints
- In accordance with legal rental regulations in India and child safety standards, shared flatmate listings require users to be at least 18 years of age.
- **Multi-Layer Enforcement:**
  1. **DTO Layer:** `CreateFlatmateProfileDto` and `UpdateFlatmateProfileDto` enforce `@Min(18)`.
  2. **Service Layer:** `FlatmatesService` explicitly checks `dto.age < 18` and raises `400 VALIDATION_FAILED`.
  3. **Database Layer:** PostgreSQL 16 table `flatmate_profiles` enforces CHECK constraint:
     ```sql
     CONSTRAINT chk_flatmate_adult_age CHECK (age >= 18)
     ```

### 3.4 Family Stays Integrity Protection
- To prevent commercial operators or landlords from misrepresenting shared rentals as verified family stays, the system enforces:
  ```sql
  CONSTRAINT chk_family_stay_eligibility CHECK (
    listing_category != 'family_stay' OR family_lives_on_property = true
  )
  ```
- The `FamilyStaysService` applies `where: { familyLivesOnProperty: true, moderationStatus: 'active' }`, guaranteeing that users searching for family accommodations only see properties where a host family genuinely resides on-site.

### 3.5 Anti-Spam & Single-Target XOR Inquiries
- **Single-Target XOR:** An inquiry must target either a property OR a flatmate profile, never both and never neither.
  - Enforced in `InquiriesService`: throws `400 INQUIRY_TARGET_INVALID` if both or neither are provided.
  - Enforced in PostgreSQL 16:
    ```sql
    CONSTRAINT chk_interest_request_target CHECK (
      (property_id IS NOT NULL AND flatmate_profile_id IS NULL) OR
      (property_id IS NULL AND flatmate_profile_id IS NOT NULL)
    )
    ```
- **Duplicate Inquiry Defense:** If a user already has a pending inquiry for a given property or flatmate profile, attempting to submit another inquiry triggers `409 Conflict` (`DUPLICATE_INQUIRY`).
- **Self-Inquiry Prevention:** A listing owner is blocked from submitting an inquiry to their own property or flatmate profile (`400 VALIDATION_FAILED`).

### 3.6 Optional Authentication in Public Marketplace Routes
- Routes such as `GET /api/v1/flatmates` and `GET /api/v1/flatmates/:id` are decorated with `@Public()` so anonymous guests can discover listings.
- When an authenticated user browses these endpoints, their Bearer token is parsed by `JwtAuthGuard` in non-blocking mode:
  - If valid, `req.user` is populated, enabling the `FlatmatesService` to calculate personalized lifestyle compatibility scores.
  - If omitted or expired, the request proceeds anonymously without raising `401 Unauthorized`.

---

## 4. Audit Logging & Security Trail

All state-modifying actions write structured audit events to the PostgreSQL `audit_logs` table:
- `property.created`, `property.updated`, `property.moderated`
- `flatmate_profile.created`, `flatmate_profile.updated`
- `inquiry.created`, `inquiry.status_updated`
- `media.upload_requested`, `media.confirmed`

All audit records capture:
- `actor_id`: Authenticated user ID (or null for public events).
- `ip_address`: Client IP address.
- `request_id`: Tracing correlation UUID from `X-Request-ID`.
- `metadata`: Sanitized JSON payload with zero credentials or tokens.

---

## 5. Security Verdict

The Sprint 3 architecture successfully implements defense-in-depth across DTO validation, business logic, RBAC guards, and database constraints. No bypass vulnerabilities or PII exposures were detected during testing.

