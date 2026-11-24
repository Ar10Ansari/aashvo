# AASHVO — ENVIRONMENT ISOLATION & DATA SECURITY POLICY

**Author:** AASHVO Senior Backend Engineer & Security Auditor  
**Date:** November 24, 2026  
**Status:** Enforced  

---

## 1. Principles of Environment Isolation

AASHVO strictly isolates environments to ensure that developer workflows, automated test suites, staging acceptance runs, and production customer traffic never overlap.

```
+----------------------------------------------------------------------------------------------------+
| ENVIRONMENT ISOLATION MATRIX                                                                       |
+-------------------+-----------------------+-----------------------------+--------------------------+
| Dimension         | Local Development     | Staging                     | Production               |
+-------------------+-----------------------+-----------------------------+--------------------------+
| Database Target   | 127.0.0.1:5433 (Local)| Neon: aashvo_staging        | Hosted Supabase / PG RDS |
| Database Region   | Localhost             | AWS Singapore (ap-se-1)     | AWS Mumbai (ap-south-1)  |
| Frontend Host     | localhost:5173        | Vercel Preview Deployment   | aashvo.com               |
| Backend Host      | localhost:4000        | aashvo-api-staging (Render) | aashvo-api (Render)      |
| Cloud Storage     | Local Disk (scratch/) | Local Disk / Staging Buckets| Cloudflare R2 / AWS S3   |
| JWT Keys          | Ephemeral RSA Dev Keys| Dedicated Staging RSA Keys  | Production HSM / KMS RSA |
| Test Data Allowed | Synthetic Only        | Synthetic Only              | Real Customer Data       |
+-------------------+-----------------------+-----------------------------+--------------------------+
```

---

## 2. Hard Isolation Guardrails

### A. Zero Production Cross-Contamination
- **Host Validation:** Automated test suites reject any database connection whose hostname contains `supabase.co` or production indicators when running in staging or development mode.
- **Database Name Enforcement:** Staging database must strictly match `aashvo_staging`. Any attempt to connect to `/postgres`, `/aashvo_prod`, or unverified databases aborts immediately.
- **No Real Customer Data in Staging:** Only synthetic test accounts (`@aashvo.test`) and generated mock listings are permitted in the staging database.

### B. Credential Management & Zero Secret Commits
- Both root `.gitignore` and `apps/api/.gitignore` enforce the exclusion of `.env*` files:
  ```gitignore
  .env
  .env.*
  !.env.example
  !.env*.example
  ```
- All secret environment variables in templates (`.env.example`, `.env.neon.example`, `render.staging.yaml`) use safe placeholders (`REPLACE_WITH_*` or `sync: false`).

---

## 3. Render Web Service Isolation

The repository maintains strict separation of infrastructure blueprints:
- **[render.yaml](file:///d:/Projects/AASHVO/render.yaml):** Dedicated exclusively to the production service `aashvo-api`.
- **[render.staging.yaml](file:///d:/Projects/AASHVO/render.staging.yaml):** Dedicated exclusively to the staging service `aashvo-api-staging`.

Production configurations, scaling limits, and environment variables are never modified during staging development.
