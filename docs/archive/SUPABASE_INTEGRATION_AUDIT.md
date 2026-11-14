# AASHVO — Complete Supabase Connectivity & Backend Integration Audit

**Date:** 2026-11-12  
**Workspace:** `D:\Projects\AASHVO`  
**Git Branch / Base Commit:** `master` (HEAD before Phase 8 edits: `ab867c1`)  
**Linked Supabase Reference:** `himtwnwxvnnykafyhysy` (`aashvo-dev`, Mumbai `ap-south-1`, PostgreSQL `17.11.0.003`, PostgREST `v14.18`, GoTrue `v2.197.0`, Storage `v1.80.2` via `supabase/.temp/`)  
**Production URL Inspected (Read-Only):** `https://aashvo.vercel.app/`

---

## 1. Executive Connectivity Verdict

**Overall Supabase Connectivity Status:** **PARTIALLY CONNECTED (Codebase Wired & Remediated / Production & Hosted DB BLOCKED on Environment & Migration Execution)**

1. **Client Codebase (`src/services/*`, `src/context/AppContext.tsx`):** The core React + TypeScript application integrates `@supabase/supabase-js` (`^2.118.0`) across authentication, property discovery/creation, flatmate discovery, inquiries, support tickets, safety reports, storage buckets, and the Rental Trust ledger. Several critical gaps between the UI/Context layer, `supportService.ts`, `marketplaceService.ts`, `storageService.ts`, and PostgreSQL RLS policies were identified and fixed in this audit.
2. **Local Workspace Environment:** Only `.env.example` exists on disk; there is no `.env` or `.env.local`. Neither Docker Desktop nor the local Supabase CLI stack (`127.0.0.1:54321` / `54322`) is running, and `supabase` / `vercel` CLIs are not installed in PATH.
3. **Production Vercel Deployment (`https://aashvo.vercel.app/`):** Read-only inspection of the live deployed JS bundle (`/assets/index-CdWyZirl.js`, 452,780 bytes) confirmed **zero `https://*.supabase.co` URLs** are compiled into the bundle and `Local Prototype Mode` is active. Production is currently **NOT CONNECTED** to hosted Supabase (`isLiveBackendConfigured === false`).

---

## 2. Phase-by-Phase Technical Findings

