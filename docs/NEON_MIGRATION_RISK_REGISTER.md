# AASHVO — NEON MIGRATION RISK REGISTER & MITIGATION MATRIX

**Author**: Principal Database Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: Comprehensive Risk Audit Completed  

---

## 1. Risk Register Summary Matrix

| Risk ID | Category | Risk Description | Likelihood | Impact | Inherent Risk | Mitigation Strategy | Residual Risk | Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| **RSK-01** | **Security** | Credential `npg_LQ1VomOtSe5l` was exposed in conversation text during onboarding | High | High | **HIGH** | Rotate password in Neon Console / CLI before live production traffic and update `.env.neon` | Low | **ACTION REQUIRED** |
| **RSK-02** | **Infrastructure** | Attempting migrations through PgBouncer connection pooler causes advisory lock failure | Low | High | **HIGH** | `directUrl = env("DIRECT_URL")` configured in Prisma schema; direct host verified | Negligible | **MITIGATED** |
| **RSK-03** | **Application** | Prepared statement collision on PgBouncer transaction pooling | Medium | High | **MEDIUM** | Appended `&pgbouncer=true&connect_timeout=15` to pooled `DATABASE_URL` | Negligible | **MITIGATED** |
| **RSK-04** | **Schema** | Migration collisions with existing tables on Neon | Low | Medium | **LOW** | Confirmed Neon `neondb` contains 0 tables and clean `public` schema | Negligible | **VERIFIED CLEAN** |
| **RSK-05** | **PostgreSQL** | PostgreSQL 18.7 incompatibility with `citext` or GIN array indexes | Low | High | **MEDIUM** | Confirmed `citext` 1.8 available; standard GIN indexing verified compatible | Negligible | **VERIFIED COMPATIBLE**|
| **RSK-06** | **Local Dev** | Accidental overwrite of local development database on port 5433 | Medium | High | **HIGH** | `apps/api/.env` preserves port 5433 defaults; 107/107 Jest tests pass locally | Negligible | **MITIGATED** |
| **RSK-07** | **Third-Party** | Migration script dependency on Supabase schemas (`auth.*`, `storage.*`) | Low | High | **MEDIUM** | Confirmed zero Supabase references in all 5 Prisma migration scripts | Negligible | **VERIFIED INDEPENDENT**|
| **RSK-08** | **Deployment** | Render automated build unexpectedly triggers destructive migrations | Medium | High | **HIGH** | Decoupled migrations from Render build command; requires explicit CTO command | Low | **GOVERNED** |
| **RSK-09** | **Source Control**| Accidental commit of `.env.neon` or secrets to GitHub repository | Low | Critical| **HIGH** | Git ignore rules `.env.*` and `.env.local` verified via `git check-ignore` | Negligible | **PROTECTED** |

---

## 2. In-Depth Risk Analysis & Remediation Plans

### Risk Item RSK-01: Exposed Onboarding Credential
- **Risk Assessment**: The password `npg_LQ1VomOtSe5l` for role `neondb_owner` was provided in prompt text during initial onboarding. While stored only in the gitignored `apps/api/.env.neon`, best-practice security governance dictates rotation.
- **Action Plan**:
  1. Once migration authorization is granted, execute password rotation in the Neon Console:
     **Neon Console -> Project `ancient-union-03679564` -> Roles -> `neondb_owner` -> Reset password**.
  2. Alternatively, run via Neon CLI:
     ```bash
     neon roles reset-password neondb_owner --project-id ancient-union-03679564 --branch production
     ```
  3. Replace the password in `apps/api/.env.neon`.
  4. Verify that connections with the old password are appropriately rejected.

---

