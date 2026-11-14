# AASHVO — Managed Cloud Infrastructure Evaluation & Backup Architecture

**Scope:** Evidence-based evaluation of managed cloud infrastructure for AASHVO's NestJS backend, PostgreSQL 16+ database, Redis queues/rate-limiting, S3-compatible object storage, transactional email, and India DLT SMS OTP delivery.  
**Constraints:** Frontend remains on Vercel (`https://aashvo.vercel.app/`) during transition; Firebase is **excluded** per CTO decision; low latency across **India (Delhi NCR, Bengaluru, Mumbai)** and **Indian DPDP Act 2023** alignment are primary criteria.  
**Skills Applied:** `aws-rds`, `aws-ecs-fargate`, `aws-s3`, `cloudflare-r2`, `vercel-deployments`, `database-backups`, `backup-recovery`

---

## 1. Provider Comparison Matrix (Verified Region & Pricing Facts)

*(All pricing & region claims verified via current provider documentation and search summaries as of November 2026; AWS India AISPL billing adds 18% GST.)*

### 1.1 Managed PostgreSQL & Backend Compute Providers

| Provider | Physical India Region? | Entry Production Pricing (Observed) | Strengths for AASHVO | Risks / Trade-offs |
|---|---|---|---|---|
| **AWS (`ap-south-1` Mumbai): ECS Fargate + RDS PostgreSQL** | **Yes — Mumbai (`ap-south-1`)** | **RDS `db.t4g.micro`:** ~$15–16/mo Single-AZ, ~$31–33/mo Multi-AZ compute + ~$0.115–0.12/GB-mo gp3 storage.<br>**Fargate (1 vCPU, 2 GB 24/7):** ~$41.90/mo + ALB + NAT/IPv4 + 18% India GST. | Industry-standard VPC network isolation, Multi-AZ automatic failover, 35-day WAL PITR, Secrets Manager auto-rotation, KMS encryption, single-cloud compliance. | Highest operational/Terraform complexity; NAT Gateway + ALB + Multi-AZ baseline typically exceeds **$110–160/mo** even at launch traffic. |
| **DigitalOcean (`BLR1` Bangalore): Managed Postgres + App Platform** | **Yes — Bengaluru (`BLR1`)** | **Managed PG:** Flat **$15/mo** (1 GiB/1 vCPU single-node) or **$30/mo HA** (2 GiB primary + standby, auto-failover); extra disk $0.215/GiB-mo Standard.<br>**App Platform / Containers:** Predictable flat tiers. | Physical Indian datacenter (`BLR1`), simple UI, no per-IOPS or DB egress surprise fees, automated daily backups + PITR on Managed PG, predictable monthly invoice. | Fewer enterprise KMS/IAM primitives than AWS; scaling past medium traffic eventually favors moving to AWS `ap-south-1`. |
| **Fly.io (`bom` Mumbai)** | **Yes — Mumbai (`bom`) & Singapore (`sin`)** | **Compute:** Shared CPU from ~$2.19–4.39/mo; RAM ~$6/GB-mo.<br>**Managed PG (`MPG`):** Starts at **$38/mo**. Volumes $0.15/GB-mo. | Physically runs containers in **Mumbai (`bom`)** with per-second billing and low-latency Anycast routing; fast container deploys. | Managed Postgres regional availability constraints & historical volume/network maintenance incidents compared to RDS or DO Managed PG. |
| **Railway** | **No** (Nearest: **Singapore**) | Hobby **$5/mo** min, Pro **$20/mo** min + ~$20/vCPU-mo, ~$10/GB RAM-mo, $0.15/GB disk. | Fastest developer onboarding for staging/preview environments; built-in service graph. | No Mumbai/Bengaluru region (~50–100 ms RTT overhead from India); metered 24/7 Postgres + API + Redis accumulates cost unpredictably. |
| **Render** | **No** (US / EU core Postgres) | Pro workspace $25/mo + PG Basic ~$6–7/mo (Free PG **deleted after 30 days**); Dedicated CPU $45–97+/mo + $0.30/GB disk. | Clean PaaS experience for US/EU apps. | **Not suitable for India production** due to lack of Asia/India core Postgres regions and 30-day free tier expiry. |
| **Neon Serverless Postgres** | **No** (Nearest: **Singapore `aws-ap-southeast-1`**) | Free (1 GB, scale-to-zero); Launch usage-based ($0.106/CU-hr, $0.35/GB-mo). | Instant DB branching (`preview` branches per PR!) for CI/CD & staging. | No Mumbai/India datacenter; cold-start wakeups if scale-to-zero is left enabled in prod. |

### 1.2 Object Storage, Cache & Messaging Providers

| Layer | Candidate A (Recommended) | Candidate B (Enterprise / Alternative) | Operational & Indian Compliance Notes |
|---|---|---|---|
| **Object Storage** | **Cloudflare R2** (`10 GB/mo`, 1M Class A, 10M Class B **Free**; `$0.015/GB-mo`; **$0.00 internet egress**) | **Amazon S3 (`ap-south-1` Mumbai)** (`$0.025/GB-mo` + `$0.109/GB` egress) | R2 eliminates image bandwidth costs for `property-photos` browsing; S3 Mumbai guarantees strict Indian regional disk residency if legal counsel mandates on-soil media storage. Both speak identical AWS S3 SDK v3. |
| **Redis (BullMQ + Rate Limits)** | **Upstash Redis** (Free 250 MB / 500k cmds; `$10/mo` fixed) | **DigitalOcean Managed Redis (`BLR1`) / AWS ElastiCache (`ap-south-1`)** | Co-locate cache inside VPC (`BLR1` or `ap-south-1`) once traffic grows so rate-limiter latency stays `< 2 ms`. |
| **Transactional Email** | **Amazon SES (`ap-south-1` Mumbai)** (`$0.10 / 1,000 emails` raw PAYG) | **Resend** (Free `3,000/mo` / 100/day; Pro `$20/mo` for 50k) | Launch easily with Resend Free/Pro -> switch SMTP/API adapter to SES Mumbai at scale cleanly via `NotificationsModule`. |
| **India SMS OTP** | **MSG91** (`~₹0.16–0.25/SMS` + 18% GST; OTP widget ~₹0.20/OTP) | **Twilio India / Kaleyra** | **Mandatory Indian Regulation:** TRAI **DLT Registration** (Principal Entity ID, Sender Header, pre-approved `{#var#}` templates) required *before* Sprint 3 OTP go-live (allow 5–10 business days lead time!). |

