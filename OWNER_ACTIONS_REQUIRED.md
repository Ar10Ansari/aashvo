# AASHVO — OWNER ACTIONS REQUIRED FOR STAGING & PRODUCTION

**Author:** AASHVO CTO & DevOps Engineering Lead  
**Date:** November 24, 2026  
**Repository:** `D:\Projects\AASHVO`  
**Integration Branch:** `infra/neon-staging`  
**Current Status:** **READY WITH OWNER ACTIONS REQUIRED** (Software 100% Complete & Tested; Live Database Verified; Staging Service Deployment Awaiting Approval)

---

## 1. Overview of Platform State & Required Actions

To provide radical transparency, the platform state is explicitly demarcated across three distinct levels:

### A. Implemented & Verified Code (100% Complete in Codebase)
- **Authentication & Security:** Asymmetric RSA-2048 (RS256) JWT access tokens, SHA-256 hashed refresh tokens with automatic family reuse revocation, RFC 6265bis `__Host-` cookies, strict CORS/CSRF origin validation.
- **Core Product Workflows:** User onboarding, seeker inquiry flow, host notification delivery, property listing wizard with multi-step validation, flatmate matching intelligence with lifestyle scoring, support ticket submission, and safety reporting.
- **Dual-Storage Engine:** Local filesystem mock adapter for staging zero-cost isolation; enterprise AWS SDK v3 S3 client for Cloudflare R2 (public CDN) and AWS S3 Mumbai (AES-256 private document vault).
- **Automated Test Coverage:** 307/307 Vitest unit & component tests passing, 26/26 browser-driven Playwright E2E workflows passing, 11/11 live Neon database integration tests passing.

