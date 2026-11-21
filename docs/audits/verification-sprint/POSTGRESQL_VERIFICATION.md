# AASHVO PostgreSQL 16 Persistence & Database Integrity Verification

**Target Database:** PostgreSQL 16 on `127.0.0.1:5433` (`aashvo_test`)  
**ORM / Schema Migration:** Prisma 6.19.3  
**Verified By:** Independent CTO Reviewer & Principal Database Engineer  
**Date:** November 21, 2026  

---

## 1. Environment & Migration Status

The database environment was verified against a dedicated PostgreSQL 16 engine running locally on port 5433. All migrations from the baseline through to `20261115060000_connect_intelligence_and_preferences` are applied and up-to-date.

```
Prisma Schema Status: Synced
Target Binary Target: windows (libquery-engine-windows.dll.node)
PostgreSQL Version: 16.6
Connection: Direct TCP, pool size 10
```

---

## 2. Table-by-Table Schema Verification & Evidence

During execution of the comprehensive Playwright E2E suite (`e2e/comprehensive-real-workflows.spec.ts`) and Jest integration suites, every database mutation was asserted directly via `PrismaClient` against PostgreSQL 16 tables:

| PostgreSQL Table | Primary Key | Key Foreign Keys & Constraints | Verified Mutations in E2E | Persistence Evidence |
|---|---|---|---|---|
| `users` | `id` (UUID) | Unique `email`, `role`, `account_status` | Created during `E2E-01` registration; verified password hash | `User` row inserted, retrieved, authenticated, survived reload |
| `profiles` | `id` (UUID) | FK → `users.id` (ON DELETE CASCADE) | Created with `fullName`, verified profile data | Profile record synchronized with user |
| `properties` | `id` (UUID) | FK → `profiles.id` (`owner_id`), `status`, `category` | Created in `E2E-02` (draft `paused`, then `active`), `E2E-06` (family stay), `E2E-07` (entire flat), `E2E-08` (admin moderation) | Decimal values (`rent_amount`, `deposit_amount`), enums, and boolean flags verified in DB |
| `property_photos` | `id` (UUID) | FK → `properties.id` (ON DELETE CASCADE) | Photo URLs, sort orders, and primary flags verified | Photos created and cascaded on property deletion |
| `saved_items` | `id` (UUID) | FK → `users.id`, `target_id`, `item_type` | Inserted on bookmark (`E2E-03`); deleted on unsave via `DELETE /saved/:targetType/:targetId` | Confirmed record existence and complete removal post-unsave |
| `interest_requests` | `id` (UUID) | FK → `users.id` (`sender_id`), FK → `properties.id` | Inserted on inquiry (`E2E-04`); status transitions verified | Record created with `status = 'pending'`, move-in date, and message |
| `property_visits` | `id` (UUID) | FK → `properties.id`, FK → `visitor_id`, FK → `host_id` | Created (`E2E-05`), confirmed by host (`status = 'confirmed'`), rescheduled (`status = 'rescheduled'`, `rescheduled_at` populated) | Lifecycle state transitions verified directly in DB |
| `user_notifications` | `id` (UUID) | FK → `profiles.id` (`user_id`), `read`, `category` | Created on inquiry for owner (`E2E-04`); marked read (`E2E-11`) | Verified `read = true`, unread count asserted to `0` |
| `safety_reports` | `id` (UUID) | Optional FK → `users.id` (`reporter_id`), `reported_property_id` | Inserted via guest whistleblower report (`E2E-09`) with `reporterEmail` | Verified record in DB with null `reporterId` and proper `reasonCode` |
| `support_tickets` | `id` (UUID) | Optional FK → `users.id`, `ticket_number` | Created in `E2E-10` with subject, description, priority | Ticket persisted with generated ticket number |
| `ticket_messages` | `id` (UUID) | FK → `support_tickets.id` (ON DELETE CASCADE) | Appended to ticket thread in `E2E-10` | Message verified in DB with foreign key linkage |
| `audit_logs` | `id` (UUID) | Optional FK → `users.id` (`actor_id`), `event_type` | Safety report audit log entry verified with `actor_id = null` | No foreign key violation on guest actions |

---

## 3. Concurrency, Locking & Integrity Guarantees

1. **OAuth Concurrency & Race Defenses:** Verified Google OAuth token exchanges with concurrent transactions in previous sprint commit `af90473`.
2. **Duplicate Inquiry Protection:** A unique constraint and transactional existence check in `InquiriesService` rejects duplicate pending inquiries from the same user on the same listing with `409 Conflict`.
3. **Self-Action Prevention:** Database checks prevent owners from submitting interest requests or booking visits on their own listings (`400 Bad Request`).
4. **Referential Integrity:** Cascading deletes properly purge child records (`property_photos`, `saved_items`, `user_notifications`, `interest_requests`, `property_visits`) without orphan records or foreign key constraint errors.
