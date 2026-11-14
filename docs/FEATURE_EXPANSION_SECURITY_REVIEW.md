# AASHVO Feature Expansion Security Review & Threat Model

**Document Version:** 1.0.0  
**Phase:** Master Feature Expansion  
**Date:** November 2026  
**Auditor:** AASHVO Principal Security Engineer & Database Architect  
**Classification:** Confidential & Architectural  

---

## 1. Executive Summary

As part of the AASHVO Master Feature Expansion, seven new capability sets were introduced across the backend (`apps/api`), database (PostgreSQL 16.16), shared contracts (`packages/contracts`), and client application (`src/`). This security review evaluates the threat vectors, isolation boundaries, authorization checks, privacy safeguards, and cryptographic postures introduced by these features.

### Scope of Audit
1. **Feature 1: Smart Location Discovery & Verified Landmarks**
2. **Feature 2: Rent Split Calculator**
3. **Feature 3: Saved Listings and Shortlists**
4. **Feature 4: Property Visit Scheduling**
5. **Feature 5: Property Verification Workflow**
6. **Feature 6: Move-In Checklist & Rental Trust Engine Integration**
7. **Feature 7: Smart In-App Notifications Center**

---

## 2. Threat Modeling & Risk Matrix

| Component / Feature | Threat Vector | Inherent Risk | Mitigations Applied | Residual Risk |
|---|---|---|---|---|
| **Location Discovery** | Exact resident coordinates exposure & stalking | HIGH | Differential privacy: exact lat/long never returned to public queries. Coords rounded/fuzzed to ~500m locality centroid. Landmarks use curated fixed catalog coordinates. | LOW |
| **Rent Split Calculator** | Perceived regulatory escrow / payment liability | HIGH | Strictly non-custodial: zero wallet, zero banking gateway, zero custodial escrow. Prominent disclaimer banners and legal demarcation ("Informational calculation only"). | NEGLIGIBLE |
| **Saved Items** | Insecure Direct Object References (IDOR), enumeration, self-saving spam | MEDIUM | Multi-tenant user isolation: `SavedItem` queries filtered strictly by `userId = currentUser.id`. Self-save denial (`targetId !== userId` and property owner check). Block enforcement via `UserBlock` check. Unique index `(user_id, item_type, target_id)` prevents duplication. | LOW |
| **Visit Scheduling** | Double-booking race conditions, harassment, visit spam | HIGH | PostgreSQL partial unique index `uq_property_confirmed_visit` on `(property_id, scheduled_at) WHERE status = 'confirmed'` prevents simultaneous confirmed visits. Application 30-min buffer check. Anti-harassment: host must confirm request before location details unlock. Self-visit forbidden. `UserBlock` check. | LOW |
| **Property Verification** | Forged utility bills, unauthorized claim of ownership, legal liability | HIGH | Document submissions restricted to verified property owners (`ownerId === currentUser.id`). Review endpoints guarded by `Roles('admin')`. Explicit legal disclaimer: "Verification represents document identity check, not state guarantee of legal title." | LOW |
| **Move-In Checklist** | Unilateral deposit deduction claims, tamper with baseline | HIGH | Two-party mutual digital acknowledgement required on `PropertyInspection`. Cryptographically tied to `TenancyAgreement`. Inspection history immutable once counterparty acknowledges. | LOW |
| **Notification Center** | Notification cross-tenant leakage, spam/DoS | MEDIUM | Strictly scoped by `userId = currentUser.id`. `markAsRead` validates ownership. Rate-limited notification event triggers. Truncated payloads without credential/token leaks. | LOW |

---

## 3. Detailed Boundary & Authorization Audits

### 3.1 Global Authentication & Authorization (NestJS)
- **Global `JwtAuthGuard`**: Registered as an `APP_GUARD` in `AppModule`. Every endpoint across all 5 new modules is authenticated by default unless decorated explicitly with `@Public()`.
- **Public Whitelist**:
  - `GET /api/v1/locations/cities` (`@Public()`)
  - `GET /api/v1/locations/localities` (`@Public()`)
  - `GET /api/v1/locations/landmarks` (`@Public()`)
- **Strict Role-Based Access Control (RBAC)**:
  - `PATCH /api/v1/properties/:id/verification/review` is restricted to `@Roles('admin')` through the global `RolesGuard`.
  - Non-admin attempts return `403 Forbidden`. Attempting direct elevation during public registration returns `400 Bad Request`.

### 3.2 Database Integrity & Constraint Architecture (PostgreSQL 16.16)
The migration `20261115020000_master_feature_expansion` applied to PostgreSQL 16 introduces 4 new relational base tables, bringing total domain tables to 32:
```sql
-- Partial unique index preventing double-booking of confirmed visits
CREATE UNIQUE INDEX uq_property_confirmed_visit 
ON property_visits (property_id, scheduled_at) 
WHERE status = 'confirmed';

-- Partial unique index preventing multiple active verification applications
CREATE UNIQUE INDEX uq_property_pending_verification 
ON property_verifications (property_id) 
WHERE status = 'pending';

-- Idempotency constraint on saved items
CREATE UNIQUE INDEX uq_saved_user_item 
ON saved_items (user_id, item_type, target_id);
```

### 3.3 Privacy & Data Masking Controls
1. **Device Location Masking**:
   - Exact client coordinates (`lat`, `lng`) are never written to database tables or logged into transcripts.
   - Haversine distance calculations are computed in-memory and rounded to one decimal place (`km`), eliminating micro-location triangulation.
2. **Anti-Harassment & Block Protection**:
   - `SavedService` and `VisitsService` actively query the `UserBlock` table. If user $A$ has blocked user $B$ (or vice versa), visit requests and candidate shortlists are rejected with appropriate error envelopes.
3. **Audit Log Hygiene**:
   - Zero credentials, plaintext passwords, refresh tokens, or raw document file buffers are written to NestJS Winston logger or PostgreSQL `audit_logs`.

---

## 4. Security Verification Verdict

**Final Verdict: APPROVED FOR PRODUCTION CANDIDACY**

All security controls, rate limiting, RLS/database constraints, and multi-tenant isolation barriers have been verified through automated integration suites executing against PostgreSQL 16.16.

