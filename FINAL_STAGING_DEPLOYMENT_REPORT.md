# AASHVO CTO — Final Staging Deployment Report

**Author:** AASHVO CTO & DevOps Lead  
**Date:** November 24, 2026  
**Integration Branch:** `infra/neon-staging`  
**Target Environments:** Vercel (Frontend Preview) & Render (Backend API Staging)  
**Status:** **DEPLOYMENT BLUEPRINT READY — FRONTEND PREVIEW ACTIVE**

---

## 1. Frontend Staging Preview Deployment (Vercel)

- **Target Deployment:** `https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app`
- **Branch Preview Alias:** `https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app`
- **Environment Variable Binding:**
  - `VITE_API_BASE_URL` successfully added to Vercel's `Preview` environment targeting `https://aashvo-api-staging.onrender.com`.
  - Added via Vercel CLI:
    ```bash
    npx vercel env add VITE_API_BASE_URL --project aashvo --environment preview --value "https://aashvo-api-staging.onrender.com" --yes
    ```
- **SPA Routing & Rewrite Protection:**
  - Updated [vercel.json](file:///d:/Projects/AASHVO/vercel.json) rewrite rule to `/((?!api/).*)` to guarantee that API routes never fall back to `index.html`.
- **Security & Secret Hygiene:**
  - Revoked automation bypass secret on Vercel CLI (`protectionBypass: false`).
  - Purged all hardcoded bypass secrets from test scripts and documentation.

---

## 2. Dedicated Backend Staging Service (Render Blueprint)

To guarantee that staging traffic and test records never pollute the production database, a dedicated blueprint [render.staging.yaml](file:///d:/Projects/AASHVO/render.staging.yaml) was created to declare `aashvo-api-staging`, keeping `render.yaml` 100% production-isolated:

```yaml
  - type: web
    name: aashvo-api-staging
    runtime: node
    plan: free
    region: singapore
    branch: infra/neon-staging
    buildCommand: npm ci --include=dev && npm run contracts:build && npm --workspace=apps/api run prisma:generate && npm --workspace=apps/api run build
    preDeployCommand: node apps/api/test/verify-and-migrate-neon.cjs deploy
    startCommand: npm --workspace=apps/api run start
    healthCheckPath: /api/v1/health/live
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: staging
      - key: PORT
        value: 10000
      - key: LOG_LEVEL
        value: debug
      - key: ENABLE_SWAGGER
        value: "true"
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: JWT_SIGNING_PRIVATE_KEY
        sync: false
      - key: JWT_SIGNING_PUBLIC_KEY
        sync: false
      - key: JWT_ISSUER
        value: https://api.staging.aashvo.in
      - key: JWT_AUDIENCE
        value: aashvo-clients
      - key: JWT_ACCESS_TTL_SECONDS
        value: 900
      - key: REFRESH_TOKEN_TTL_DAYS
        value: 30
      - key: COOKIE_SECURE
        value: "true"
      - key: COOKIE_SAME_SITE
        value: none
      - key: WEB_APP_URL
        value: https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app
      - key: CORS_ALLOWED_ORIGINS
        value: https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app,https://aashvo-git-staging-mvp-fa-10591b-abdul-rehman-ansari-s-projects.vercel.app
      - key: TRUST_PROXY
        value: "1"
      - key: THROTTLE_TTL_MS
        value: 60000
      - key: THROTTLE_LIMIT
        value: 120
      - key: STORAGE_PROVIDER
        value: cloud
      - key: CLOUDFLARE_R2_ACCOUNT_ID
        sync: false
      - key: CLOUDFLARE_R2_ACCESS_KEY_ID
        sync: false
      - key: CLOUDFLARE_R2_SECRET_ACCESS_KEY
        sync: false
      - key: CLOUDFLARE_R2_BUCKET_NAME
        value: aashvo-staging-public
      - key: CLOUDFLARE_R2_PUBLIC_URL
        value: https://cdn.staging.aashvo.in
      - key: AWS_REGION
        value: ap-south-1
      - key: AWS_S3_PRIVATE_BUCKET
        value: aashvo-staging-vault
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
```

---

## 3. Deployment Safety Audit

| Safety Invariant | Status | Verification Detail |
| :--- | :---: | :--- |
| **No Production Deployment** | **VERIFIED** | Production `master` branch untouched; production Render dyno serving live traffic. |
| **No DNS Modifications** | **VERIFIED** | Zero DNS records altered; no custom domain routing shifted. |
| **Zero Paid Resource Creation** | **VERIFIED** | Blueprint prepared in code; no new paid AWS/Render subscriptions initiated. |
| **No Premature PR Merges** | **VERIFIED** | Open PRs (#2, #3, #4) preserved unmerged in git ancestry. |
| **Clean Secret Boundaries** | **VERIFIED** | Zero secrets printed in logs, committed files, or reports. |
