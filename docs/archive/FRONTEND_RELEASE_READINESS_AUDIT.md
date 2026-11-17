# AASHVO Frontend Release Readiness & Demo Removal Audit

**Audit Date:** 2026-11-15
**Reviewers:** Principal Frontend Engineer, Product Designer, QA Lead & Security Reviewer
**Target Environments:**
- Production Frontend: `https://aashvo.vercel.app`
- Production API: `https://aashvo-api.onrender.com/api/v1`
- Git Branch: `master`

---

## 1. Executive Summary

This comprehensive audit evaluates the Aashvo frontend codebase for production release readiness. The audit specifically targets the identification and elimination of prototype artifacts, demo buttons, prefilled credentials, simulated databases, fake activity feeds, and hardcoded sample records, while ensuring robust connectivity to the live Render NestJS backend (`/api/v1`) and Supabase services.

All findings have been categorized by severity:
- **BLOCKER:** Direct violation of production integrity, exposure of test credentials/personas, or misleading demo banners.
- **HIGH:** Synthetic data injection into real user experiences or silent fallback to seed listings.
- **MEDIUM:** Suboptimal empty states lacking clear user CTAs, URL normalization risks, or cold-start resilience gaps.
- **LOW:** Asset branding polish, metadata minor enhancements, and typography edge cases.

---

## 2. Inventory of Findings by Severity

| ID | Category | Location | Severity | Description |
|---|---|---|---|---|
| **AUD-01** | Auth Demo Personas | `src/components/auth/AuthModal.tsx:31, 395-406, 764-835` | **BLOCKER** | "Demo Personas" navigation tab with Sparkles icon allows visitors to bypass authentication and log in as "DEMO RENTER", "DEMO OWNER", or "DEMO MANAGER" via `loginAs()`. |
| **AUD-02** | Navbar Persona Switcher | `src/components/layout/Navbar.tsx:319-327, 552-557` | **BLOCKER** | Profile dropdown and mobile navigation render "Switch Persona / Login" button invoking `openAuthModal('personas')`. |
| **AUD-03** | Demo Role & Context | `src/context/AppContext.tsx:72-74, 1067-1107` | **BLOCKER** | `loginAs()` in `AppContext` generates synthetic mock users (`usr-demo-101`, `usr-demo-202`, `usr-demo-303`) with test phone numbers and email domains (`rohan.v@delhitech.in`, `anil.mehra@delhihomes.org`, `rajesh@urbanstay.in`). |
| **AUD-04** | Synthetic Tenancy Records | `src/components/rental/RentalTrustModal.tsx:121, 358-370` | **BLOCKER** | Unauthenticated visitors are automatically mapped to `user-demo-renter-1` and shown a "DEMO / EVALUATION MODE" notice banner over synthetic lease `ag-demo-001`. |
| **AUD-05** | Fake Visit Activity | `src/components/activity/MyActivityModal.tsx:61-98` | **HIGH** | If user has no scheduled visits or backend is unreachable, the UI injects fake visits (`vis-demo-1`, `vis-demo-2`) to DLF Phase 4 and Sector 28. |
| **AUD-06** | Seed Listing Fallback | `src/context/AppContext.tsx:152-173, 232-401` | **HIGH** | `properties` and `flatmates` default to `SEED_PROPERTIES` and `SEED_FLATMATES` when backend is offline or unconfigured, populating fake inventory in production localStorage. |
| **AUD-07** | Flatmate Service Fallback | `src/services/marketplaceService.ts:743` | **HIGH** | `fetchFlatmatesFromSupabase()` returns `SEED_FLATMATES` when Supabase is not configured. |
| **AUD-08** | Incomplete Empty States | `src/components/discovery/DiscoverySection.tsx:341-403` | **MEDIUM** | When inventory is empty, only "Reset All Filters" is offered. Missing actionable CTAs such as "Be the first to list your property" or "Create your flatmate profile". |
| **AUD-09** | API Base URL Ambiguity | `src/services/apiClient.ts:57-60, 146-155` | **MEDIUM** | If `VITE_API_BASE_URL` is configured without `/api/v1` (e.g. `https://aashvo-api.onrender.com`), requests to `/auth/login` would 404 because NestJS routes expect `/api/v1/auth/login`. |
| **AUD-10** | Cold Start Feedback | `src/services/apiClient.ts` & `src/components/ui/Toast.tsx` | **MEDIUM** | Render free-tier cold starts may take 30-50s on initial load; lacks a specific friendly cold-start wake-up notification. |
| **AUD-11** | SEO & Favicon Branding | `index.html:5, 52` | **LOW** | Favicon references default `/vite.svg` instead of an Aashvo brand mark. |

---

## 3. Detailed Component & Route Analysis

### 3.1 Authentication & Personas (`AuthModal.tsx` & `Navbar.tsx`)
- **Current State:**
  - `AuthModal` supports mode `'personas'` alongside genuine modes (`signin`, `signup`, `forgot`, `recovery`).
  - Renders interactive persona cards for Rohan Varma, Anil Mehra, and Rajesh Kumar.
  - Navbar profile dropdown includes a "Switch Persona / Login" option.
  - Navbar renders a badge reading "Demo" and "Non-Privileged Demo Preview" when `currentUser.isDemo` is true.
