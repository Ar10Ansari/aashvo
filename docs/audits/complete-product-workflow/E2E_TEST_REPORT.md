# AASHVO End-to-End & Integration Test Report

**Execution Date:** November 2026  
**Test Harness:** Playwright (Native Google Chrome), Jest (PostgreSQL 16), Vitest (React)  
**Overall Status:** **100% PASSING (ALL GATES GREEN)**  

---

## 1. Test Execution Summary

| Test Suite | Framework | Environment / Target | Tests Executed | Passed | Failed | Duration |
|---|---|---|---|---|---|---|
| Browser E2E Workflows | Playwright 1.65.1 | Native Google Chrome (Desktop + Mobile) | 14 | 14 | 0 | 18.6s |
| Product Workflows Integration | Jest 29.7.0 | PostgreSQL 16 (Port 5433) | 16 | 16 | 0 | 10.5s |
| Core Marketplace Persistence | Jest 29.7.0 | PostgreSQL 16 (Port 5433) | 18 | 18 | 0 | 34.2s |
| Frontend Components & Logic | Vitest 4.0.7 | jsdom / React 18 | 300 | 300 | 0 | 5.2s |
| TypeScript Quality Gate | `tsc --noEmit` | Node.js 20 | Monorepo Check | 0 Errors | 0 | 4.8s |
| NestJS API Production Build | `nest build` | Webpack / Node 20 | `dist/` Output | 0 Errors | 0 | 8.1s |
| Frontend Production Bundle | `vite build` | Rollup / ESBuild | `dist/` Output | 0 Errors | 0 | 7.4s |

---

## 2. Playwright Browser E2E Test Suite Details (`e2e/product-workflows.spec.ts`)

- **Workflow 1: Homepage renders brand wordmark, navbar controls, and founders**
  - Desktop Chrome: PASSED (1.2s)
  - Mobile Chrome (Pixel 5): PASSED (1.8s)
- **Workflow 2: Discovery Section and category filtering**
  - Desktop Chrome: PASSED (908ms)
  - Mobile Chrome (Pixel 5): PASSED (1.2s)
- **Workflow 3: Authentication Modal opening, tabs, and close**
  - Desktop Chrome: PASSED (1.0s)
  - Mobile Chrome (Pixel 5): PASSED (889ms)
- **Workflow 4: Rent Split Calculator Modal opens and calculates share**
  - Desktop Chrome: PASSED (813ms)
  - Mobile Chrome (Pixel 5): PASSED (773ms)
- **Workflow 5: Get started button opens List Property Modal with Draft button**
  - Desktop Chrome: PASSED (1.1s)
  - Mobile Chrome (Pixel 5): PASSED (726ms)
- **Workflow 6: Saved Listings Modal opens and displays shortlist tabs**
  - Desktop Chrome: PASSED (856ms)
  - Mobile Chrome (Pixel 5): PASSED (694ms)
- **Workflow 7: Mobile viewport responsive test**
  - Desktop Chrome: PASSED (644ms)
  - Mobile Chrome (Pixel 5): PASSED (696ms)

---

## 3. PostgreSQL 16 Integration Suite Details (`complete-product-workflows.postgres.integration.spec.ts`)

1. `Saved items: toggling save creates record in Postgres` - PASSED
2. `Saved items: unsaving via DELETE /api/v1/saved/:itemType/:targetId removes record` - PASSED
3. `Saved items: user can fetch their saved list from backend` - PASSED
4. `Visits: creating a visit persists with REQUESTED status` - PASSED
5. `Visits: host can confirm visit via PATCH /api/v1/visits/:id/status` - PASSED
6. `Visits: rescheduling visit via PATCH /api/v1/visits/:id/reschedule updates proposed time` - PASSED
7. `Visits: rescheduling visit via POST /api/v1/visits/:id/reschedule is supported` - PASSED
8. `Support: submit safety report creates SafetyReport and AuditLog in Postgres` - PASSED
9. `Support: submit safety report handles guest reporter (null actorId)` - PASSED
10. `Support: creating support ticket writes to database` - PASSED
11. `Admin moderation: approving a pending property updates status to active` - PASSED
12. `Admin moderation: pausing a property updates status to paused` - PASSED
13. `Family Stays: publishing listing with familyLivesOnProperty persists flag` - PASSED
14. `Family Stays: meal options (included/optional_extra) persist correctly` - PASSED
15. `Tenancy Agreements: querying mine returns agreements for user` - PASSED
16. `Notification Center: mark-all-as-read updates notifications to read` - PASSED
