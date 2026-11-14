# AASHVO — Frontend API Transition Plan (Web SPA & Shared Client Contracts)

**Target App:** `D:\Projects\AASHVO` (React 18.3 + TypeScript + Vite 6 + Tailwind 3.4, deployed on Vercel `https://aashvo.vercel.app/`)  
**Principle:** Preserve 100% of existing visual design, component UX, pricing transparency (`calculateMoveInCost`), and product workflows while cleanly replacing `@supabase/supabase-js` and `localStorage` fallbacks with typed REST calls to the NestJS backend (`/api/v1/*`).  
**Skills Applied:** `frontend-architecture`, `frontend-data-contracts`, `cc-skill-frontend-patterns`, `deprecation-and-migration`, `vercel-deployments`

---

## 1. Complete Audit of Current Frontend Backend Touchpoints

### 1.1 Service & Context Layer (`src/services/*`, `src/context/*`)
| Current File | Direct Supabase / Fallback Dependencies | Target Transition Action |
|---|---|---|
| `src/services/supabase.ts` | `@supabase/supabase-js` singleton, `isLiveBackendConfigured`, `checkSupabaseConnection()`, and 7 snake↔camel DB mappers (`mapSupabasePropertyToApp`, etc.). | Replace with `src/shared/api-client/httpClient.ts` (Fetch wrapper with in-memory Bearer JWT, `credentials: 'include'` for `__Host-` refresh cookies, single-flight `401` refresh retry). **Mappers become obsolete** because NestJS natively returns `camelCase` DTOs matching `src/types/*`. |
| `src/services/authService.ts` | GoTrue auth wrappers (`signUpWithSupabase`, `initiateGoogleOAuthWithSupabase`, etc.) + **hardcoded simulated OTP `'654321'`** (`L435`) + `activeOtpSessions` / `verifiedPhoneRegistry` in-memory Maps. | Repoint login, signup, OAuth redirect/exchange, password reset, and real SMS OTP (`/auth/phone/send-otp`, `/auth/phone/verify-otp`) to `NestAuthAdapter`. Retain pure input/eligibility UI helpers (`validatePhone`, `evaluateActionEligibility` mirror for UX hints). |
| `src/services/authorizationService.ts` | `isTrustedAdminSession`, `sanitizeStoredUser`, `canPerformAdminAction` guarding client UI against `localStorage` spoofing. | Authoritative session & role come strictly from `GET /api/v1/auth/me` (never trusted from `localStorage`). Keep UI guard utilities reading validated server `User` state. |
| `src/services/marketplaceService.ts` | Queries `public_properties`, `properties`, `property_photos`, `public_flatmates`, `flatmate_profiles`, `interest_requests`. | Point to `/api/v1/properties`, `/api/v1/family-stays`, `/api/v1/flatmates`, and `/api/v1/inquiries`. Retain pure client helpers (`calculateFlatmateCompatibility`, `calculateGeoDistanceKm`, `maskAddressForPublicView`). |
| `src/services/supportService.ts` | Queries `support_tickets`, `ticket_messages`, `ticket_audit_events`, `safety_reports` + RPCs (`lookup_support_ticket`, `create_guest_support_ticket`, `add_guest_ticket_reply`). | Point to `/api/v1/support/tickets`, `/support/tickets/guest-lookup`, `/support/tickets/:id/messages`, `/safety/reports`, and `/admin/*`. Keep pure `VALID_STATUS_TRANSITIONS` & `getReportPriorityAndLabel` UX preview helpers. |
| `src/services/rentalTrustService.ts` | Queries 5 tenancy tables + `SEED_*` dev fallbacks when Supabase is unconfigured. | Point to `/api/v1/tenancy/*` and `/api/v1/rental-trust/*`. Gate `SEED_*` strictly behind `import.meta.env.DEV && VITE_API_PROVIDER === 'mock'`. |
| `src/services/storageService.ts` | Direct `supabase.storage.from(bucket).upload(...)` & `createSignedUrl` across 4 buckets. | Two-step presigned S3/R2 upload (`POST /media/presign-upload` → direct `PUT` to R2/S3 → `POST /media/:id/confirm`), plus `POST /media/:id/presign-download` for private attachments/rental docs. |
| `src/context/AppContext.tsx` | 1,200+ lines combining **UI state** (active modals, filters, toast) with **server cache**, `supabase.auth.onAuthStateChange`, `loginAs` demo personas, and `aashvo_*` `localStorage` sync. | Split cleanly into `UiContext` (modals, toast, filters) + `@tanstack/react-query` (or thin server-state hooks) backed by `ApiClient`; remove production `localStorage` data fallbacks and `aashvo_current_user` spoofing surface. |