- **Required Remediation:**
  - Remove `'personas'` mode from `AuthMode` in `AuthModal.tsx` and `AppContext.tsx`.
  - Remove "Demo Personas" tab header and Sparkles icon from `AuthModal.tsx`.
  - Remove the persona switcher card section entirely from `AuthModal.tsx`.
  - In `Navbar.tsx`, remove "Switch Persona / Login" button from profile dropdown and mobile menu.
  - In `Navbar.tsx`, remove demo badges; display authentic role and verified status tags only.
  - In `AppContext.tsx`, deprecate/remove `loginAs` from the public interface (preserve internal test utilities for test suites in `src/test/` only).

### 3.2 Tenancy Agreements & Rental Trust (`RentalTrustModal.tsx`)
- **Current State:**
  - If `currentUser` is null, falls back to `userId = 'user-demo-renter-1'`.
  - Fetches synthetic agreements from `rentalTrustService.ts` (`ag-demo-001`).
  - Displays amber banner: `DEMO / EVALUATION MODE: Viewing local synthetic tenancy records. Database writes will not persist to live storage.`
- **Required Remediation:**
  - If `!currentUser`, render a polished sign-in prompt: "Sign in to view your tenancy agreements, rent payment records, and move-in inspection checklists." with a "Sign In" button opening `openAuthModal('signin')`.
  - If `currentUser` is signed in but has no agreements (`agreements.length === 0`), render a genuine empty state: "No active tenancy agreements found. Once an agreement is drafted with a host or renter, your deposit ledger and checklists will appear here."
  - Remove the amber "DEMO / EVALUATION MODE" banner.

### 3.3 My Activity Modal (`MyActivityModal.tsx`)
- **Current State:**
  - Lines 61-98 inject hardcoded demo visits:
    - `vis-demo-1` (Sunita Rao, DLF Phase 4 Master Bedroom)
    - `vis-demo-2` (Vikram Malhotra, Spacious Studio Apartment)
- **Required Remediation:**
  - Remove synthetic visit array fallback completely.
  - When `visits.length === 0`, render a clean empty state: "No viewing appointments scheduled yet. Browse verified rooms and schedule a visit with direct owners." with a button to scroll to `#discovery-section`.

### 3.4 Marketplace Inventory & Seed Data Isolation (`AppContext.tsx`, `DiscoverySection.tsx`, `marketplaceService.ts`)
- **Current State:**
  - `AppContext` initializes `properties` with `SEED_PROPERTIES` and `flatmates` with `SEED_FLATMATES`.
  - If backend is offline or unconfigured, users browse fake listings.
  - `marketplaceService.ts` returns `SEED_FLATMATES` when Supabase is not reachable.
- **Required Remediation:**
  - In `AppContext.tsx`, initialize `properties` and `flatmates` to `[]` by default.
  - Disconnect `SEED_PROPERTIES` and `SEED_FLATMATES` from production runtime (retain them strictly in `src/data/seedData.ts` for automated test suites).
  - In `DiscoverySection.tsx`, provide high-fidelity empty states:
    - For empty property listings: "No listings in this area yet. Be the first to list your property" with a clear CTA to "List a Property" (`setIsListPropertyOpen(true)`).
    - For empty flatmates: "No flatmate profiles found. Create your profile to be discovered" with a clear CTA to "Create Flatmate Profile" or "Launch Aashvo Connect".
    - For active filter zero-matches: "No matching listings found. Try expanding your filters or exploring nearby localities." with "Reset Filters" CTA.

### 3.5 API Client Robustness & URL Normalization (`apiClient.ts`)
- **Current State:**
  - `apiClient.getBaseUrl()` returns `VITE_API_BASE_URL || '/api/v1'`.
  - Potential mismatch if `VITE_API_BASE_URL` contains or omits `/api/v1`.
- **Required Remediation:**
  - Normalize `getBaseUrl()`:
    ```ts
    public getBaseUrl(): string {
      const envUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined;
      if (!envUrl) return '/api/v1';
      const trimmed = envUrl.replace(/\/+$/, '');
      if (!trimmed.endsWith('/api/v1')) {
        return `${trimmed}/api/v1`;
      }
      return trimmed;
    }
    ```
  - In `request()`, prevent double `/api/v1/api/v1` prefix if a caller provides a path starting with `/api/v1/`.

---

## 4. Verification & Testing Requirements

1. **Unit & Integration Regression Suite:**
   - Add `src/test/productionReleaseReadiness.test.tsx` verifying:
     - No "Demo Personas" tab or demo login buttons rendered in `AuthModal`.
     - No prefilled credentials or test emails displayed.
     - Empty marketplace state renders clean CTAs instead of fake seed listings.
     - `RentalTrustModal` prompts unauthenticated users to sign in and displays clean empty states for users with 0 agreements.
     - `MyActivityModal` does not render synthetic visits (`vis-demo-1`).
2. **Monorepo Build & Typecheck:**
   - `npm test` (all 24+ frontend test suites must pass).
   - `npm --workspace=apps/api test` (all 14 backend test suites must pass).
   - `npm run typecheck` & `npm run build` must succeed with zero errors.

---

## 5. Audit Conclusion

The application possesses a solid architectural foundation (NestJS + Prisma backend, React + Vite frontend, robust token rotation, GIS Google OAuth, and RLS policies). However, the presence of demo login persona switchers, hardcoded synthetic visits, and seed data fallbacks in production components creates confusion and prevents genuine commercial operation. Remediating these findings according to the plan above will bring the AASHVO frontend to a genuine production standard.
