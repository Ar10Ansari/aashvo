# AASHVO Backend Security & Authorization Test Review

**Auditor:** Independent CTO Reviewer & Senior Security Engineer  
**Suite:** `apps/api/test/security-authorization-deep.postgres.integration.spec.ts`  
**Framework:** Jest + Supertest + live PostgreSQL 16 on port 5433  
**Date:** November 22, 2026  

---

## 1. Executive Summary

Frontend `localStorage` checks or client-side disabled buttons are superficial security barriers. True security requires uncompromising backend authorization enforced at the API controller, guard, and database query layers.

To independently verify backend security, we authored and executed a deep security test suite (`apps/api/test/security-authorization-deep.postgres.integration.spec.ts`) that issued actual hostile HTTP payloads against the live NestJS application. All 10 security assertions passed with 100% precision.

---

## 2. Tested Security Scenarios & Results

| # | Security Scenario | Attack Payload / Method | Expected HTTP Status | Verified DB State | Result |
|---|---|---|---|---|---|
| **1** | Normal user attempting admin action | Non-admin user calls `PATCH /api/v1/properties/:id/moderate` with `{ status: 'active' }` | **403 Forbidden** | Property status remains `pending_review` | **PASS** |
| **2** | User modifying another user's listing | Attacker calls `PATCH /api/v1/properties/:id` with `{ rentAmount: 100 }` | **403 Forbidden** | Listing `rentAmount` remains `45000` | **PASS** |
| **3** | User accessing another user's inquiry | Attacker calls `PATCH /api/v1/inquiries/:id/status` with `{ status: 'accepted' }` | **403 Forbidden** | Inquiry status remains `pending` | **PASS** |
| **4** | User altering another user's visit | Attacker calls `PATCH /api/v1/visits/:id/status` with `{ action: 'confirm' }` | **403 Forbidden** | Visit status remains `pending` | **PASS** |
| **5** | User reading another user's notifications | Attacker calls `PATCH /api/v1/notifications/:id/read` | **403 Forbidden** | Notification `read` flag remains `false` | **PASS** |
| **6a**| Forged token with rogue RSA key | Attacker signs valid payload with their own RSA-2048 private key | **401 Unauthorized** | Session rejected; no access | **PASS** |
| **6b**| Algorithm:none exploit | Token header specifies `{"alg":"none"}` | **401 Unauthorized** | Blocked by `assertSafeJwtHeader` | **PASS** |
| **7** | Expired token | Validly signed token with `exp` in the past | **401 Unauthorized** | Blocked by `jwt.verify` expiration check | **PASS** |
| **8** | Revoked session family | User calls `POST /api/v1/auth/logout`, then attempts request with previous access token | **401 Unauthorized** | Session marked inactive in `RefreshSession` table | **PASS** |
| **9** | Authoritative server-side role resolution | Attacker passes token, but server checks role directly from PostgreSQL `users` row | **Authoritative RBAC** | Role from `User` table governs access | **PASS** |

---

## 3. In-Depth Technical Architecture Analysis

### A. Authoritative Server-Side Role Enforcement
In `JwtAuthGuard` (`apps/api/src/modules/auth/guards/jwt-auth.guard.ts`):
```typescript
const [userRecord, isSessionActive] = await Promise.all([
  this.usersService.findActiveAuthStatus(claims.sub),
  this.refreshSessions.isSessionFamilyActive(claims.sid),
]);

if (!userRecord || userRecord.accountStatus !== 'active' || !isSessionActive) {
  throw new UnauthorizedException({
    code: ERROR_CODES.UNAUTHORIZED,
    message: 'Session is no longer active.',
  });
}

request.user = {
  id: userRecord.id,
  email: userRecord.email,
  role: userRecord.role, // Authoritative role from PostgreSQL
  accountStatus: userRecord.accountStatus,
  sessionFamilyId: claims.sid,
};
```
Even if an attacker forges or tampers with the `role` claim in a token payload, the application **never** relies on the token's role claim. The server queries `prisma.user.findUnique({ where: { id: userId }, select: { role: true, accountStatus: true } })` to set `request.user.role`.

### B. Anti-Tampering & Algorithm Confusion Protections
`JwtTokenService` includes strict header validation before token verification:
- Blocks `alg: none` unconditionally.
- Blocks asymmetric-to-symmetric key confusion (`RS256` to `HS256`).
- Blocks remote key injection headers (`jku`, `x5u`, `jwk`).
- Enforces strict UUID and character patterns on `kid`.

### C. Session Revocation & Logout
Logging out calls `RefreshSessionService.revokeFamily(familyId)`, which marks the session family revoked in PostgreSQL. On subsequent requests, `isSessionFamilyActive(claims.sid)` returns `false`, immediately revoking access even if the short-lived JWT has not yet expired.
