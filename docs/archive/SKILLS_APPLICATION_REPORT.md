# AASHVO — Skills Discovery & Application Report

**Last Updated:** 2026-11-12 (Sprint 0 Finalization Pass)  
**Workspace:** `D:\Projects\AASHVO` (branch `master`, remote `https://github.com/Ar10Ansari/aashvo.git`)  
**Environments Scanned:**
- `C:\Users\Lenovo\.gemini\antigravity\builtin\skills\`
- `C:\Users\Lenovo\.agents\skills\`
- `C:\Users\Lenovo\.codex\skills\` (not present on this host)
- Active MCP / plugin accounts checked via `list_plugin_accounts`

This report documents **Phase 0 / Sprint 0** skill discovery, full instruction reads, explicit missing-skill disclosures, and concrete application across:
1. Sprint 1 (Prior): Supabase Connectivity Audit & Safe Remediation
2. Master Plan: Independent Backend Migration (`Supabase → NestJS 11 + PostgreSQL + Prisma`)
3. **Sprint 0 Finalization:** Infrastructure Finalization, Auth Migration Proof, Monorepo Transition Audit, Security/DR Readiness & India DLT Preparation.

---

## 1. Complete Skill Inventory Discovered

### 1.1 Antigravity Built-in Skills (13)
`agy-customizations`, `antigravity_guide`, `automation`, `generative_ui`, `migrate-agent-settings`, `migrate-workflows`, `native_swarm`, `permissioned-github`, `plugin`, `run-workflow`, `swarm_monitor`, `swarm_narrator`, `ui-plugin-navigation`.

### 1.2 Global Agent Skills (`C:\Users\Lenovo\.agents\skills\`, 400+ total)
Re-scanned during Sprint 0 for backend, database, cloud/India hosting, Redis, Docker, CI/CD, monorepo, Vite, email/privacy, and security domains:
- **Backend, API & Contracts:** `architecture-review`, `api-and-interface-design`, `api-designer`, `openapi-spec-generator`, `cc-skill-backend-patterns`, `cc-skill-coding-standards`, `deprecation-and-migration`
- **Database, PostgreSQL, Read-Only & Backups:** `supabase`, `supabase-postgres-best-practices`, `postgresql-devsec`, `postgres-readonly-queries`, `database-security`, `database-backups`, `backup-recovery`
- **Frontend & Data Contracts:** `frontend-architecture`, `frontend-data-contracts`, `cc-skill-frontend-patterns`
- **Object Storage, Cloud, Redis & Secrets:** `object-storage`, `cloudflare-r2`, `aws-s3`, `aws-rds`, `aws-ecs-fargate`, `aws-secrets-manager`, `vercel-deployments`, `redis`, `upstash-redis`, `upstash-ratelimit`
- **CI/CD, Containers & Ops:** `ci-cd-and-automation`, `github-actions`, `docker-management`
- **Security, Auth, Privacy & Observability:** `api-security`, `cc-skill-security-review`, `client-secret-exposure-audit`, `security-and-hardening`, `cloudflare-security-audit`, `data-privacy-controls`, `email-security`, `hunt-jwt-crypto`, `hunt-oauth`, `hunt-session`, `audit-logging`, `observability-and-instrumentation`
- **Testing & Quality:** `vitest-skill`, `code-review-and-quality`, `debugging-and-error-recovery`

### 1.3 Verified Missing Skills & Tooling Gaps (Reported Explicitly per Requirement G)
Exact filesystem checks on `C:\Users\Lenovo\.agents\skills\` confirmed the following technologies have **no dedicated installed skills**:
1. **NestJS Framework (`nest*`):** Covered via TypeScript modularity (`cc-skill-backend-patterns`, `architecture-review`), OpenAPI/REST design (`api-designer`, `openapi-spec-generator`, `api-and-interface-design`), and OWASP/API security (`security-and-hardening`, `api-security`).
2. **Prisma ORM (`prisma*`):** Covered via PostgreSQL DDL/constraints/indexing skills (`supabase-postgres-best-practices`, `postgresql-devsec`, `database-security`) plus explicit raw SQL companion migrations for constraints Prisma lacks (`CHECK`, partial unique indexes, `GIN`).
3. **DigitalOcean (`digitalocean*`), Railway/Render/Fly (`fly*`/`render*`/`railway*`):** Covered by live provider documentation & pricing verification via `search_web` rather than assumptions.
4. **Monorepo Tooling (`monorepo*`, `turborepo*`, `pnpm*`, `npm-workspaces*`) & Dedicated `vite` Skill:** (`markstream-vue2-vite` is Vue-specific and excluded.) Covered by direct static inspection of root `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vercel.json`, and `ci-cd-and-automation` / `github-actions` workspace gates.
5. **Indian TRAI DLT / MSG91 (`dlt*`, `msg91*`):** Covered via India regulatory requirements verified via `search_web`, `api-rate-limit-handler` / `upstash-ratelimit`, and `security-and-hardening`.
6. **Live Hosted DB / Vercel Plugins:** `list_plugin_accounts` returned empty; no `.env*` secrets or Docker daemon exist locally, keeping `aashvo-dev` `auth.users` proof explicitly gated for Sprint 0 clearing.

---

## 2. Skills Selected, Read in Full & Applied Across Master Plan + Sprint 0

| # | Skill Name | File Read (`SKILL.md` / Refs) | Concrete Sprint 0 & Master Plan Application |
|---|---|---|---|
| 1 | `architecture-review` | `...\architecture-review\SKILL.md` | Enforced strict single-responsibility module boundaries across all 16 NestJS modules, acyclic dependency graph, and failure-mode isolation (`INDEPENDENT_BACKEND_ARCHITECTURE.md`). |
| 2–4 | `api-and-interface-design`, `api-designer`, `openapi-spec-generator` | `...\api-and-interface-design\SKILL.md`, `...\api-designer\SKILL.md`, `...\openapi-spec-generator\SKILL.md` | Defined `/api/v1/*` URI contracts, cursor/page envelopes, typed error payloads, OpenAPI 3.1 shared schema generation inside `packages/contracts`, and `Idempotency-Key` support. |
| 5–6 | `cc-skill-backend-patterns`, `cc-skill-coding-standards` | `...\cc-skill-backend-patterns\SKILL.md`, `...\cc-skill-coding-standards\SKILL.md` | Structured Controller → Service → Prisma Repository layering, atomic `$transaction` boundaries, strict TS config, and outbox-backed BullMQ async workers. |
| 7–10 | `supabase`, `supabase-postgres-best-practices`, `postgresql-devsec`, `postgres-readonly-queries` | `...\supabase\SKILL.md`, `...\supabase-postgres-best-practices\SKILL.md` (+ 5 refs), `...\postgresql-devsec\SKILL.md`, `...\postgres-readonly-queries\SKILL.md` | Audited all 12 migrations (`20261018`–`20261112`), reconciled all 15 existing + 8 new tables, designed read-only `aashvo-dev` preflight audit queries (`readonly=True`, query timeout, row caps, zero hash/PII export), and separated `aashvo_migrator` vs `aashvo_app` DB roles (`MIGRATION_ACCEPTANCE_CHECKLIST.md`, `AUTH_MIGRATION_FEASIBILITY.md`). |
| 11–13 | `database-security`, `database-backups`, `backup-recovery` | `...\database-security\SKILL.md`, `...\database-backups\SKILL.md`, `...\backup-recovery\SKILL.md` | Exposed DigitalOcean Managed PG's **7-day backup/PITR retention cap**, added encrypted `restic`/cold offsite `pg_dump` to satisfy the **3-2-1 rule** for 30+ day retention, and explicitly categorized RPO `≤ 5m` / RTO `< 15m` as **unverified targets until monthly restore tests pass** (`INFRASTRUCTURE_FINAL_DECISION.md`, `MIGRATION_ACCEPTANCE_CHECKLIST.md`). |
| 14–17 | `object-storage`, `cloudflare-r2`, `aws-s3`, `cloudflare-security-audit` | `...\object-storage\SKILL.md`, `...\cloudflare-r2\SKILL.md`, `...\aws-s3\SKILL.md`, `...\cloudflare-security-audit\SKILL.md` | Confirmed Cloudflare R2 lacks a strict India jurisdiction lock (`eu`/`us`/`fedramp` only; `apac` is best-effort), driving our hybrid decision: Cloudflare R2 for public `property-photos`/`user-avatars` vs **AWS S3 (`ap-south-1` Mumbai)** or **DO Spaces (`BLR1` Bangalore)** for private India-resident `rental-documents` & `support-attachments` (`INFRASTRUCTURE_FINAL_DECISION.md`, `STORAGE_MIGRATION_PLAN.md`). |
| 18–20 | `aws-rds`, `aws-ecs-fargate`, `aws-secrets-manager` | `...\aws-rds\SKILL.md`, `...\aws-ecs-fargate\SKILL.md`, `...\aws-secrets-manager\SKILL.md` | Modeled AWS Mumbai fallback/Stage-2 architecture, Secrets Manager automatic rotation & IAM execution roles, and verified S3 SSE-KMS vs DO Spaces trade-offs (`INFRASTRUCTURE_FINAL_DECISION.md`). |
| 21–23 | `redis`, `upstash-redis`, `upstash-ratelimit` | `...\redis\SKILL.md`, `...\upstash-redis\SKILL.md`, `...\upstash-ratelimit\SKILL.md` | Distinguished TCP Valkey/Redis (needed if running BullMQ workers) vs HTTP Upstash Redis Mumbai (`ap-south-1`, `< 1–3ms`), showing how initial launch avoids paying for a separate HA Redis node until BullMQ/multi-pod throttling requires it (`INFRASTRUCTURE_FINAL_DECISION.md`). |
| 24–27 | `hunt-jwt-crypto`, `hunt-oauth`, `hunt-session`, `api-security` | `...\hunt-jwt-crypto\SKILL.md`, `...\hunt-oauth\SKILL.md`, `...\hunt-session\SKILL.md`, `...\api-security\SKILL.md` | Grounded security acceptance tests in concrete exploit proofs: EdDSA/RS256 `alg` pinning (`alg: none` & key confusion rejection), rotating refresh family reuse revocation, PKCE + `state`/`nonce` + verified-email OAuth linking guard, and counterparty BOLA/IDOR checks (`AUTH_MIGRATION_FEASIBILITY.md`, `MIGRATION_ACCEPTANCE_CHECKLIST.md`). |
| 28–31 | `security-and-hardening`, `cc-skill-security-review`, `client-secret-exposure-audit`, `email-security` | `...\security-and-hardening\SKILL.md`, `...\cc-skill-security-review\SKILL.md`, `...\client-secret-exposure-audit\SKILL.md`, `...\email-security\SKILL.md` | Applied zero-secret client bundle hygiene, STRIDE boundary mapping, PII log redaction, and mandatory SPF/DKIM/DMARC alignment checks for transactional email domains (`MIGRATION_ACCEPTANCE_CHECKLIST.md`). |
| 32–33 | `data-privacy-controls`, `audit-logging` | `...\data-privacy-controls\SKILL.md`, `...\audit-logging\SKILL.md` | Built India DPDP Act 2023 data inventory, consent/retention tracking, and append-only `audit_logs` table guarantees (`POSTGRESQL_DATABASE_DESIGN.md`, `MIGRATION_ACCEPTANCE_CHECKLIST.md`). |
| 34–37 | `frontend-architecture`, `frontend-data-contracts`, `cc-skill-frontend-patterns`, `deprecation-and-migration` | `...\frontend-architecture\SKILL.md`, `...\frontend-data-contracts\SKILL.md`, `...\cc-skill-frontend-patterns\SKILL.md`, `...\deprecation-and-migration\SKILL.md` | Audited existing `src/` coupling, verified drift fixes, preserved Vite root untouched during Sprint 0–1, and structured reversible `VITE_API_PROVIDER` adapter transition (`MONOREPO_TRANSITION_PLAN.md`, `FRONTEND_API_TRANSITION_PLAN.md`). |
| 38–40 | `vercel-deployments`, `ci-cd-and-automation`, `github-actions`, `docker-management` | `...\vercel-deployments\SKILL.md`, `...\ci-cd-and-automation\SKILL.md`, `...\github-actions\SKILL.md`, `...\docker-management\SKILL.md` | Audited root `vite.config.ts` / `vercel.json` / `package.json`, designed multi-stage non-root Alpine NestJS Dockerfile, and defined monorepo path-filtered CI quality gates (`MONOREPO_TRANSITION_PLAN.md`). |
| 41–44 | `observability-and-instrumentation`, `vitest-skill`, `code-review-and-quality`, `debugging-and-error-recovery` | `...\observability-and-instrumentation\SKILL.md`, `...\vitest-skill\SKILL.md`, `...\code-review-and-quality\SKILL.md`, `...\debugging-and-error-recovery\SKILL.md` | Defined RED/USE telemetry, `X-Request-ID` tracing, mandatory Testcontainers Postgres integration suites, and non-skipping test acceptance gates (`MIGRATION_ACCEPTANCE_CHECKLIST.md`, `BACKEND_IMPLEMENTATION_ROADMAP.md`). |
