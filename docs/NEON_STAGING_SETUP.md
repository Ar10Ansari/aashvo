# AASHVO — NEON POSTGRESQL STAGING SETUP GUIDE

**Author:** AASHVO Senior Backend Engineer & Infrastructure Auditor  
**Date:** November 24, 2026  
**Target Environment:** Staging  
**Database:** `aashvo_staging`  
**Provider:** Neon Serverless PostgreSQL (AWS Singapore `aws-ap-southeast-1`)  
**Project:** `aashvo-staging` (`small-butterfly-15738810`)  

---

## 1. Overview & Architecture

AASHVO utilizes a dedicated, serverless Neon PostgreSQL database for its staging environment (`aashvo_staging`). This database is completely decoupled from production environments (such as hosted Supabase or production managed clusters), ensuring that automated E2E runs, schema migrations, and QA testing never contaminate or lock production tables.

```
+-------------------------------------------------------------------------------------------------+
| NEON STAGING CONNECTION ARCHITECTURE                                                            |
|                                                                                                 |
| [ NestJS API Runtime Queries ]                                                                  |
|              |                                                                                  |
|              v (DATABASE_URL, pgbouncer=true, port 5432/6543)                                    |
|   ep-snowy-hall-bi49p4m9-pooler.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging                 |
|                                                                                                 |
| [ Prisma DDL Migrations CLI ]                                                                   |
|              |                                                                                  |
|              v (DIRECT_URL, unpooled direct compute endpoint)                                   |
|   ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging                        |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Neon Staging Topology Specifications

| Parameter | Staging Value | Purpose |
| :--- | :--- | :--- |
| **Project Name** | `aashvo-staging` | Isolated staging project container |
| **Project ID** | `small-butterfly-15738810` | Unique Neon identifier |
| **Provider / Cloud** | Neon on AWS (`k8s-neonvm`) | Serverless autoscaling Postgres |
| **Region** | `aws-ap-southeast-1` (Singapore) | Proximity to APAC staging web services |
| **Default Branch** | `main` (`br-restless-base-bi8ybn3a`) | Authoritative staging data branch |
| **Database Name** | `aashvo_staging` | Staging database |
| **Owner Role** | `aashvo_staging_owner` | Principle least-privilege role |
| **Direct Host** | `ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech` | DDL migrations (`DIRECT_URL`) |
| **Pooled Host** | `ep-snowy-hall-bi49p4m9-pooler.c-5.ap-southeast-1.aws.neon.tech` | Application queries (`DATABASE_URL`) |
| **SSL Enforcement** | `sslmode=require` | Mandatory TLS 1.3 encryption in transit |

---

## 3. Environment Variable Configuration

For local staging testing or deploying the `aashvo-api-staging` web service on Render, configure the following environment variables. **Never commit actual passwords to version control.**

Template: [apps/api/.env.neon.example](file:///d:/Projects/AASHVO/apps/api/.env.neon.example)

```env
NODE_ENV=staging
PORT=10000
LOG_LEVEL=debug
ENABLE_SWAGGER=true

# Pooled runtime connection (PgBouncer mode)
DATABASE_URL="postgresql://aashvo_staging_owner:<PASSWORD>@ep-snowy-hall-bi49p4m9-pooler.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging?sslmode=require&pgbouncer=true"

# Direct unpooled connection for schema migrations
DIRECT_URL="postgresql://aashvo_staging_owner:<PASSWORD>@ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging?sslmode=require"

COOKIE_SECURE=true
COOKIE_SAME_SITE=none
WEB_APP_URL=https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app
CORS_ALLOWED_ORIGINS=https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app,https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app
TRUST_PROXY=1
STORAGE_PROVIDER=local
LOCAL_STORAGE_BASE_DIR=./scratch/storage
LOCAL_STORAGE_PUBLIC_BASE_URL=https://aashvo-api-staging.onrender.com/assets
```

---

## 4. Applying Schema Migrations

To apply pending migrations to the Neon staging database:

```bash
# 1. Ensure apps/api/.env.neon contains DIRECT_URL targeting aashvo_staging
# 2. Run the verified migration deploy script:
node apps/api/test/verify-and-migrate-neon.cjs deploy

# Or run directly via Prisma CLI:
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## 5. Verification & Testing

Run the automated Neon integration suite to verify connection health, table schemas, and production isolation:

```bash
npm --workspace=apps/api test test/neon-staging.integration.spec.ts
```
Expected output: **11/11 passed**.
