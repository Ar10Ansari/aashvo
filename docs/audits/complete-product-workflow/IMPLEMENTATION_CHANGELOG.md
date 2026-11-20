# AASHVO Implementation Changelog

**Release Branch:** `feat/complete-product-workflow-remediation`  
**Base Commit:** `cfcd724b1ce4c832372357f93775c31c0a5ee3dd`  

---

## 1. Backend Service & Controller Modifications

### `apps/api/src/modules/saved/`
- **`saved.service.ts`:**
  - Added method `deleteSavedItemByTypeAndTarget(userId: string, itemType: string, targetId: string)`.
  - Performs indexed lookup on `(userId, itemType, targetId)` and deletes the matching record safely.
- **`saved.controller.ts`:**
  - Added route `@Delete(':itemType/:targetId')` guarded by `JwtAuthGuard`.
  - Invokes `deleteSavedItemByTypeAndTarget` with authenticated user ID.

### `apps/api/src/modules/visits/`
- **`visits.controller.ts`:**
  - Added `@Patch(':id/reschedule')` route handler alongside `@Post(':id/reschedule')`.
  - Handles reschedule requests with `RescheduleVisitDto`, preventing HTTP 404/405 route rejections.

### `apps/api/src/modules/support/`
- **`dto/support.dto.ts`:**
  - Added `CreateSafetyReportDto` with validation decorators:
    - `reporterEmail`: optional string (email format).
    - `targetType`: required enum (`property`, `user`, `visit`, `message`).
    - `targetId`: required string.
    - `category`: required string (`fraud`, `harassment`, `safety`, `misrepresentation`, `other`).
    - `description`: required string (min 10 characters).
  - Added `SafetyReportResponseDto`.
- **`support.service.ts`:**
  - Added `submitSafetyReport(callerUserId: string | null, dto: CreateSafetyReportDto)`.
  - Creates a row in `SafetyReport` PostgreSQL table.
  - Emits an `AuditLog` entry with `actorId: callerUserId ?? null` (strictly respecting UUID constraints for unauthenticated guest reporters).
- **`support.controller.ts`:**
  - Added `@Post('reports')` route handler accepting `CreateSafetyReportDto`.
  - Uses `OptionalJwtAuthGuard` allowing both authenticated users and guest reporters to flag safety violations.

---

## 2. Frontend Services & React Context Modifications

### `src/services/savedService.ts`
- Updated `checkSaved()` to return `{ isSaved, id: savedId || id }` ensuring UI bookmark toggles have the required target identifier.
- Aligned `unsaveItem()` to use `DELETE /api/v1/saved/:itemType/:targetId`.

### `src/services/visitService.ts`
- Updated `rescheduleVisit()` client helper to use `POST /api/v1/visits/:id/reschedule`, fully compatible with both `@Patch` and `@Post` endpoints.

### `src/services/supportService.ts`
- Added `submitSafetyReportToBackend(report)` invoking `POST /api/v1/support/reports`.
- Maintained offline fallback cache if network is temporarily disconnected.

### `src/services/rentalTrustService.ts`
- Updated `fetchAgreementsForUser(userId)` to invoke `fetchAgreementsFromBackend()` as the primary source of truth.

### `src/components/admin/AdminModerationModal.tsx`
- Refactored `handleApprove` and `handlePause` to call `moderatePropertyInBackend(property.id, newStatus, reason)`.
- Updates the UI dynamically while persisting changes to PostgreSQL via `PATCH /api/v1/properties/:id/moderate`.

### `src/context/AppContext.tsx`
- Integrated `submitSafetyReportToBackend` into the platform context provider.
- Ensures all safety escalation modals write directly to the database.

---

## 3. End-to-End & Integration Test Infrastructure

### `playwright.config.ts`
- Configured native Google Chrome browser automation.
- Setup desktop (`1280x800`) and mobile (`Pixel 5`, `393x851`) device profiles.
- Integrated `webServer` launching Vite development server on port 5173 with proxy to backend.

### `apps/api/start-e2e-server.js`
- Created dedicated E2E runner that initializes RSA keypairs, sets test environment variables, and launches the NestJS API server on port 4000 against PostgreSQL 16.

### `e2e/product-workflows.spec.ts`
- Authored 14 comprehensive browser test scenarios covering Homepage, Discovery filtering, Auth modal, Rent Split calculator, Listing wizard, and Saved shortlists.

### `apps/api/test/complete-product-workflows.postgres.integration.spec.ts`
- Authored 16 automated PostgreSQL 16 integration tests verifying Saved items, Visits lifecycle, Support & Safety reporting, Admin moderation, and Family Stay listings.
