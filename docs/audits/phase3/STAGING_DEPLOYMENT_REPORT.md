# AASHVO CTO — Staging Deployment Report

**Author:** AASHVO CTO, DevOps Lead & Release Engineer  
**Date:** November 24, 2026  
**Candidate Branch:** `staging/mvp-fasttrack-candidate`  
**Candidate HEAD:** `ccfe38a5372be8ba6833d3927567055b817d79e8`  
**Environment Target:** Isolated Staging Environment  
**Verdict:** **READY WITH CONDITIONS**

---

## 1. Executive Summary

This report documents the staging deployment audit and execution for AASHVO under the Phase 3 Controlled Staging Deployment mandate.

The frontend candidate has been deployed to an isolated Vercel staging preview environment. We independently verified deployment status, bypassed Vercel SSO protection via an automation secret, and executed automated browser smoke tests with a **100% pass rate (4/4 passed in 9.0s)**.

In addition, an in-depth audit of the backend API, database topology, and cross-origin security architecture was conducted to evaluate readiness for stakeholder User Acceptance Testing (UAT).

---

## 2. Preflight & Git Status Verification

- **Repository Workspace:** `D:\Projects\AASHVO`
- **Current Branch:** `staging/mvp-fasttrack-candidate`
- **Exact HEAD Commit:** `ccfe38a5372be8ba6833d3927567055b817d79e8`
- **Remote Synchronization:** Up to date with `origin/staging/mvp-fasttrack-candidate`.
- **Working Tree:** Clean (all Phase 2 changes committed and pushed).
- **Branch Isolation:** Master and production branches untouched; no pull requests merged prematurely.

---

## 3. Infrastructure Readiness Audit

### A. Staging Vercel Frontend Deployment
- **Deployment URL:** `https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app`
- **Branch Preview Alias:** `https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app`
- **Deployment Status:** `● Ready` (Built with Vite on Node.js 24.x, duration 27s).
- **Deployment Protection:** Vercel Authentication / SSO protection is active (`all_except_custom_domains`).
- **Protection Bypass for Automation:**
  - Configured and verified using project automation secret.
  - Stakeholders and test runners access the deployment via query parameter:
    `?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<AUTOMATION_SECRET>`
    or header `x-vercel-protection-bypass`.

### B. Staging Render/NestJS API Audit
- **Production Reference API:** `https://aashvo-api.onrender.com`
  - Health check (`/api/v1/health/live`): **200 OK** (`{"status":"ok","service":"aashvo-api","version":"1.0.0","environment":"production"}`)
  - Readiness check (`/api/v1/health/ready`): **200 OK** (`{"status":"ready","database":{"status":"up","latencyMs":1555}}`)
- **Staging API Status:**
  - Render currently operates a single web service tied to `master`.
  - In strict compliance with CTO Directive Section 5 (*"Do not deploy to production. Do not modify DNS. Do not create paid infrastructure without approval"*), the production service was **NOT** overwritten with staging code.
  - A dedicated staging web service (`aashvo-api-staging`) must be provisioned on Render under the approved staging configuration plan.

### C. Discovered Cross-Origin & Environment Variable Gap
During bundle inspection of the deployed preview frontend, an environment variable configuration gap was identified:
1. **Frontend API Target:**
   - In Vercel Project Settings, `VITE_API_BASE_URL` was defined only for the `Production` environment.
   - For `Preview` deployments, `VITE_API_BASE_URL` was undefined at build time, causing the compiled bundle `apiClient.getBaseUrl()` to fall back to `/api/v1`.
   - On Vercel, requests to `/api/v1` are rewritten by `vercel.json` SPA rules to `index.html`.
2. **CORS & CSRF Origin Enforcement:**
   - On the backend, `CORS_ALLOWED_ORIGINS` is strictly locked to `https://aashvo.vercel.app`.
   - The NestJS controller method `assertCookieOriginAllowed` rejects cross-origin cookie requests from untrusted origins with `403 Forbidden` (`Cross-origin cookie request denied.`).
   - Consequently, the preview frontend cannot communicate with the production API, which correctly protects production database state from non-production origins.

**Remediation Required for Full UAT Integration:**
- Provision `aashvo-api-staging.onrender.com`.
- Add `VITE_API_BASE_URL=https://aashvo-api-staging.onrender.com` to Vercel's `Preview` environment variables.
- Add the Vercel preview domain to `CORS_ALLOWED_ORIGINS` on the staging Render service.

---

## 4. Post-Deployment Browser Smoke Test Results

We executed automated Playwright smoke tests against the live deployed Vercel staging preview (`https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app`):

| Test Case | Description | Duration | Status |
| :--- | :--- | :---: | :---: |
| **Smoke 01** | Preview Homepage renders brand, title, and initial DOM correctly | 923 ms | **PASSED** |
| **Smoke 02** | Discovery Section category tabs (Flatmates, Family Stays, Entire Flats) and search controls mount | 788 ms | **PASSED** |
| **Smoke 03** | Modal dialogs (Auth Modal with 'Welcome Back', Saved Listings) render smoothly | 1.3 s | **PASSED** |
| **Smoke 04** | Mobile responsive view on iPhone 14 (390x844) with zero overflow and functioning navigation drawer | 816 ms | **PASSED** |
| **Total** | **All 4 Smoke Tests** | **9.0 s** | **4 / 4 PASSED** |

---

## 5. Deployment Verification Verdict

**FINAL VERDICT: READY WITH CONDITIONS**

- **Completed:**
  - Candidate HEAD `ccfe38a` pushed and deployed to Vercel staging preview.
  - Vercel SSO protection bypassed cleanly via verified automation tokens.
  - 100% of live browser smoke tests passed against the deployed preview domain.
  - Zero changes to production DNS or master branch.
- **Conditions for Stakeholder UAT:**
  1. Provision dedicated Render staging service (`aashvo-api-staging`).
  2. Set `VITE_API_BASE_URL` in Vercel Preview environment.
  3. Provision staging Supabase database and execute pending migrations.
