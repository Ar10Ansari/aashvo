# AASHVO MVP Release — Executive Report
**Release Version:** RC-1.0.0 (MVP Release Sprint)  
**Date:** November 15, 2026  
**Status:** **RELEASE-READY (Contingent on Database Credential Selection)**  
**Target Environments:**
- **Frontend:** Vercel Hobby (Free Tier) — `https://aashvo.vercel.app`
- **Backend API:** Render Web Service (Free Tier) — `aashvo-api` (`https://aashvo-api.onrender.com`)
- **Primary Database Option:** Supabase `aashvo-dev` (Mumbai `ap-south-1`)
- **Staging / Fallback Database Option:** Neon `ancient-union-03679564` (AWS Singapore `ap-southeast-1`)

---

## 1. Executive Summary

AASHVO has completed a full end-to-end engineering verification and release hardening sprint for tonight's MVP launch. All internal application code, contracts, build pipelines, and automated test suites have achieved a **100% pass rate** across both frontend and backend architectures:

- **10 of 10 Quality Gates Passed** (Zero test failures, zero type errors, zero contract mismatches).
- **107 of 107 Backend Tests Passed** across 11 integration suites against PostgreSQL.
- **257 of 257 Frontend Tests Passed** across 23 test suites.
- **Production Build Artifacts Validated** for both Vite client and NestJS API.
- **Render Infrastructure-as-Code (`render.yaml`)** configured and verified for zero-cost deployment.

### Release Readiness Verdict: **GO (Ready for Instant Deployment)**
- **Code & Test Suite:** 100% verified.
- **Neon Staging Database:** 100% migrated (33 tables, 38 enums, 406 constraints active and verified).
- **Supabase Production Database:** Blocked solely on input of the database password for project `himtwnwxvnnykafyhysy`. All migration scripts and transition plans are pre-audited and staged.

---

## 2. Infrastructure & Cost Architecture (100% Free-Tier)

In accordance with strict budget constraints, the production architecture operates entirely on zero-cost tiers:

| Component | Platform | Plan | Region | SLA / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Hobby (Free) | Global Edge | Fast CDN, automatic git deploys on `master`. |
| **Backend API** | Render | Free Web Service | Singapore (`singapore`) | 512 MB RAM, 0.1 CPU, spins down after 15m idle. |
| **Database (Opt 1)** | Supabase | Free Tier | Mumbai (`ap-south-1`) | 500 MB storage, PgBouncer pooler port 6543, direct 5432. |
| **Database (Opt 2)** | Neon | Free Tier | Singapore (`ap-southeast-1`) | 0.5 GB storage, serverless autoscaling, active & verified. |

---

## 3. High-Level Quality Gate Results

| # | Quality Gate | Command | Result | Exit Code |
| :---: | :--- | :--- | :---: | :---: |
| 1 | Contracts Build | `npm run contracts:build` | **PASS** | `0` |
| 2 | Prisma Schema Validation | `npm --prefix apps/api run prisma:validate` | **PASS** | `0` |
| 3 | Prisma Client Generation | `npm --prefix apps/api run prisma:generate` | **PASS** | `0` |
| 4 | Backend TypeScript Typecheck | `npm --prefix apps/api run typecheck` | **PASS** | `0` |
| 5 | Frontend TypeScript Typecheck | `npm run typecheck` | **PASS** | `0` |
| 6 | Backend Integration Suite | `npm --prefix apps/api test` (11 suites, 107 tests) | **PASS** | `0` |
| 7 | Frontend Vitest Suite | `npm run test` (23 files, 257 tests) | **PASS** | `0` |
| 8 | OpenAPI Spec Generation | `npm --prefix apps/api run openapi:generate` | **PASS** | `0` |
| 9 | Frontend Production Build | `npm run build` (Vite) | **PASS** | `0` |
| 10 | Backend Production Build | `npm --workspace=apps/api run build` (NestJS) | **PASS** | `0` |

---

## 4. Key Deployment Pathways for Tonight

To launch the MVP tonight, the founder/CTO can choose between two clear paths:

### Path A: Supabase Primary (Recommended by Directive)
1. Provide the database password for Supabase project `himtwnwxvnnykafyhysy` in local `.env.supabase`.
2. Run `npm --prefix apps/api run prisma:migrate:deploy` with `.env.supabase`.
3. Set the pooled `DATABASE_URL` (port 6543) and direct `DIRECT_URL` (port 5432) in Render environment variables.
4. Set `VITE_API_BASE_URL=https://aashvo-api.onrender.com/api/v1` in Vercel.

### Path B: Neon Staging Instant Launch (Zero Wait)
1. Neon staging is **already 100% migrated and active** with all 33 tables.
2. Configure Render environment variables directly with the existing Neon pooled and direct connection strings.
3. Set `VITE_API_BASE_URL=https://aashvo-api.onrender.com/api/v1` in Vercel.
4. Transition to Supabase later without downtime using the prepared transition plan.

---

## 5. Security & Operational Posture

1. **Credential Hygiene:** Zero secrets, raw passwords, or connection strings are tracked in git. All `.env*` files are strictly ignored.
2. **Asymmetric Authentication:** RS256 JWT keypair validation ensures decoupled authentication; token private keys never leave backend memory.
3. **CORS & Origin Isolation:** Configured to strictly accept requests from `https://aashvo.vercel.app` with credentials enabled.
4. **Health Probes:** Liveness probe `/api/v1/health/live` operates without database dependency (ideal for Render spin-up checks), while readiness probe `/api/v1/health/ready` validates active database connectivity.