---

## 2. Recommended Infrastructure Topologies

### 2.1 Primary Recommendation (Phase-Appropriate Growth Architecture)

#### Stage 1 — Production Launch Topology (Target Budget: **~$55–85/month** in India)
Optimized for sub-35ms Indian user latency, zero operational bloat, and zero vendor lock-in:
- **Frontend SPA:** **Vercel** (`https://aashvo.vercel.app/`, existing — zero change needed).
- **PostgreSQL 16+:** **DigitalOcean Managed PostgreSQL High Availability (`BLR1` Bangalore)** (`$30/mo` — synchronous standby, automated daily backups + PITR, automated connection pooling/PgBouncer).
- **NestJS API + BullMQ Worker:** **DigitalOcean App Platform (`BLR1`)** or **Fly.io (`bom` Mumbai)** — 2 stateless NestJS API instances (`512MB–1GB` each) + 1 background worker container communicating with `BLR1` over private TLS.
- **Object Storage:** **Cloudflare R2** behind `https://media.aashvo.in/` (public bucket) + Private Vault bucket (0 egress fees).
- **Redis & Comms:** **Upstash Redis** (or DO `BLR1` Managed Redis) + **Resend** (email verification/resets/tickets) + **MSG91** (TRAI DLT SMS OTP).
- **Staging / PR Previews:** **Neon (`aws-ap-southeast-1`)** ephemeral database branches per pull request so integration tests never touch production.

#### Stage 2 — Scale-Up / Compliance Upgrade Topology (Target Budget: **~$150–250+/month**)
When transaction volume, enterprise partnerships, or RBI/DPDP audit requirements demand strict VPC isolation and KMS controls:
- **Compute:** **AWS ECS Fargate (`ap-south-1` Mumbai)** in private subnets behind an Application Load Balancer + AWS WAF + Deployment Circuit Breaker.
- **Database:** **Amazon RDS PostgreSQL 16 Multi-AZ (`ap-south-1`)** (`db.r6g.large` or `db.t4g.medium`) + RDS Proxy + Secrets Manager automatic credential rotation.
- **Storage:** Keep Cloudflare R2 for public CDN images *or* move `aashvo-private-vault` (`rental-documents`, `support-attachments`) to **Amazon S3 (`ap-south-1`)** with SSE-KMS + Block Public Access for strict Indian financial document residency.
- **Migration Between Stage 1 and Stage 2:** Takes `< 2 hours` with minimal downtime because Dockerfiles, Prisma schemas, S3 SDK v3, and DNS (`api.aashvo.in`) are 100% portable.

### 2.2 Fallback Architecture
If Mumbai/Bengaluru capacity or billing issues arise on Stage 1:
- **Fallback Stack:** **Railway (`Singapore` region) + Neon (`Singapore` `aws-ap-southeast-1`) + Cloudflare R2**. Adds ~50–65 ms RTT compared to Bengaluru/Mumbai — completely functional for Indian users while retaining standard PostgreSQL and S3 contracts.

---

## 3. Availability, RTO/RPO, Backups & Disaster Recovery (`3-2-1 Rule`)

| Metric / Control | Production Target | Implementation Mechanism |
|---|---|---|
| **RPO (Max Data Loss)** | **≤ 5 minutes** (target `< 1 min` on synchronous Multi-AZ failover) | Continuous PostgreSQL WAL archiving / Managed PITR enabled continuously on DO HA / AWS RDS Multi-AZ. |
| **RTO (Max Recovery Time)** | **< 15 minutes** (AZ node failure: `< 90 sec` automatic failover) | Standby DB auto-promotion + stateless ECS/DO containers re-deploying from immutable tagged container images in ECR/GHCR. |
| **3-2-1 Backup Strategy** | 3 copies · 2 media types · 1 offsite | **Copy 1:** Managed Multi-AZ Primary + Standby DB.<br>**Copy 2:** Provider automated daily snapshots + PITR WAL logs (14–35 day retention).<br>**Copy 3 (Encrypted Offsite):** Nightly `pg_dump` encrypted via `restic` / `age` pushed to an isolated cross-region S3/R2 cold archive bucket (`ap-south-1` <-> `ap-southeast-1`) + Object Versioning on `rental-documents`. |
| **Monthly Restore Drill** | **100% verified once per month** | Automated CI/Ops job restores latest encrypted backup into an isolated scratch Postgres instance, verifies Prisma schema checksum + row counts + anonymization, and logs result to Ops runbook. **Untested backups are not backups.** |
| **Secrets & TLS** | TLS 1.3 in transit; AES-256 / KMS at rest | Enforce `sslmode=verify-full` for DB connections, short-lived IAM roles where available, and zero plaintext `.env` secrets committed to Git. |

