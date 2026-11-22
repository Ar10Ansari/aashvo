# AASHVO Discovered Defects & Remediation Log

**Sprint:** Independent Verification & Real E2E Workflow Expansion  
**Branch:** `audit/independent-verification-e2e-expansion`  
**Base Commit:** `80ba31b9d40b4c810d738f62f1c841bb74fa1ee5`  
**Status:** All 6 Identified Defects Resolved and Verified  

---

## 1. Itemized Defect Register

### Defect D-01: Canonical Safety Reports Route Missing
- **Severity:** High (Broken Public Workflow)
- **Component:** Backend (`apps/api/src/modules/support`)
- **Description:** Frontend forms and standard API clients post public safety complaints to `POST /api/v1/support/reports`. However, the NestJS route was only mapped to `POST /api/v1/support/tickets/reports`, resulting in 404 errors for whistleblowers and guest users.
- **Root Cause:** Legacy route naming was preserved in `support.controller.ts` without mounting the canonical route.
- **Resolution:** Created `SafetyReportsController` mounted at `@Controller('api/v1/support/reports')` and registered it in `support.module.ts`. Maintained backwards compatibility with the legacy route.
- **Verification Evidence:** `E2E-09` passed against `POST /api/v1/support/reports` (both desktop and mobile).

---

### Defect D-02: PropertyCard Optimistic Inversion on Network Failure
- **Severity:** Medium (Deceptive UI State)
- **Component:** Frontend (`src/components/property/PropertyCard.tsx`)
- **Description:** When a user clicked the shortlist heart icon, if the API call failed (e.g. network timeout or 401), the catch block executed `setIsSaved(!isSaved)`. This caused the heart icon to turn red (saved) precisely when the save had failed.
- **Root Cause:** Incorrect rollback logic in component state management.
- **Resolution:** Removed state mutation in the catch block. The component now preserves its original state and displays an actionable error toast.
- **Verification Evidence:** Unit and browser tests confirm bookmark state remains unchanged when an API call fails.

---

### Defect D-03: Vite Preview Server Missing API Reverse Proxy
- **Severity:** High (E2E Test Environment Invalidation)
- **Component:** Build & Tooling (`vite.config.ts`)
- **Description:** `vite.config.ts` configured proxy rules for `server` (development mode), but omitted `preview.proxy`. When running Playwright against `npm run preview` on port 4173, all API calls were routed to the static file server instead of `http://localhost:4000`, causing 404 errors.
- **Root Cause:** Incomplete Vite configuration for production preview mode.
- **Resolution:** Added `preview: { port: 4173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } }`.
- **Verification Evidence:** Playwright dual webServer config successfully proxies API requests through port 4173 to port 4000.

---

### Defect D-04: Session Lost on Browser Page Reload
- **Severity:** High (Broken User Journey)
- **Component:** Frontend (`src/context/AppContext.tsx`)
- **Description:** When an authenticated user refreshed the page in the browser, `currentUser` was reset to `null` because state was only kept in memory, even though the JWT token was saved in localStorage.
- **Root Cause:** Missing hydration lifecycle hook on AppProvider initialization.
- **Resolution:** Added `useEffect` in `AppContext.tsx` that inspects `aashvo_at` in localStorage and queries `GET /api/v1/profiles/me` to hydrate `currentUser` and role.
- **Verification Evidence:** `E2E-01` verified page reload survival with PostgreSQL backing.

---

### Defect D-05: Missing Mandatory Fields in Property Creation DTO
- **Severity:** Medium (Contract Validation Error)
- **Component:** Contract / Backend Validation (`apps/api/src/modules/properties/dto/property.dto.ts`)
- **Description:** `CreatePropertyDto` marked `availableFrom` as mandatory `@IsString()`, but draft creation and certain test payloads omitted it, triggering 400 Bad Request.
- **Root Cause:** Contract update added required fields without updating all client callers.
- **Resolution:** Updated documentation and fixed all listing creation payloads to supply `availableFrom: 'Immediately'`.
- **Verification Evidence:** `E2E-02`, `E2E-06`, and `E2E-07` all pass creation validations.

---

### Defect D-06: JWT Token Invalidation on Logout
- **Severity:** Medium (Security Hygiene)
- **Component:** Frontend (`src/context/AppContext.tsx`)
- **Description:** Calling `logout()` cleared localStorage items but failed to reset the in-memory bearer token held in `apiClient`.
- **Root Cause:** Incomplete cleanup routine in `logout()`.
- **Resolution:** Updated `logout()` to execute `apiClient.setAccessToken(null)` and invoke backend session logout.
- **Verification Evidence:** Subsequent requests following logout return 401 Unauthorized.
