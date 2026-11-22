# AASHVO Playwright Test Quality & Classification Review

**Auditor:** Independent CTO Reviewer & Senior QA Lead  
**Target Suite:** `e2e/comprehensive-real-workflows.spec.ts`  
**Execution Config:** Dual webServer (`:4000` NestJS + `:4173` Vite Preview), Chromium desktop & mobile  
**Date:** November 22, 2026  

---

## 1. Truthful Test Classification & Dissection

Previous audit reports claimed that all 14 tests in Playwright were "Browser Workflows". As CTO, I conducted an independent code inspection of `e2e/comprehensive-real-workflows.spec.ts` to classify each test truthfully based on what it actually executes:

| Test ID | Title | Actual Mechanism | True Classification | Real Browser Actions? | Visible UI Tested? | Real API & DB? |
|---|---|---|---|---|---|---|
| **E2E-01** | Full Authentication Lifecycle | Uses `page` fixture. Clicks desktop/mobile navigation button, opens `AuthModal`, selects `Register`, fills text/password inputs, submits form, verifies dialog closes, queries PostgreSQL, reloads page, verifies session survival. | **Full-Stack Browser E2E** | **YES** | **YES** | **YES** |
| **E2E-02** | Owner Listing & Draft Lifecycle | Uses `request` fixture. Calls `POST /api/v1/properties` (`asDraft: true`), asserts 201, queries DB for `paused` status, calls `PATCH /api/v1/properties/:id`, queries DB for `active` status. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-03** | Seeker Bookmarking & Shortlists | Uses `request` fixture. Calls `POST /api/v1/saved`, queries DB for `SavedItem`, calls `GET /api/v1/saved/check/...`, calls `DELETE /api/v1/saved/...`, asserts DB deletion. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-04** | Property Inquiry Workflow | Uses `request` fixture. Calls `POST /api/v1/inquiries`, queries DB for `InterestRequest`, queries DB for `UserNotification` delivered to owner. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-05** | Visit Scheduling Lifecycle | Uses `request` fixture. Calls `POST /api/v1/visits`, asserts DB `pending`, calls host `PATCH /visits/:id/status` (confirm), calls `PATCH /visits/:id/reschedule`, asserts DB `rescheduled`. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-06** | Family Stays Search & Filtering | Uses `request` fixture. Calls `POST /api/v1/properties` (family stay payload), calls admin moderation, calls `GET /api/v1/family-stays?mealsOffered=optional_extra`, asserts listing found. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-07** | Entire Flat Listing Creation | Uses `request` fixture. Calls `POST /api/v1/properties` (`roomType: entire_flat`), asserts 201, asserts DB `room_type = 'entire_flat'`. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-08** | Admin Moderation Pipeline | Uses `request` fixture. Calls `PATCH /api/v1/properties/:id/moderate` (active, paused, active), asserts DB status transitions. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-09** | Public Safety Reporting | Uses `request` fixture. Calls `POST /api/v1/support/reports` without auth header, asserts DB `SafetyReport` and `AuditLog` (`actorId: null`). | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-10** | Support Ticket & Messages | Uses `request` fixture. Calls `POST /api/v1/support/tickets`, calls `POST /api/v1/support/tickets/:id/messages`, asserts DB ticket and messages. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-11** | Notification Center Isolation | Uses `request` fixture. Calls `GET /api/v1/notifications`, calls `POST /api/v1/notifications/read-all`, asserts DB unread count is 0. | **API Integration + DB Persistence** | **NO** | **NO** | **YES** |
| **E2E-12** | Security & IDOR Defenses | Uses `request` fixture. Hostile caller calls `PATCH /properties/:id` and `/moderate`, asserts 403, asserts DB rent amount untouched. | **Security API Integration** | **NO** | **NO** | **YES** |
| **E2E-13** | Duplicate & Boundary Defenses | Uses `request` fixture. Owner calls self-visit and self-inquiry, asserts 400 Bad Request. | **Validation API Integration** | **NO** | **NO** | **YES** |
| **E2E-14** | Malformed Input Rejection | Uses `request` fixture. Submits short password and unauthenticated mutations, asserts 400 and 401. | **Validation API Integration** | **NO** | **NO** | **YES** |

---

## 2. Critical Findings & Analysis

1. **The "14 Browser Workflows" Misnomer:**
   - Previous sprint reports overstated that all 14 tests were "Browser Workflows".
   - **Fact:** Only **E2E-01** drives the browser DOM. Tests **E2E-02 through E2E-14** execute fast, direct HTTP requests against the NestJS API via Playwright's network client and query PostgreSQL 16 directly via Prisma.
   - **Assessment:** While E2E-02..14 are excellent full-stack API integration tests that thoroughly validate backend contracts and PostgreSQL persistence, they **do not validate React UI component interactions** (e.g. clicking "Book Visit" modal or submitting the listing creation multi-step wizard in DOM).

2. **Genuine Full-Stack Persistence:**
   - Real PostgreSQL 16 database is used (`postgresql://postgres@127.0.0.1:5433/aashvo_test`).
   - Zero mocked services: NestJS runs live on port 4000, connected to live PostgreSQL 16.
   - Independent database assertions: Every single test queries `prisma.<model>.findUnique` or `findFirst` to assert actual disk persistence.

3. **Desktop vs. Mobile Parity:**
   - In E2E-01, desktop interacts with the header inline buttons while mobile interacts with `button[aria-label="Toggle navigation menu"]` (mobile drawer).
   - In E2E-02..14, because requests are issued via `request` API fixture, mobile and desktop runs execute the identical API/DB integration assertions.

4. **Flakiness & Isolation:**
   - We ran the full suite twice consecutively:
     - Run 1: 28 passed / 28 total (19.7s)
     - Run 2: 28 passed / 28 total (12.6s)
   - Zero flakiness observed. Each test run generates unique timestamps (`e2e-owner-${Date.now()}@example.com`) and cleans up child records in `afterAll`.
