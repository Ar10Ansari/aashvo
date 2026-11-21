# AASHVO Security & Authorization Verification

**Auditor:** Independent CTO Reviewer & Security Engineer  
**Date:** November 21, 2026  
**Target:** AASHVO Platform API, Database & Frontend  

---

## 1. Security Architecture & Threat Model

The AASHVO marketplace processes sensitive personal information, property listings, tenant-landlord communications, and viewing appointments. The security audit evaluated defenses against the OWASP API Top 10 vulnerabilities, specifically focusing on:
- Broken Object Level Authorization (BOLA / IDOR)
- Broken Authentication & Session Management
- Privilege Escalation
- Unrestricted Resource Consumption & Validation Failures
- Audit Logging & Anonymous Action Safety

---

## 2. In-Depth Security Audit Findings & Evidence

### A. Insecure Direct Object References (IDOR / BOLA)
- **Attack Vector:** An authenticated user attempts to mutate or delete a resource owned by another user.
- **Verification (`E2E-12`):**
  - Seeker attempts to update an owner's property (`PATCH /api/v1/properties/:id`):
    - **Result:** `403 Forbidden` (`ERROR_CODES.FORBIDDEN: You are not authorized to update this listing`).
    - Database verification confirmed `rent_amount` remained completely unmodified.
  - Non-owner attempts to mark another user's notification as read:
    - **Result:** `403 Forbidden`.
  - Non-owner attempts to confirm or reschedule someone else's visit:
    - **Result:** `403 Forbidden`.

### B. Role-Based Access Control (RBAC) & Privilege Escalation
- **Attack Vector:** A regular tenant or owner attempts to access admin moderation endpoints.
- **Verification (`E2E-08`, `E2E-12`):**
  - Seeker attempts to moderate a property listing (`PATCH /api/v1/properties/:id/moderate`):
    - **Result:** `403 Forbidden` (`Insufficient permissions for this action`).
  - Roles are extracted from the authoritative `users` table via `UsersService.findActiveAuthStatus(userId)` on every request, preventing client-side role forgery.
  - In frontend Vitest suite, forged admin claims in `localStorage` are automatically sanitized and demoted to `renter` with security alert.

### C. Unauthenticated Access & Session Hijacking Defenses
- **Attack Vector:** Direct calls to protected mutation endpoints without a valid bearer token.
- **Verification (`E2E-14`):**
  - Call to `POST /api/v1/visits` without Authorization header returns `401 Unauthorized`.
  - `JwtAuthGuard` validates RSA256 signature, expiry, and active session family ID (`RefreshSessionService.isSessionFamilyActive`).
  - Sign-out actively invalidates the refresh session family on the backend and clears tokens in client memory and storage.

### D. Malformed Input & Validation Defenses
- **Attack Vector:** Sending malformed JSON, SQL injection vectors, or missing mandatory fields.
- **Verification (`E2E-14`):**
  - Registration with password shorter than 8 characters is rejected with `400 Bad Request`.
  - Global `ValidationPipe` with `{ whitelist: true, transform: true }` strips unwhitelisted properties and enforces strict types.

### E. Guest Whistleblower & Anonymous Audit Logging
- **Attack Vector:** Anonymous safety report creation (`POST /api/v1/support/reports`) causing foreign key violations in audit logs.
- **Verification (`E2E-09`):**
  - Anonymous visitor submits safety report on fraudulent listing.
  - API accepts report (`201 Created`).
  - `AuditLog` record is generated with `actorId: null` and `actorRole: 'guest'`, successfully preventing foreign key constraint crashes on `users.id`.
