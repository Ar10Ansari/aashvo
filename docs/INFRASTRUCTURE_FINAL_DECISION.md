# AASHVO — Infrastructure Final Decision & Cost Model (Sprint 0)

**Decision Date:** 2026-11-12  
**Approved Architecture Direction:** NestJS 11 + TypeScript Modular Monolith · Independent PostgreSQL (Prisma) · Vercel Frontend Preserved · Managed Cloud · Firebase Excluded  
**Skills Applied:** `aws-rds`, `aws-ecs-fargate`, `aws-s3`, `aws-secrets-manager`, `cloudflare-r2`, `redis`, `upstash-redis`, `upstash-ratelimit`, `database-backups`, `backup-recovery`, `vercel-deployments`

---

## 1. India Region & Service Revalidation Summary (Critical Verification Findings)

Before selecting final providers, every candidate service was revalidated for actual **Mumbai (`ap-south-1` / `bom`)** and **Bengaluru (`BLR1`)** regional availability and current product status:

| Provider / Service | Verified Mumbai Availability | Verified Bengaluru (`BLR1`) Availability | Sprint 0 Revalidation Finding & Impact |
|---|---|---|---|
| **DigitalOcean Managed PostgreSQL** | No | **Yes (`BLR1`)** | Fully available in India (`BLR1`); automated daily backups + WAL PITR (~5-min intervals) included on all plans, **hard-capped at 7-day rolling retention**. Connection limits strictly bound by RAM + built-in PgBouncer pooler. |
| **DigitalOcean App Platform** | No | **Yes (`BLR1`)** | Verified dynamic web/API/worker services deploy physically in **`blr1`** alongside `BLR1` Managed Postgres over private networking (`< 1 ms` DB RTT; `~12–18 ms` user RTT from Mumbai/Delhi NCR). |
| **AWS ECS Fargate (`ap-south-1`)** | **Yes (`ap-south-1`)** | No | Full production VPC compute in Mumbai. *(Note: **AWS App Runner stopped accepting new customers on April 30, 2026**; ECS Fargate / ECS Express Mode is the active path.)* |
| **Fly.io (`bom`)** | Gateway only (no `MPG`) | No | Fly.io consolidated regional infrastructure; **Fly Managed Postgres (`MPG`) is NOT supported in Mumbai (`bom`)**. Excluded as primary managed PG/compute host. |
| **Amazon S3 (`ap-south-1`)** | **Yes (`ap-south-1`)** | No | Native Mumbai physical residency, Block ALL Public Access, Object Versioning, SSE-KMS, Bucket Policies, and CloudTrail object read audit logs. |
| **DigitalOcean Spaces (`BLR1`)** | No | **Yes (`BLR1`)** | Native Bengaluru S3-compatible buckets (`$5/mo` minimum for `250 GiB` + `1 TiB` outbound transfer; free internal transfer to DO `BLR1` compute); lacks customer-managed KMS keys and granular CloudTrail-style object audit. |
| **Cloudflare R2** | **No India Jurisdiction** | **No India Jurisdiction** | Verified strict jurisdiction locks exist **only** for `eu`, `us`, and `fedramp`. Setting `apac` is a best-effort latency hint that may place objects outside India (e.g., Singapore). **Approved strictly for public `property-photos` and `user-avatars` only — NOT sensitive private documents.** |
| **Upstash Redis (`ap-south-1`)** | **Yes (`ap-south-1`)** | No | Serverless HTTP/REST Redis physically hosted in AWS Mumbai (`ap-south-1`), `< 1–3 ms` local latency, free tier (`500k` cmds/mo) scaling smoothly without idle Valkey node fees. |
| **DigitalOcean Managed Valkey (`BLR1`)** | No | **Yes (`BLR1`)** | Drop-in open-source Redis fork in `BLR1`; flat `$15/mo` single-node (`1 GiB`) / `$30/mo` HA (`2 GiB`) when TCP BullMQ workers outgrow DB outbox polling. |
| **Amazon SES (`ap-south-1`) / Resend** | **Yes (SES `ap-south-1`)** | Multi-region | SES Mumbai bills `$0.10 / 1,000 emails`; Resend offers `3,000/mo` (`100/day`) free tier for dev/staging & instant developer setup. |

---

