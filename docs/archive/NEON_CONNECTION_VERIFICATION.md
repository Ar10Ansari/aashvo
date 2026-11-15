# AASHVO — NEON CONNECTION VERIFICATION REPORT

**Author**: Principal Full-Stack & Database Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: Verification Passed — Strictly Read-Only  

---

## 1. Executive Summary

A comprehensive, non-destructive connection verification was performed for the Neon PostgreSQL project linked to AASHVO. Both the runtime pooled connection and the direct migration connection were tested using Prisma Client (`v6.19.3`).

- **Neon Pooled Connection (`DATABASE_URL`)**: **VERIFIED** (767 ms latency, PgBouncer transaction mode compatible).
- **Neon Direct Connection (`DIRECT_URL`)**: **VERIFIED** (568 ms latency, direct unpooled endpoint).
- **SSL / TLS Enforcement**: **VERIFIED** (Unencrypted connections are rejected by Neon edge).
- **Database Slate**: Clean unmigrated database (0 tables in `public` schema).
- **Local PostgreSQL (Port 5433)**: **VERIFIED INTACT** (43 ms latency, 33 tables preserved, 107/107 Jest tests passed).
- **Hosted Supabase**: **UNTOUCHED** (Zero modifications).
- **Zero Secrets Committed**: All credentials remain confined to local gitignored files (`apps/api/.env.neon`).

---

## 2. Neon Database Identity & Topology

| Property | Verified Value | Notes |
| :--- | :--- | :--- |
| **Project ID** | `ancient-union-03679564` | Verified via Neon CLI and endpoint routing |
| **Project Name** | `my-first-project` | Default project linked in org `org-raspy-violet-50288785` |
| **Branch** | `production` (`br-divine-dawn-aoc3e3iw`) | Active state: `ready` |
| **Compute Endpoint** | `ep-round-mountain-aozrgk3c` | Type: `read_write`, State: `active` |
| **Autoscaling** | 0.25 CU min, 2 CU max | Scale-to-zero enabled |
| **Region** | AWS Singapore (`ap-southeast-1`) | Host: `...ap-southeast-1.aws.neon.tech` |
| **Engine Version** | `PostgreSQL 18.7 (a21afb5)` | aarch64-unknown-linux-gnu |
| **Database Name** | `neondb` | Verified via `current_database()` |
| **Database Role** | `neondb_owner` | Verified via `current_user` and `session_user` |
| **Existing Schemas** | `public` | Verified via `information_schema.schemata` |
| **Existing Tables** | `0` | Clean slate; no migrations applied yet |

---

## 3. Connection Verification Details

### A. Pooled Runtime Connection (`DATABASE_URL`)
- **Target Host**: `ep-round-mountain-aozrgk3c-pooler.c-2.ap-southeast-1.aws.neon.tech`
- **Target Port**: `5432`
- **Target Database**: `neondb`
- **Query Mode**: `PrismaClient.$connect()` + `PrismaClient.$queryRawUnsafe()`
- **Parameters**: `sslmode=require&channel_binding=require&pgbouncer=true&connect_timeout=15`
- **Connection Latency**: **767 ms**
- **Read-Only Probe**: `SELECT version(), current_database(), current_user` executed successfully.
- **Compatibility**: Transaction-mode pooling verified with `pgbouncer=true`.

### B. Direct Migration Connection (`DIRECT_URL`)
- **Target Host**: `ep-round-mountain-aozrgk3c.c-2.ap-southeast-1.aws.neon.tech`
- **Target Port**: `5432`
- **Target Database**: `neondb`
- **Query Mode**: `PrismaClient.$connect()` + `PrismaClient.$queryRawUnsafe()`
- **Parameters**: `sslmode=require&channel_binding=require`
- **Connection Latency**: **568 ms**
- **Read-Only Probe**: `SELECT version(), current_database(), current_user` executed successfully.
- **Compatibility**: Direct TCP connection to compute node without PgBouncer intermediate, supporting transactional DDL and PostgreSQL advisory locks for future migrations.

---

## 4. SSL / Transport Security Verification

- **Enforcement Check**: Attempted connection with `sslmode=disable`.
- **Result**: Neon edge rejected the unencrypted connection immediately (`User was denied access on the database`).
- **Confirmation**: All network traffic between client applications and Neon is strictly encrypted via TLS with channel binding required.

---

## 5. Local Database Regression Verification

To guarantee that the introduction of Neon configuration did not break existing local development:

1. **Direct Connection Check to Local Database (Port 5433)**:
   - Host: `127.0.0.1:5433`
   - Database: `aashvo_test`
   - Version: `PostgreSQL 16.16`
   - Latency: **43 ms**
   - Tables Preserved: **33 tables** (including `_prisma_migrations`, `users`, `properties`, `tenancy_agreements`, etc.)
2. **Backend Jest Test Suite**:
   - `npm --prefix apps/api test`
   - **11 test suites passed, 107 tests passed** (100% pass rate).
3. **Frontend Vitest Test Suite**:
   - `npm run test`
   - **23 test files passed, 257 tests passed** (100% pass rate).

---

## 6. Security & Credential Audit

- **Git Status**:
  - `apps/api/.env.neon`: Confirmed gitignored by `apps/api/.gitignore:5:.env.*`.
  - `.env.local`: Confirmed gitignored by `.gitignore:77:.env.local`.
  - `git ls-files --stage -- "*.env*"`: Confirmed only template files (`.env.example`) are in the Git tree.
- **Zero Credential Exposure**: No connection strings, passwords, or tokens were printed to terminal outputs or committed to source control.
- **Hosted Supabase**: Untouched. No configuration, keys, or endpoints altered.
- **Frontend Isolation**: No database connection strings or secrets exist in frontend environment files or client bundles.

---

## 7. Remaining Blockers & Next Actions

- **Blockers**: **None.** Both pooled and direct connection channels are verified, functional, secure, and isolated.
- **Next Controlled Step**: Awaiting explicit CTO authorization before executing Prisma migrations against the verified Neon `production` branch.

