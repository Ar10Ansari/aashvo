# AASHVO Security & Access Control Review

**Audit Date:** November 2026  
**Auditor:** Principal Security Engineer & Autonomous CTO  

---

## 1. Authentication Architecture & Token Security

- **JWT Issuance & Verification:**
  - Asymmetric RS256 signing with dedicated private/public key pairs.
  - Short-lived Access Tokens (15m expiry) paired with rotating Refresh Tokens (7d expiry).
  - Secure, HTTP-only, `SameSite=Strict` cookie transmission preventing XSS interception.
- **Google OAuth Race Hardening:**
  - Fully verified fix for concurrent Google OAuth callback races using PostgreSQL row locks and serializable account linking transactions.
  - Zero-trust token signature verification against Google JWKS.

---

## 2. Authorization, IDOR & Multi-Tenant Boundary Enforcement

- **Ownership Verification on Mutations:**
  - `Properties`: Listing edits, status updates, and deletions check `property.ownerId === req.user.id`.
  - `Visits`: Only the visitor or property owner can view or reschedule visit appointments.
  - `Inquiries`: Self-inquiries are blocked at the service level (`inquiry.userId !== property.ownerId`).
  - `SavedItems`: Scoped strictly by `req.user.id` on query and deletion.
- **Role-Based Access Control (RBAC):**
  - Moderation endpoints (`PATCH /api/v1/properties/:id/moderate`) require `ADMIN` or `MODERATOR` role validated via `RolesGuard`.
- **Guest Access Hygiene:**
  - Public read endpoints (`GET /api/v1/properties`) omit sensitive owner contact information unless authorized.
  - Safety reporting accepts guest submissions while sanitizing input strings and recording IP/UserAgent for anti-abuse throttling.

---

## 3. Input Validation & Injection Mitigation

- **NestJS Validation Pipe:**
  - Configured with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
  - Rejects unknown or malicious payload keys automatically.
- **SQL Injection Prevention:**
  - 100% parameterization through Prisma ORM query builder. Zero raw string interpolation queries.
