# AASHVO — OWNER ACTIONS REQUIRED FOR STAGING & PRODUCTION

**Author:** AASHVO CTO & DevOps Engineering Lead  
**Date:** November 24, 2026  
**Repository:** `D:\Projects\AASHVO`  
**Integration Branch:** `staging/mvp-fasttrack-candidate`  
**Current Status:** **READY WITH OWNER ACTIONS REQUIRED** (Software Complete; Cloud Infrastructure Provisioning Pending)

---

## 1. Overview of Required Actions

The AASHVO engineering team has completed 100% of the code, configuration, testing, and architecture required for the staging platform. To respect security isolation and prevent unauthorized cloud billing, the following **4 external cloud actions** require direct execution or approval by the repository/account owner.

Estimated time to complete: **15–20 minutes**.

---

## 2. Step-by-Step Owner Action Matrix

```
+---------------------------------------------------------------------------------------+
| ACTION SUMMARY                                                                        |
+----+-----------------------+------------------------------------------+---------------+
| #  | Provider / Console    | Action Description                       | Priority      |
+----+-----------------------+------------------------------------------+---------------+
| 1  | Render.com Dashboard  | Deploy 'aashvo-api-staging' Web Service  | P0 (Critical) |
| 2  | Neon / Render / PG    | Provision Isolated Staging Database      | P0 (Critical) |
| 3  | Cloudflare Dashboard  | Provision R2 Media Bucket & CDN Domain   | P1 (High)     |
| 4  | AWS Console (Mumbai)  | Provision Private S3 Document Vault      | P1 (High)     |
+----+-----------------------+------------------------------------------+---------------+
```

---

## 3. Detailed Action Procedures

### Action 1: Deploy Dedicated Render Staging Service (`aashvo-api-staging`)

- **Why:** The production API (`aashvo-api.onrender.com`) is isolated and must never be used for staging tests. A dedicated blueprint is already prepared in `render.yaml`.
- **Steps:**
  1. Log in to the [Render Dashboard](https://dashboard.render.com).
  2. Click **Blueprints** -> Select the linked `aashvo` repository.
  3. Render will detect the new service definition `aashvo-api-staging` defined in `render.yaml`.
  4. Ensure the **Branch** is set to:
     ```
     staging/mvp-fasttrack-candidate
     ```
  5. Click **Apply Blueprint** (or click **New +** -> **Web Service** manually using the specs below).
- **Manual Web Service Parameters (if not using Blueprint):**
  - **Name:** `aashvo-api-staging`
  - **Region:** Singapore (`singapore`) or Frankfurt (matching DB region)
  - **Branch:** `staging/mvp-fasttrack-candidate`
  - **Root Directory:** `apps/api`
  - **Build Command:** `npm install --include=workspace-root && npm run contracts:build && npm run build`
  - **Start Command:** `npm run start:prod`
  - **Instance Type:** Starter (Free or Standard)
  - **Health Check Path:** `/health`

---

### Action 2: Provision Staging PostgreSQL Database

- **Why:** Staging must never share tables or connection strings with production.
- **Option A (Recommended — Neon Postgres Branch):**
  1. Open your Neon Console project `aashvo-db`.
  2. Click **Branches** -> Click **New Branch**.
  3. Name the branch: `staging`.
  4. Copy the resulting pooled connection string:
     ```
     postgresql://<user>:<password>@<neon-staging-host>/neondb?sslmode=require
     ```
- **Option B (Render PostgreSQL):**
  1. In Render Dashboard, click **New +** -> **PostgreSQL**.
  2. Name: `aashvo-staging-db`.
  3. Environment: Free or Starter.
  4. Copy the **Internal Database URL** (for Render-to-Render) or **External Database URL**.
- **Configure in Render `aashvo-api-staging` Environment Variables:**
  - Key: `DATABASE_URL`
  - Value: `<your-staging-database-connection-string>`

---

### Action 3: Provision Cloudflare R2 Media Bucket (Public CDN)

- **Why:** Stores public property images and roommate photos.
- **Steps:**
  1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
  2. In the left navigation, select **R2 Object Storage**.
  3. Click **Create bucket**.
  4. Name the bucket:
     ```
     aashvo-staging-media
     ```
  5. Location: Automatic (Default). Click **Create bucket**.
  6. Go to bucket **Settings** -> Under **Public access**:
     - Either enable **R2.dev subdomain** (free/instant), or connect a custom domain (e.g., `staging-media.aashvo.com`).
     - Copy the public base URL (e.g. `https://pub-xxxxxx.r2.dev`).
  7. In R2 home, click **Manage R2 API Tokens** -> **Create API token**:
     - Permissions: **Object Read & Write** scoped to `aashvo-staging-media`.
     - Copy the **Access Key ID**, **Secret Access Key**, and **Endpoint URL** (`https://<account-id>.r2.cloudflarestorage.com`).
- **Inject into Render `aashvo-api-staging` Environment Variables:**
  ```env
  STORAGE_DRIVER=cloud
  STORAGE_R2_BUCKET=aashvo-staging-media
  STORAGE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
  STORAGE_R2_ACCESS_KEY_ID=<your-r2-access-key-id>
  STORAGE_R2_SECRET_ACCESS_KEY=<your-r2-secret-access-key>
  STORAGE_R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev
  ```

---

### Action 4: Provision AWS S3 Mumbai Bucket (Private Document Vault)

- **Why:** Stores sensitive government IDs, rental agreements, and identity verification docs with strict access controls and 300s presigned URLs.
- **Steps:**
  1. Log in to the [AWS Management Console](https://console.aws.amazon.com).
  2. Select Region: **Asia Pacific (Mumbai) `ap-south-1`**.
  3. Navigate to **S3** -> Click **Create bucket**:
     - Bucket name: `aashvo-staging-docs-private`
     - Object Ownership: **ACLs disabled (recommended)**
     - Block Public Access: **Block all public access = ON** (Ensure all 4 checkboxes are enabled)
     - Default Encryption: **Server-side encryption with Amazon S3 managed keys (SSE-S3)**
  4. Click **Create bucket**.
  5. Navigate to **IAM** -> **Users** -> **Create user**:
     - User name: `aashvo-staging-s3-app`
     - Attach policy directly: Create custom inline policy:
       ```json
       {
         "Version": "2012-10-17",
         "Statement": [
           {
             "Effect": "Allow",
             "Action": [
               "s3:PutObject",
               "s3:GetObject",
               "s3:DeleteObject"
             ],
             "Resource": "arn:aws:s3:::aashvo-staging-docs-private/*"
           }
         ]
       }
       ```
  6. Under user **Security credentials** -> Create **Access key**:
     - Copy **Access Key ID** and **Secret Access Key**.
- **Inject into Render `aashvo-api-staging` Environment Variables:**
  ```env
  STORAGE_S3_BUCKET=aashvo-staging-docs-private
  STORAGE_S3_REGION=ap-south-1
  STORAGE_S3_ACCESS_KEY_ID=<your-aws-access-key-id>
  STORAGE_S3_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
  ```

---

## 4. Verification After Owner Actions

Once these 4 actions are completed:
1. Render will build and deploy `aashvo-api-staging`.
2. Check health endpoint:
   ```bash
   curl -i https://aashvo-api-staging.onrender.com/health
   # Expected: HTTP 200 {"status":"ok","database":"connected","timestamp":"..."}
   ```
3. Visit the Vercel Preview URL:
   ```
   https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app
   ```
4. Perform live Seeker / Host testing; image uploads will stream directly to Cloudflare R2, and documents will persist securely in AWS S3 Mumbai.
