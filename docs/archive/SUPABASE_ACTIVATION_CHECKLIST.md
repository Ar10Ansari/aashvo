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

Execute the following 9 migration scripts sequentially in the Supabase Dashboard SQL Editor (or via Supabase CLI `supabase db push` against the Mumbai instance):

| Order | Migration File | Key Tables & Objects Created | Constraints & RLS |
| :---: | :--- | :--- | :--- |
| **01** | `supabase/migrations/20261018000000_initial_schema.sql` | `profiles`, `properties`, `flatmates`, `inquiries`, `listing_reports` | Enables RLS on all tables; public read for active listings, owner-only updates; baseline profile and discovery tables. |
| **02** | `supabase/migrations/20261019000000_security_fixes.sql` | `listing_moderation_audit`, Storage buckets (`property-photos`, `reports`) | Closes cross-user data leakage on inquiries and reports; restricts storage upload MIME-types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and enforces 5 MB limit. |
| **03** | `supabase/migrations/20261020000000_nationwide_auth_and_family_stays.sql` | Columns: `state`, `pincode`, `latitude`, `longitude`, `family_lives_on_property`, `meals_offered`, `email_verified` | Adds `chk_family_stay_eligibility` constraint (resident owner living on property only, transparent meals); installs `trg_prevent_verification_forgery` trigger to block direct REST mutation of `phone_verified` and `email_verified`. |
| **04** | `supabase/migrations/20261021000000_help_and_support_system.sql` | `support_tickets`, `ticket_messages`, `ticket_audit_events`, `safety_reports`, `faqs`, Storage bucket (`support-attachments`) | RLS restricts tickets to user's own tickets (`auth.uid() = user_id OR auth.email() = user_email`); internal notes (`is_internal = TRUE`) strictly concealed from users and only visible to staff (`is_admin()`); private attachments bucket. |
| **05** | `supabase/migrations/20261022000000_auth_profile_trigger_and_insert_policy.sql` | `handle_new_user()` trigger on `auth.users`, `public.profiles` INSERT policy | Installs idempotent profile provisioning upon `auth.users` insert; enables safe RLS self-healing INSERT (`auth.uid() = id`) while preserving `trg_prevent_role_escalation` (strictly `renter`). |
| **06** | `supabase/migrations/20261023000000_rental_agreements_and_tenancy_records.sql` | `tenancy_agreements`, `rent_payment_records`, `property_inspections`, Storage bucket (`rental-documents`) | Private bucket; RLS ensures agreement visibility is strictly restricted to counterparties (landlord & tenant) and admins. Move-in condition log integrity. |
| **07** | `supabase/migrations/20261024000000_rental_reputation_and_disputes.sql` | `tenancy_reviews`, `rental_disputes` | Two-sided verified reviews with `enforce_review_eligibility()` trigger; mediation ledger with unique dispute numbering and evidence URLs. |
| **08** | `supabase/migrations/20261025000000_rental_storage_counterparty_access.sql` | Storage RLS policies on `storage.objects` for `rental-documents` | Scoped counterparty SELECT and INSERT access allowing tenant and landlord to share document proofs within agreement folder. |
| **09** | `supabase/migrations/20261026000000_flatmate_profiles_rls_and_anti_forgery.sql` | `public.flatmate_profiles` least-privilege RLS, `public.public_flatmates` view & anti-forgery trigger | Revokes base-table SELECT from `anon`; base-table SELECT strictly owner/admin; public discovery exclusively through `public.public_flatmates` view (zero phone/email exposure; internal `user_id` shielded); `trg_prevent_flatmate_verification_forgery` blocks client forgery of verification badge; inquiry target constraint. |
| **10** | `supabase/migrations/20261027100000_backend_contract_reconciliation.sql` | Sanitized `public.public_properties` view, property photo aggregation, support attachments, safety-report target metadata, guest support lookup RPC | Aligns client payloads with relational tables; removes public owner IDs from discovery; preserves private support and evidence boundaries. |

