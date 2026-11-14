# AASHVO — Production & Vercel Backend Verification Report

**Verification Date:** 2026-11-12  
**Target Production URL:** `https://aashvo.vercel.app/`  
**Target Hosted Supabase Project:** `aashvo-dev` (`himtwnwxvnnykafyhysy`, region `ap-south-1` Mumbai)

---

## 1. Live Production Inspection (Read-Only)

An automated read-only inspection of `https://aashvo.vercel.app/` was performed:

- **HTTP Status:** `200 OK` (`Server: Vercel`, region `bom1` Mumbai)
- **HTML & Script Entry:** Served `/assets/index-CdWyZirl.js` (`452,780` bytes)
- **Compiled Supabase URLs in Production Bundle:** **NONE (`0` matches for `https://*.supabase.co`)**
- **Compiled Prototype Flag in Bundle:** `Local Prototype Mode` string present and active when env vars are missing
- **Localhost URLs in Production Bundle:** `False` (no `127.0.0.1:54321` or `localhost:54321` leaked)
- **Service Role Key Exposure Check:** `False` (`service_role` absent from client bundle)
- **Observed Production Response Headers:**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Access-Control-Allow-Origin: *`

### Verdict on Production Connectivity
**NOT CONNECTED / BLOCKED.** Although `https://aashvo.vercel.app/` returns HTTP `200 OK`, the deployed bundle was built without `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, so `isLiveBackendConfigured` is `false` in production and the live site runs in Local Prototype Mode (`localStorage` + seed data).

---

## 2. Hosted Supabase Project Status (`aashvo-dev`)

- **Linked Reference (`supabase/.temp/project-ref`):** `himtwnwxvnnykafyhysy`
- **Pooler Host (`supabase/.temp/pooler-url`):** `aws-0-ap-south-1.pooler.supabase.com:5432`
- **Hosted Schema Verification:** **BLOCKED** in this environment because no `.env.local`, database password, `SUPABASE_ACCESS_TOKEN`, or Supabase MCP credentials are present locally.
- **Note from Repository History (`docs/HOSTED_SUPABASE_MIGRATION_READINESS.md` & `20261027000000`):** Earlier manual preflight runs indicated partial migration state on `aashvo-dev`, motivating `20261027000000_repair_missing_tenancy_agreements.sql` and `20261027100000_backend_contract_reconciliation.sql`. A new non-destructive remediation migration (`20261112000000_audit_remediation_and_rls_fixes.sql`) has been added and must be applied sequentially after verifying current `supabase_migrations.schema_migrations` state.

---

## 3. Exact Steps Required to Activate Live Production (Owner Action Required)

1. **Verify Hosted Database State (Read-Only):**
   - Run `docs/PRODUCTION_PREFLIGHT_READ_ONLY.sql` in the Supabase Dashboard SQL Editor for `aashvo-dev` (`himtwnwxvnnykafyhysy`) and check `supabase_migrations.schema_migrations`.
   - Enable Automated Daily Backups / PITR before applying migrations.
2. **Apply Pending Migrations Safely (Non-Destructive):**
   - Apply any unapplied migrations in chronological order through `supabase/migrations/20261112000000_audit_remediation_and_rls_fixes.sql`.
3. **Configure Supabase Auth Redirects & Providers:**
   - In Supabase Dashboard -> Authentication -> URL Configuration:
     - Set **Site URL:** `https://aashvo.vercel.app`
     - Add **Redirect URLs:** `https://aashvo.vercel.app`, `https://aashvo.vercel.app/**`, and `http://localhost:5173` (dev only).
   - Verify SMTP provider (for signup confirmation and password reset emails) and Google OAuth credentials (if enabled).
4. **Configure Vercel Environment Variables:**
   - In Vercel Project Settings -> Environment Variables (Production & Preview):
     - `VITE_SUPABASE_URL` = `https://himtwnwxvnnykafyhysy.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = `<publishable-anon-key-from-supabase-api-settings>`
     - `VITE_APP_ENV` = `production`
     - `VITE_MARKETPLACE_REGION` = `Pan-India`
   - Never add `SUPABASE_SERVICE_ROLE_KEY` or database passwords with a `VITE_` prefix.
5. **Redeploy & Run Post-Deploy Smoke Verification:**
   - Trigger a clean Vercel production build so Vite embeds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Confirm `"Local Prototype Mode"` no longer appears in the Auth Modal (`Live Supabase Cloud` indicator appears instead), verify signup/login, property listing submission, inquiry submission, support ticket creation/lookup, and RLS isolation with non-sensitive test accounts.

