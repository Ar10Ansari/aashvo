# AASHVO — PRODUCTION LAUNCH CHECKLIST & RUNBOOK

**Author:** AASHVO CTO & Principal Systems Architect  
**Date:** November 24, 2026  
**Repository:** `D:\Projects\AASHVO`  
**Target Release:** Production 1.0.0  
**Current Status:** Gated at Staging UAT Completion

---

## 1. Overview & Launch Phasing

This checklist defines the strict operational gating requirements to promote AASHVO from staging to full production readiness. No production deployment shall proceed without 100% sign-off across all mandatory gates.

```
+--------------------------------------------------------------------------------+
| LAUNCH PHASE PROGRESSION                                                       |
|                                                                                |
| [ Phase 1: Staging UAT ]  -->  [ Phase 2: Pre-Launch Gating ]                  |
|            |                                   |                               |
|            v                                   v                               |
| [ Phase 3: Zero-Downtime Rollout ] --> [ Phase 4: Post-Launch Telemetry ]      |
+--------------------------------------------------------------------------------+
```

---

## 2. Gate 1: Code Integrity & Branch Management

- [ ] **Master Branch Protection:**
  - Branch protection rules enabled on GitHub `master`.
  - Require status checks to pass before merging (`CI`, `Typecheck`, `E2E Tests`).
  - Require at least 1 independent pull request review approval.
  - Enforce linear history / squash merging (no merge bubbles).
- [ ] **PR Merging Order:**
  - PR #2 (`fix/mobile-responsive-performance-polish`) merged to master.
  - PR #3 (`audit/independent-verification-e2e-expansion`) merged to remediation branch.
  - Staging candidate (`infra/neon-staging`) validated, verified against Neon staging, and ready for release gate.
- [ ] **Secrets & Audit Cleanliness:**
  - Zero hardcoded secrets, test credentials, or bypass tokens in commit history (`git log -S bypass`).
  - `.gitignore` verified to exclude `.env*`, `.pem`, `.key`, and local build outputs.

---

## 3. Gate 2: Database Sizing, Pooling & Migrations

- [ ] **PostgreSQL Production Instance:**
  - Database engine: PostgreSQL 16.x on Neon / AWS RDS.
  - Connection pooling active (PgBouncer or Neon pooled endpoint, port 6543/5432).
  - Maximum connections tuned: `max_connections >= 100`, pool size set to 20 per API replica.
- [ ] **Automated Backups & Point-in-Time Recovery (PITR):**
  - Continuous WAL archiving enabled with 7-day minimum retention.
  - Automated daily snapshots configured at 03:00 IST.
  - Cold recovery drill tested: Schema and seed restored cleanly to a test instance.
- [ ] **Migration Idempotency:**
  - All 13 Supabase migrations verified against fresh database.
  - All 7 Prisma migrations applied via `npx prisma migrate deploy`.
  - Row Level Security (RLS) active on all public tables: `profiles`, `properties`, `inquiries`, `reviews`.

---

## 4. Gate 3: Cloud Infrastructure & Storage

- [ ] **API Production Hosting (Render / ECS / Kubernetes):**
  - Minimum 2 load-balanced container instances (Auto-scaling: Min 2, Max 10).
  - Memory limit >= 512 MB per instance; CPU >= 0.5 vCPU.
  - Health check endpoint `/health` configured with 15s timeout and 3-strike unhealthiness threshold.
- [ ] **Vercel Production Frontend:**
  - Custom domain bound (`aashvo.com`, `www.aashvo.com`) with automated Let's Encrypt SSL/TLS.
  - DNS CAA and A/CNAME records configured with 300s TTL.
  - Vercel deployment protection enabled; all automation bypass tokens securely managed.
- [ ] **Cloud Storage Configuration:**
  - **Cloudflare R2 (Media):** Bucket `aashvo-prod-media` with custom domain `media.aashvo.com` + Cloudflare edge caching.
  - **AWS S3 Mumbai (Private Docs):** Bucket `aashvo-prod-docs-private` in `ap-south-1` with 100% Block Public Access, AES256 server-side encryption, and strict IAM credentials.

---

## 5. Gate 4: Security, Authentication & Session Hardening

- [ ] **Asymmetric JWT Architecture:**
  - 2048-bit RSA key pair provisioned (`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`).
  - Private key stored strictly in secure server environment variables; never checked into repo.
  - Access token lifespan: 15 minutes (`900s`).
  - Refresh token lifespan: 7 days (`604800s`) with rotation on every refresh call.
- [ ] **Cookie Security:**
  - Prefix `__Host-` enforced on production cookies.
  - Flags enforced: `HttpOnly; Secure; SameSite=Strict; Path=/`.
  - Subdomain cookie isolation configured (`Domain=aashvo.com`).
- [ ] **CORS & Origin Security:**
  - Whitelist restricted exclusively to `https://aashvo.com` and `https://www.aashvo.com`.
  - Wildcards (`*`) strictly rejected when `credentials: true`.
- [ ] **Rate Limiting & DDoS Defense:**
  - Cloudflare Web Application Firewall (WAF) active on apex domain.
  - API rate limiting: 100 requests / 15 minutes per IP for public endpoints; 10 requests / minute for `/api/v1/auth/*`.

---

## 6. Gate 5: Observability, Logging & Alerting

- [ ] **Error Tracking (Sentry):**
  - Sentry SDK initialized in both Frontend (`@sentry/react`) and Backend (`@sentry/node`).
  - Environment tagged as `production`.
  - Alert rules configured: Trigger Slack / PagerDuty alert on >10 errors/minute or any unhandled exception.
- [ ] **Structured Logging:**
  - Winston / Pino JSON logger writing structured JSON to stdout.
  - PII scrubbing filter active (passwords, auth tokens, phone numbers, Aadhaar masked).
- [ ] **Uptime & Health Monitoring:**
  - BetterStack / Pingdom pinging `/health` every 60 seconds from multi-region probe locations.

---

## 7. Gate 6: Launch Day Execution Runbook

```
Step 1: Freeze code changes (T-24h).
Step 2: Take manual pre-launch snapshot of PostgreSQL database.
Step 3: Run `npx prisma migrate deploy` on production database.
Step 4: Deploy `apps/api` to production Render/cloud instance. Verify `/health`.
Step 5: Promote Vercel frontend build to Production domain.
Step 6: Execute automated smoke test suite against live production endpoints:
        - Health check
        - User registration & login
        - Property search & filter
        - S3/R2 presigned upload verification
Step 7: Announce public availability.
```

---

## 8. Rollback Plan

In the event of an unrecoverable failure during launch:
1. **Frontend Rollback:** In Vercel Dashboard -> Deployments -> Instantly revert domain alias to previous stable deployment (1-click rollback, <10 seconds).
2. **Backend Rollback:** In Render Dashboard -> Rollback service to prior release image tag (<60 seconds).
3. **Database Rollback:** If migration caused schema corruption, restore from pre-launch snapshot using PITR.
