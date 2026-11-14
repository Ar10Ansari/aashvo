# AASHVO — MASTER RELEASE DEPLOYMENT RUNBOOK
## Step-by-Step Production Deployment, Infrastructure Provisioning & Cutover Manual

**Author:** CTO & DevOps Lead  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Execution Target:** Production Staging & Cloud Infrastructure  
**Date:** November 14, 2026  

---

## 1. PRE-DEPLOYMENT VERIFICATION GATE

Before executing any production infrastructure actions, the release manager must verify:
- [x] All 232 Vitest frontend tests pass (`npm test`).
- [x] All 53 Jest backend tests pass against PostgreSQL 16 (`npm --workspace=@aashvo/api test`).
- [x] TypeScript typechecks pass cleanly on root (`npm run typecheck`) and backend (`npm --workspace=@aashvo/api run typecheck`).
- [x] Frontend production bundle compiles without errors (`npm run build`).
- [x] No modifications made to hosted Supabase project `himtwnwxvnnykafyhysy`.
- [x] All uncommitted working copy changes preserved.

---

## 2. STEP-BY-STEP PRODUCTION DEPLOYMENT PROCEDURE

### Phase 1: Database Provisioning (DigitalOcean BLR1)
1. In the DigitalOcean Cloud Console, create a **Managed PostgreSQL 16** cluster in the **Bangalore (BLR1)** region.
   - Recommended Tier: 1 Node, 2 vCPU, 4 GB RAM, 50 GB NVMe Storage (Production Baseline).
   - Enable automated daily backups with 7-day retention.
   - Restrict incoming network access to the DigitalOcean VPC and the deployment CI/CD IP allowlist.
2. Obtain the connection pool URL and direct connection URL.
3. Apply version-controlled Prisma migrations from a trusted CI runner:
   ```bash
   export DATABASE_URL="postgresql://db_user:password@pg-host:25060/aashvo_prod?sslmode=require"
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```
4. Verify all 23 tables, 15 check constraints, and 5 GIN/partial unique indexes are created:
   ```sql
   SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
   -- Expected: 23 tables
   ```

### Phase 2: Storage Buckets & Credentials
1. **Cloudflare R2 (Public Media):**
   - Create bucket `aashvo-public-assets-prod`.
   - Configure custom domain: `https://media.aashvo.com`.
   - Enable CORS policy allowing `GET` from `https://aashvo.vercel.app`.
   - Issue R2 API Token with Object Read & Write permissions.
2. **AWS S3 ap-south-1 Mumbai (Private Documents):**
   - Create bucket `aashvo-private-docs-prod` in `ap-south-1`.
   - Block All Public Access = **ON**.
   - Enable SSE-S3 AES-256 Default Encryption.
   - Create IAM policy restricting PutObject and GetObject with presigned URLs.

### Phase 3: Backend Compute Deployment (DigitalOcean App Platform)
1. Deploy NestJS application container on DigitalOcean App Platform in `BLR1`.
2. Configure App Platform Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `4000`
   - `DATABASE_URL`: `${db.DATABASE_URL}`
   - `JWT_SIGNING_PRIVATE_KEY`: `-----BEGIN PRIVATE KEY-----\n...`
   - `JWT_SIGNING_PUBLIC_KEY`: `-----BEGIN PUBLIC KEY-----\n...`
   - `COOKIE_SECURE`: `true`
   - `COOKIE_SECRET`: `<64-byte-cryptographically-random-hex>`
   - `CORS_ALLOWED_ORIGINS`: `https://aashvo.vercel.app,https://aashvo.com`
   - `STORAGE_PROVIDER`: `s3_compatible`
   - `CLOUDFLARE_R2_BUCKET`: `aashvo-public-assets-prod`
   - `AWS_S3_PRIVATE_BUCKET`: `aashvo-private-docs-prod`
3. Attach custom domain: `https://api.aashvo.com`.

### Phase 4: Backend Health Verification & Smoke Tests
Execute verification against production API endpoint:
```bash
# 1. System Health
curl -s -i https://api.aashvo.com/api/v1/health
# Expected: HTTP/1.1 200 OK, {"status":"ok"}

# 2. Database Connectivity
curl -s -i https://api.aashvo.com/api/v1/health/db
# Expected: HTTP/1.1 200 OK, {"status":"ok","database":"connected"}

# 3. OpenAPI Docs Verification
curl -s -o /dev/null -w "%{http_code}" https://api.aashvo.com/api/docs
# Expected: 200
```

### Phase 5: Frontend Configuration & Vercel Deployment
1. In Vercel Project Settings for `aashvo`:
   - Set Environment Variable `VITE_API_BASE_URL`: `https://api.aashvo.com/api/v1`.
   - Set `VITE_USE_INDEPENDENT_BACKEND`: `true`.
2. Trigger production deployment on branch `master`.
3. Verify build completes and assets deploy cleanly.

### Phase 6: Post-Deployment Verification (Staged Cutover)
1. Test User Registration on live URL.
2. Test User Login and verify `__Host-` cookie presence in browser devtools.
3. Verify Property Listing search and GIN amenity filter performance.
4. Verify digital tenancy agreement creation and counterparty acknowledgement.
5. Verify guest customer support ticket submission.

---

## 3. CONTACT ESCALATION ROSTER

- **CTO & Architecture Lead:** Engineering Core Team
- **Database Administrator:** DevOps & Infrastructure Lead
- **Security Incident Response:** security@aashvo.com

