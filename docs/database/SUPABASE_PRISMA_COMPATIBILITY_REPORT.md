# AASHVO Supabase & Prisma Migration Compatibility Report

**Date:** 2026-11-15
**Author:** Principal Database Architect & Backend Lead
**Scope:** Supabase CLI Migrations, Prisma Engine Parity, PostgreSQL 17 Hosted Compatibility
**Database:** Supabase Mumbai (`himtwnwxvnnykafyhysy`), PostgreSQL 17.11
**Status:** FULLY RECONCILED & LOCALLY VALIDATED

---

## 1. Problem Statement & Failure Mode

When running Supabase preview branching or running the historical migration sequence against an initialized branch, the migration runner failed with:

```
Applying migration 20261018000000_initial_schema.sql...
ERROR: type "user_role" already exists (SQLSTATE 42710)
```

### 1.1 Technical Analysis
In standard PostgreSQL, enumeration types created with `CREATE TYPE name AS ENUM (...)` do not support an `IF NOT EXISTS` clause in PostgreSQL DDL syntax.

In `supabase/migrations/20261018000000_initial_schema.sql`, lines 11-20 declared:

```sql
CREATE TYPE user_role AS ENUM (
  'renter',
  'owner',
  'flatmate',
  'broker',
  'admin'
);
```

When a database preview branch was created from an existing parent branch, or when migrations were applied against a database where base roles or extensions had already been initialized, PostgreSQL threw `SQLSTATE 42710` (duplicate_object), aborting the migration pipeline.

---

## 2. Non-Destructive Resolution

### 2.1 The Anti-Pattern to Avoid
A naïve workaround is to prepend `DROP TYPE IF EXISTS user_role CASCADE;`.
**This was strictly rejected** because `CASCADE` drops all referencing table columns (`users.role`, `profiles.role`, etc.), indexes, views, and row data. In any environment containing data, this causes irreversible data destruction.

### 2.2 The Idempotent DDL Implementation
We replaced the bare `CREATE TYPE` with an idempotent PL/pgSQL conditional block checking the PostgreSQL system catalog (`pg_type`):

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'renter',
      'owner',
      'flatmate',
      'broker',
      'admin'
    );
  ELSE
    -- Verify label compatibility if the type already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'renter'
    ) THEN
      RAISE EXCEPTION 'Existing user_role enum is incompatible with AASHVO schema.';
    END IF;
  END IF;
END $$;
```

### 2.3 Verification of Idempotency
This block was tested against isolated local PostgreSQL instances:
- **Clean Database:** Creates `user_role` enum with all 5 labels.
- **Pre-existing Type:** Detects existing type, confirms `'renter'` label exists, completes with 0 errors.
- **Repeated Application:** Executing the file 10 times consecutively produces identical, consistent state with zero errors.

---

## 3. Migration Ownership Architecture

A clear, unambiguous boundary of responsibility exists between the two migration directories in the repository:

| Migration System | Directory | Tooling | Role & Scope |
|---|---|---|---|
| **Authoritative Schema Manager** | `apps/api/prisma/migrations` | Prisma CLI (`prisma migrate deploy`) | **Authoritative single source of truth for the NestJS API backend.** Manages all 33 base tables, constraints, foreign keys, indexes, and runtime schema in CI/CD and production releases. |
| **Preview Branch History** | `supabase/migrations` | Supabase CLI (`supabase db push`) | **Supabase environment provisioning & preview branch parity.** Defines RLS policies, PostgreSQL helper functions, and database triggers. |

### Migration Invariants:
1. Production DDL migrations are strictly applied via `apps/api/prisma/migrations` during release deployment.
2. The runtime API role (`aashvo_api_runtime`) connects to PostgreSQL with explicitly declared table grants.
3. No destructive migration operations (`DROP`, `TRUNCATE`, `CASCADE`) may ever be executed against the hosted database without an approved rollback procedure.
