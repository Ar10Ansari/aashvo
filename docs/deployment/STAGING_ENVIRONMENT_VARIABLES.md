# AASHVO — STAGING ENVIRONMENT VARIABLES INVENTORY
## Master Configuration Reference, Validation Rules & Secrets Generation Guide

**Author:** Chief Technology Officer & DevOps Lead  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 15, 2026  
**Confidentiality:** **SENSITIVE TEMPLATE — ZERO REAL SECRETS COMMITTED**

---

## 1. BACKEND API ENVIRONMENT VARIABLES (`apps/api`)

These variables must be populated in the **DigitalOcean App Platform** settings for the staging application. All variables are validated at startup by `apps/api/src/infrastructure/config/env.schema.ts`.

| Variable Name | Required? | Classification | Example Staging Value | Description & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **YES** | Config | `staging` | Runtime mode. Must be one of `development`, `test`, `staging`, `production`. |
| `PORT` | **YES** | Config | `4000` | Port NestJS listens on. Defaults to 4000. |
| `TRUST_PROXY` | **YES** | Config | `true` | Must be `true` behind DigitalOcean/Cloudflare reverse proxy for rate-limiting IP resolution. |
| `DATABASE_URL` | **YES** | **SECRET** | `postgresql://doadmin:secret@db-pool-host:25060/aashvo_staging?sslmode=require` | Connection-pooled (PgBouncer) connection string with SSL enabled. |
| `DIRECT_URL` | **YES** | **SECRET** | `postgresql://doadmin:secret@db-direct-host:5432/aashvo_staging?sslmode=require` | Direct database connection for running Prisma migrations. |
| `JWT_SIGNING_PRIVATE_KEY`| **YES** | **SECRET** | `-----BEGIN PRIVATE KEY-----\nMIIEvg...` | 2048-bit RSA Private Key PEM used to sign access tokens (RS256). |
| `JWT_SIGNING_PUBLIC_KEY` | **YES** | Public | `-----BEGIN PUBLIC KEY-----\nMIIBIj...` | 2048-bit RSA Public Key PEM used to verify access tokens. |
| `JWT_ACCESS_EXPIRATION_SECONDS` | NO | Config | `900` | Access token lifespan in seconds (15 minutes). |
| `JWT_REFRESH_EXPIRATION_SECONDS`| NO | Config | `2592000` | Refresh token lifespan in seconds (30 days). |
| `COOKIE_SECURE` | **YES** | Config | `true` | When `true`, cookies enforce `Secure` flag and `__Host-` prefix. |
| `COOKIE_SECRET` | **YES** | **SECRET** | `a1b2c3d4e5f6...` (64-byte hex) | Cryptographic secret for signing HTTP-only session cookies. |
| `CORS_ALLOWED_ORIGINS` | **YES** | Config | `https://staging.aashvo.vercel.app` | Comma-separated allowlist of origins. Wildcards (`*`) forbidden. |
| `THROTTLE_TTL_MS` | NO | Config | `60000` | Throttler time window in milliseconds (1 minute). |
| `THROTTLE_LIMIT` | NO | Config | `60` | Maximum requests per IP per time window. |
| `STORAGE_PROVIDER` | **YES** | Config | `s3_compatible` | Storage backend: `s3_compatible` or `memory`. |
| `CLOUDFLARE_R2_ACCOUNT_ID` | **YES** | Config | `a1b2c3d4e5f6...` | Cloudflare account identifier for R2 access. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | **YES** | **SECRET** | `r2_access_key_123` | R2 S3-compatible API access key. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | **YES** | **SECRET** | `r2_secret_key_456` | R2 S3-compatible API secret key. |
| `CLOUDFLARE_R2_BUCKET` | **YES** | Config | `aashvo-public-staging` | R2 bucket for public property photos and avatars. |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL` | **YES** | Config | `https://media-staging.aashvo.com` | Custom domain serving public R2 assets. |
| `AWS_REGION` | **YES** | Config | `ap-south-1` | AWS region for private document storage (Mumbai). |
| `AWS_ACCESS_KEY_ID` | **YES** | **SECRET** | `AKIAIOSFODNN7EXAMPLE` | IAM user access key for AWS S3. |
| `AWS_SECRET_ACCESS_KEY` | **YES** | **SECRET** | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | IAM user secret access key for AWS S3. |
| `AWS_S3_PRIVATE_BUCKET` | **YES** | Config | `aashvo-private-staging` | Private S3 bucket for tenancy agreements and disputes. |
| `EMAIL_PROVIDER` | **YES** | Config | `resend` | Transactional email provider: `resend` or `memory`. |
| `RESEND_API_KEY` | **YES** | **SECRET** | `re_staging_123456789` | Resend API key for transactional emails. |
| `MAIL_FROM_ADDRESS` | **YES** | Config | `staging@aashvo.com` | Sender email address for outgoing system notifications. |

---

## 2. FRONTEND ENVIRONMENT VARIABLES (`Vercel Staging`)

These variables must be populated in the **Vercel Project Settings** under the **Preview / Staging** branch environment:

| Variable Name | Required? | Classification | Example Staging Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **YES** | Public | `https://api-staging.aashvo.com/api/v1` | Base URL of the staging NestJS API. |
| `VITE_USE_INDEPENDENT_BACKEND` | **YES** | Public | `true` | Directs frontend to use NestJS API client instead of Supabase client. |
| `VITE_STORAGE_PUBLIC_BASE_URL` | **YES** | Public | `https://media-staging.aashvo.com` | Base URL for loading public property photos. |

---

## 3. HOW TO GENERATE STAGING SECRETS SAFELY

Execute the following PowerShell commands locally to generate cryptographically random keys for staging (do not share or commit these):

### A. Generate 2048-Bit RSA Keypair for RS256 JWT
```powershell
# Generate Private Key
openssl genrsa -out staging_rsa_private.pem 2048

# Extract Public Key
openssl rsa -in staging_rsa_private.pem -pubout -out staging_rsa_public.pem

# View Private Key for App Platform (single-line or multiline)
Get-Content staging_rsa_private.pem -Raw
```

### B. Generate 64-Byte Cookie Secret
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### C. Verify Startup Validation Rules
Before deploying, you can verify your generated configuration against the Zod schema locally:
```powershell
cd apps/api
npm run typecheck
```
If any required variable is missing or fails formatting checks (e.g. invalid RSA PEM, non-numeric port), the NestJS process exits immediately on boot with a detailed error log.