## 2. Database Comparison: DigitalOcean Managed PostgreSQL Plans & Constraints

| Specification | DO Basic (`1 GiB / 1 vCPU`) | DO Basic (`2 GiB / 1 vCPU`) | DO Production HA (`2 GiB` Primary + Standby) | AWS RDS `db.t4g.micro` Multi-AZ (`ap-south-1`, Fallback) |
|---|---|---|---|---|
| **Base Compute Cost** | **$15.00 / mo** | **$30.00 / mo** | **~$50.00–$60.00 / mo** *(2 nodes; verify exact 2 GiB HA tier in DO console; 1 GiB HA starts at $30/mo)* | ~$31–$33 / mo compute + mirrored `gp3` storage (`$0.115–0.12/GB-mo`) |
| **Storage Included** | 10 GiB | 25 GiB | 25 GiB (mirrored standby) | Billed per GiB provisioned |
| **Usable Connections (`max_connections`)** | **22** *(25 total minus 3 reserved)* | **47** *(50 total minus 3 reserved)* | **47** *(plus read-only standby offload)* | Formula-driven (~85–112 on 1 GiB RAM) |
| **Connection Pooling** | **Built-in PgBouncer** (mandatory!) | **Built-in PgBouncer** | **Built-in PgBouncer** | Separate **RDS Proxy** (~$11+/vCPU-mo) or app-level pool |
| **High Availability (Auto-Failover)** | No (Single Node) | No (Single Node) | **Yes (Synchronous Standby)** | **Yes (Synchronous Multi-AZ)** |
| **Automated Backup & PITR Window** | Daily snapshot + **~5m WAL PITR (7-day rolling max)** | Daily + **7-day PITR** | Daily + **7-day PITR** | Daily + **14–35 day PITR** |

### Critical Architectural Controls Required for DigitalOcean Managed PG
1. **7-Day Backup Ceiling Mitigation:** Because DigitalOcean strictly rotates automated backups & WAL PITR every **7 days** with no built-in cold archive tier, an automated **nightly encrypted `pg_dump` via `restic`** (or Age-encrypted archive) pushed to **AWS S3 `ap-south-1` (Mumbai)** with 90-day lifecycle retention is **mandatory** for 3-2-1 compliance.
2. **PgBouncer + Prisma Configuration:** Entry tiers expose only **22–47 direct backend connections**. Configure Prisma `connection_limit=5` per API pod pointing to DO's **PgBouncer transaction pool port**, using direct port (`25060`) exclusively for `prisma migrate deploy`.

---

## 3. Storage Comparison: Public vs. Sensitive India-Region Private Vault

| Evaluation Criterion | **Cloudflare R2 (`apac` hint)** | **AWS S3 (`ap-south-1` Mumbai)** | **DigitalOcean Spaces (`BLR1`)** |
|---|---|---|---|
| **Physical Indian Residency** | **No guarantee** (`apac` spans regional hubs; no India jurisdiction lock) | **Yes — Strictly Mumbai (`ap-south-1`)** | **Yes — Strictly Bengaluru (`BLR1`)** |
| **Assigned AASHVO Buckets** | `aashvo-public-media` (`property-photos`, `user-avatars`) | `aashvo-private-vault` (`rental-documents`, `support-attachments`) | *(Alternative private vault if avoiding AWS billing)* |
| **Public Access Controls** | Custom domain CDN (`media.aashvo.in`) | **Block ALL Public Access = ON**; 15m S3 Presigned GET only via `MediaModule` | ACL `private`; 15m Presigned GET via `MediaModule` |
| **Encryption & Audit** | SSE-AES256 + Cloudflare audit | **SSE-KMS (CMK)** + Object Versioning + **S3 CloudTrail data events** | SSE-AES256 at rest; no customer-managed KMS or CloudTrail granularity |
| **Storage Price** | **10 GB/mo free**; `$0.015/GB-mo` | `$0.025/GB-mo` (`ap-south-1`) | **`$5.00/mo` flat** (includes `250 GiB` + `1 TiB` outbound; `$0.02/GiB` extra) |
| **Egress Cost** | **$0.00 unlimited** | `$0.109/GB` to internet | `1 TiB/mo` included; `$0.01/GiB` overage; **$0/GB internal to DO `BLR1`** |
| **Bulk Export Portability** | S3-compatible (`rclone` / AWS SDK v3) | S3-compatible (`aws s3 sync`) | S3-compatible (`rclone` / `s3cmd`) |