### 1.2 UI Component Coupling Inventory
- **Minimal / Wrapper Refactor Needed (5 modals):**
  - `src/components/auth/AuthModal.tsx`: Handle NestJS OAuth callback query code (`/auth/callback?code=...` → `POST /auth/oauth/exchange`); **hide/remove `Demo Personas` in `VITE_APP_ENV === 'production'`**.
  - `src/components/listing/ListPropertyModal.tsx`: Swap `uploadPropertyPhoto` → presigned R2 upload (`mediaId` + CDN URL returned on confirm) before `POST /api/v1/properties`.
  - `src/components/support/HelpCenterModal.tsx`: Pass `mediaId` attachments and use `POST /support/tickets/guest-lookup`; render temporary 15m presigned download links for private attachments.
  - `src/components/admin/AdminModerationModal.tsx`: Use paginated `/api/v1/admin/*` endpoints.
  - `src/components/rental/RentalTrustModal.tsx`: Remove `SEED_*` banner in production; use `/api/v1/media/:id/presign-download` when viewing rental PDFs/receipts.
- **Zero-Backend Presentation Components (Preserve Untouched):** `Hero.tsx`, `Footer.tsx`, `TrustFeatures.tsx`, `OurFounders.tsx`, `PropertyCard.tsx`, `PropertyFilters.tsx`, `DiscoverySection.tsx`, `PropertyDetailModal.tsx`, `FlatmateDetailModal.tsx`, `ReportModal.tsx`, `Navbar.tsx`.

---

## 2. Target Frontend Client Architecture

```text
src/
├── shared/
│   ├── api-client/
│   │   ├── generated/openapi.ts    # Auto-generated from NestJS OpenAPI 3.1 spec (shared w/ mobile!)
│   │   ├── httpClient.ts           # Base fetch client: BaseURL, X-Request-ID, Bearer, single-flight refresh
│   │   ├── errorMapper.ts          # Maps { error: { code, message, details } } -> typed UI errors
│   │   └── adapters/               # AuthAdapter, MarketplaceAdapter, SupportAdapter, RentalAdapter, MediaAdapter
│   └── auth/
│       └── tokenStore.ts           # In-memory access JWT ONLY (never localStorage!)
├── context/
│   ├── AppContext.tsx              # Slimmed facade maintaining backwards-compatible hook props for UI
│   └── UiStateContext.tsx          # Modal open states, search filters, toast notifications
└── services/                       # Facade interface (selected by VITE_API_PROVIDER during transition)
```

### 2.1 Auth & Session Continuity in Browser
- **Tab Reload Session Restoration:** On `App` mount, `httpClient` calls `POST /api/v1/auth/refresh` (with `credentials: 'include'`). If `__Host-aashvo_rt` httpOnly cookie is valid, NestJS rotates it and returns `{ accessToken, user }` directly into React memory (`tokenStore`). If `401`, user starts unauthenticated cleanly without flashing error toasts.
- **Concurrent 401 Protection:** Multiple simultaneous component requests hitting expired 15m access JWT share a single in-flight `refreshPromise` so rotating refresh tokens never trigger false reuse-detection revocations!

---

## 3. Safe Incremental Cutover & Deprecation Workflow (`Strangler + Adapter Pattern`)

1. **Phase 1 — Introduce Interface Adapter (`VITE_API_PROVIDER=supabase | nestjs`):**
   - Keep existing `src/services/*.ts` signatures stable while introducing `src/shared/api-client/` implementing the same return types (`{ success, data?, error? }`).
   - Vercel staging preview runs `VITE_API_PROVIDER=nestjs` + `VITE_API_BASE_URL=https://staging-api.aashvo.in`; production (`https://aashvo.vercel.app/`) stays untouched until staging passes 100% E2E verification.
2. **Phase 2 — OpenAPI Contract Lock:**
   - CI validates generated TypeScript types from NestJS Swagger against `src/types/index.ts` and `src/types/rentalTrust.ts` before merging any frontend/backend PR.
3. **Phase 3 — Production Switch & Cookie Verification:**
   - Update `vercel.json` CSP (`connect-src 'self' https://api.aashvo.in https://*.r2.cloudflarestorage.com ...` and `img-src 'self' data: https://media.aashvo.in https://images.unsplash.com`).
   - Set Vercel Production env vars (`VITE_API_PROVIDER=nestjs`, `VITE_API_BASE_URL=https://api.aashvo.in`, `VITE_APP_ENV=production`, `VITE_ENABLE_DEMO_PERSONAS=false`).
   - **Never place any secret keys in Vercel `VITE_*` variables.**
4. **Phase 4 — Clean Deprecation Removal (T+14 Days Post-Cutover Stability):**
   - Once production telemetry confirms `0` fallback traffic and stable auth/CRUD metrics for 14 days:
     - Remove `src/services/supabase.ts` and legacy `mapSupabase*` mappers.
     - Remove `aashvo_*` `localStorage` server-data mirrors from `AppContext.tsx` and hardcoded OTP `'654321'` simulation from `authService.ts`.
     - Uninstall `@supabase/supabase-js` from `package.json` and update `.env.example`.

---

## 4. Mobile App Parity (Future iOS / Android Clients)
Because NestJS enforces all rules, DTO validation, rate limits, and counterparty permissions in HTTP endpoints rather than PostgREST views/RLS, future React Native / Swift / Kotlin clients consume the **exact same `/api/v1/*` OpenAPI contract**, sending `X-Client-Platform: ios|android` on auth endpoints to store rotating refresh tokens in device Keychain / EncryptedSharedPreferences instead of browser cookies.

