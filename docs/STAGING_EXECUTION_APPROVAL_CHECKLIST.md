# AASHVO STAGING EXECUTION APPROVAL CHECKLIST
## RC-1.0.0 | Founder & CTO Sign-Off Gate

| Governance Metadata | Details |
| :--- | :--- |
| **Phase** | Staging Authorization & Infrastructure Provisioning |
| **Release Candidate** | AASHVO RC-1.0.0 |
| **Target Date** | Post-Audit Immediate Execution |
| **Monthly Budget Impact** | **$23.66 USD / month** (~₹2,011.00 INR / month including 18% GST) |
| **Current Operational Status** | **PREPARED & VERIFIED LOCALLY — AWAITING FOUNDER SIGN-OFF** |

---

## 1. Safety Boundaries & Anti-Destruction Guarantees

Prior to requesting founder execution authorization, the engineering team formally verifies that all anti-destruction guardrails are in place:

- [x] **Zero Production Disruption:** The live production website (`https://aashvo.vercel.app`) remains untouched and isolated.
- [x] **Zero Supabase Touch:** Hosted Supabase (`himtwnwxvnnykafyhysy`) is completely air-gapped and omitted from staging configurations.
- [x] **Zero Local Data Loss:** Local PostgreSQL 16 test database, Docker data, and WSL distributions remain preserved without pruning or deletion.
- [x] **Zero Unauthorized Cloud Spend:** No cloud provider account has been billed or charged; no provision command has been executed.
- [x] **Zero Remote Git Mutation:** No unapproved branch creation, push, or commit has been made to remote repository `Ar10Ansari/aashvo.git`.

---

## 2. Founder Decision Gates & Action Items

Before any cloud infrastructure is provisioned, the Founder/CTO must review and check off the following four decision gates:

### Gate 1: Cloud Billing Authorization
- [ ] **Monthly Infrastructure Commitment Approved:**
  - DigitalOcean App Platform (BLR1): $5.00 / month
  - DigitalOcean Managed PostgreSQL 16 (BLR1): $15.00 / month
  - Cloudflare R2 Storage (Public Assets): $0.00 / month (Free Tier)
  - AWS S3 Storage (Mumbai `ap-south-1` Private): $0.05 / month
  - Resend Transactional Email: $0.00 / month (Free Tier: 3,000 emails/mo)
  - Estimated Total with 18% GST: **~₹2,011.00 INR / month ($23.66 USD)**
  - *Founder Signature / Confirmation Date:* `__________________________`

### Gate 2: External Account Credentials Provisioning
The Founder or designated administrator must create or supply access to the following 4 cloud service accounts:

- [ ] **DigitalOcean Account:**
  - Create project: `AASHVO-Staging`.
  - Generate Personal Access Token (Read + Write) -> `DO_ACCESS_TOKEN`.
  - Confirm region availability for Bangalore (`blr1`).
- [ ] **Cloudflare R2 Account:**
  - Create R2 Bucket: `aashvo-public-staging`.
  - Generate R2 S3-Compatible API Token (Object Read & Write) -> `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`.
  - Configure CORS policy allowlisting `https://staging.aashvo.vercel.app`.
- [ ] **AWS Account (Mumbai ap-south-1):**
  - Create private S3 Bucket: `aashvo-private-staging` in region `ap-south-1`.
  - Enable default AES-256 server-side encryption.
  - Enable "Block all public access".
  - Create IAM user `aashvo-staging-app` with restricted S3 read/write policy.
  - Provide IAM credentials -> `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`.
- [ ] **Resend Account:**
  - Verify sending domain (e.g., `notifications.aashvo.com` or use default onboarding domain).
  - Generate API key -> `RESEND_API_KEY`.

### Gate 3: DNS & Routing Configuration
- [ ] **Staging Subdomains Approved:**
  - Frontend: `staging.aashvo.vercel.app` (or custom subdomain `staging.aashvo.com`).
  - Backend API: `api-staging.aashvo.com` (pointed to DigitalOcean App Platform CNAME).
  - Public Assets CDN: `public-staging.aashvo.com` (pointed to Cloudflare R2).

### Gate 4: Production Admin Whitelist Authorization
- [ ] **Admin Account Provisioning Allowlist:**
  - Confirm the exact email address(es) permitted to hold the `ADMIN` role on staging:
    1. Primary Administrator: `__________________________`
    2. Operational Lead: `__________________________`

---

## 3. Pre-Flight Verification Audit Matrix

The following quality benchmarks have been verified by the engineering lead prior to presenting this checklist:

| Verification Area | Benchmark Standard | Verified Local Result | Verification Command | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Shared Contracts** | Zero TS compilation errors | Clean build (0 errors) | `npm run contracts:build` | **PASSED** |
| **Prisma Schema** | Valid schema & generated client | Valid schema, v6.19.3 | `npx prisma validate` | **PASSED** |
| **Backend Integration** | 100% Jest tests on PostgreSQL 16 | 8/8 suites, 53/53 tests passed | `cd apps/api; npx jest --runInBand` | **PASSED** |
| **Frontend Unit / E2E** | 100% Vitest tests passed | 21/21 suites, 232/232 tests passed | `npm test` | **PASSED** |
| **Frontend Production Build** | Clean Vite build under 500kB | `dist/index.js` 461 kB (116 kB gzip) | `npm run build` | **PASSED** |
| **API Surface Alignment** | 100% routes registered | 55 paths, 62 operations | `npm run api:openapi` | **PASSED** |
| **Database Restore Drill** | Exact table count restored | 24 tables restored in 4.8s | `pg_dump` & `pg_restore` drill | **PASSED** |
| **Security Audit (CVEs)** | 0 runtime HTTP exploit paths | 4 transitive dev/CLI CVEs mitigated | `npm audit --omit=dev` | **PASSED** |

---

## 4. Execution Step Sequence (Upon Approval)

Once Gates 1 through 4 are checked off, the engineering team will execute the 11-step Staging Deployment Runbook in exact sequence:

1. **Step 1:** Cloud provider accounts & credentials initialization.
2. **Step 2:** DigitalOcean Managed PostgreSQL 16 cluster provisioning (`blr1`).
3. **Step 3:** Object storage buckets creation (Cloudflare R2 & AWS S3 Mumbai).
4. **Step 4:** Transactional email domain verification (Resend).
5. **Step 5:** App Platform environment variables configuration (using RSA keys & secrets).
6. **Step 6:** Monorepo container build & database migration deployment (`prisma migrate deploy`).
7. **Step 7:** Backend API health verification (`GET /api/v1/health` -> 200 OK).
8. **Step 8:** Frontend staging deployment on Vercel preview branch (`staging.aashvo.vercel.app`).
9. **Step 9:** Cross-domain CORS & HttpOnly cookie configuration validation.
10. **Step 10:** Execution of the 30-Journey End-to-End Acceptance Test Suite.
11. **Step 11:** Production Readiness Sign-Off & staging handoff to stakeholders.

---

## 5. Formal Sign-Off Authorization

By signing below, the Founder and CTO authorize the deployment of AASHVO RC-1.0.0 to the staging environment and approve the cloud infrastructure expenditure detailed above:

```
[ ] APPROVED TO PROCEED WITH STAGING DEPLOYMENT
[ ] BLOCKED — REVISIONS REQUIRED (Specify below)

Founder / CTO Name:      __________________________________________________

Signature:               __________________________________________________

Date:                    __________________________________________________

Notes / Constraints:     __________________________________________________
```

