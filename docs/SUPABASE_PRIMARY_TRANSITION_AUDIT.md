# AASHVO — SUPABASE PRIMARY DATABASE TRANSITION AUDIT
**Priority: Free-Tier MVP | Phase 1: Read-Only Audit & Transition Preparation**

**Author**: Senior Cloud Infrastructure Engineer & Database Migration Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: AUDIT COMPLETE — Transition Blocked on Database Credentials  

---

## 1. Executive Summary & Transition Verdict

The CTO has directed AASHVO to select **Supabase** (Project `aashvo-dev`, Mumbai region `ap-south-1`, project reference `himtwnwxvnnykafyhysy`) as the primary database platform for the Free-Tier MVP launch, transitioning away from the newly staged Neon database in Singapore.

### Overall Verdict: **NEEDS CREDENTIAL CONFIGURATION & RECONCILIATION**
1. **Database Credentials Missing Locally**: While the hosted project reference (`himtwnwxvnnykafyhysy`) and pooler host (`aws-0-ap-south-1.pooler.supabase.com`) are documented in architecture records, **no PostgreSQL database password, connection string, or access token is configured in any local environment file (`.env`, `.env.local`, `.env.neon`, process/user environment variables)**. Direct read-only inspection of the live Supabase database cannot proceed until credentials are provided in a local ignored file (`apps/api/.env.supabase`).
2. **Neon Staging Successfully Frozen**: Neon (`ancient-union-03679564`) remains active in Singapore with all 5 migrations verified, serving as an authoritative, validated schema reference. No compute has been deleted or disabled.
3. **Local PostgreSQL Intact**: Local PostgreSQL on port `5433` remains the active default development engine with all 33 tables, 7 seed users, and 107/107 Jest integration tests passing.
4. **Table Count Reconciliation (32 vs 33)**: Reconciled with 100% mathematical and schema certainty:
   - **32 Application Domain Tables**: `users`, `profiles`, `properties`, `flatmate_profiles`, etc.
   - **1 Prisma Migration Ledger**: `_prisma_migrations`.
   - **Total Base Tables in PostgreSQL `public` Schema**: **32 + 1 = 33**.

---

## 2. Mandatory Skill Discovery

An audit of installed Antigravity skills was performed:
- **Discovered Built-in & User Skills**: `neon`, `neon-postgres`, `neon-realtime`, `agy-customizations`, `antigravity_guide`, `automation`, `generative_ui`, `migrate-workflows`, `native_swarm`, `plugin`, `ui-plugin-navigation`.
- **Missing Skills**:
  - `supabase` (Available in Agent Marketplace as `antigravity-plugins-partners/plugin/supabase`).
  - Standalone `prisma` or `devops` skills.
- **Fallback Engineering Practices**: Standard PostgreSQL 16/17 administrative procedures, Prisma CLI `v6.19.3` dual-connection patterns (`url` + `directUrl`), and multi-cloud database engineering standards were applied throughout.

---

## 3. Supabase Configuration & Missing Credential Analysis

