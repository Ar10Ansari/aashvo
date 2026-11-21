# AASHVO Comprehensive Playwright Workflow Matrix

**Suite:** `e2e/comprehensive-real-workflows.spec.ts`  
**Execution Profile:** Dual Execution — `desktop-chrome` (1280x720) & `mobile-chrome` (Pixel 5 393x851)  
**Backend:** NestJS API on `http://localhost:4000`  
**Frontend:** Vite Preview on `http://localhost:4173` with reverse proxy to `:4000`  
**Database:** PostgreSQL 16 on `127.0.0.1:5433` (`aashvo_test`)  
**Results:** **28 Passed / 28 Total (100% Success Rate)**  

---

## 1. End-to-End Workflow Execution Matrix

| ID | Workflow Title | Persona | Browser / Client Interaction | API Endpoint & Verb | PostgreSQL Verification Table & Condition | Refresh Persistence | Authorization & Guards | Result (Desktop / Mobile) |
|---|---|---|---|---|---|---|---|---|
| **E2E-01** | Full Authentication Lifecycle | Guest → Seeker | Opens Auth Modal, switches to Register, fills fullName, email, password, clicks "Create Account" | `POST /api/v1/auth/register` | `users` (email exists, hashed password), `profiles` (fullName matches) | **Yes**: Survives page reload, session persists via `aashvo_at` | Public endpoint, issues RSA256 signed JWT | **PASS** / **PASS** |
| **E2E-02** | Owner Listing Creation & Draft Lifecycle | Owner | Submits listing with `asDraft: true`, then updates and publishes listing | `POST /api/v1/properties`<br>`PATCH /api/v1/properties/:id` | `properties` (status is `paused` on draft, becomes `active` on publish) | **Yes**: Property record persists in database across sessions | `JwtAuthGuard`, Owner-only update check | **PASS** / **PASS** |
| **E2E-03** | Seeker Bookmarking & Shortlist Management | Seeker | Clicks bookmark/save icon on property card, checks shortlist, un-saves property | `POST /api/v1/saved`<br>`GET /api/v1/saved/check/...`<br>`DELETE /api/v1/saved/property/:id` | `saved_items` (record created with `userId` and `targetId`; completely removed on delete) | **Yes**: Verified in DB after mutation; unsave verifies deletion | `JwtAuthGuard`, User isolation filter | **PASS** / **PASS** |
| **E2E-04** | Property Inquiry & Owner Notification | Seeker → Owner | Submits inquiry form with move-in date and message | `POST /api/v1/inquiries` | `interest_requests` (record created, status `pending`), `user_notifications` (created for owner) | **Yes**: Inquiry persisted in DB with foreign keys to seeker and listing | `JwtAuthGuard`, Self-inquiry guard | **PASS** / **PASS** |
| **E2E-05** | Visit Scheduling & Rescheduling Lifecycle | Seeker ↔ Owner | Requests visit, owner confirms, seeker reschedules with updated timestamp | `POST /api/v1/visits`<br>`PATCH /api/v1/visits/:id/status`<br>`PATCH /api/v1/visits/:id/reschedule` | `property_visits` (transitions: `pending` → `confirmed` → `rescheduled`; `rescheduledAt` recorded) | **Yes**: Full state history persisted in PostgreSQL | `JwtAuthGuard`, Host vs Visitor authorization | **PASS** / **PASS** |
| **E2E-06** | Family Stays Discovery & Meal Filtering | Host ↔ Seeker | Host publishes listing with `familyLivesOnProperty: true` and meals offered; seeker filters | `POST /api/v1/properties`<br>`GET /api/v1/family-stays?mealsOffered=optional_extra` | `properties` (`category = 'family_stays'`, `family_lives_on_property = true`, `meals_offered`) | **Yes**: Retrieved by query matching meal criteria | Public search, Host creation via `JwtAuthGuard` | **PASS** / **PASS** |
| **E2E-07** | Entire Flat Listing & Filtering | Landlord | Publishes full apartment with `roomType = entire_flat` | `POST /api/v1/properties`<br>`GET /api/v1/properties` | `properties` (`room_type = 'entire_flat'`) | **Yes**: Persisted in database | `JwtAuthGuard`, Owner role | **PASS** / **PASS** |
| **E2E-08** | Admin Moderation Pipeline | Admin | Admin inspects pending listing, approves it, pauses for review, re-activates | `PATCH /api/v1/properties/:id/moderate` | `properties` (`status` transitions `active` → `paused` → `active`), `audit_logs` entry created | **Yes**: Status changes persisted in DB | `RolesGuard` (`@Roles('admin')`), RBAC verified | **PASS** / **PASS** |
| **E2E-09** | Public Safety Violation Report | Guest / Whistleblower | Submits safety violation report on suspicious listing without requiring login | `POST /api/v1/support/reports` | `safety_reports` (record created with `reporterEmail`, `reasonCode`), `audit_logs` (`actorId = null`) | **Yes**: Persisted in database without foreign key failure | Public endpoint with optional authentication | **PASS** / **PASS** |
| **E2E-10** | Support Ticket & Thread Messages | Seeker | Opens support ticket regarding billing, adds reply message to ticket thread | `POST /api/v1/support/tickets`<br>`POST /api/v1/support/tickets/:id/messages` | `support_tickets` (ticket record), `ticket_messages` (message linked via `ticketId`) | **Yes**: Complete conversational thread persisted in DB | `JwtAuthGuard`, Ticket ownership check | **PASS** / **PASS** |
| **E2E-11** | Notification Center & User Isolation | Owner | Views in-app notifications, marks all as read | `GET /api/v1/notifications`<br>`POST /api/v1/notifications/read-all` | `user_notifications` (`read` set to `true`, unread count becomes `0`) | **Yes**: Database confirms zero unread notifications for user | `JwtAuthGuard`, User isolation (`userId` scoped) | **PASS** / **PASS** |
| **E2E-12** | Security & IDOR Defenses | Seeker (Attacker) | Attempts to alter another user's property rent and moderate listings | `PATCH /api/v1/properties/:id` (tampering)<br>`PATCH /api/v1/properties/:id/moderate` | `properties` (verified rent amount remained unchanged in database) | **Yes**: DB record intact, unauthorized mutations rejected | Returns `403 Forbidden` for tampering attempts | **PASS** / **PASS** |
| **E2E-13** | Duplicate & Self-Action Boundary Defenses | Owner | Attempts self-visit booking and self-inquiry on own listing | `POST /api/v1/visits`<br>`POST /api/v1/inquiries` | No duplicate or invalid records inserted into `property_visits` or `interest_requests` | **Yes**: Database state clean | Returns `400 Bad Request` preventing invalid state | **PASS** / **PASS** |
| **E2E-14** | Validation Pipe Rejection | Anonymous / Malformed | Submits malformed registration payload with short password and unauthenticated access | `POST /api/v1/auth/register`<br>`POST /api/v1/visits` (unauthenticated) | No corrupt user inserted into `users` table | **Yes**: Database protected from corrupt data | `ValidationPipe` returns `400 Bad Request`, Auth returns `401` | **PASS** / **PASS** |

---

## 2. Desktop vs Mobile Execution Details

- **Desktop Chrome (1280x720):** Direct interaction with header navigation, top-level actions, and modal overlays. All 14 workflows executed in 9.8s.
- **Mobile Chrome (Pixel 5, 393x851):** Tests dynamically open the mobile hamburger drawer (`button[aria-label="Toggle navigation menu"]`), ensuring mobile seekers and owners can access the full authentication and marketplace features without desktop header clipping. All 14 workflows executed in 15.6s.
- **Total Suite Execution Time:** 25.4s for 28 full end-to-end persistent test runs.