**Decision:** Split storage cleanly behind the single S3-SDK-v3 `MediaModule` abstraction:
- **Public media (`property-photos`, `user-avatars`) → Cloudflare R2:** Zero egress eliminates bandwidth spikes as listing galleries scale.
- **Sensitive private documents (`rental-documents`, `support-attachments`, + nightly encrypted DB backups) → AWS S3 (`ap-south-1` Mumbai):** Guarantees strict physical Indian soil residency, SSE-KMS encryption, Object Versioning against accidental deletion, and immutable CloudTrail access audit logs at `< $2/mo` initial spend. *(All credentials stay server-side; zero keys touch browser/mobile bundles.)*

---

## 4. Managed Redis Decision ("Only Where Required")

- **Do NOT provision a fixed `$15–$30/mo` DigitalOcean Managed Valkey cluster in Dev, Staging, or Day-1 Launch.**
- Instead:
  - **Asynchronous Emails & SMS:** `NotificationsModule` writes to PostgreSQL `notification_outbox` (transactional with domain writes!) and polls cleanly on a lightweight in-process worker loop inside `apps/api` (or dedicated low-memory worker dyno) at launch scale (`< 10k jobs/day`).
  - **Rate Limiting, OAuth `state`, JWT Revocation Cutoff & Idempotency Keys:** Use **Upstash Redis (`ap-south-1` Mumbai)** over REST/HTTP (`$0/mo` free tier up to `500,000` commands/month; `$0.20 / 100k commands` PAYG).
  - **Upgrade Trigger:** Provision **DigitalOcean Managed Valkey (`BLR1`, `$15–$30/mo`)** for TCP **BullMQ** queues only when sustained background throughput exceeds `~50,000 jobs/day` or p95 Upstash HTTP overhead crosses `10 ms` between Mumbai (`ap-south-1`) and Bengaluru (`BLR1`).

---

## 5. Final Recommended Configuration vs. Fallback Stack

### 5.1 Primary Recommended Configuration (CTO Approved Direction)
- **Frontend SPA:** **Vercel** (`https://aashvo.vercel.app/` — Pro/Hobby per team)
- **Backend Compute:** **DigitalOcean App Platform (`BLR1` Bangalore)** — 2 × dynamic container instances (`1 vCPU / 1 GiB` shared or `512 MiB` basic containers for HA rolling deploys) + App Platform health checks
- **Primary Database:** **DigitalOcean Managed PostgreSQL (`BLR1` Bangalore)** — HA cluster (`2 GiB RAM` Primary + Standby = `47` direct conns + PgBouncer pooler)
- **Public Object Storage:** **Cloudflare R2** (`apac` hint, custom domain `media.aashvo.in`)
- **Private Sensitive Document & Backup Vault:** **Amazon S3 (`ap-south-1` Mumbai)** (SSE-KMS + Versioning + Block Public Access)
- **Redis (Rate Limits / Auth State / Revocation):** **Upstash Redis (`ap-south-1` Mumbai)** (Free -> PAYG)
- **Email & India DLT SMS:** **Resend** (or **Amazon SES `ap-south-1`**) + **MSG91 India DLT**

### 5.2 Single Recommended Fallback Architecture
If DigitalOcean `BLR1` App Platform/Managed PG hits regional capacity limits, multi-week backup retention constraints become too rigid, or enterprise partners require single-cloud AWS compliance:
- **Fallback Stack (Full AWS Mumbai `ap-south-1`):**
  - **AWS ECS Fargate (`ap-south-1`) + ALB** (2 private tasks)
  - **Amazon RDS PostgreSQL Multi-AZ (`ap-south-1`, `db.t4g.small` / `db.r6g`)** (35-day native PITR + Secrets Manager auto-rotation)
  - **Amazon S3 (`ap-south-1`)** (private vault) + **Cloudflare R2** (public media)
  - **Upstash Mumbai / ElastiCache Redis (`ap-south-1`)** + **Amazon SES (`ap-south-1`)** + **MSG91 DLT**
  - Estimated monthly floor: **~$125–$185/mo USD** (+ 18% AISPL India GST).

---

## 6. Realistic Monthly Cost Breakdown (Dev, Staging & Initial Production)

