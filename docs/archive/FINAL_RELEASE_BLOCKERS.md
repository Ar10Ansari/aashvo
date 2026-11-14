# AASHVO — FINAL RELEASE BLOCKERS & PRODUCTION READINESS GAPS
## Authoritative CTO Defect Log, External Dependencies & Pre-Flight Launch Gates

**Author:** Chief Technology Officer & Principal Software Architect  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Audit Date:** November 14, 2026  
**Overall Readiness Verdict:** **CLEARED FOR STAGING — BLOCKED FOR IMMEDIATE PUBLIC PRODUCTION**

---

## 1. CRITICAL BLOCKERS (MUST RESOLVE BEFORE PUBLIC PRODUCTION)

The following items are hard blockers preventing an immediate public production launch. They must not be bypassed or ignored:

| Blocker ID | Domain | Description | Current State | Resolution Path | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | **Cloud Compute** | DigitalOcean App Platform container hosting for NestJS backend is unprovisioned. | Backend runs locally on `127.0.0.1:4000`. | Create DigitalOcean App Platform app in `BLR1` region. Set environment variables. | DevOps / Founder |
| **BLK-02** | **Cloud Database** | DigitalOcean Managed PostgreSQL 16 cluster in `BLR1` is unprovisioned. | Tested against local PostgreSQL 16.16 on port 5433. | Provision Managed PG 16 cluster, apply Prisma migrations (`npx prisma migrate deploy`). | DBA / Founder |
| **BLK-03** | **Cloud Storage (Public)** | Cloudflare R2 bucket `aashvo-public-assets-prod` and R2 API tokens are unprovisioned. | Staged via S3-compatible client; credentials not populated in prod. | Create R2 bucket, configure custom domain `media.aashvo.com`, issue read/write API token. | DevOps / Founder |
| **BLK-04** | **Cloud Storage (Private)** | AWS S3 bucket in `ap-south-1` (Mumbai) for private rental agreements and dispute evidence is unprovisioned. | Staged in configuration; no IAM user or bucket active. | Create `aashvo-private-docs-prod` in `ap-south-1`, enable AES-256 SSE, restrict to presigned URLs. | Security / DevOps |
| **BLK-05** | **Transactional Email** | Live production email dispatch (Resend / AWS SES) is unconfigured. | Test environment uses `NoopMailer`. | Create Resend or AWS SES account, verify domain `aashvo.com` (DKIM/SPF), obtain API key. | Product / Founder |
| **BLK-06** | **Production DNS & SSL** | Custom domains (`api.aashvo.com`, `media.aashvo.com`) and production Vercel DNS unmapped. | Frontend resides on `https://aashvo.vercel.app`. | Add CNAME records in DNS provider, provision TLS 1.3 certificates. | DevOps |
| **BLK-07** | **Dependency CVEs** | 4 High-severity vulnerabilities detected in production runtime (`npm audit --omit=dev`). | `deepmerge-ts` inside `@prisma/config` (GHSA-ggr8-5vv4-36mx); `zod` (< 4.6.6) (GHSA-mrhx-c7xc-m3w5). | Evaluate breaking upgrades to `prisma@7.x` and `zod@4.x` or apply compensating input limits. | Security Lead |

---

## 2. LEGAL, REGULATORY & BUSINESS OPERATIONAL BOUNDARIES

The product implementation has deliberately bounded scope to avoid regulatory non-compliance under Indian law:

### BLK-08: Tenancy Agreements vs. Statutory Registration
- **Current Capability:** The platform drafts, signs, and timestamps digital tenancy agreements between verified landlord and tenant profiles.
- **Legal Reality:** Under Section 17 of the Registration Act, 1908 and various state tenancy acts (e.g. Maharashtra, Karnataka), lease agreements exceeding 11 months require formal stamp duty payment and registration before a Sub-Registrar.
- **Classification:** **VERIFIED WITH LIMITATIONS**.
- **Action Required:** Terms of Service and UI disclaimers must state clearly that AASHVO tenancy agreements constitute digital agreements between private parties and do not constitute statutory registered leases with government land revenue departments.

### BLK-09: Rent Payment Ledger vs. Escrow / Payment Settlement
- **Current Capability:** Rent payment records log payment categories, amounts, dates, and UPI transaction references (`transaction_reference`) for landlord digital confirmation.
- **Legal Reality:** The platform does NOT take custody of funds, operate an escrow account, or act as an authorized Payment Aggregator under Reserve Bank of India (RBI) Payment and Settlement Systems Act, 2007.
- **Classification:** **VERIFIED WITH LIMITATIONS**.
- **Action Required:** Retain zero-custody peer-to-peer payment ledger model. Direct payment integration requires partnership with an RBI-licensed payment aggregator (Razorpay, Cashfree).

### BLK-10: Domestic Indian SMS OTP Verification
- **Current Capability:** Email verification is 100% operational with single-use cryptographically secure tokens.
- **Legal Reality:** Indian telecom regulations (TRAI) mandate commercial entities register their business entity, sender headers (e.g. `ASHVO`), and SMS templates on a Distributed Ledger Technology (DLT) platform before sending domestic transactional SMS.
- **Classification:** **BLOCKED BY EXTERNAL DEPENDENCY**.
- **Action Required:** Complete TRAI DLT registration before activating SMS OTP. Keep email verification as the primary authentication gate for v1.0.0.

---

## 3. STAGING VS. PRODUCTION LAUNCH GATES

```
[Phase 1: Code Complete & Local Verification] ---> 100% COMPLETE (285/285 Tests Pass)
                    │
                    ▼
[Phase 2: Cloud Staging Environment] ------------> READY TO DEPLOY
   ├── Provision Staging Managed PG 16
   ├── Provision Staging App Platform Container
   ├── Provision Staging Cloudflare R2 Bucket
   └── Verify End-to-End Smoke Tests on Staging URL
                    │
                    ▼
[Phase 3: Security & Dependency Remediation] ----> PENDING (BLK-07)
   ├── Evaluate Prisma/Zod Breaking Upgrade Path
   └── Enforce strict input collection size limits in Zod
                    │
                    ▼
[Phase 4: Production Infrastructure Cutover] ----> BLOCKED (BLK-01 to BLK-06)
   ├── Provision Production DigitalOcean & AWS Resources
   ├── Configure Production DNS (aashvo.com, api.aashvo.com)
   └── Verify Backups, WAL Archiving, and Production Monitoring
                    │
                    ▼
[Phase 5: Public Launch] ------------------------> REQUIRES CTO & FOUNDER AUTHORIZATION
```

