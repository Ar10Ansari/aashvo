# AASHVO — Master Release Implementation Roadmap & Feature Traceability Matrix

**Author:** Principal Software Architect & QA Lead  
**Date:** 2026-11-14  
**Workspace:** `D:\Projects\AASHVO` | GitHub: `https://github.com/Ar10Ansari/aashvo.git`  
**Phase:** **MASTER RELEASE WORKSTREAM A**

---

## 1. Feature Traceability Matrix

This matrix connects every core product requirement to its frontend components, backend REST API endpoints, PostgreSQL 16 database models, and automated test suites.

| Feature ID | Product Requirement | Frontend Component / View | Backend API Endpoint | Database Table / Constraint | Test Suite |
|---|---|---|---|---|---|
| **REQ-AUTH-01** | User Registration (Email/Password) | `AuthModal.tsx` | `POST /api/v1/auth/register` | `users`, `profiles`, `Argon2id` | `auth.postgres.integration.spec.ts` |
| **REQ-AUTH-02** | User Login & Session Rotation | `AuthModal.tsx` | `POST /api/v1/auth/login`<br>`POST /api/v1/auth/refresh` | `refresh_sessions`, `__Host-` cookies | `auth.postgres.integration.spec.ts` |
| **REQ-AUTH-03** | Account Recovery & Password Reset | `AuthModal.tsx` | `POST /api/v1/auth/forgot-password`<br>`POST /api/v1/auth/reset-password` | `verification_tokens` (SHA-256) | `auth.postgres.integration.spec.ts` |
| **REQ-AUTH-04** | Logout & Global Device Revocation | `Navbar.tsx` | `POST /api/v1/auth/logout`<br>`POST /api/v1/auth/logout-all` | `refresh_sessions` (revoked_at) | `auth.postgres.integration.spec.ts` |
| **REQ-PROF-01** | User Profile & Progressive Score | `UserProfileModal.tsx` | `GET /api/v1/profiles/me`<br>`PATCH /api/v1/profiles/me` | `profiles` (completion calc) | `domain.unit.spec.ts`<br>`marketplace.postgres.integration.spec.ts` |
| **REQ-PROF-02** | Sanitized Public Profile View | `FlatmateDetailModal.tsx` | `GET /api/v1/profiles/:userId` | `profiles` (no phone, no email) | `marketplace.postgres.integration.spec.ts` |
| **REQ-LOC-01** | Indian Cities & Localities Catalog | `Hero.tsx`<br>`PropertyFilters.tsx` | `GET /api/v1/locations/cities`<br>`GET /api/v1/locations/localities` | In-memory catalog + dynamic PG count | `marketplace.postgres.integration.spec.ts` |
| **REQ-PROP-01** | Property Search & Filtering | `DiscoverySection.tsx` | `GET /api/v1/properties` | `properties`, `property_photos`, GIN | `marketplace.postgres.integration.spec.ts` |
| **REQ-PROP-02** | Property Listing Creation (Owner) | `ListPropertyModal.tsx` | `POST /api/v1/properties` | `properties` (status: pending_review) | `marketplace.postgres.integration.spec.ts` |
| **REQ-PROP-03** | Admin Property Moderation | `AdminModerationModal.tsx`| `PATCH /api/v1/properties/:id/moderate` | `properties.status`, `audit_logs` | `marketplace.postgres.integration.spec.ts` |
| **REQ-FLAT-01** | Flatmate Profile Creation (18+) | `ListPropertyModal.tsx` | `POST /api/v1/flatmates/me` | `flatmate_profiles`, `chk_flatmate_adult_age` | `domain.unit.spec.ts`<br>`marketplace.postgres.integration.spec.ts` |
| **REQ-FLAT-02** | Lifestyle Compatibility Scoring | `FlatmateCard.tsx` | `GET /api/v1/flatmates/:id` | 5-factor lifestyle algorithm | `domain.unit.spec.ts`<br>`marketplace.postgres.integration.spec.ts` |
| **REQ-FAM-01** | Family Stays Discovery & Meals | `DiscoverySection.tsx` | `GET /api/v1/family-stays` | `properties`, `chk_family_stay_eligibility` | `marketplace.postgres.integration.spec.ts` |
| **REQ-INQ-01** | Single-Target Inquiry with Anti-Spam | `PropertyDetailModal.tsx`<br>`FlatmateDetailModal.tsx` | `POST /api/v1/inquiries` | `interest_requests`, `chk_interest_request_target` | `marketplace.postgres.integration.spec.ts` |
| **REQ-INQ-02** | Contact Privacy & Phone Masking | `InquiriesModal.tsx` | `GET /api/v1/inquiries/received`<br>`PATCH /api/v1/inquiries/:id/status`| `maskPhoneNumber` (+91 ***** *3210) | `domain.unit.spec.ts`<br>`marketplace.postgres.integration.spec.ts` |
| **REQ-MED-01** | Media Presigned Upload & Storage | Image Uploaders | `POST /api/v1/media/presigned-upload`<br>`POST /api/v1/media/confirm` | `media_assets`, MIME limits | `domain.unit.spec.ts`<br>`marketplace.postgres.integration.spec.ts` |
| **REQ-MED-02** | Private Document Vault Download | `RentalTrustModal.tsx` | `GET /api/v1/media/:id/download` | `media_assets` (private S3 vault) | `marketplace.postgres.integration.spec.ts` |
| **REQ-TRU-01** | Tenancy Agreement Lifecycle | `RentalTrustModal.tsx` | `POST /api/v1/agreements`<br>`POST /api/v1/agreements/:id/sign` | `agreements` (dual digital signature) | `trust-engine.postgres.integration.spec.ts` |
| **REQ-TRU-02** | Property Move-In/Out Inspection | `RentalTrustModal.tsx` | `POST /api/v1/inspections` | `inspection_reports` (room checklist) | `trust-engine.postgres.integration.spec.ts` |
| **REQ-TRU-03** | Verified Tenancy Reviews | `RentalTrustModal.tsx` | `POST /api/v1/reviews` | `reviews`, `chk_review_rating_range` | `trust-engine.postgres.integration.spec.ts` |
| **REQ-TRU-04** | Security Deposit Disputes | `RentalTrustModal.tsx` | `POST /api/v1/disputes` | `disputes`, `uq_active_dispute_per_agreement_type` | `trust-engine.postgres.integration.spec.ts` |
| **REQ-SUP-01** | Omnichannel Support Tickets | `HelpCenterModal.tsx` | `POST /api/v1/support/tickets` | `support_tickets` (ASH-TKT-XXXXXX) | `trust-engine.postgres.integration.spec.ts` |