*(Base USD figures sourced from verified pricing documentation; indicative INR assumes ~₹85/USD purely for budgeting planning. All external variable fees & Indian taxes listed explicitly.)*

| Cost Line Item | Development (Local + Cloud Test) | Staging (Pre-Prod Mirror) | Initial Production (India Launch) |
|---|---|---|---|
| **Frontend Hosting (Vercel)** | `$0` (existing/Hobby) | `$0` (Preview branch) | `$0` Hobby *(or `$20/mo` Pro per commercial team seat)* |
| **NestJS API Compute (`DO App Platform BLR1`)** | `$0` (local Docker / Node) | `$5.00` (1 × `512 MiB` basic service) | **`$20.00–$24.00`** (2 × `1 vCPU / 1 GiB` containers for zero-downtime deploys) |
| **PostgreSQL (`DO Managed PG BLR1`)** | `$0` (local Docker Postgres 16) | **`$0–$15.00`** (Neon Free Singapore branch OR DO `$15/mo` Basic 1 GiB) | **`$30.00–$60.00`** *(DO HA Standby tier; budget `$60/mo` for 2 GiB HA w/ 47 conns — verify exact HA RAM tier in DO console before checkout)* |
| **Redis (`Upstash ap-south-1`)** | `$0` (local Redis / Upstash Free) | `$0` (Free tier `500k` cmds/mo) | **`$0.00–$5.00`** (Free tier → PAYG `$0.20 / 100k` cmds; `$10` fixed optional) |
| **Public Storage (`Cloudflare R2`)** | `$0` (Free tier) | `$0` (Free tier) | **`$0.00–$2.00`** (`10 GB` storage + `1M` write + `10M` read free; `$0` egress) |
| **Private India Vault (`AWS S3 ap-south-1`)** | `$0` (bucket prefix test) | `$0.50` | **`$1.50–$4.00`** (~`5–20 GB` docs + encrypted backups + KMS requests + minimal PDF egress) |
| **Transactional Email (`Resend` / `SES ap-south-1`)** | `$0` (Resend Free `3,000/mo`) | `$0` (Free tier) | **`$0.10–$2.00`** via Amazon SES Mumbai (`$0.10/1k` emails) or `$0–$20` Resend |
| **India DLT SMS OTP (`MSG91`)** | `$0` (mock sandbox adapter) | **`~$1–$2`** (`~200–500` QA OTPs) | **`~$6–$15`** *(~`₹500–₹1,250/mo` for `2,000–5,000` OTPs @ `~₹0.20–0.25/SMS`; excludes one-time telecom DLT registration fee — verify directly on DLT portal)* |
| **Observability / Log Retention / Alerts** | `$0` | `$0` (free tier) | **`$0–$15.00`** (DO Insights + Grafana Cloud / Better Stack free tier → starter logs) |
| **Monthly Pre-Tax Subtotal (USD)** | **`$0`** | **`$6.50 – $22.50`** | **`~$58 – $127 / mo`** *(Dev `$0`, Staging `~$7–23`, Initial Prod `~$60–110` excl. optional Vercel Pro)* |
| **Taxes, FX & Contingency** | N/A | + **18% GST** (AWS/MSG91/DO India) | **+18% GST** on India-billed cloud/SMS + **~2–3% FX** card markup on USD vendors → **Budget ₹6,000–₹13,500 / month** (`~$70–$155` all-in tax-inclusive) |

### Hidden Costs Explicitly Budgeted
- **DigitalOcean App Platform Outbound Bandwidth Overage:** `$0.02/GiB` past included plan allowance (mitigated because images serve directly from **Cloudflare R2 `$0` egress**, not proxied through App Platform!).
- **DigitalOcean Extra DB Disk:** `$0.215/GiB-month` Standard beyond initial `25 GiB`.
- **Upfront Telecom DLT Compliance Wallet:** One-time DLT entity/header registration fees charged directly by Indian telecom operators (Jio/Airtel/Vodafone) plus initial MSG91 wallet top-up.
- **Standby Supabase Retention (Temporary Dual-Cost):** Retain Supabase `aashvo-dev` at current `$0` Free / `$25` Pro tier (whichever is currently active) strictly for **30 days post-cutover** as rollback insurance before final CTO-approved archival.

