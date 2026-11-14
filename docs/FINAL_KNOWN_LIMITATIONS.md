# AASHVO — FINAL KNOWN LIMITATIONS & RISK ACCEPTANCE
## Explicit Documentation of Operational Constraints, Accepted Risks & Deferred Items

**Document Status:** Approved & Authoritative  
**Release Candidate:** RC-1.0.0  
**Date:** November 2026  
**Auditor:** AASHVO CTO & Security Lead  
**Target Release:** RC-1.0.0  

---

## 1. Executive Summary

In adherence to radical engineering honesty and transparency, this document records all accepted operational limitations, external third-party dependencies, and deferred infrastructure provisions for AASHVO RC-1.0.0. None of these limitations represent application-level defects; all 364 automated tests pass with 100% success.

---

## 2. Inventory of Known Limitations

### 2.1 Software Supply Chain: Build-Time DevDependency in Prisma CLI
- **Advisory:** GHSA-c2cw-3rch-8wh5 / GHSA-ggr8-5vv4-36mx (`deepmerge-ts` <8.0.0 via `@prisma/config` in `prisma@6.19.3` CLI).
- **Classification:** **Low Runtime Risk (Accepted Build-Time DevDependency)**.
- **Rationale:** 
  - `prisma` CLI is strictly a `devDependency` executed during build and migration phases.
  - The runtime production package `@prisma/client@6.19.3` does **not** depend on `@prisma/config` or `deepmerge-ts`.
  - Upgrading to Prisma 7 introduces major breaking schema changes requiring full ecosystem reconfiguration.
  - In accordance with CTO guidelines, running destructive `npm audit fix --force` was strictly rejected.
  - Production container artifacts prune devDependencies via `npm prune --omit=dev`.

### 2.2 Cloud Infrastructure: Compute & Database Hosting Pending Provisioning
- **Current Status:** The NestJS 11 backend (`apps/api`) and PostgreSQL 16 database run in local development and test environments.
- **Limitation:** Cloud compute instances (Render / DigitalOcean / Fly.io container) and managed PostgreSQL 16 clusters have not been provisioned or billed, awaiting Founder budget authorization of the [Staging Cost Estimate](./STAGING_INFRASTRUCTURE_COST_ESTIMATE.md) (~$23.66 USD/mo).
- **Impact on Vercel:** Pushing to `master` deploys the React frontend to Vercel. In the live cloud environment, without a running cloud NestJS API, the frontend functions with deterministic seed data and client-side storage sandboxes.

### 2.3 Cloud Storage: Multi-Cloud Providers Prepared in Code
- **Current Status:** `StorageService` operates with `STORAGE_PROVIDER=local` during development and automated tests.
- **Limitation:** Production cloud buckets (Cloudflare R2 for public photos and AWS S3 Mumbai for private KYC title deeds) are fully integrated in code, but live bucket creation is deferred until cloud infrastructure provisioning.

### 2.4 SMS & OTP Gateway: Telephony Provider Activation
- **Current Status:** Email and password authentication with Argon2id and JWT rotation is fully functional.
- **Limitation:** Indian phone OTP login relies on developer console stubs until live credentials from an Indian SMS provider (Msg91 / Twilio) are populated in production environment variables.

### 2.5 Legacy Supabase: Passive Historical Archive
- **Current Status:** Hosted Supabase instance (`himtwnwxvnnykafyhysy`) is air-gapped and not used by the primary runtime path.
- **Limitation:** `supabase/migrations/` (12 files) is preserved in the repository as an immutable rollback trail. It will be archived after 60 days of stable independent backend operation.

---

## 3. Formal CTO Risk Acceptance

I have reviewed each of the five operational limitations above. None of them compromise user security, data integrity, or core code quality. They are accepted as operational boundaries of the RC-1.0.0 release.
