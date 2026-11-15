# AASHVO CI/CD Pipeline Repair Report

**Date:** 2026-11-15
**Author:** Senior DevOps & Backend Infrastructure Engineer
**Scope:** `.github/workflows/api-ci.yml` & Prisma Client Generation
**Target Environment:** GitHub Actions Ubuntu Runner (`ubuntu-latest`)
**Status:** RESOLVED & LOCALLY VERIFIED

---

## 1. Root Cause Analysis

### 1.1 The Failure Mode
The continuous integration workflow `.github/workflows/api-ci.yml` failed during the automated build and test pipeline with the following Prisma CLI error:

```
apps/api: prisma generate --schema=prisma/schema.prisma
Prisma schema loaded from prisma/schema.prisma
Error: P1012
Environment variable not found: DIRECT_URL.
  -->  schema.prisma:9
   |
 8 |   url       = env("DATABASE_URL")
 9 |   directUrl = env("DIRECT_URL")
   |
Validation Error Count: 1
```

### 1.2 Underlying Root Cause
In `apps/api/prisma/schema.prisma`, the datasource configuration explicitly declares:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

This configuration is essential in production environments where connection pooling (such as PgBouncer or Supabase transaction pooling on port 6543) is used for runtime queries via `DATABASE_URL`, while schema migrations, introspection, and DDL operations require an unpooled, direct connection via `DIRECT_URL` (port 5432).

However, in `.github/workflows/api-ci.yml`:
1. The GitHub Actions job spins up an ephemeral PostgreSQL 16 service container (`postgres:16-alpine`) mapped to port 5432.
2. The pipeline steps configured `DATABASE_URL` selectively on certain steps, but omitted `DIRECT_URL`.
3. In Prisma 6.19.3, when `directUrl = env("DIRECT_URL")` is present in the schema, Prisma validates that `DIRECT_URL` exists in the process environment during schema compilation, `prisma validate`, `prisma generate`, and `prisma migrate deploy`.
4. Because `DIRECT_URL` was undefined in the environment, the CLI aborted with code `P1012`.

---

## 2. Comprehensive Repair Implementation

### 2.1 Job-Level Environment Binding
Rather than patching environment variables piecemeal across individual steps, both `DATABASE_URL` and `DIRECT_URL` are now bound at the top of the `build-and-test` job in `.github/workflows/api-ci.yml`.

Because the GitHub Actions PostgreSQL container is a single unpooled database instance running locally inside the runner network, both pooled and direct connection strings point to the same isolated test container:

```yaml
jobs:
  build-and-test:
    name: Build, Lint & Integration Tests (PostgreSQL)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    # Job-level environment variables guaranteeing both Prisma connection strings
    # are universally available across all build, validation, migration and test steps.
    env:
      NODE_ENV: test
      CI: 'true'
      DATABASE_URL: postgresql://ci_user:ci_local_password_only@localhost:5432/aashvo_test
      DIRECT_URL: postgresql://ci_user:ci_local_password_only@localhost:5432/aashvo_test
```

### 2.2 Schema Validation Pre-Flight Step
To prevent runtime and deployment surprises, an explicit schema validation step was introduced into the workflow before Prisma Client generation:

```yaml
      - name: Validate Prisma schema
        run: npm --workspace=apps/api run prisma:validate
```

This ensures any syntax, relation, or attribute discrepancies in `apps/api/prisma/schema.prisma` fail immediately with actionable diagnostics before the build proceeds.

### 2.3 Elimination of Redundant Step Overrides
All ad-hoc, duplicate step-level `DATABASE_URL` overrides were removed from the Prisma migration and test steps, enforcing a single source of truth for the CI runner environment.

---

## 3. Local Verification & Pipeline Parity

The full CI pipeline commands were executed locally against an isolated PostgreSQL instance matching the CI service container:

| Pipeline Stage | Command | Result |
|---|---|---|
| Contracts Build | `npm run contracts:build` | **PASS** (Dual CJS/ESM compilation successful) |
| Prisma Schema Validation | `npm --workspace=apps/api run prisma:validate` | **PASS** (`The schema at prisma/schema.prisma is valid 🚀`) |
| Prisma Client Generation | `npm --workspace=apps/api run prisma:generate` | **PASS** (Prisma Client v6.19.3 generated in 277ms) |
| API TypeScript Typecheck | `npm --workspace=apps/api run typecheck` | **PASS** (0 errors) |
| API NestJS Build | `npm --workspace=apps/api run build` | **PASS** (`dist/` packaged cleanly) |
| Security Integration Suite | `npm --workspace=apps/api test -- test/security-authorization.postgres.integration.spec.ts` | **PASS** (28/28 tests passed) |
| Connect Matching Suite | `npm --workspace=apps/api test -- test/connect.postgres.integration.spec.ts` | **PASS** (26/26 tests passed) |

---

## 4. Production Security Assessment
- **Zero Secret Exposure:** The credentials configured in `.github/workflows/api-ci.yml` (`ci_user`, `ci_local_password_only`) are strictly scoped to the ephemeral CI container running on `localhost:5432`. No production passwords, Supabase keys, or cryptographic secrets exist in the workflow.
- **Reproducibility:** The job runs in deterministic lockfile-pinned conditions (`npm ci`), preventing dependency drift between local development and CI runners.