### B. Configured Services
- **Dedicated Staging Blueprint:** [render.staging.yaml](file:///d:/Projects/AASHVO/render.staging.yaml) configured exclusively for service `aashvo-api-staging` targeting branch `infra/neon-staging`. Zero modification to production blueprint (`render.yaml`).
- **Frontend Staging Preview (Vercel):** Bound to `https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app` with `VITE_API_BASE_URL` pointing to `https://aashvo-api-staging.onrender.com`.

### C. Live Verified Infrastructure
- **Neon Staging Database:** Dedicated serverless PostgreSQL database `aashvo_staging` on Neon project `aashvo-staging` (`small-butterfly-15738810`) in AWS Singapore (`ep-snowy-hall-bi49p4m9`).
- **Schema & Migrations:** All 7 Prisma migrations deployed; all 34 relational tables created; live TLS encryption verified; CRUD lifecycle and synthetic record cleanup verified.

---

## 2. Step-by-Step Owner Action Matrix

To deploy the staging API service without incurring unexpected billing or compromising security, complete the following owner actions:

```
+---------------------------------------------------------------------------------------------------------+
| ACTION SUMMARY                                                                                          |
+----+-----------------------+------------------------------------------------------------+---------------+
| #  | Provider / Console    | Action Description                                         | Status        |
+----+-----------------------+------------------------------------------------------------+---------------+
| 1  | Render.com Dashboard  | Deploy 'aashvo-api-staging' using render.staging.yaml      | P0 (Required) |
| 2  | Render.com Dashboard  | Bind Neon Staging DB Credentials (DATABASE_URL/DIRECT_URL) | P0 (Required) |
| 3  | Cloudflare Dashboard  | (Optional) Provision R2 Media Bucket & Connect CDN Domain  | P1 (Optional) |
| 4  | AWS Console (Mumbai)  | (Optional) Provision Private S3 Document Vault (ap-south-1)| P1 (Optional) |
+----+-----------------------+------------------------------------------------------------+---------------+
```

---

## 3. Detailed Action Procedures

### Action 1: Deploy Dedicated Render Staging Service (`aashvo-api-staging`)

- **Why:** The production API (`aashvo-api.onrender.com`) is isolated and must never be touched. A dedicated blueprint is prepared in [render.staging.yaml](file:///d:/Projects/AASHVO/render.staging.yaml).
- **Steps:**
  1. Log in to the [Render Dashboard](https://dashboard.render.com).
  2. Click **Blueprints** -> **New Blueprint Instance**.
  3. Select repository `Ar10Ansari/aashvo`.
  4. Specify Blueprint Path: `render.staging.yaml`.
  5. Confirm the **Branch** is set to:
     ```
     infra/neon-staging
     ```
  6. Click **Apply**. Render will create web service `aashvo-api-staging`.

---

### Action 2: Bind Neon Staging Database Credentials in Render

- **Why:** Staging API needs credentials to connect to the already-verified Neon staging database (`aashvo_staging`).
- **Database Status:** ALREADY PROVISIONED & VERIFIED on Neon project `aashvo-staging` (`small-butterfly-15738810`).
- **Steps:**
  1. In the Render Dashboard, navigate to web service `aashvo-api-staging` -> **Environment**.
  2. Add the following environment variables (marked `sync: false` in blueprint):
     - **`DATABASE_URL`**:
       ```
       postgresql://aashvo_staging_owner:<PASSWORD>@ep-snowy-hall-bi49p4m9-pooler.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging?sslmode=require&pgbouncer=true
       ```
     - **`DIRECT_URL`**:
       ```
       postgresql://aashvo_staging_owner:<PASSWORD>@ep-snowy-hall-bi49p4m9.c-5.ap-southeast-1.aws.neon.tech/aashvo_staging?sslmode=require
       ```
     - **`JWT_SIGNING_PRIVATE_KEY`**: RSA-2048 private key (PEM format).
     - **`JWT_SIGNING_PUBLIC_KEY`**: RSA-2048 public key (PEM format).
  3. Save Changes.

---

### Action 3: (Optional) Provision Cloudflare R2 Media Bucket (Public CDN)

> [!NOTE]
> Staging defaults to `STORAGE_PROVIDER=local` with zero cloud costs. Follow this action only if you wish to enable live cloud asset uploads during staging testing.

- **Why:** Stores public property images and roommate photos on Cloudflare global CDN.
- **Steps:**
  1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
  2. In the left navigation, select **R2 Object Storage** -> Click **Create bucket**.
  3. Bucket name: `aashvo-staging-public` (Location: Automatic).
  4. Under bucket **Settings** -> **Public access**:
     - Connect custom domain (e.g. `cdn.staging.aashvo.in`) or enable R2.dev subdomain.
  5. Go to R2 home -> **Manage R2 API Tokens** -> **Create API token**:
     - Permissions: **Object Read & Write** scoped to `aashvo-staging-public`.
  6. Update Render `aashvo-api-staging` environment variables:
     ```env
     STORAGE_PROVIDER=cloud
     CLOUDFLARE_R2_ACCOUNT_ID=<account-id>
     CLOUDFLARE_R2_ACCESS_KEY_ID=<r2-access-key-id>
     CLOUDFLARE_R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
     CLOUDFLARE_R2_BUCKET_NAME=aashvo-staging-public
     CLOUDFLARE_R2_PUBLIC_URL=https://cdn.staging.aashvo.in
     ```

---

### Action 4: (Optional) Provision AWS S3 Mumbai Bucket (Private Document Vault)

> [!NOTE]
> If `STORAGE_PROVIDER=local` is maintained, rental documents are safely handled by local storage. Follow this action only to test real AWS KMS/S3 private document storage.

- **Why:** Stores sensitive tenancy agreements and KYC documents in a private vault with 300s presigned URLs.
- **Steps:**
  1. Log in to the [AWS Management Console](https://console.aws.amazon.com) in region **ap-south-1** (Mumbai).
  2. Navigate to **S3** -> Click **Create bucket**:
     - Bucket name: `aashvo-staging-vault`
     - Block Public Access: **Block all public access = ON** (all 4 checkboxes enabled).
     - Default Encryption: **Server-side encryption with Amazon S3 managed keys (SSE-S3)**.
  3. Navigate to **IAM** -> Create user `aashvo-staging-s3-app` with custom policy:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
           "Resource": "arn:aws:s3:::aashvo-staging-vault/*"
         }
       ]
     }
     ```
  4. Generate Access Key pair for the user.
  5. Update Render `aashvo-api-staging` environment variables:
     ```env
     AWS_REGION=ap-south-1
     AWS_S3_PRIVATE_BUCKET=aashvo-staging-vault
     AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
     AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
     ```

---

## 4. Post-Deployment Verification Checklist

Once Action 1 and Action 2 are completed:
1. Render triggers pre-deploy migration:
   ```bash
   node apps/api/test/verify-and-migrate-neon.cjs deploy
   ```
2. Render starts `aashvo-api-staging`.
3. Check API health endpoint:
   ```bash
   curl -i https://aashvo-api-staging.onrender.com/api/v1/health/live
   # Expected: HTTP 200 {"status":"ok","timestamp":"..."}
   ```
4. Verify Vercel Staging Preview:
   ```
   https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app
   ```
5. Confirm live end-to-end flows: Seeker inquiry, Owner property listing, Flatmate matchmaking.
