# AASHVO Test Coverage & Verification Gap Audit

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Principal QA Architect  
**Scope:** Evaluation of test suites across Frontend (Vitest), Backend (Jest), Database Integration (PostgreSQL 16), and End-to-End User Journeys.

---

## 1. Current Test Suite Inventory

AASHVO currently maintains two independent automated test suites totaling **492 automated tests**:

| Test Layer | Test Framework | Test Files / Suites | Total Tests | Pass Rate | Primary Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend UI / Units** | Vitest 1.4.0 + Testing Library | 28 test files | 300 tests | **100%** (300 passed) | Component rendering, state reducers, utility math, mock services |
| **Backend API & DB** | Jest 29 + Supertest | 17 test suites | 192 tests | **100%** (192 passed) | NestJS controllers, PostgreSQL Prisma integration, OAuth race tests |

---

## 2. The Verification Paradox: Why Critical Bugs Escaped CI

Despite having 492 passing tests with high reported code coverage, the platform harbors several severe operational disconnects (e.g. Listing creation bypassing NestJS, Notification 404 error). 

### Root Cause Analysis
1. **Mocking Divergence in Frontend Tests:**
   - Frontend Vitest tests mock `apiClient` or `AppContext` directly. When testing `ListPropertyModal`, the test asserts that `AppContext.addProperty()` was called. It does **not** test whether `addProperty()` actually invokes an HTTP request that reaches a running backend!
2. **Backend Tests Validate APIs in Isolation:**
   - NestJS Jest integration tests invoke `/api/v1/properties` with Supertest. They verify that the NestJS controller properly writes to PostgreSQL. However, because no End-to-End (E2E) test runs the compiled frontend against the compiled backend, nobody noticed that the frontend was calling Supabase instead of NestJS!
3. **Route Mismatch Blindspot:**
   - `notificationService.ts` called `/notifications/mark-all-read`. The backend test tested `/api/v1/notifications/read-all`. Both tests passed in isolation, yet production users experience a 404 error when clicking "Mark all as read".

---

## 3. Detailed Test Coverage Gap Matrix

| Feature Domain | Backend Jest Coverage | Frontend Vitest Coverage | End-to-End Integration Coverage | Verification Status |
| :--- | :---: | :---: | :---: | :--- |
| **Authentication & Refresh** | High (95%) | High (90%) | High (Supertest + DB) | **ROBUST** |
| **Google OAuth Race Locking** | Exhaustive (100%) | N/A (Mocked) | Exhaustive (Concurrent DB) | **ROBUST** |
| **AASHVO Connect Matching** | Exhaustive (98%) | High (92%) | High (Prisma test DB) | **ROBUST** |
| **Multi-Persona Onboarding** | High (90%) | High (94%) | High (Draft & Publish DB) | **ROBUST** |
| **Visit Scheduling** | High (88%) | Medium (75%) | High (Supertest DB) | **ROBUST** |
| **Saved Items / Favorites** | High (92%) | High (90%) | High (Supertest DB) | **ROBUST** |
| **Property Listing Creation** | High (Supertest only) | Medium (Mock only) | **ZERO** (Frontend calls Supabase) | **CRITICAL GAP** |
| **Direct Property Inquiries** | High (Supertest only) | Low (Mock only) | **ZERO** (Bypassed via Supabase) | **CRITICAL GAP** |
| **Tenancy Agreements** | High (Supertest only) | Low (Mock only) | **ZERO** (Bypassed via Supabase) | **CRITICAL GAP** |
| **Move-In Inspections** | High (Supertest only) | N/A (Orphaned) | **ZERO** (Unmounted in UI) | **CRITICAL GAP** |
| **Notification Mark-All-Read**| High (Supertest `/read-all`) | Low (Mock only) | **ZERO** (Route typo `/mark-all-read`) | **DEFECT GAP** |
| **Support & Safety Disputes** | High (Supertest only) | Low (Mock only) | **ZERO** (Bypassed via Supabase) | **CRITICAL GAP** |

---

## 4. Remediation Roadmap for Quality Engineering

1. **Implement Playwright E2E Suite:**
   - Create 5 critical user journey tests executing in a real Chromium browser against live backend + PostgreSQL:
     - Journey 1: Register → Complete Onboarding → Enter Connect → Like Candidate → Chat.
     - Journey 2: Login as Owner → List Property → Verify Property in Public Search.
     - Journey 3: Login as Renter → Schedule Visit → Confirm Visit in Owner Dashboard.
     - Journey 4: Notification lifecycle (receive notification, mark single read, mark all read).
     - Journey 5: Tenancy agreement creation and digital signature flow.
2. **Contract Testing with OpenAPI / TypeScript Types:**
   - Auto-generate frontend API clients from NestJS Swagger/OpenAPI specification (`@nestjs/swagger`) to mathematically guarantee endpoint route and payload synchronization at compile time.
