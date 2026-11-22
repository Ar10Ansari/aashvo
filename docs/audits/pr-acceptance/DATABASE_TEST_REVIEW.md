# AASHVO Database Test Review & Integrity Audit

**Auditor:** Independent CTO Reviewer & Principal Database Architect  
**Database Engine:** PostgreSQL 16 on `127.0.0.1:5433` (`aashvo_test`)  
**ORM:** Prisma 6.19.3  
**Date:** November 22, 2026  

---

## 1. Scope of Database Tests

The backend integration test suite consists of 44 automated tests across three dedicated specifications:
1. `complete-product-workflows.postgres.integration.spec.ts` (16 tests, 7.6s)
2. `core-marketplace-persistence.postgres.integration.spec.ts` (18 tests, 31.5s)
3. `security-authorization-deep.postgres.integration.spec.ts` (10 tests, 7.2s)

All 44 tests execute directly against the isolated PostgreSQL 16 test database with zero mocks.

---

## 2. Relational Integrity & Constraint Verification

| Database Model / Table | Constraint / Invariant Tested | Verified Behavior | Test Specification |
|---|---|---|---|
| `User` / `users` | Unique `email` (citext) | Rejects duplicate registration with 409 Conflict | `core-marketplace-persistence` |
| `Profile` / `profiles` | Cascading delete on `User` | When a user is purged, profile is automatically removed | `afterAll` cleanup hooks |
| `Property` / `properties` | Decimal rent and deposit amounts | Exact decimal precision preserved in DB (`rentAmount: 32000`) | `complete-product-workflows` |
| `PropertyPhoto` | Foreign key to `Property` | Cascaded on property deletion without orphaned photos | All test cleanup |
| `InterestRequest` | No duplicate pending inquiries | Second pending inquiry from same user on same property rejected with 409 Conflict | `core-marketplace-persistence` (P0-02) |
| `InterestRequest` | No self-inquiry | Owner inquiring on own property rejected with 400 Bad Request | `core-marketplace-persistence` (P0-02) |
| `PropertyVisit` | No self-visit booking | Owner booking visit on own property rejected with 400 Bad Request | `complete-product-workflows` (Workflow 2) |
| `PropertyVisit` | Dual-verb rescheduling | Reschedule updates `rescheduled_at` and sets `status = 'rescheduled'` | `complete-product-workflows` (Workflow 2) |
| `UserNotification` | Scoped unread count | `POST /read-all` updates `read: true` strictly for caller's notifications | `core-marketplace-persistence` (P0-03) |
| `SafetyReport` | Optional `reporter_id` | Guest whistleblower creates report without user foreign key constraint error | `complete-product-workflows` (Workflow 3) |
| `AuditLog` | Optional `actor_id` | Generates audit log with `actor_id = null` for anonymous reports | `complete-product-workflows` (Workflow 3) |
| `RefreshSession` | Family revocation | Logging out marks session family revoked, rejecting subsequent tokens | `security-authorization-deep` (Security 8) |

---

## 3. Database Concurrency & Race Condition Defenses

- **Google OAuth Concurrency:** Validated in commit `af90473`. Parallel Google token exchanges use database transactions with `findFirst` and upsert locking to prevent duplicate account creation races.
- **Inquiry State Machine:** State transitions (`pending` → `accepted`) are enforced in transactional service calls. A second acceptance or invalid status rollback is rejected with 400 Bad Request.
- **Moderation Concurrency:** Status transitions from `pending_review` to `active` are guarded by role checks requiring admin privileges, ensuring unapproved listings cannot be prematurely activated by concurrent owner updates.