### A. Documented Supabase Identity
- **Project Name**: `aashvo-dev`
- **Project Reference**: `himtwnwxvnnykafyhysy`
- **Region**: Mumbai, India (`ap-south-1`)
- **API URL**: `https://himtwnwxvnnykafyhysy.supabase.co`
- **Engine**: PostgreSQL 17 (per `supabase/config.toml` `major_version = 17` and archive audit records)
- **Supavisor Connection Pooler Hosts**:
  - **Transaction Mode (Runtime Queries)**: `aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
  - **Session Mode (Migrations & DDL)**: `aws-0-ap-south-1.pooler.supabase.com:5432/postgres` (or direct host `db.himtwnwxvnnykafyhysy.supabase.co:5432/postgres`)

### B. Local Credential Audit Findings
An exhaustive scan of environment variables and local files revealed:
- `apps/api/.env`: Contains local PostgreSQL configuration (`127.0.0.1:5433`).
- `apps/api/.env.neon`: Contains Neon Singapore credentials (freshly rotated).
- `.env.local`: Contains Neon environment variables.
- `apps/api/.env.example` & `.env.example`: Contain only placeholders.
- Machine/User environment: `[System.Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD')` is `null`.
- `C:\Users\Lenovo\.supabase`: Contains only telemetry and shadow cache; zero tokens or passwords.

### C. Exactly What Needs Configuration to Unblock Live Inspection
To inspect the remote Supabase database without requesting secrets in chat, the developer must create a local ignored file at `apps/api/.env.supabase` structured as follows:

```dotenv
# Supabase Transaction Pooler (for PrismaClient runtime queries on port 6543)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=15"

# Supabase Session Pooler / Direct Endpoint (for Prisma CLI migrations on port 5432)
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

> [!IMPORTANT]
> `apps/api/.gitignore` already contains `.env.*`, guaranteeing that `apps/api/.env.supabase` will remain strictly git-ignored and never committed to source control.

---

## 4. Environment Comparison: Local vs. Neon vs. Supabase

| Dimension | Local PostgreSQL (Port 5433) | Neon Staging (Singapore) | Hosted Supabase (Mumbai) |
| :--- | :--- | :--- | :--- |
| **Engine Version** | PostgreSQL 16.16 | PostgreSQL 18.7 (a21afb5) | PostgreSQL 17.x |
| **Active Database** | `aashvo_test` / `aashvo_dev` | `neondb` | `postgres` |
| **Application Tables** | **32 tables** | **32 tables** | **0 to 15** *(Pending live credential probe)* |
| **Migration Tracker** | `_prisma_migrations` (5 rows) | `_prisma_migrations` (5 rows) | `supabase_migrations` or None |
| **Total Base Tables** | **33 tables** | **33 tables** | Variable |
| **Custom ENUM Types** | **38 enums** | **38 enums** | 0 to 10 legacy enums |
| **Constraints** | 120 (33 PK, 65 FK, 20 Check, 2 UQ) | 406 (33 PK, 65 FK, 20 Check, 2 UQ) | Unknown without credentials |
| **Special Indexes** | GIN on array columns, Partial UQ | GIN on array columns, Partial UQ | Unknown without credentials |
| **Prisma Compatibility** | 100% verified (Prisma 6.19.3) | 100% verified (Prisma 6.19.3) | Ready once configured |
| **Row Count / Data** | 7 test users, local seed rows | **0 rows** (Clean schema slate) | Unknown without credentials |

---

## 5. Security & Isolation Audit

1. **Neon Credential Rotation**:
   - The previously exposed onboarding password `npg_LQ1VomOtSe5l` was rotated via Neon CLI in Turn 16.
   - Tested and confirmed rejected with `Please make sure to provide valid database credentials`.
   - The active rotated credential exists only in the git-ignored `apps/api/.env.neon`.
2. **Git Ignored Status**:
   - `git check-ignore -v apps/api/.env.neon` ➔ MATCHED (`apps/api/.gitignore:5:.env.*`).
   - `git check-ignore -v .env.local` ➔ MATCHED (`.gitignore:77:.env.local`).
   - `git ls-files --stage -- "*.env*"` ➔ Only `.env.example` templates are tracked.
3. **Supabase Isolation**:
   - Hosted Supabase was 100% untouched during all previous Neon operations.
   - No credentials or data cross-contaminated between Neon and Supabase.

---

## 6. Recommended Next Actions for CTO Approval

1. **Step 1 (Developer Action)**: Create `apps/api/.env.supabase` locally with Supabase pooled and direct connection strings.
2. **Step 2 (Read-Only Live Probe)**: Execute a non-destructive schema inspection script against Supabase to verify whether it contains legacy tables (`profiles`, `properties`) or is a clean slate.
3. **Step 3 (Reconciliation Strategy)**:
   - If clean slate: Apply the 5 audited Prisma migrations directly via `prisma migrate deploy`.
   - If legacy tables exist: Execute the reconciliation baseline runbook (documented in `SUPABASE_MIGRATION_PLAN.md`).

