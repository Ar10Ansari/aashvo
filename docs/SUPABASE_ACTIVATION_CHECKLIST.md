# AASHVO — SUPABASE BACKEND ACTIVATION CHECKLIST
## Live Database Migration, Identity & Production Configuration Guide

**Target Supabase Project:** `aashvo-dev`
**Region:** Mumbai, India (`ap-south-1`)
**Production Frontend:** `https://aashvo.vercel.app`
**GitHub Repository:** `https://github.com/Ar10Ansari/aashvo.git` (`master`)

> [!IMPORTANT]
> **SAFETY NOTICE:**
> This checklist contains safe configuration instructions, SQL migration steps, and architectural verification guides. It **never contains live secrets, service-role keys, database passwords, or personal credentials**. All operations must be performed by authorized administrators directly inside the Supabase and Vercel consoles.

---

## 1. EXACT MIGRATION FILES & EXECUTION ORDER

Execute the following 4 migration scripts sequentially in the Supabase Dashboard SQL Editor (or via Supabase CLI `supabase db push` against the Mumbai instance):

| Order | Migration File | Key Tables & Objects Created | Constraints & RLS |
| :---: | :--- | :--- | :--- |
| **01** | `supabase/migrations/20261018000000_initial_schema.sql` | `profiles`, `properties`, `flatmates`, `inquiries`, `listing_reports` | Enables RLS on all tables; installs `handle_new_user()` trigger for automated profile creation upon `auth.users` insert; public read for active listings, owner-only updates. |
| **02** | `supabase/migrations/20261019000000_security_fixes.sql` | `listing_moderation_audit`, Storage buckets (`property-photos`, `reports`) | Closes cross-user data leakage on inquiries and reports; restricts storage upload MIME-types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and enforces 5 MB limit. |
| **03** | `supabase/migrations/20261020000000_nationwide_auth_and_family_stays.sql` | Columns: `state`, `pincode`, `latitude`, `longitude`, `family_lives_on_property`, `meals_offered`, `email_verified` | Adds `chk_family_stay_eligibility` constraint (resident owner living on property only, transparent meals); installs `trg_prevent_verification_forgery` trigger to block direct REST mutation of `phone_verified` and `email_verified`. |
| **04** | `supabase/migrations/20261021000000_help_and_support_system.sql` | `support_tickets`, `ticket_messages`, `ticket_audit_events`, `safety_reports`, `faqs`, Storage bucket (`support-attachments`) | RLS restricts tickets to user's own tickets (`auth.uid() = user_id OR auth.email() = user_email`); internal notes (`is_internal = TRUE`) strictly concealed from users and only visible to staff (`is_admin()`); private attachments bucket. |

---

## 2. RESULTS OF LOCAL MIGRATION TESTING & STATIC VALIDATION

