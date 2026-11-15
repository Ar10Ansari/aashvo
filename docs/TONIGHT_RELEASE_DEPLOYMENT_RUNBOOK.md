# AASHVO MVP Release — Tonight Deployment Runbook
**Target Audience:** Release Engineer / Founder / DevOps Lead  
**Scope:** Live Deployment of Render Backend & Vercel Frontend  
**Hosting Architecture:** 100% Free Tier (Vercel + Render + Neon/Supabase)

---

## Preflight Checklist

Before starting, ensure you have access to:
1. [GitHub Repository](https://github.com/Ar10Ansari/aashvo.git) (Branch: `master`)
2. [Render Dashboard](https://dashboard.render.com/)
3. [Vercel Dashboard](https://vercel.com/)
4. Target Database Credentials (either Neon Staging or Supabase Primary)

---

## Step 1: Generate RS256 JWT Keypair (One-Time Setup)

The AASHVO NestJS backend requires an asymmetric RS256 keypair for secure authentication tokens.

Run this quick command in PowerShell or Bash to generate single-line PEM keys suitable for Render environment variables:

```bash
node -e "
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
console.log('--- JWT_SIGNING_PRIVATE_KEY ---');
console.log(privateKey.replace(/\n/g, '\\n'));
console.log('\n--- JWT_SIGNING_PUBLIC_KEY ---');
console.log(publicKey.replace(/\n/g, '\\n'));
"
```

Save these two strings securely for Step 2.

---

## Step 2: Deploy Backend to Render (Free Web Service)

### Option 2A: Using Render Blueprint (Recommended)
Because `render.yaml` is included in the root of the repository:
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository `Ar10Ansari/aashvo`.
4. Render will parse `render.yaml` and discover service `aashvo-api`.
5. Under environment variables marked `sync: false`, fill in the values:
   - `DATABASE_URL`: Your pooled database connection string.
   - `DIRECT_URL`: Your direct database connection string.
   - `JWT_SIGNING_PRIVATE_KEY`: Output from Step 1.
   - `JWT_SIGNING_PUBLIC_KEY`: Output from Step 1.
6. Click **Apply**.

### Option 2B: Manual Web Service Setup
If creating manually:
1. Click **New +** -> **Web Service**.
2. Connect `https://github.com/Ar10Ansari/aashvo.git`, branch `master`.
3. Set configuration:
   - **Name:** `aashvo-api`
   - **Region:** `Singapore`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm run contracts:build && npm --workspace=apps/api run prisma:generate && npm --workspace=apps/api run build
     ```
   - **Start Command:**
     ```bash
     npm --workspace=apps/api run start
     ```
   - **Instance Type:** `Free`
   - **Health Check Path:** `/api/v1/health/live`
4. Add the following **Environment Variables**:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `LOG_LEVEL` | `info` |
   | `ENABLE_SWAGGER` | `true` |
   | `DATABASE_URL` | *[Pooled PostgreSQL Connection String]* |
   | `DIRECT_URL` | *[Direct PostgreSQL Connection String]* |
   | `JWT_SIGNING_PRIVATE_KEY` | *[RS256 Private Key from Step 1]* |
   | `JWT_SIGNING_PUBLIC_KEY` | *[RS256 Public Key from Step 1]* |
   | `JWT_ISSUER` | `https://api.aashvo.in` |
   | `JWT_AUDIENCE` | `aashvo-clients` |
   | `JWT_ACCESS_TTL_SECONDS` | `900` |
   | `REFRESH_TOKEN_TTL_DAYS` | `30` |
   | `COOKIE_SECURE` | `true` |
   | `WEB_APP_URL` | `https://aashvo.vercel.app` |
   | `CORS_ALLOWED_ORIGINS` | `https://aashvo.vercel.app` |
   | `TRUST_PROXY` | `1` |
   | `THROTTLE_TTL_MS` | `60000` |
   | `THROTTLE_LIMIT` | `120` |
   | `STORAGE_PROVIDER` | `local` |
   | `LOCAL_STORAGE_BASE_DIR` | `./scratch/storage` |
   | `LOCAL_STORAGE_PUBLIC_BASE_URL` | `https://aashvo-api.onrender.com/assets` |
5. Click **Create Web Service**.

---

## Step 3: Connect Frontend on Vercel

1. Open [Vercel Dashboard](https://vercel.com/) -> Select project `aashvo`.
2. Navigate to **Settings** -> **Environment Variables**.
3. Add or update:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://aashvo-api.onrender.com/api/v1`
   - **Environments:** Production, Preview, Development
4. Navigate to **Deployments** -> Click **Redeploy** on the latest `master` commit.

---

## Step 4: Live Verification & Smoke Testing

Once Render displays **Service is live** and Vercel completes deployment:

### 1. Test Backend Liveness (Process is running)
```bash
curl -i https://aashvo-api.onrender.com/api/v1/health/live
```
**Expected Response:** HTTP 200 OK with `{"status":"ok", ...}`

### 2. Test Backend Readiness (Database connection active)
```bash
curl -i https://aashvo-api.onrender.com/api/v1/health/ready
```
**Expected Response:** HTTP 200 OK with `{"database":"ok", ...}`

### 3. Verify Swagger / OpenAPI Documentation
Open in browser:
`https://aashvo-api.onrender.com/docs`
Verify that OpenAPI endpoints load cleanly.

### 4. Test CORS Preflight from Vercel
```bash
curl -i -X OPTIONS https://aashvo-api.onrender.com/api/v1/health/live \
  -H "Origin: https://aashvo.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```
**Expected Response:** HTTP 204 or 200 with header:
`Access-Control-Allow-Origin: https://aashvo.vercel.app` and `Access-Control-Allow-Credentials: true`.

### 5. Frontend End-to-End Verification
1. Visit `https://aashvo.vercel.app`.
2. Verify homepage renders with "Our Founders" section intact.
3. Open Developer Tools (Network tab).
4. Perform user registration/login or browse listings to confirm live calls to `https://aashvo-api.onrender.com/api/v1`.

---

## Step 5: Rollback Procedures

### Frontend Rollback (Vercel)
If a critical UI issue is identified:
1. Open Vercel -> Deployments.
2. Locate the previous stable deployment.
3. Click **Instant Rollback**. Traffic is immediately routed to the prior build.

### Backend Rollback (Render)
If the backend exhibits runtime anomalies:
1. Open Render Dashboard -> `aashvo-api` -> **Events**.
2. Select previous successful deploy -> Click **Rollback to this deploy**.
3. Check **Logs** to confirm successful restart.

