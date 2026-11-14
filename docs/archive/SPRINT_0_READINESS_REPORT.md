# AASHVO — Sprint 0 Readiness Report & CTO Go/No-Go Gate

**Report Date:** 2026-11-12  
**Workspace Audited:** `D:\Projects\AASHVO` (`Ar10Ansari/aashvo`, branch `master`)  
**Execution Mode:** Planning & Verification Only *(zero application code, Vercel config, Git history, or Supabase changes made)*  

---

## FINAL READINESS VERDICT: **READY WITH CONDITIONS**

All architecture, database schema, Supabase-to-PostgreSQL mappings, cryptographic auth proofs, monorepo boundaries, India DLT templates, security verification tests, and realistic Dev/Staging/Initial Production budgets are **complete and internally consistent**.

**Sprint 1 implementation (`apps/api` + `packages/contracts` scaffolding)** may proceed immediately upon CTO sign-off of the **Sprint 0 Conditions** in §3, while **production data migration and SMS OTP go-live** remain explicitly gated on external hosted-DB inspection and TRAI DLT approval evidence.

---

## 1. Summary of Verified Sprint 0 Workstreams

| Workstream | Outcome Summary | Authoritative Deliverable |
|---|---|---|
| **A. Infrastructure Finalization** | Revalidated India availability & pricing: **DigitalOcean App Platform (`BLR1`) + Managed Postgres HA (`BLR1`)** co-located (`< 1 ms` DB RTT, PgBouncer pooler required due to `22`/`47` connection caps, plus nightly encrypted `pg_dump` to overcome DO's **7-day PITR limit**). Verified **Cloudflare R2 has no India jurisdiction lock** → restricted strictly to public `property-photos`/`user-avatars` (`$0` egress), while sensitive private `rental-documents` & `support-attachments` route to **AWS S3 (`ap-south-1` Mumbai)** with SSE-KMS + Block Public Access. **AWS App Runner (closed to new customers Apr 30, 2026)** and **Fly.io Mumbai (`bom` lacks Managed Postgres)** excluded cleanly. Initial Prod budget: **`~$58–$127/mo` pre-tax** (**`₹6,000–₹13,500/mo`** incl. 18% GST/FX). Fallback: full **AWS `ap-south-1` (Mumbai)** (`ECS Fargate + RDS Multi-AZ + S3 + SES`). | [INFRASTRUCTURE_FINAL_DECISION.md](file:///D:/Projects/AASHVO/docs/INFRASTRUCTURE_FINAL_DECISION.md) |
| **B. Auth Migration Proof** | Inspected local `supabase/config.toml` (`jwt_expiry = 3600`, `minimum_password_length = 6`, `[auth.sms] enabled = false`), 12 SQL migrations, and `authService.ts`. Proven Node `bcrypt` verifies standard GoTrue `$2a$`/`$2b$` hashes for transparent **on-login Argon2id upgrade** *subject to read-only hosted preflight classification*; defined `password_reset_required` fallback + verified-email Google OAuth linking guard (preventing pre-hijacking) + 1:1 preserved UUIDs (`users.id === profiles.id === auth.users.id`) + zero hash logging. | [AUTH_MIGRATION_FEASIBILITY.md](file:///D:/Projects/AASHVO/docs/AUTH_MIGRATION_FEASIBILITY.md) |
| **C. Database & Migration Finalization** | Verified all **15 existing tables + 8 new tables**, retargeted `support_*`/`safety_reports` FKs cleanly via preserved UUIDs, reconciled `properties.featured` and `flatmate_profiles.user_id` uniqueness, mapped **3 views → masked DTOs**, **3 RPCs → endpoints**, **15 triggers → NestJS `$transaction` guards + DB `CHECK` constraints**, plus idempotent ETL order, SHA-256 storage verification, missing-file quarantine recovery, and Stage A–C rollback with `≥ 30d` Supabase standby. | [MIGRATION_ACCEPTANCE_CHECKLIST.md](file:///D:/Projects/AASHVO/docs/MIGRATION_ACCEPTANCE_CHECKLIST.md), [POSTGRESQL_DATABASE_DESIGN.md](file:///D:/Projects/AASHVO/docs/POSTGRESQL_DATABASE_DESIGN.md), [SUPABASE_TO_POSTGRESQL_MAPPING.md](file:///D:/Projects/AASHVO/docs/SUPABASE_TO_POSTGRESQL_MAPPING.md) |
| **D. Monorepo Transition** | Audited root `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vercel.json`, `.gitignore`, and missing `.github/`. Proposed non-disruptive **npm workspaces (`apps/api`, `packages/contracts`)** leaving existing root Vite SPA **100% in place** during Sprints 1–10 with isolated TS configs, shared browser-safe OpenAPI contracts, and Vercel `ignoreCommand` protection. | [MONOREPO_TRANSITION_PLAN.md](file:///D:/Projects/AASHVO/docs/MONOREPO_TRANSITION_PLAN.md) |
| **E. Security & Operational Readiness** | Defined mandatory negative automated test gates covering `alg: none` & RS256→HS256 JWT attacks, refresh family reuse kill, IDOR/BOLA & private file presign checks, magic-byte upload inspection, `aashvo_app` least-privilege SQL enforcement, Upstash Redis rate limiting, PII-scrubbed Pino logs, SPF/DKIM/DMARC, and staging DR backup-restore timing (**RPO `≤ 5m` / RTO `< 15m` marked as unverified targets until tested**). | [MIGRATION_ACCEPTANCE_CHECKLIST.md](file:///D:/Projects/AASHVO/docs/MIGRATION_ACCEPTANCE_CHECKLIST.md) |
| **F. India DLT & MSG91 Prep** | Prepared legal entity KYC checklist (zero fabricated corporate details), operator DLT Header + `{#var#}` templates + mandatory **PE-TM MSG91 chain binding**, and vendor-independent server-side OTP architecture replacing client `'654321'` simulation. | [MIGRATION_ACCEPTANCE_CHECKLIST.md](file:///D:/Projects/AASHVO/docs/MIGRATION_ACCEPTANCE_CHECKLIST.md) |
| **G. Mandatory Skills Audit** | Re-discovered and applied all relevant skills across infrastructure, Redis, security/hardening, read-only PG auditing, CI/CD, Docker, and data privacy; transparently logged missing framework skills (`nest*`, `prisma*`, `digitalocean*`, `monorepo*`). | [SKILLS_APPLICATION_REPORT.md](file:///D:/Projects/AASHVO/docs/SKILLS_APPLICATION_REPORT.md) |

---

## 2. Core Planning Documents Index

All Sprint 0 and Master Plan blueprints live cleanly under `D:\Projects\AASHVO\docs\`:
1. [SPRINT_0_READINESS_REPORT.md](file:///D:/Projects/AASHVO/docs/SPRINT_0_READINESS_REPORT.md) *(this report)*
2. [INFRASTRUCTURE_FINAL_DECISION.md](file:///D:/Projects/AASHVO/docs/INFRASTRUCTURE_FINAL_DECISION.md)
3. [AUTH_MIGRATION_FEASIBILITY.md](file:///D:/Projects/AASHVO/docs/AUTH_MIGRATION_FEASIBILITY.md)
4. [MONOREPO_TRANSITION_PLAN.md](file:///D:/Projects/AASHVO/docs/MONOREPO_TRANSITION_PLAN.md)
5. [MIGRATION_ACCEPTANCE_CHECKLIST.md](file:///D:/Projects/AASHVO/docs/MIGRATION_ACCEPTANCE_CHECKLIST.md)
6. [INDEPENDENT_BACKEND_ARCHITECTURE.md](file:///D:/Projects/AASHVO/docs/INDEPENDENT_BACKEND_ARCHITECTURE.md)
7. [POSTGRESQL_DATABASE_DESIGN.md](file:///D:/Projects/AASHVO/docs/POSTGRESQL_DATABASE_DESIGN.md)
8. [SUPABASE_TO_POSTGRESQL_MAPPING.md](file:///D:/Projects/AASHVO/docs/SUPABASE_TO_POSTGRESQL_MAPPING.md)
9. [AUTHENTICATION_MIGRATION_PLAN.md](file:///D:/Projects/AASHVO/docs/AUTHENTICATION_MIGRATION_PLAN.md)
10. [STORAGE_MIGRATION_PLAN.md](file:///D:/Projects/AASHVO/docs/STORAGE_MIGRATION_PLAN.md)
11. [DATA_MIGRATION_AND_ROLLBACK_PLAN.md](file:///D:/Projects/AASHVO/docs/DATA_MIGRATION_AND_ROLLBACK_PLAN.md)
12. [MANAGED_INFRASTRUCTURE_EVALUATION.md](file:///D:/Projects/AASHVO/docs/MANAGED_INFRASTRUCTURE_EVALUATION.md)
13. [FRONTEND_API_TRANSITION_PLAN.md](file:///D:/Projects/AASHVO/docs/FRONTEND_API_TRANSITION_PLAN.md)
14. [BACKEND_IMPLEMENTATION_ROADMAP.md](file:///D:/Projects/AASHVO/docs/BACKEND_IMPLEMENTATION_ROADMAP.md)
15. [SKILLS_APPLICATION_REPORT.md](file:///D:/Projects/AASHVO/docs/SKILLS_APPLICATION_REPORT.md)

---

## 3. Unresolved Dependencies & Exact Evidence Required to Clear Them

Sprint 1 code scaffolding (`apps/api`, `packages/contracts`) can start as soon as the **CTO Approvals (#1–#3)** are confirmed; production cutover and live SMS OTP require **External Evidence (#4–#7)**:

| # | Unresolved Dependency | Owner | Exact Verification Evidence Required to Clear | Gate Timing |
|---|---|---|---|---|
| **1** | **Compute Co-Location Choice (`BLR1` vs `ap-south-1`)** | CTO | Written confirmation selecting **DigitalOcean App Platform (`BLR1` Bengaluru)** co-located with DO Managed PG (`BLR1`) *(since Fly.io lacks Mumbai MPG and AWS App Runner closed Apr 30 2026)* OR approving **AWS ECS Fargate (`ap-south-1` Mumbai)**. | **Before Sprint 1** |
| **2** | **India-Region Private Storage Choice** | CTO | Written confirmation approving **AWS S3 (`ap-south-1` Mumbai)** (recommended for SSE-KMS + CloudTrail) vs **DigitalOcean Spaces (`BLR1`)** (`$5/mo` flat) for `rental-documents` & `support-attachments`, keeping Cloudflare R2 strictly for public media. | **Before Sprint 1** |
| **3** | **Repository & Admin Governance** | CTO | Confirmation of: (a) `npm workspaces` at root (`apps/api`, `packages/contracts`), (b) approved production `role = 'admin'` email list, and (c) keep vs prune disposition for synthetic `SEED_PROPERTIES` on hosted DB. | **Before Sprint 1** |
| **4** | **Hosted `aashvo-dev` Read-Only Auth & Data Audit** | CTO / Authorized DB Operator | Output of the aggregate read-only SQL checks in [AUTH_MIGRATION_FEASIBILITY.md](file:///D:/Projects/AASHVO/docs/AUTH_MIGRATION_FEASIBILITY.md#L44-L66) (confirming `$2a$`/`$2b$` count, `oauth_only` count, `requires_password_reset_fallback` count, zero duplicate emails/flatmate `user_id`s, row counts, and `storage.objects` file manifest — **zero raw hashes printed!**). | **Before Sprint 2 / Mandatory Before Sprint 8** |
| **5** | **TRAI DLT Registration & MSG91 PE-TM Chain** | Founder / Legal + Backend | Approved **19-digit DLT Principal Entity ID**, approved **6-char Sender Header**, approved **DLT Content Template IDs**, and active **MSG91 PE-TM chain approval screenshot/ID** (5–10 business days lead time). | **Before Live SMS OTP Testing (Sprint 2 end)** |
| **6** | **Cloud Vendor Provisioning & Secrets** | CTO / DevOps | Active DigitalOcean, AWS, Cloudflare R2, Upstash, Resend/SES DNS (`SPF`/`DKIM`/`DMARC`), and Google Cloud OAuth 2.0 production client credentials stored solely in Secrets Manager / encrypted CI secrets. | **Before Sprint 3 Staging Deploy** |
| **7** | **Executed DR Backup-Restore & Security Proof** | Engineering QA | Timed Staging **`pg_restore` + DO PITR + S3 `restic`** drill log proving actual measured RPO (`≤ 5m`) and RTO (`< 15m`), plus passing CI security matrix (`alg: none`, refresh reuse family kill, private file `403`, least-privilege DB role check). | **Mandatory Before Sprint 10 Production Cutover** |

---

**Next Action:** Awaiting explicit **CTO approval** on Conditions #1–#3 (and initiation of #4–#5) before commencing Sprint 1 workspace scaffolding (`apps/api` and `packages/contracts`).