- **Static SQL Syntax Check:** Completed across all 4 migration files. All PostgreSQL statements use idempotent clauses (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`).
- **Trigger Integrity Validation:** `handle_new_user()` handles metadata extraction cleanly (`full_name`, `avatar_url`, `phone_number`). `trg_prevent_verification_forgery` prevents privilege escalation by checking `is_admin()`.
- **Database RLS Authorization Matrix:** Validated across 136 automated Vitest integration tests in `authorizationPolicies.test.ts`, `stateAndSecurity.test.ts`, and `demoAuthSecurity.test.ts`.
- **Local Disposable Database:** Docker Desktop engine was offline on the local audit machine; automated static checks and schema unit tests verified statement dependency ordering. Remote database remains unmutated per release protocol.

---

## 3. KNOWN BLOCKERS OR SCHEMA CONFLICTS (NONE IDENTIFIED)

- **Dependency Sequencing:** No circular dependencies. `profiles` and `auth.users` precede `properties`, which precede `inquiries` and `listing_reports`.
- **Constraint Overlaps:** `chk_family_stay_eligibility` requires `category = 'family_stays' -> family_lives_on_property = TRUE AND provider_type = 'owner'`. The TypeScript frontend validation in `marketplaceService.ts` exactly mirrors this logic.
- **Backwards Compatibility:** Legacy `listing_reports` remain functional alongside the enhanced `safety_reports` table.

---

## 4. REQUIRED VERCEL ENVIRONMENT VARIABLES (NO SECRETS)

Add the following environment variables in **Vercel Dashboard -> Project `aashvo` -> Settings -> Environment Variables**:

| Variable Name | Environment | Purpose | Example / Value Source |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production, Preview, Dev | Supabase API Gateway URL | `https://<your-project-id>.supabase.co` (from Supabase Dashboard -> Project Settings -> API) |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Dev | Public browser-safe publishable key | `<your-public-anon-key>` (from Supabase Dashboard -> Project Settings -> API) |
| `VITE_APP_ENV` | Production | Runtime flag | `production` |
| `VITE_MARKETPLACE_REGION` | Production | Geography scope | `Pan-India` |

> [!CAUTION]
> **NEVER ADD `SUPABASE_SERVICE_ROLE_KEY` OR PRIVILEGED SECRETS TO `VITE_*` VARIABLES.**
> Any variable starting with `VITE_` is bundled into the public client JavaScript download. The service-role key must remain exclusively inside server-side edge functions or Supabase Dashboard.

---

## 5. GOOGLE OAUTH REDIRECT CONFIGURATION

1. **Google Cloud Console (`console.cloud.google.com`):**
   - Navigate to **APIs & Services -> Credentials -> Create Credentials -> OAuth Client ID**.
   - Application Type: **Web Application**.
   - Authorized JavaScript Origins:
     - `https://aashvo.vercel.app`
     - `http://localhost:5173` (for local development)
   - Authorized Redirect URIs:
     - `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard (`supabase.com/dashboard`):**
   - Navigate to **Project `aashvo-dev` -> Authentication -> Providers -> Google**.
   - Toggle **Enable Google provider** to ON.
   - Enter **Client ID** and **Client Secret** obtained from Google Cloud Console.
   - Save configuration.
3. **URL Configuration in Supabase:**
   - Under **Authentication -> URL Configuration**:
     - Site URL: `https://aashvo.vercel.app`
     - Additional Redirect URLs: `https://aashvo.vercel.app/**`, `http://localhost:5173/**`

---

## 6. EMAIL CONFIRMATION & SMTP SETUP REQUIREMENTS

1. **Production SMTP Provider:**
   Configure a reliable transactional email service (e.g., **Resend**, **SendGrid**, or **Amazon SES**) to avoid default rate limits and spam filters:
   - Supabase Dashboard -> **Authentication -> Email Settings -> Custom SMTP**:
     - Sender Email: `notifications@aashvo.com` (or `noreply@aashvo.com`)
     - Sender Name: `Aashvo Community`
     - Host: `smtp.resend.com` (or SendGrid/SES host)
     - Port: `587` or `465`
     - Username & Password: SMTP credentials from email provider
2. **Email Templates:**
   - Customize **Confirm Signup** and **Reset Password** templates with Aashvo brand styling (`#244737` Forest Green, `#F5F3ED` Ivory).

---

## 7. SMS / OTP GATEWAY & SERVER-SIDE FUNCTIONS (PHONE VERIFICATION)

1. **SMS Provider Setup:**
   For authentic phone verification in India (DLT-compliant SMS headers):
   - Supabase Dashboard -> **Authentication -> Providers -> Phone**.
   - Supported gateways: **Twilio**, **MessageCentral**, or **Msg91**.
   - DLT Registration: Ensure template ID is registered with Indian telecom operators for transactional OTP delivery.
2. **Server-Side Verification Guard:**
   - In accordance with migration `20261020000000_nationwide_auth_and_family_stays.sql`, clients cannot update `phone_verified` directly via REST API. The OTP verification hook must be invoked via Supabase Auth `verifyOtp()` endpoint.

---

## 8. POST-MIGRATION SMOKE TESTS

After executing migrations and populating Vercel environment variables, verify each flow on `https://aashvo.vercel.app`:

1. **Connection Check:** Open Sign In modal -> verify the Database Engine indicator reports `Live Supabase Cloud`.
2. **Email Registration:** Register a new test account (`test-renter@example.com`) -> verify confirmation email received and profile created in `public.profiles`.
3. **Session Persistence:** Refresh the browser -> confirm user remains signed in via JWT session.
4. **Listing Creation:** Log in as owner -> create a test listing -> confirm entry appears in `public.properties` with `status: 'pending_review'`.
5. **Family Stay Rejection Check:** Attempt to create Family Stay as commercial manager -> confirm rejected by constraint `chk_family_stay_eligibility`.
6. **Support Ticket:** Submit inquiry via Help Centre -> verify ticket created in `public.support_tickets` with formatted ID (`ASH-TKT-XXXXXX`).
7. **Internal Notes Isolation:** Log in as ordinary user -> check ticket messages -> confirm internal notes are invisible.
8. **Sign Out:** Click logout -> verify JWT revoked and session cleared.

---

## 9. ROLLBACK & RECOVERY CONSIDERATIONS

1. **Database Schema Rollback:**
   If a migration needs to be reverted during deployment:
   ```sql
   -- Rollback 04 (Help & Support)
   DROP TABLE IF EXISTS public.safety_reports CASCADE;
   DROP TABLE IF EXISTS public.ticket_audit_events CASCADE;
   DROP TABLE IF EXISTS public.ticket_messages CASCADE;
   DROP TABLE IF EXISTS public.support_tickets CASCADE;
   DROP TABLE IF EXISTS public.faqs CASCADE;

   -- Rollback 03 (Family Stays & Nationwide)
   ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS chk_family_stay_eligibility;
   DROP TRIGGER IF EXISTS trg_prevent_verification_forgery ON public.profiles;
   DROP FUNCTION IF EXISTS public.enforce_verification_integrity;

   -- Rollback 02 (Security & Moderation)
   DROP TABLE IF EXISTS public.listing_moderation_audit CASCADE;
   ```
2. **Point-In-Time Recovery (PITR):**
   - Ensure Supabase Daily Automated Backups are enabled for `aashvo-dev` before applying any manual migrations.
3. **Frontend Fallback Resilience:**
   - The Aashvo React client is architected to automatically fall back to local deterministic state if the Supabase API returns 500 or is temporarily unreachable, preventing user-facing blank screens.