---

## 2. RESULTS OF LOCAL MIGRATION TESTING & STATIC VALIDATION

- **Static SQL Syntax Check:** Completed across all 9 migration files. All PostgreSQL statements use idempotent clauses (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`).
- **Trigger Integrity Validation:** `handle_new_user()` handles metadata extraction cleanly (`full_name`, `avatar_url`, `phone_number`). `trg_prevent_verification_forgery` and `trg_prevent_flatmate_verification_forgery` prevent privilege escalation by checking `is_admin()`.
- **Database RLS Authorization Matrix:** Validated across 204 automated Vitest integration tests in `authorizationPolicies.test.ts`, `gotrueTrustBoundaryE2E.test.ts`, `marketplaceBackendE2E.test.ts`, and `rentalTrustE2E.test.ts`.
- **Local Database Environment:** The repository contains 10 ordered migrations. Hosted migration status must be re-verified before execution; remote database state is not inferred from repository files.

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

1. **Rollback Data Loss Risk Analysis:**
   - **Rollback 05 (Zero Data Loss Risk):** Drops only `on_auth_user_created` trigger, `handle_new_user()` function, and `"Users can insert own profile"` RLS policy. No customer rows or profile records are altered or deleted.
   - **Rollback 04 (HIGH RISK OF PERMANENT DATA LOSS):** Executing `DROP TABLE IF EXISTS ... CASCADE` on `support_tickets`, `safety_reports`, or `ticket_messages` will permanently erase all submitted user tickets, chat threads, and moderation audits. Never run Rollback 04 in production without an verified offline PITR snapshot.

2. **Production Disaster Recovery Directive:**
   - **STRICT PROHIBITION:** NEVER execute table-dropping DDL (`DROP TABLE ... CASCADE`) against a production database holding live customer data. Dropping tables destroys customer support records, safety reports, and listing history permanently.
   - **Recommended Incident Procedure:**
     1. Revert the application deployment in Vercel to cease traffic to problematic endpoints.
     2. Apply a forward-only remediation migration (e.g., dropping a problematic trigger or altering a constraint).
     3. For critical data corruption, perform Point-In-Time Recovery (PITR) from the latest automated snapshot.
   - **Staging-Only Table Drops:** The destructive table-dropping scripts below are strictly reserved for developer sandboxes and pre-launch staging resets before live user data exists.

3. **Rollback DDL Scripts:**
   ```sql
   -- Rollback 09 (Flatmate Profiles RLS & Anti-Forgery - SAFE / NON-DESTRUCTIVE)
   DROP TRIGGER IF EXISTS trg_prevent_flatmate_verification_forgery ON public.flatmate_profiles;
   DROP FUNCTION IF EXISTS public.enforce_flatmate_verification_integrity();
   DROP POLICY IF EXISTS "Flatmate profiles are viewable by everyone" ON public.flatmate_profiles;
   DROP POLICY IF EXISTS "Users can insert own flatmate profile" ON public.flatmate_profiles;
   DROP POLICY IF EXISTS "Users can update own flatmate profile" ON public.flatmate_profiles;
   DROP POLICY IF EXISTS "Users can delete own flatmate profile" ON public.flatmate_profiles;
   ALTER TABLE public.interest_requests DROP CONSTRAINT IF EXISTS chk_interest_request_target;

   -- Rollback 08 (Rental Storage Counterparty Access - SAFE / NON-DESTRUCTIVE)
   DROP POLICY IF EXISTS "Rental documents accessible by uploader or agreement parties" ON storage.objects;
   DROP POLICY IF EXISTS "Rental documents uploadable by authenticated user to own folder" ON storage.objects;

   -- Rollback 07 (Reputation & Disputes - STAGING ONLY — DO NOT RUN IN PRODUCTION)
   -- DESTRUCTIVE: Irreversibly deletes reviews and active mediation cases.
   DROP TRIGGER IF EXISTS trg_enforce_review_eligibility ON public.tenancy_reviews;
   DROP FUNCTION IF EXISTS public.enforce_review_eligibility();
   DROP TABLE IF EXISTS public.rental_disputes CASCADE;
   DROP TABLE IF EXISTS public.tenancy_reviews CASCADE;

   -- Rollback 06 (Agreements & Inspections - STAGING ONLY — DO NOT RUN IN PRODUCTION)
   -- DESTRUCTIVE: Irreversibly deletes tenancy contracts, receipts, and condition evidence.
   DROP TABLE IF EXISTS public.property_inspections CASCADE;
   DROP TABLE IF EXISTS public.rent_payment_records CASCADE;
   DROP TABLE IF EXISTS public.tenancy_agreements CASCADE;

   -- Rollback 05 (Profile Trigger & Insert Policy - SAFE / NON-DESTRUCTIVE)
   -- Drops trigger, function, and RLS policy without modifying or deleting any profile data.
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   DROP FUNCTION IF EXISTS public.handle_new_user();
   DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

   -- Rollback 04 (STAGING ONLY — DO NOT RUN IN PRODUCTION)
   -- DESTRUCTIVE: Irreversibly deletes live customer tickets, audit trails, and safety reports.
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
3. **Point-In-Time Recovery (PITR):**
   - Ensure Supabase Daily Automated Backups are enabled for `aashvo-dev` before applying any manual migrations.
4. **Frontend Fallback Resilience:**
   - The Aashvo React client is architected to automatically fall back to local deterministic state if the Supabase API returns 500 or is temporarily unreachable, preventing user-facing blank screens.

---

## 10. GIT AUTHOR IDENTITY & VERCEL DEPLOYMENT TROUBLESHOOTING

### 1. Root Cause: Vercel Deployment Author Verification Block
- **Issue:** Vercel deployment failed or was blocked on commit `b796117` due to author email mismatch.
- **Root Cause:** Git commits were authored under `engineering@aashvo.com`. Vercel's GitHub integration verifies that the commit author email matches a verified email address on the GitHub account (`Ar10Ansari`) connected to the Vercel project. Because `engineering@aashvo.com` was not registered or verified on the connected GitHub account, Vercel blocked the deployment trigger.

### 2. Strict Prohibition on History Rewriting
- **No Force-Push / No Amend:** In production and shared branches (`master`), never run `git commit --amend`, `git rebase`, or `git push --force`. Rewriting commit history disrupts remote tracking, invalidates deployment references, and risks losing verified work.

### 3. Safe Resolution & Verification Procedure
1. **Configure Local Git Author Identity:**
   Ensure the local git configuration uses the email address associated with the verified GitHub account:
   ```bash
   git config user.email "abdul.professional10@gmail.com"
   ```
2. **Verify Email on GitHub:**
   - Log into GitHub as `Ar10Ansari`.
   - Navigate to **GitHub Settings -> Emails** (`https://github.com/settings/emails`).
   - Confirm that `abdul.professional10@gmail.com` is listed with a green **Verified** badge.
   - If not present or unverified, click **Add email address**, enter `abdul.professional10@gmail.com`, and click the verification link sent to your inbox.
   - *(Alternative)*: Add `engineering@aashvo.com` as an additional verified email under the same GitHub account.
3. **Forward-Only Release Deployment & Verification:**
   - All subsequent changes must be committed as new forward-only commits under the verified author identity (`abdul.professional10@gmail.com`).
   - Push cleanly to `origin master`.
   - **Explicit Deployment Confirmation Required:** Verifying the author email satisfies Git author validation, but does **not** guarantee automatic deployment. Project settings, webhooks, or approval workflows may require manual confirmation or triggers.
   - Always inspect the **Vercel Dashboard -> Deployments** tab to verify that the commit triggered a build, passed all checks, and is marked `Ready`. Never assume or claim a commit is deployed until Vercel explicitly confirms deployment success.
