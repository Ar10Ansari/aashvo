# AASHVO Database Integrity Review

**Audit Target:** PostgreSQL 16 & Prisma Schema  
**Scope:** Relations, Foreign Key Cascades, Index Optimization, Enum Constraints, Schema Consistency  

---

## 1. Schema Architecture & Entity Relationships

The AASHVO data model is built on Lakebase PostgreSQL and managed via Prisma ORM (`packages/database/prisma/schema.prisma`).

### Core Domain Entities
1. **`User` (Accounts & Identities)**
   - Relations: `properties`, `inquiries`, `visits`, `savedItems`, `notifications`, `auditLogs`.
   - Identity: Supports Google OAuth (`googleId`), Email/Password (`passwordHash`), Phone authentication.
2. **`Property` (Marketplace Inventory)**
   - Relations: `owner` (`User`), `inquiries` (`PropertyInquiry[]`), `visits` (`Visit[]`), `savedItems` (`SavedItem[]`).
   - Fields: `title`, `rent`, `deposit`, `maintenance`, `electricityPerUnit`, `brokerageFee`, `providerType`, `familyLivesOnProperty`, `mealsOffered`, `images`, `amenities`, `rules`.
3. **`PropertyInquiry` (Lead & Inquiry System)**
   - Compound indices: `[propertyId, createdAt]`, `[userId, createdAt]`.
   - Integrity: Foreign keys cascade on delete to prevent dangling inquiries if a draft is purged.
4. **`Visit` (Physical & Virtual Walkthroughs)**
   - Compound index: `[propertyId, scheduledAt]`, `[visitorId, status]`.
   - Enums: `VisitStatus` (`REQUESTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `PENDING_RESCHEDULE`).
5. **`SavedItem` (User Shortlists)**
   - Unique compound index: `[userId, itemType, targetId]`.
   - Prevents duplicate bookmarks and allows `O(1)` deletion via composite keys.
6. **`SafetyReport` (Trust & Safety Reporting)**
   - Fields: `id`, `reporterEmail`, `targetType`, `targetId`, `category`, `description`, `status`, `createdAt`.
   - Audit: Cross-referenced in `AuditLog` table.
7. **`AuditLog` (Compliance & Telemetry)**
   - Column `actorId`: UUID format, nullable for unauthenticated guest reports.
   - Indices: `[entityType, entityId]`, `[actorId]`.

---

## 2. Integrity & Constraint Verification

- **UUID Hygiene:** Verified all relations enforce valid v4 UUIDs. Special care taken in `AuditLog` to ensure `actorId: null` is passed when no JWT session exists (preventing PostgreSQL UUID parse exceptions).
- **Index Performance:** Essential lookup paths (`properties` by city/status, `saved_items` by user/target, `notifications` by user/readStatus) are indexed with B-Tree indices.
- **Migration Determinism:** All migrations executed in strict forward-only sequence with zero checksum drift.