### 2.1 Environment & Client Initialization
- **`src/services/supabase.ts`:** Reads `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. Safely disables `supabase` (`null`) when placeholders or missing values are detected. No `service_role` keys appear anywhere in `src/` or the deployed production bundle.
- **`.vercel/` Directory:** Empty (`project.json` absent locally).

### 2.2 Authentication & Profile Lifecycle (`src/services/authService.ts`, `src/components/auth/AuthModal.tsx`, `src/context/AppContext.tsx`)
- **Implemented Supabase Calls:** `signUp`, `signInWithPassword`, `resend`, `signOut`, `resetPasswordForEmail`, `updateUser`, `signInWithOAuth` (Google), `getSession`, `onAuthStateChange`.
- **Profile Provisioning:** Trigger `public.handle_new_user()` on `auth.users` (`20261022000000`) plus idempotent client fallback `ensureUserProfileExists()` on `public.profiles`.
- **Security Controls:** Demo personas (`isDemo: true`, `usr-demo-*`) cannot elevate to `admin`; `sanitizeStoredUser()` demotes tampered `localStorage` `role: "admin"` claims; `isTrustedAdminSession()` enforces strict UUID checks when live Supabase is active.
- **Unimplemented / Local-Only Helpers:** `authService.ts` also retains in-memory test/evaluation helpers (`initiateGoogleOAuth`, `registerWithEmail`, `confirmUserEmail`, `requestPasswordReset` at lines 97–250) and `activeOtpSessions` / `verifiedPhoneRegistry` maps for unit tests; live SMS OTP verification gateway (`supabase.auth.signInWithOtp` / `verifyOtp`) is not yet wired in the UI.

### 2.3 Database Schema, Migrations & RLS Findings (`supabase/migrations/`)
There are **12 sequential migrations** (11 pre-existing + 1 new remediation migration authored in this audit):
1. `20261018000000_initial_schema.sql` — Core enums, `profiles`, `properties`, `property_photos`, `flatmate_profiles`, `interest_requests`, `listing_reports`, `is_admin()`.
2. `20261019000000_security_fixes.sql` — `search_path` hardening, role/moderation triggers, `public_profiles` view, `property-photos` and `user-avatars` buckets.
3. `20261020000000_nationwide_auth_and_family_stays.sql` — Pan-India columns, `chk_family_stay_eligibility` DB constraint, verification anti-forgery & host/inquiry prerequisite triggers, `public_properties` view.
4. `20261021000000_help_and_support_system.sql` — `support_tickets`, `ticket_messages`, `ticket_audit_events`, `safety_reports`, state-machine trigger, `support-attachments` private bucket.
5. `20261022000000_auth_profile_trigger_and_insert_policy.sql` — `handle_new_user()` trigger with `aashvo.auth_context` + `session_user` validation.
6. `20261023000000_rental_agreements_and_tenancy_records.sql` — `tenancy_agreements`, `rent_payment_records`, `property_inspections`, `rental-documents` private bucket.
7. `20261024000000_rental_reputation_and_disputes.sql` — `tenancy_reviews`, `rental_disputes`, review & dispute integrity triggers.
8. `20261025000000_rental_storage_counterparty_access.sql` — Agreement-scoped counterparty RLS on `storage.objects` for `rental-documents`.
9. `20261026000000_flatmate_profiles_rls_and_anti_forgery.sql` — Least-privilege `flatmate_profiles` RLS (`REVOKE ALL FROM anon`), `public_flatmates` view, `chk_interest_request_target`.
10. `20261027000000_repair_missing_tenancy_agreements.sql` — Idempotent repair migration for hosted Rental Trust tables, FKs, immutability triggers, and post-repair assertions.
11. `20261027100000_backend_contract_reconciliation.sql` — `optional_meal_cost`, `safety_reports` target columns, `support_tickets.attachments`, `public_properties` photo aggregation, `lookup_support_ticket` RPC.
12. `20261112000000_audit_remediation_and_rls_fixes.sql` (**New**) — Fixes discovered schema/RLS contract gaps without weakening security:
    - Adds `flatmate_profiles.city` and `UNIQUE (user_id)` constraint (`uq_flatmate_profiles_user_id`) required by `upsert(..., { onConflict: 'user_id' })`.
    - Recreates `public_flatmates` with `city` and `WITH (security_barrier = true)`, and sets `security_barrier = true` on `public_profiles` and `public_properties`.
    - Adds `SECURITY DEFINER` RPCs `create_guest_support_ticket` and `add_guest_ticket_reply` (`SET search_path = public, pg_temp`) so anonymous/guest support flows persist without granting `anon` `SELECT` on `support_tickets` or `ticket_messages`.
    - Adds 11 missing foreign-key indexes (`properties.owner_id`, `property_photos.property_id`, `interest_requests.*`, `listing_reports.*`, `support_tickets.*`, `safety_reports.*`).
    - Adds `updated_at` triggers on `profiles`, `properties`, and `tenancy_agreements`.

---

## 3. Defects Identified & Safe Fixes Implemented (Phase 8)

| ID | Defect / Gap Found | Root Cause | Safe Fix Implemented | Files Changed |
|---|---|---|---|---|
| **SUP-01** | `createSafetyReportInSupabase` failed for non-admins under RLS | `.insert(...).select('id').single()` invokes `RETURNING`, which triggers `safety_reports` `SELECT` RLS (admin-only) | Generate UUID client-side and call `.insert(...)` without `.select()` | `src/services/supportService.ts` |
| **SUP-02** | Guest support ticket creation & reply failed under RLS | Anonymous users cannot `SELECT` from `support_tickets` or `INSERT` into `ticket_messages` | Added `create_guest_support_ticket` & `add_guest_ticket_reply` RPCs + wired client RPC calls | `supabase/migrations/20261112000000_...sql`, `src/services/supportService.ts`, `src/components/help/HelpCenterModal.tsx` |
| **SUP-03** | Ticket replies, priority changes, and assignments were local-only | `AppContext` `addTicketMessage`, `updateTicketPriority`, `assignTicket` never called Supabase | Implemented `addTicketMessageInSupabase`, `updateTicketPriorityInSupabase`, `assignTicketInSupabase`, awaited in `AppContext` | `src/services/supportService.ts`, `src/context/AppContext.tsx` |
| **SUP-04** | Ticket status & safety report resolution ignored DB errors | `AppContext` fired `.update().then()` without `await` or rollback, always showing success toast | Implemented awaited `updateTicketStatusInSupabase` & `resolveSafetyReportInSupabase` with audit logs and error rejection | `src/services/supportService.ts`, `src/context/AppContext.tsx`, `src/components/admin/AdminModerationModal.tsx` |
| **SUP-05** | Admin moderation queue stayed empty in live mode | Live hydration only fetched `public_properties` (`active`) and current user's tickets | Added `fetchAllPropertiesForAdminFromSupabase`, `fetchAllSupportTicketsForAdminFromSupabase`, `fetchSafetyReportsForAdminFromSupabase` when `isTrustedAdminSession` is true | `src/services/marketplaceService.ts`, `src/services/supportService.ts`, `src/context/AppContext.tsx` |
| **SUP-06** | `flatmate_profiles` upsert & `city` mismatch | `flatmate_profiles` lacked `UNIQUE (user_id)` and `city` column | Added `city`, `uq_flatmate_profiles_user_id`, updated `public_flatmates` & `mapAppFlatmateToSupabaseInsert`, added `fetchMyFlatmateProfileFromSupabase` | `supabase/migrations/20261112000000_...sql`, `src/services/supabase.ts`, `src/services/marketplaceService.ts` |
| **SUP-07** | Property photo upload UI did not invoke Storage | `ListPropertyModal` Step 4 only accepted pasted URLs / presets | Wired `uploadPropertyPhoto` + `validateStorageFile` file picker and `isSubmitting` guard | `src/components/listing/ListPropertyModal.tsx` |
| **SUP-08** | Missing signed URL helper & loading/error UI states | Private buckets lacked `createSignedStorageUrl`; `DiscoverySection` hid backend fetch failures as empty grids | Added `createSignedStorageUrl` in `storageService.ts`; exposed `isLoadingData`, `dataLoadError`, `retryDataLoad` in `AppContext` + `DiscoverySection` | `src/services/storageService.ts`, `src/context/AppContext.tsx`, `src/components/discovery/DiscoverySection.tsx` |
| **SUP-09** | Missing `Permissions-Policy` header in `vercel.json` | Only 4 security headers configured | Added `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` | `vercel.json` |

---

## 4. Remaining Gaps & External Blockers

1. **Unwired Service Features (Code exists in services, no UI trigger yet):**
   - Creating/editing user's own `flatmate_profiles` row (`upsertFlatmateProfileInSupabase`, `fetchMyFlatmateProfileFromSupabase`).
   - Editing/deleting owner properties (`updatePropertyInSupabase`, `deletePropertyInSupabase`, `fetchOwnerPropertiesFromSupabase`).
   - Viewing received inquiries (`fetchInquiriesForProperty`, `fetchInquiriesForFlatmate`).
   - Creating new tenancy agreements or updating dispute statuses in UI (`createTenancyAgreement`, `updateDisputeStatus`).
   - Viewing uploaded private attachments (`createSignedStorageUrl` helper is ready, UI viewer links not yet built).
   - Live SMS OTP phone verification UI (`profiles.phone_verified` currently requires server-side OTP gateway / Supabase Phone Auth).
2. **Hosted Database & Production Environment:**
   - Migrations `20261018000000` through `20261112000000` must be verified and applied on `aashvo-dev` (`himtwnwxvnnykafyhysy`) via Supabase Dashboard SQL Editor or `supabase db push`.
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be configured in Vercel Production & Preview environment variables and redeployed.
   - Local E2E test suites (`gotrueTrustBoundaryE2E.test.ts`, `marketplaceBackendE2E.test.ts`, `rentalTrustE2E.test.ts`) require a running local Supabase stack (`supabase start`) to execute against real PostgreSQL/GoTrue.

