# AASHVO Prioritized Engineering Remediation Backlog

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Release Manager  
**Scope:** Actionable, ranked backlog of remediation items categorized by urgency: P0 (Critical Release Blocker), P1 (High Priority), P2 (Medium Priority), P3 (Long-Term Enhancement).

---

## 1. Backlog Priority Matrix

| Backlog ID | Priority | Feature Domain | Title | Effort | Status | Risk If Unfixed |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| **ENG-P0-01** | **P0** | Properties | Connect Property Listing Creation to NestJS REST API | 2 Days | **RESOLVED & VERIFIED** | Landlords cannot persist listings to PostgreSQL; listings lost on reload. |
| **ENG-P0-02** | **P0** | Notifications | Fix Notification Route Mismatch (`/read-all` vs `/mark-all-read`) | 2 Hours | **RESOLVED & VERIFIED** | Users encounter 404 error when clicking "Mark all as read". |
| **ENG-P0-03** | **P0** | Inquiries | Wire Direct Property Inquiry Submission to NestJS API | 1 Day | **RESOLVED & VERIFIED** | Renters' inquiries never reach landlords in database. |
| **ENG-P1-01** | **P1** | Tenancy | Migrate Tenancy Agreements from Supabase to NestJS REST | 2 Days | Open | Lease agreements fail to load or save in NestJS environment. |
| **ENG-P1-02** | **P1** | Safety & Support| Route Support Tickets & Dispute Reports to NestJS Controllers | 1.5 Days | Critical user safety reports and disputes are silently dropped. |
| **ENG-P1-03** | **P1** | Inspections | Mount Orphaned `MoveInChecklistModal` into Tenancy Workflow | 1 Day | Production-ready inspection checklist remains inaccessible to users. |
| **ENG-P1-04** | **P1** | Visits | Prevent Duplicate Visit Booking on Rapid Double-Click | 3 Hours | Double bookings created in database on mobile double-taps. |
| **ENG-P2-01** | **P2** | Security | Remove Token Mirroring in `localStorage` | 4 Hours | Mitigates token exfiltration risks via potential XSS vectors. |
| **ENG-P2-02** | **P2** | Search | Replace In-Memory Filter with Server-Side Query Params | 2 Days | Inability to scale listing catalog beyond in-memory batch size. |
| **ENG-P2-03** | **P2** | Landlord UX | Build Landlord Listing Management Dashboard (Edit/Delete) | 3 Days | Landlords cannot edit pricing or deactivate rented properties. |
| **ENG-P3-01** | **P3** | Messaging | Unify Connect Chat into Global Inbox for Landlords & Renters | 5 Days | High user friction from separate inquiry and messaging channels. |
| **ENG-P3-02** | **P3** | Reviews | Expose Prisma Review Model in Property Detail UI | 2 Days | Missing social proof and renter trust signals on listings. |

---

## 2. In-Depth Remediation Specifications

### ENG-P0-01: Connect Property Listing Creation to NestJS REST API
- **Domain:** Host / Property Owner Journey
- **Root Cause:** [ListPropertyModal.tsx](file:///d:/Projects/AASHVO/src/components/ListPropertyModal.tsx) invokes `AppContext.addProperty()`, which calls legacy Supabase client or local React state.
- **Acceptance Criteria:**
  1. Refactor `src/services/propertyService.ts` to call `POST /api/v1/properties` with payload matching `CreatePropertyDto`.
  2. Multi-step listing wizard uploads image assets and sends structured JSON payload with authorization bearer token.
  3. Created property is stored in PostgreSQL `Property` table and immediately searchable in public listing catalog.
  4. Integration test added verifying frontend-to-backend property creation.

### ENG-P0-02: Fix Notification Route Mismatch
- **Domain:** Notification System
- **Root Cause:** [notificationService.ts](file:///d:/Projects/AASHVO/src/services/notificationService.ts) line 42 calls `POST /notifications/mark-all-read`. The NestJS controller in [notifications.controller.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/notifications/notifications.controller.ts) line 38 defines `@Post('read-all')`.
- **Acceptance Criteria:**
  1. Change endpoint path in `notificationService.ts` to `/notifications/read-all`.
  2. Clicking "Mark all as read" in `NotificationCenter.tsx` returns HTTP 200 and marks all notifications read without error.

### ENG-P0-03: Wire Direct Property Inquiry Submission to NestJS API
- **Domain:** Renter Journey
- **Root Cause:** [PropertyDetailModal.tsx](file:///d:/Projects/AASHVO/src/components/PropertyDetailModal.tsx) invokes `AppContext.submitConnectRequest()`, which executes Supabase query instead of NestJS `POST /api/v1/inquiries`.
- **Acceptance Criteria:**
  1. Create `inquiryService.ts` invoking `POST /api/v1/inquiries` with `propertyId`, `message`, `moveInDate`.
  2. Wire `PropertyDetailModal.tsx` directly to `inquiryService.createInquiry()`.
  3. Ensure inquiries populate Prisma `PropertyInquiry` table in PostgreSQL.

### ENG-P1-01: Migrate Tenancy Agreements from Supabase to NestJS REST
- **Domain:** Rental Trust & Leases
- **Root Cause:** [rentalTrustService.ts](file:///d:/Projects/AASHVO/src/services/rentalTrustService.ts) executes raw Supabase PostgREST queries against `tenancy_agreements`.
- **Acceptance Criteria:**
  1. Rewrite `rentalTrustService.ts` methods to call NestJS `/api/v1/agreements` endpoints.
  2. Verify creating, viewing, and digitally signing tenancy agreements via [RentalTrustModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/RentalTrustModal.tsx).

### ENG-P1-03: Mount Orphaned MoveInChecklistModal
- **Domain:** Rental Trust & Inspections
- **Root Cause:** [MoveInChecklistModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/MoveInChecklistModal.tsx) is completely written but never imported in `App.tsx` or `RentalTrustModal.tsx`.
- **Acceptance Criteria:**
  1. Mount `MoveInChecklistModal` inside `RentalTrustModal` under active tenancy agreements.
  2. Wire submission to NestJS `POST /api/v1/inspections`.
