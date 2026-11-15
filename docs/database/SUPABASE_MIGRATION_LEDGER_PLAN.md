# AASHVO — Prisma Migration Ledger & Reconciliation Strategy
**Author:** Principal Database Architect & DevOps Lead  
**Reviewer / Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **RECONCILIATION LEDGER DESIGN COMPLETE**  
**Core Standard:** **LEGITIMATE PRISMA CLI BASELINING — ZERO FABRICATED CHECKSUMS — DEMONSTRABLE EQUIVALENCE**

---

## 1. Executive Context & Strict CTO Constraints

In accordance with CTO Requirements 8 & 9:
1. **Zero Manual Fabrications:** No arbitrary or fabricated `_prisma_migrations` records or raw checksum strings shall be inserted manually via unverified SQL scripts.
2. **Demonstrable Equivalence Before Baselining:** A migration may **only** be marked as applied if the target database state is demonstrably and structurally 100% equivalent to the migration's intended outcome.
3. **Legitimate CLI Procedures:** Baselining must use official Prisma CLI lifecycle commands (`prisma migrate resolve --applied <migration_name>`).
4. **Execution Division:** A clear technical demarcation must be established explaining which migrations are genuinely executed by the engine and which, if any, are legitimately baselined.

---

## 2. Deep Dive: Prisma Migrate Engine Internals

Prisma Migrate tracks database state through the `public._prisma_migrations` table, which possesses the following schema:
```sql
CREATE TABLE public._prisma_migrations (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
);
```

When `prisma migrate deploy` runs:
1. It reads `_prisma_migrations` on the target database.
2. It compares applied migrations against the physical directories in `prisma/migrations/`.
3. If unapplied migrations exist, it executes their `migration.sql` scripts sequentially inside individual transactions.
4. If an unapplied migration contains DDL for objects that already exist in the database (e.g., `CREATE TYPE "user_role"`), PostgreSQL rolls back the transaction and aborts with `P3006: Migration failed to apply cleanly`.

---

## 3. The Five Authoritative Migrations & Execution Strategy

Below is the definitive analysis of the five migrations in `apps/api/prisma/migrations/`:

### Migration 1: `20261112165753_init_independent_schema`
- **Contents:** `citext` extension, 31 custom ENUMs, 23 base tables (including the 8 new auth/infrastructure tables and 15 common tables), foreign keys, and indexes.
- **Can it run blindly via `migrate deploy`?**  
  **NO.** Because 15 of these tables and 10 of these enums already exist in Supabase, running raw `CREATE TABLE` and `CREATE TYPE` fails immediately.
- **Can it be blindly baselined without DDL?**  
  **FATAL.** As proved in Section 4 of `SUPABASE_RECONCILIATION_FINAL_PLAN.md`, marking Migration 1 as applied without DDL leaves the 8 NestJS auth tables uncreated, causing the backend to crash on boot.
- **The Legitimate Procedure:**
  1. Execute the non-destructive reconciliation DDL script to create the 8 missing tables, 21 missing enums, and 18 missing columns.
  2. Prove 100% structural equivalence with Migration 1.
  3. Execute official Prisma CLI baseline:
     ```bash
     npx prisma migrate resolve --applied 20261112165753_init_independent_schema --schema=apps/api/prisma/schema.prisma
     ```
  4. The Prisma CLI calculates the true SHA-256 checksum of `migration.sql` dynamically and registers the migration legitimately into `_prisma_migrations`.

### Migration 2: `20261112165800_postgres_checks_and_gin_indexes`
- **Contents:** Check constraints (`chk_properties_non_negative_money`, `chk_family_stay_eligibility`), partial unique indexes, and 4 GIN indexes on arrays (`amenities`, `target_localities`, `interests`).
- **Execution Strategy:**
  - Can be genuinely executed or applied via the reconciliation DDL.
  - Once verified, execute:
    ```bash
    npx prisma migrate resolve --applied 20261112165800_postgres_checks_and_gin_indexes --schema=apps/api/prisma/schema.prisma
    ```

### Migration 3: `20261115000000_aashvo_connect_matching`
- **Contents:** 2 custom ENUMs (`flatmate_interest_type`, `flatmate_match_status`), 5 matching tables (`flatmate_interests`, `flatmate_matches`, `match_messages`, `user_blocks`, `user_reports`), and `flatmate_profiles.discovery_hidden`.
- **Execution Strategy:**
  - Can be genuinely executed via Prisma or applied additively and resolved:
    ```bash
    npx prisma migrate resolve --applied 20261115000000_aashvo_connect_matching --schema=apps/api/prisma/schema.prisma
    ```

### Migration 4: `20261115010000_flatmate_intentions`
- **Contents:** Custom ENUM `flatmate_intention` and column `flatmate_profiles.intentions`.
- **Execution Strategy:**
  - Applied additively and resolved:
    ```bash
    npx prisma migrate resolve --applied 20261115010000_flatmate_intentions --schema=apps/api/prisma/schema.prisma
    ```

### Migration 5: `20261115020000_master_feature_expansion`
- **Contents:** 4 custom ENUMs (`saved_item_type`, `visit_status`, `property_verification_status`, `notification_category`), 4 tables (`saved_items`, `property_visits`, `property_verifications`, `user_notifications`), and inspection handover columns.
- **Execution Strategy:**
  - Applied additively and resolved:
    ```bash
    npx prisma migrate resolve --applied 20261115020000_master_feature_expansion --schema=apps/api/prisma/schema.prisma
    ```

---

## 4. Legitimate Baselining Execution Sequence

To achieve full Prisma synchronization without manual SQL injection or fabricated checksums:

```bash
# Pre-requisite: Non-destructive additive DDL executed and verified

# Step 1: Resolve Migration 1 (Independent Schema)
node scratch/run_with_supabase_env.js npx prisma migrate resolve --applied 20261112165753_init_independent_schema --schema=prisma/schema.prisma

# Step 2: Resolve Migration 2 (Checks and GIN Indexes)
node scratch/run_with_supabase_env.js npx prisma migrate resolve --applied 20261112165800_postgres_checks_and_gin_indexes --schema=prisma/schema.prisma

# Step 3: Resolve Migration 3 (Connect Matching)
node scratch/run_with_supabase_env.js npx prisma migrate resolve --applied 20261115000000_aashvo_connect_matching --schema=prisma/schema.prisma

# Step 4: Resolve Migration 4 (Flatmate Intentions)
node scratch/run_with_supabase_env.js npx prisma migrate resolve --applied 20261115010000_flatmate_intentions --schema=prisma/schema.prisma

# Step 5: Resolve Migration 5 (Master Feature Expansion)
node scratch/run_with_supabase_env.js npx prisma migrate resolve --applied 20261115020000_master_feature_expansion --schema=prisma/schema.prisma

# Step 6: Verify Final Migration Status
node scratch/run_with_supabase_env.js npx prisma migrate status --schema=prisma/schema.prisma
```

### Expected Final Output of `prisma migrate status`:
```text
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-ap-south-1.pooler.supabase.com:5432"

5 migrations found in prisma/migrations
Database schema is up to date!
```

---

## 5. Parity & Future Migration Guarantees

1. **Future Migrations Unblocked:** Because all 5 migrations are legitimately registered by Prisma CLI with true checksums, running `prisma migrate deploy` during future release sprints will execute seamlessly without collisions.
2. **Prisma Client Typing:** `npm --prefix apps/api run prisma:generate` operates with 100% type fidelity against the live database.
3. **No Drift:** Prisma schema matches PostgreSQL catalogs with zero unresolved drift.
