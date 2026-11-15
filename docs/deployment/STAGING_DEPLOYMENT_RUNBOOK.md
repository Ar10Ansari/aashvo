# AASHVO — STAGING DEPLOYMENT RUNBOOK
## Step-by-Step Execution Protocol, Exact Commands & Verification Gates

**Author:** Chief Technology Officer & Release Manager  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Execution Environment:** Pre-Production Staging  
**Date:** November 15, 2026  
**Execution Condition:** **AWAITING FOUNDER AUTHORIZATION (DO NOT EXECUTE WITHOUT SIGN-OFF)**

---

## 1. PRE-FLIGHT READINESS CHECKLIST

Before executing step 1, confirm:
- [x] All 285 local automated tests pass (`npm test` and `npm --workspace=@aashvo/api test`).
- [x] Zero uncommitted files lost.
- [x] Founder has reviewed and approved `STAGING_INFRASTRUCTURE_COST_ESTIMATE.md`.
- [x] Staging credentials and RSA keys generated per `STAGING_ENVIRONMENT_VARIABLES.md`.

---

## 2. THE 11-STEP ORDERED DEPLOYMENT RUNBOOK

### STEP 1: Provision Approved Staging Cloud Resources
1. **DigitalOcean Managed PostgreSQL:**
   - Console: **Databases** -> **Create Database Cluster**.
   - Engine: PostgreSQL 16.
   - Region: `blr1` (Bangalore, India).
   - Plan: Basic (1 vCPU, 1 GB RAM, 10 GB Storage) - $15/mo.
   - Cluster Name: `aashvo-db-staging`.
2. **Cloudflare R2 Bucket:**
   - Console: **R2** -> **Create Bucket**.
   - Bucket Name: `aashvo-public-staging`.
   - Location: Automatic (India Edge).
   - Custom Domain: `media-staging.aashvo.com`.
3. **AWS S3 Bucket:**
   - Console: **S3** -> **Create Bucket**.
   - Bucket Name: `aashvo-private-staging`.
   - Region: `ap-south-1` (Mumbai).
   - Block Public Access: **ON (All checkboxes checked)**.
   - Encryption: **Server-side encryption with Amazon S3-managed keys (SSE-S3)**.

*Expected Outcome:* All three storage and database services report status "Active".  
*Failure Recovery:* If a region is unavailable, switch to `MUM1` or failover to fallback region.

---

### STEP 2: Configure Secrets & Environment Variables
In the **DigitalOcean App Platform** settings for `aashvo-api-staging`:
1. Navigate to **Settings** -> **App-Level Environment Variables**.
2. Add all variables documented in `docs/STAGING_ENVIRONMENT_VARIABLES.md`.
3. Verify that `JWT_SIGNING_PRIVATE_KEY`, `COOKIE_SECRET`, `AWS_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` are flagged as **Encrypt**.

*Expected Outcome:* Variables saved with encrypted shields visible in UI.  
*Failure Recovery:* If an encryption error occurs, verify single-line PEM formatting (`\n` linebreaks).

---

### STEP 3: Verify Network Connectivity
From an authorized deployment machine or CI runner:
```bash
# Verify database connection string reachability over TLS
psql "postgresql://doadmin:password@db-host:25060/defaultdb?sslmode=require" -c "SELECT version();"
```
*Expected Outcome:* PostgreSQL 16.x version string returned.  
*Failure Recovery:* If connection times out, add the runner IP address to the DigitalOcean Database **Trusted Sources** allowlist.

---

### STEP 4: Create & Validate Staging Database
```bash
# Create staging database if not exists
psql "postgresql://doadmin:password@db-host:25060/defaultdb?sslmode=require" -c "CREATE DATABASE aashvo_staging;"

# Confirm database existence
psql "postgresql://doadmin:password@db-host:25060/aashvo_staging?sslmode=require" -c "\l"
```
*Expected Outcome:* `aashvo_staging` database listed with UTF-8 encoding.

---

### STEP 5: Apply Prisma Migrations
Execute the version-controlled Prisma migrations against the staging database:
```bash
export DATABASE_URL="postgresql://doadmin:password@db-host:25060/aashvo_staging?sslmode=require"

# Apply versioned migrations
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# Verify migration status
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```
*Expected Outcome:* "Database schema is up to date!" returned. All 23 tables, 15 check constraints, and 5 GIN/partial unique indexes applied.  
*Failure Recovery:* If migration fails, inspect Prisma error code (e.g. P3009) and check user permissions.

