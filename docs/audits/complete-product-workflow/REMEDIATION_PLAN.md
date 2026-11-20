# AASHVO Product Workflow Remediation Plan

**Author:** Autonomous CTO & Principal Software Architect  
**Scope:** Remediation of All Verified Architectural Disconnects, Inconsistencies & Blind Spots  
**Status:** FULLY EXECUTED & VERIFIED  

---

## 1. Defect Prioritization & Triage

### P0 (Critical Architecture Disconnects - Addressed in Sprint 1)
- [x] **Property Listing Creation Disconnect:** Multi-step wizard previously dumped listings to local memory mock. Fixed by connecting `propertyService.createProperty()` to `POST /api/v1/properties`.
- [x] **Property Inquiry Split-Brain:** Inquiries previously bypassed backend. Fixed by connecting `submitInquiry` to `POST /api/v1/properties/:id/inquiries`.
- [x] **Notifications "Mark All as Read" Route Inconsistency:** Frontend called `/api/v1/notifications/read-all` while backend exposed `/read/all`. Standardized on `/api/v1/notifications/read-all`.

### P1 (High-Priority Workflow & Route Disconnects - Remediated in this Sprint)
- [x] **Saved Items Unsave 404 Disconnect:**
  - *Root Cause:* Frontend client `savedService.ts` called `DELETE /saved/:itemType/:targetId` when toggling a bookmark off, but `SavedController` only exposed `DELETE /saved/:id` (requiring internal saved record UUID).
  - *Remediation:* Added `@Delete(':itemType/:targetId')` endpoint in `SavedController` and `deleteSavedItemByTypeAndTarget(userId, itemType, targetId)` in `SavedService`.
- [x] **Visit Reschedule HTTP Verb Mismatch:**
  - *Root Cause:* Frontend called `PATCH /visits/:id/reschedule` while backend only declared `@Post(':id/reschedule')`.
  - *Remediation:* Added `@Patch(':id/reschedule')` in `VisitsController` alongside `@Post(':id/reschedule')`, ensuring seamless compatibility.
- [x] **Safety Report Database Persistence Missing:**
  - *Root Cause:* Safety reporting modal saved reports to localStorage rather than writing to authoritative PostgreSQL tables.
  - *Remediation:* Added `CreateSafetyReportDto` in API, `submitSafetyReport()` in `SupportService`, `@Post('reports')` in `SupportController`, and wired `submitSafetyReportToBackend()` in `supportService.ts` and `AppContext.tsx`.
- [x] **Admin Property Moderation Disconnect:**
  - *Root Cause:* `AdminModerationModal.tsx` updated local mock state rather than calling the API.
  - *Remediation:* Connected moderation actions (`handleApprove`, `handlePause`) to `moderatePropertyInBackend()` (`PATCH /api/v1/properties/:id/moderate`).
- [x] **Tenancy Agreement Portal Data Freshness:**
  - *Root Cause:* Rental agreements in `rentalTrustService.ts` prioritized local mock cache over backend queries.
  - *Remediation:* Updated `fetchAgreementsForUser()` to prioritize `fetchAgreementsFromBackend()` (`GET /api/v1/agreements/mine`).

### P2 (Testing & Verification Automation)
- [x] **Native Chrome Browser E2E Automation:**
  - Configured `@playwright/test` to run against installed Google Chrome channel across desktop (1280x800) and mobile (Pixel 5, 393x851) viewports.
  - Verified 14 automated browser user journeys.