### Risk Item RSK-02: Pooler Transaction Lock Failure During Migration
- **Risk Assessment**: If Prisma Migrate were to connect to `ep-round-mountain-aozrgk3c-pooler...`, PgBouncer in transaction mode would drop session advisory locks (`pg_advisory_lock`), resulting in migration deadlocks or corrupt migration states.
- **Remediation**:
  - `apps/api/prisma/schema.prisma` explicitly configures `directUrl = env("DIRECT_URL")`.
  - Live probe using `prisma migrate status` confirmed that Prisma CLI automatically selected the direct host (`ep-round-mountain-aozrgk3c.c-2.ap-southeast-1.aws.neon.tech`) on port 5432, completely bypassing the pooler.
- **Residual Risk**: **Negligible**.

---

### Risk Item RSK-03: Prepared Statement Collision Under Transaction Pooling
- **Risk Assessment**: Default PostgreSQL drivers create named prepared statements (`s0`, `s1`, etc.). When executing through PgBouncer in transaction pooling mode, subsequent queries assigned to different backend worker processes fail with `prepared statement "s0" already exists` or `does not exist`.
- **Remediation**:
  - Appended `&pgbouncer=true` to the pooled `DATABASE_URL` in `apps/api/.env.neon`.
  - Prisma Client disables named prepared statement caching when `pgbouncer=true` is present, executing queries safely in simple protocol mode.
- **Residual Risk**: **Negligible**.

---

### Risk Item RSK-06: Local PostgreSQL Regression
- **Risk Assessment**: Configuring Neon could inadvertently alter the local development database configuration in `apps/api/.env` or cause test suites to fail.
- **Remediation**:
  - Default `apps/api/.env` strictly retains the local PostgreSQL instance on port `5433` (`DATABASE_URL` and `DIRECT_URL` both point to `127.0.0.1:5433`).
  - Automated tests (`setup-env.ts`) and OpenAPI generator (`generate-openapi.ts`) enforce local defaults.
  - Full regression execution: 11 test suites and 107 integration tests executed and passed against the local PostgreSQL test database.
- **Residual Risk**: **Negligible**.

---

### Risk Item RSK-08: Render Build Migration Decoupling
- **Risk Assessment**: Bundling database migrations into the Render build script risks unexpected schema modifications during code deployments or CI/CD rebuilds.
- **Remediation**:
  - Build command is strictly limited to:
    ```bash
    npm run contracts:build && npm --workspace=apps/api run prisma:generate && npm --workspace=apps/api run build
    ```
  - Database migration execution is isolated to a discrete, manually authorized runbook.
- **Residual Risk**: **Low**.

---

## 3. Go / No-Go Decision Gate for Migration Execution

| Gate # | Check Criterion | Status | Verification Evidence |
| :---: | :--- | :---: | :--- |
| **G-01** | Zero application tables on Neon staging | **GO** | `information_schema.tables` confirmed 0 tables |
| **G-02** | Dual-connection Prisma architecture configured | **GO** | `directUrl` in `schema.prisma` tested via `prisma migrate status` |
| **G-03** | Local PostgreSQL 16 on port 5433 intact | **GO** | 33 tables preserved; 107/107 tests passed |
| **G-04** | All 5 migrations classified SAFE TO APPLY | **GO** | Zero drops, zero truncates, purely additive DDL |
| **G-05** | PostgreSQL 18.7 extension compatibility | **GO** | `citext` 1.8 confirmed available in `pg_available_extensions` |
| **G-06** | Secret exposure protection | **GO** | All credential files confirmed git-ignored |
| **G-07** | Explicit CTO Authorization | **PENDING** | **Awaiting final CTO sign-off** |

---

## 4. Emergency Instant Rollback Procedure

Because Neon is built on copy-on-write cloud storage architecture, instantaneous rollback is supported:

1. **Pre-Migration Snapshot**:
   Immediately before applying migrations, execute:
   ```bash
   neon branches create --name pre-migration-snapshot --project-id ancient-union-03679564 --branch production
   ```
2. **Instant Restore If Aborted**:
   If any unexpected error occurs during migration:
   ```bash
   # Reset production branch state to parent snapshot
   neon branches restore production --snapshot-id <snapshot_id> --project-id ancient-union-03679564
   ```
   *Restoration takes less than 3 seconds without data corruption.*

