# AASHVO — MASTER RELEASE INTEGRATION REGISTER
## External Services, Cloud Providers, API Contracts, Credentials & Storage Matrix

**Author:** CTO & Principal Software Architect  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  
**Integration Status:** **STAGED & CONFIGURED VIA UNIFIED CONFIGURATION MATRIX**

---

## 1. EXTERNAL INTEGRATION INVENTORY & CONTRACTS

| Service / Provider | Purpose & Workstream | Protocol / SDK | Region / Host | Authentication Method | Staging / Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DigitalOcean Managed PostgreSQL** | Primary relational database (23 tables) | TCP Port 5432 / 25060 (TLS 1.3) | `BLR1` (Bangalore, India) | SCRAM-SHA-256 with CA Certificate | Verified locally on port 5433 |
| **DigitalOcean App Platform** | NestJS 11 Containerized Application Hosting | HTTPS (Docker OCI image) | `BLR1` (Bangalore, India) | Internal VPC / Direct DO Token | Local node server (`PORT=4000`) |
| **Cloudflare R2** | Public property photos & user avatars | S3-Compatible API via `@aws-sdk/client-s3` | Global Anycast / India Edge | Access Key ID + Secret Access Key | Staged via `MediaModule` presigned URLs |
| **AWS S3** | Sensitive private rental documents & dispute evidence | AWS SDK v3 Presigned Put/Get | `ap-south-1` (Mumbai, India) | IAM Role / Access Keys with restricted bucket policy | Local simulated storage / staging URLs |
| **Upstash Redis** | Distributed rate limiting & notification outbox queue | Redis RESP3 / TLS Port 6379 | `ap-south-1` (Mumbai, India) | Redis URL with TLS token | PostgreSQL `notification_outbox` table |
| **Resend / AWS SES** | Transactional verification & reset emails | SMTP / HTTPS REST API | `ap-south-1` (Mumbai, India) | Bearer API Key | In-memory `NoopMailer` in test environment |
| **Twilio / MSG91** | Indian domestic SMS OTP for phone verification | HTTPS REST API | India Domestic Gateway | Auth Token / API Key | Staged interface (`phoneVerified` toggle) |
| **Hosted Supabase (`himtwnwxvnnykafyhysy`)** | Legacy source system & historical archive | HTTPS PostgREST / GoTrue | `ap-south-1` (Mumbai, India) | Anon Key & Service Role Key | Untouched; read-only archive |

---

## 2. STORAGE BUCKET TAXONOMY & ACCESS POLICIES

| Bucket Name | Target Cloud Storage | Access Policy | MIME Types Allowed | Max Size | Retention Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `property-photos` | Cloudflare R2 | Public Read, Signed Put | `image/jpeg`, `image/png`, `image/webp` | 10 MiB | Indefinite until listing deleted |
| `user-avatars` | Cloudflare R2 | Public Read, Signed Put | `image/jpeg`, `image/png`, `image/webp` | 5 MiB | Overwritten on avatar change |
| `rental-documents` | AWS S3 `ap-south-1` | **Private Only**, Signed Get/Put | `application/pdf`, `image/jpeg`, `image/png` | 25 MiB | 7 years (statutory lease compliance) |
| `support-attachments` | AWS S3 `ap-south-1` | **Private Only**, Signed Get/Put | `image/jpeg`, `image/png`, `application/pdf` | 10 MiB | 3 years post ticket resolution |

---

## 3. SECRETS MANAGEMENT & ENVIRONMENT INVENTORY

All secrets are strictly declared in `apps/api/.env.example` and validated on NestJS startup using `@nestjs/config` and `class-validator` schema:

1. `DATABASE_URL`: SCRAM-SHA-256 PostgreSQL connection string with SSL mode.
2. `JWT_SIGNING_PRIVATE_KEY` / `JWT_SIGNING_PUBLIC_KEY`: 2048-bit RSA PEM keypair for RS256 token issuance and verification.
3. `COOKIE_SECRET`: Cryptographic secret for signing session refresh cookies.
4. `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: S3-compatible credentials for public asset uploads.
5. `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: IAM credentials scoped exclusively to `s3:PutObject` and `s3:GetObject` on `aashvo-private-docs-prod`.
6. `CORS_ALLOWED_ORIGINS`: Comma-separated allowlist of web clients (`https://aashvo.vercel.app`).