---

### STEP 6: Deploy NestJS API Container
1. Build and push the container to DigitalOcean Container Registry (or connect GitHub repository branch `staging` to App Platform).
2. Trigger deployment in DigitalOcean App Platform.
3. Monitor build logs:
   - TypeScript compilation (`nest build`): Must complete with 0 errors.
   - Container startup: `Nest application successfully started`.
4. Attach custom domain: `https://api-staging.aashvo.com`.

*Expected Outcome:* App Platform reports status "Healthy" and routes incoming requests.

---

### STEP 7: Deploy Frontend Against Staging API
1. In Vercel Project Settings for `aashvo`:
   - Under **Environment Variables**, select **Preview** environment:
     - `VITE_API_BASE_URL`: `https://api-staging.aashvo.com/api/v1`
     - `VITE_USE_INDEPENDENT_BACKEND`: `true`
     - `VITE_STORAGE_PUBLIC_BASE_URL`: `https://media-staging.aashvo.com`
2. Push or deploy preview branch `staging` to Vercel.
3. Access preview URL: `https://staging.aashvo.vercel.app`.

*Expected Outcome:* Frontend loads cleanly without console errors; network tab requests target `api-staging.aashvo.com`.

---

### STEP 8: Verify Health & Readiness Endpoints
Execute automated curl smoke tests against staging endpoints:
```bash
# 1. API Liveness Check
curl -s -i https://api-staging.aashvo.com/api/v1/health
# Expected: HTTP/1.1 200 OK, {"status":"ok"}

# 2. Database Readiness Check
curl -s -i https://api-staging.aashvo.com/api/v1/health/ready
# Expected: HTTP/1.1 200 OK, {"database":"connected"}

# 3. OpenAPI Docs Reachability
curl -s -o /dev/null -w "%{http_code}" https://api-staging.aashvo.com/api/docs
# Expected: 200
```
*Failure Recovery:* If `/ready` returns 503, verify database pool connection count and network firewall rules.

---

### STEP 9: Execute End-to-End User Journeys
The QA Lead executes the 5 core user journey smoke tests on `https://staging.aashvo.vercel.app`:
1. **User Sign-Up & Login:** Register new user `staging-user@aashvo.in`, verify `__Host-` session cookie set with `Secure; HttpOnly; SameSite=Strict`.
2. **List Property:** Post listing in `flats_rooms`, verify status `pending_review`.
3. **Moderation Queue:** Log in as admin, approve listing, verify status updates to `active`.
4. **Digital Tenancy Agreement:** Create lease between landlord and tenant, record move-in inspection, acknowledge by counterparty.
5. **Support Ticket:** Submit guest support ticket, verify `ASH-TKT-XXXXXX` reference code generation.

*Expected Outcome:* All 5 flows succeed without client exceptions. Detailed test plan in `STAGING_ACCEPTANCE_TEST_PLAN.md`.

---

### STEP 10: Test Backup & Restore on Staging Database
Verify that database backups work under cloud conditions:
```bash
# Capture staging dump
pg_dump "postgresql://doadmin:password@db-host:25060/aashvo_staging?sslmode=require" -F c -f staging_test.dump

# Create disposable verification DB
psql "postgresql://doadmin:password@db-host:25060/defaultdb?sslmode=require" -c "CREATE DATABASE aashvo_restore_drill;"

# Restore into verification DB
pg_restore -d "postgresql://doadmin:password@db-host:25060/aashvo_restore_drill?sslmode=require" -v staging_test.dump

# Verify 24 tables restored
psql "postgresql://doadmin:password@db-host:25060/aashvo_restore_drill?sslmode=require" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

# Clean up drill DB
psql "postgresql://doadmin:password@db-host:25060/defaultdb?sslmode=require" -c "DROP DATABASE aashvo_restore_drill;"
rm staging_test.dump
```
*Expected Outcome:* Count returns 24 tables restored; drill database dropped.

---

### STEP 11: Test Staging Rollback
Simulate and verify rollback procedures:
1. Revert Vercel deployment to prior preview commit. Verify frontend switches back cleanly.
2. In DigitalOcean App Platform, click **Rollback to previous deployment**. Verify zero downtime.
3. Verify that the legacy Supabase project (`himtwnwxvnnykafyhysy`) remained untouched throughout all 11 steps.

*Expected Outcome:* Staging rollback completes in < 2 minutes with zero data loss. Detailed in `STAGING_ROLLBACK_PLAN.md`.

