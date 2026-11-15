# AASHVO — SUPABASE PRIMARY MIGRATION EXECUTION PLAN
**Phase 1 Preparation | Target: Supabase Free-Tier (Mumbai `ap-south-1`)**

**Author**: Senior Cloud Infrastructure Engineer & Database Migration Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: DRAFT PLAN — Awaiting Credentials & CTO Authorization  

---

## 1. Migration Overview & Strategy

The objective is to establish the complete, authoritative AASHVO database architecture on the **Supabase Mumbai** project (`himtwnwxvnnykafyhysy`), matching the verified schema currently running on Neon and local PostgreSQL.

### Migration Path Selection

Depending on the results of the live read-only probe (once credentials are provided in `apps/api/.env.supabase`), one of two paths will be executed:

```mermaid
flowchart TD
    Creds["1. Provide Credentials in apps/api/.env.supabase"] --> Probe["2. Run Read-Only Schema Probe"]
    Probe --> Decision{"Does Supabase have legacy tables?"}
    
    Decision -->|"No (Clean Slate)"| PathA["Path A: Standard Prisma Migration (Recommended)"]
    Decision -->|"Yes (Legacy Prototype)"| PathB["Path B: Reconciliation & Baseline Path"]
    
    PathA --> Deploy["npx prisma migrate deploy"]
    PathB --> Reconcile["Reconcile auth.users FK -> public.users"] --> Baseline["prisma migrate resolve --applied"] --> Deploy
    
    Deploy --> Verify["3. Execute Read-Only Verification Queries"]
    Verify --> Complete["4. Switch API DATABASE_URL on Render"]
```

#### Path A: Standard Prisma Migrate Deploy (Clean Target — Recommended)
- **Applicability**: If `aashvo-dev` has 0 application tables in `public` (as indicated by `docs/archive/HOSTED_SUPABASE_MIGRATION_READINESS.md`).
- **Procedure**: Run `npx prisma migrate deploy` using the Supabase direct session pooler URL on port `5432`.
- **Outcome**: Instantiates all 33 tables, 38 enums, and 406 constraints in under 20 seconds.

#### Path B: Schema Reconciliation Path (Legacy Prototype Target)
- **Applicability**: If `aashvo-dev` already contains legacy prototype tables (`profiles`, `properties`) linked to Supabase GoTrue `auth.users`.
- **Procedure**:
  1. Export a full physical SQL dump via `pg_dump` before any changes.
  2. Execute a non-destructive reconciliation SQL script to decouple `profiles.id` from `auth.users.id` and repoint to `public.users.id`.
  3. Mark migration 01 as resolved: `npx prisma migrate resolve --applied 20261112165753_init_independent_schema`.
  4. Deploy remaining migrations 02 through 05 via `npx prisma migrate deploy`.

---

## 2. Environment Variable Configuration

### A. Local Development Environment (`apps/api/.env`)
Remains strictly pointed to local PostgreSQL on port `5433`:
```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/aashvo_dev?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/aashvo_dev?schema=public"
```

### B. Local Supabase Ignored Environment (`apps/api/.env.supabase`)
To be created locally (git-ignored) for staging inspection and deployment:
```dotenv
# Supabase Transaction Pooler (Port 6543) for runtime queries
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=15"

# Supabase Session Pooler (Port 5432) for Prisma CLI migrations
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

### C. Render Environment Variables (NestJS Web Service)
In the Render Web Service Environment settings:
- **`DATABASE_URL`**: Supabase Transaction Pooler URL on port `6543` with `?sslmode=require&pgbouncer=true&connect_timeout=15`.
- **`DIRECT_URL`**: Supabase Session Pooler URL on port `5432` with `?sslmode=require`.

---

## 3. Step-by-Step Migration Execution Runbook

### Step 1: Preflight Verification
Verify that `apps/api/.env.supabase` is populated and direct connection succeeds:
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } }); client.\$connect().then(() => console.log('Connected to Supabase')).catch(console.error);"
```

### Step 2: Disaster Recovery Backup
Before applying any migration to the remote database:
```bash
pg_dump "$DIRECT_URL" -F c -f "supabase_pre_migration_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 3: Execute Prisma Migrate Deploy
Execute migration strictly using the direct session pooler:
```bash
node -e "const { execSync } = require('child_process'); console.log(execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', { cwd: 'apps/api', env: { ...process.env, ...require('dotenv').config({ path: 'apps/api/.env.supabase' }).parsed } }).toString());"
```

### Step 4: Post-Migration System Verification Queries
Run non-destructive verification queries against the target Supabase database:
```sql
-- 1. Verify migration ledger
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at ASC;

-- 2. Verify table count (Expected: 33)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 3. Verify custom ENUM types (Expected: 38)
SELECT count(DISTINCT typname) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public';

-- 4. Verify GIN indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '%GIN%';

-- 5. Test pooled connection runtime query
SELECT count(*) FROM "users";
```

---

## 4. Rollback Plan

In the event of an unexpected DDL error during migration execution:
1. **Immediate Abort**: Stop the migration runner. Because Prisma Migrate wraps each migration file in a transaction, failures within a single migration rollback automatically.
2. **Database State Restoration**: If partial migrations completed and need full restoration:
   ```bash
   pg_restore -d "$DIRECT_URL" --clean --if-exists supabase_pre_migration_backup_*.dump
   ```
3. **Application Routing Safeguard**: The NestJS API on Render continues running against Neon or local database until Supabase verification passes 100%. Zero customer downtime occurs.