---

## 2. Workstream Sequencing & Execution Schedule

```text
WORKSTREAM A: Architecture, Gap Audit & Traceability Matrix (COMPLETE)
  └─ Output: SPRINT_3_5 verified, gap audit established, roadmap generated.

WORKSTREAM B: Full-Stack Authentication & Account Integration
  ├─ 1. Build unified frontend API client (src/services/apiClient.ts) targeting NestJS /api/v1.
  ├─ 2. Connect React AuthModal.tsx to NestJS /api/v1/auth/login and /api/v1/auth/register.
  ├─ 3. Implement session storage, bearer token header injection, and refresh token cookie handling.
  └─ 4. Verify account recovery (forgot password, reset password, change password).

WORKSTREAM C: Marketplace Frontend-to-Backend Integration
  ├─ 1. Update src/services/marketplaceService.ts to fetch active listings from NestJS /api/v1/properties.
  ├─ 2. Connect locations, city selectors, and locality searches to /api/v1/locations.
  └─ 3. Add robust loading, error, empty, and retry states.

WORKSTREAM D: Flatmate & Family Stay Workflows
  ├─ 1. Connect flatmate discovery and profile creation to /api/v1/flatmates.
  ├─ 2. Connect family stays discovery to /api/v1/family-stays.
  └─ 3. Verify lifestyle compatibility display and host family residence enforcement.

WORKSTREAM E: Saved Items, User Dashboard, Inquiries & Notifications
  ├─ 1. Build persistent saved properties and saved flatmates features in user dashboard.
  ├─ 2. Connect inquiry submission and received inquiries management with phone number masking.
  └─ 3. Build in-app notification center.

WORKSTREAM F: Admin Moderation Console
  ├─ 1. Connect AdminModerationModal.tsx to /api/v1/properties/:id/moderate.
  ├─ 2. Implement admin listings queue, host verification reviews, and audit logging.

WORKSTREAM G: Rental Trust Engine (Sprint 4 Backend & Frontend Integration)
  ├─ 1. Build AgreementsModule, InspectionsModule, ReviewsModule, DisputesModule, SupportModule in apps/api.
  ├─ 2. Add contracts in packages/contracts and update OpenAPI spec.
  ├─ 3. Connect RentalTrustModal.tsx to NestJS trust endpoints.
  └─ 4. Write trust-engine.postgres.integration.spec.ts.

WORKSTREAM H: Media Storage & External Integration Register
  ├─ 1. Connect frontend photo upload modal to /api/v1/media/presigned-upload and confirm.
  └─ 2. Author docs/MASTER_RELEASE_INTEGRATION_REGISTER.md.

WORKSTREAM I & J: Security, Performance & SEO Verification
  ├─ 1. Verify OWASP defenses, rate limiting, N+1 query elimination, Core Web Vitals.
  └─ 2. Author docs/MASTER_RELEASE_SECURITY_AUDIT.md and docs/MASTER_RELEASE_SEO_AEO_GEO_REPORT.md.

WORKSTREAM K & L: End-to-End QA, Production Runbook & Release Candidate
  ├─ 1. Execute 30 end-to-end user journeys across frontend and backend.
  ├─ 2. Author remaining deliverables (Deployment Runbook, Backup/Restore, Rollback Plan, Feature Matrix, Sign-Off).
  └─ 3. Present Master Release Candidate to CTO for review.
```

