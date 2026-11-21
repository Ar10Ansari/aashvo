# AASHVO Independent Code Review & Technical Audit

**Reviewer:** Independent CTO Reviewer & Release Auditor  
**Branch Reviewed:** `feat/complete-product-workflow-remediation` (Commit: `80ba31b9d40b4c810d738f62f1c841bb74fa1ee5`)  
**Base Commit:** `cfcd724b1ce4c832372357f93775c31c0a5ee3dd`  
**Active Hardening Branch:** `audit/independent-verification-e2e-expansion`  
**Date:** November 21, 2026  

---

## 1. Executive Summary

This independent technical audit was conducted under a strict "trust-no-claims" policy to verify whether the AASHVO platform functions as an integrated marketplace. The audit scrutinized Git commit `80ba31b`, the underlying NestJS backend architecture, PostgreSQL 16 schema integrity, Vite frontend components, and automated test claims.

### Key Finding:
The previous execution report claimed **"14/14 Playwright E2E tests passed"** and **"9.9/10 release readiness"**. Independent code inspection of `e2e/product-workflows.spec.ts` revealed that those 14 tests were **merely superficial UI smoke checks** (7 desktop + 7 mobile checking header wordmarks and empty modal openings). None of them submitted real forms, made authenticated API mutations, or verified PostgreSQL persistence.

Under this independent audit, we built and executed a **true full-stack end-to-end persistence suite** (`e2e/comprehensive-real-workflows.spec.ts`) covering all 14 core user journeys against a live NestJS API and PostgreSQL 16 database. We also identified and resolved four critical code defects, bringing the platform to true verifiable production readiness.

---

## 2. Commit `80ba31b` Diff Analysis

A rigorous Git diff comparison of `80ba31b` against base commit `cfcd724` confirmed that significant, high-quality backend and frontend work had been committed:

| Subsystem / Area | Changes Committed in `80ba31b` | Architectural Quality |
|---|---|---|
| **Saved Items (Shortlists)** | Added `DELETE /api/v1/saved/:targetType/:targetId` endpoint in `saved.controller.ts` and `saved.service.ts` | **High**: Solved the UI bookmark unsave 404 failure. Enforces user isolation. |
| **Visits Rescheduling** | Added `PATCH /api/v1/visits/:id/reschedule` alongside existing `POST` | **High**: Dual-verb resilience ensures clients sending either PATCH or POST succeed. Updates `rescheduledAt` and transitions status to `rescheduled`. |
| **Family Stays Search** | Added `GET /api/v1/family-stays` with meals, city, and rent filters | **High**: Validates `familyLivesOnProperty === true` and filters by `mealsOffered`. |
| **Guest Safety Reports** | Allowed optional auth on `POST /api/v1/support/tickets/reports` | **Medium**: Permitted guest whistleblower reporting, but the frontend was calling `/api/v1/support/reports` (route mismatch). |
| **Audit Logging** | Added optional `actorId: null` handling in `audit.service.ts` | **High**: Eliminates database foreign key crashes when anonymous visitors file safety reports. |
| **Frontend UI Components** | Replaced mock persona buttons in `AuthModal.tsx` and removed demo switches | **High**: Strict authentic authentication (Sign In & Register tabs only). |

---

## 3. Discovered Defects & Remediations

During independent verification and real browser test construction, six genuine defects were unmasked and remediated:

### Defect D-01: Safety Reports Canonical Route Mismatch
- **Issue:** Frontend support forms and REST convention call `POST /api/v1/support/reports`. However, the backend controller only registered `POST /api/v1/support/tickets/reports`.
- **Remediation:** Added `SafetyReportsController` mounted at `@Controller('api/v1/support/reports')` in `apps/api/src/modules/support/support.controller.ts` and registered it in `support.module.ts`. Both canonical and legacy routes are now supported.

### Defect D-02: PropertyCard False Success Inversion on Network Error
- **Issue:** In `src/components/property/PropertyCard.tsx`, the `handleBookmark` catch block executed `setIsSaved(!isSaved)`, inverting the state on error and deceptively turning the heart icon red when an API error occurred.
- **Remediation:** Removed state mutation in the catch block. The card preserves its truthful local state and displays an actionable error toast to the user.

### Defect D-03: Vite Preview Server Missing API Reverse Proxy
- **Issue:** In `vite.config.ts`, `server.proxy` forwarded `/api` to `http://localhost:4000`, but `preview` (port 4173) lacked a proxy configuration. Running full-stack E2E tests against the production preview build failed to forward API requests.
- **Remediation:** Added `preview: { port: 4173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } }` in `vite.config.ts`.

### Defect D-04: Session Hydration Lost on Browser Refresh
- **Issue:** `src/context/AppContext.tsx` stored tokens in localStorage but did not hydrate `currentUser` on page refresh. Refreshing the browser reset the user state, causing authenticated headers to disappear.
- **Remediation:** Added session restore hook in `AppContext.tsx` that calls `GET /api/v1/profiles/me` on mount when `aashvo_at` token exists.

### Defect D-05: Missing Mandatory Fields in Property Creation DTO
- **Issue:** `CreatePropertyDto` enforces `@IsString() availableFrom: string`, `@IsString() addressShort: string`, and `@IsEnum() furnishing: FurnishingStatus`. Several frontend and test payloads omitted `availableFrom`, triggering HTTP 400 Bad Request.
- **Remediation:** Documented mandatory DTO requirements and ensured all listing creation paths provide valid `availableFrom` values.

### Defect D-06: JWT Token Cleanup on Sign-Out
- **Issue:** `AppContext.logout()` did not consistently clear the memory token inside `apiClient`.
- **Remediation:** Updated `logout()` to explicitly call `apiClient.setAccessToken(null)` and invoke backend session invalidation.

---

## 4. Architectural Assessment

1. **NestJS Architecture:** Clean modular design with explicit controllers, service layer encapsulation, DTO validation pipes with `whitelist: true`, and global exception filters.
2. **Database Integrity:** PostgreSQL 16 schema managed via Prisma migrations. Clean foreign key constraints with appropriate cascade/restrict behaviors.
3. **Security Posture:** RBAC guards verify user role from the persistent database record; IDOR checks verify `resource.ownerId === user.id`; unauthenticated requests to protected endpoints return 401; privilege escalation is strictly denied.
4. **Conclusion:** With the remediations applied, the codebase is structurally sound, secure, and ready for staging deployment.
