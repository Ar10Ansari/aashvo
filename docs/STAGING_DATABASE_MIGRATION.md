# AASHVO — STAGING DATABASE MIGRATION RUNBOOK

**Author:** AASHVO Senior Backend Engineer & Database Architect  
**Date:** November 24, 2026  
**Target:** Neon PostgreSQL `aashvo_staging`  

---

## 1. Migration Overview

All schema changes in AASHVO are managed as versioned, immutable SQL migrations under [apps/api/prisma/migrations/](file:///d:/Projects/AASHVO/apps/api/prisma/migrations/).

### Migration Catalog:
1. `20261112165753_init_independent_schema`: Foundational schema for users, roles, properties, and refresh tokens.
2. `20261112165800_postgres_checks_and_gin_indexes`: PostgreSQL check constraints, citext extensions, and GIN indexes.
3. `20261115000000_aashvo_connect_matching`: Compatibility match score calculations and roommate preferences.
4. `20261115010000_flatmate_intentions`: Flatmate search profiles, lifestyle traits, and dietary preferences.
5. `20261115020000_master_feature_expansion`: Support ticketing, safety reporting, and tenancy agreements.
6. `20261115030000_marketplace_profiles_and_onboarding`: Onboarding progress tracking and user personas.
7. `20261115060000_connect_intelligence_and_preferences`: Connect intelligence scoring and filter index enhancements.

---

## 2. Pre-Migration Safety Checklist

Before executing any migration command against the staging database:

1. [ ] **Verify Target Branch:** Confirm active Git branch is `infra/neon-staging`. Never run staging migrations from `master`.
2. [ ] **Verify Target Hostname:** Ensure `DIRECT_URL` points to `ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech` (AWS Singapore).
3. [ ] **Verify Database Name:** Ensure path is `/aashvo_staging`.
4. [ ] **Verify Unpooled Endpoint:** DDL commands must NEVER run through a connection pooler port (`DIRECT_URL` must connect directly to PostgreSQL compute).
5. [ ] **Forbid Destructive Operations:** Never run `prisma db push`, `prisma migrate reset`, `DROP DATABASE`, or `TRUNCATE`.

---

## 3. Migration Execution Procedure

### Method A: Automated Pre-Flight Verified Script (Recommended)
```bash
node apps/api/test/verify-and-migrate-neon.cjs deploy
```
This script automatically performs:
- Protocol, hostname, and database name assertions.
- Safety abort if host or database does not match Neon staging.
- Clean execution of `npx prisma migrate deploy`.

### Method B: Standard Prisma CLI Execution
```bash
export DIRECT_URL="postgresql://aashvo_staging_owner:<PASSWORD>@ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging?sslmode=require"
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## 4. Post-Migration Verification

1. Verify migration ledger:
   ```bash
   node apps/api/test/verify-and-migrate-neon.cjs status
   # Expected: "7 migrations found in prisma/migrations. Database schema is up to date!"
   ```
2. Verify all 34 tables in `public` schema via integration test:
   ```bash
   npm --workspace=apps/api test test/neon-staging.integration.spec.ts
   ```
