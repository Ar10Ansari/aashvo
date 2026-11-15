# AASHVO Documentation Index & Knowledge Base

Welcome to the authoritative engineering and product documentation for **AASHVO** (*Find your place. Find your people.*).

This directory is organized into functional engineering categories to provide intuitive navigation for developers, architects, security reviewers, and operations leads.

---

## 🗂️ Documentation Taxonomy

```text
docs/
├── product/        # Product requirements, feature specifications, user journeys
├── architecture/   # System topology, module architecture, component mappings
├── api/            # API references, contract schemas, endpoint specifications
├── database/       # Relational models, migration plans, Supabase/PostgreSQL schema
├── security/       # Threat models, OAuth/GIS reviews, RLS policies, audit logs
├── development/    # Environment setup, monorepo maintenance, dependency hygiene
├── deployment/     # Production/staging runbooks, rollback plans, SEO launch checklists
├── testing/        # QA reports, E2E acceptance suites, performance & accessibility
└── archive/        # Historical sprint reports, superseded audits, and preflight logs
```

---

## 1. Product Specifications (`docs/product/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_CONNECT_PRODUCT_SPEC.md`](./product/AASHVO_CONNECT_PRODUCT_SPEC.md) | Product specification for Aashvo Connect swipe-based flatmate matching and messaging. |
| [`AASHVO_CONNECT_INTELLIGENCE_SPEC.md`](./product/AASHVO_CONNECT_INTELLIGENCE_SPEC.md) | Specification for 7-dimension matching, personalized weights, and match explanations. |
| [`FEATURE_EXPANSION_PRODUCT_SPEC.md`](./product/FEATURE_EXPANSION_PRODUCT_SPEC.md) | Specifications for rental trust handover checklists, deposit tracking, and reviews. |
| [`END_TO_END_USER_JOURNEYS.md`](./product/END_TO_END_USER_JOURNEYS.md) | Journey maps for Renters, Flatmates, and Property Owners across the platform. |

---

## 2. Architecture & System Design (`docs/architecture/`)

| Document | Purpose |
| :--- | :--- |
| [`FINAL_ARCHITECTURE.md`](./architecture/FINAL_ARCHITECTURE.md) | End-to-end system topology: React SPA, NestJS 11 backend, PostgreSQL 16 database. |
| [`INDEPENDENT_BACKEND_ARCHITECTURE.md`](./architecture/INDEPENDENT_BACKEND_ARCHITECTURE.md) | Modular monolith architecture, dependency injection, and service boundaries. |
| [`AASHVO_CONNECT_TECHNICAL_DESIGN.md`](./architecture/AASHVO_CONNECT_TECHNICAL_DESIGN.md) | Technical architecture of the Connect recommendation and match pipeline. |
| [`CONNECT_INTELLIGENCE_ARCHITECTURE.md`](./architecture/CONNECT_INTELLIGENCE_ARCHITECTURE.md) | 7-dimension mathematical compatibility engine and database persistence. |
| [`FEATURE_EXPANSION_TECHNICAL_DESIGN.md`](./architecture/FEATURE_EXPANSION_TECHNICAL_DESIGN.md) | Architecture for digital agreements, inspections, and trust metrics. |
| [`MONOREPO_TRANSITION_PLAN.md`](./architecture/MONOREPO_TRANSITION_PLAN.md) | Monorepo structure, npm workspaces boundaries, and build orchestration. |
| [`FRONTEND_BACKEND_MAPPING.md`](./architecture/FRONTEND_BACKEND_MAPPING.md) | Mapping of React services and hooks to backend REST endpoints. |
| [`BACKEND_IMPLEMENTATION_ROADMAP.md`](./architecture/BACKEND_IMPLEMENTATION_ROADMAP.md) | Historical module delivery roadmap and milestones. |
| [`INFRASTRUCTURE_FINAL_DECISION.md`](./architecture/INFRASTRUCTURE_FINAL_DECISION.md) | Cloud hosting selection: Vercel frontend, Render backend, Supabase DB. |
| [`MANAGED_INFRASTRUCTURE_EVALUATION.md`](./architecture/MANAGED_INFRASTRUCTURE_EVALUATION.md) | Comparative evaluation of Neon, Supabase, Fly.io, and Render. |
| [`REPOSITORY_ARCHITECTURE_FINAL.md`](./architecture/REPOSITORY_ARCHITECTURE_FINAL.md) | Canonical repository layout and code organization standards. |
| [`FINAL_ENGINEERING_DOCUMENTATION_INDEX.md`](./architecture/FINAL_ENGINEERING_DOCUMENTATION_INDEX.md) | Cross-reference index of historical specifications. |

---

## 3. API & Contracts (`docs/api/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_CONNECT_API_REFERENCE.md`](./api/AASHVO_CONNECT_API_REFERENCE.md) | REST API endpoints for profiles, swipes, matches, and messaging. |
| [`CONNECT_INTELLIGENCE_API_REFERENCE.md`](./api/CONNECT_INTELLIGENCE_API_REFERENCE.md) | REST API endpoints for user matching preferences and intelligent candidate discovery. |
| [`FEATURE_EXPANSION_API_REFERENCE.md`](./api/FEATURE_EXPANSION_API_REFERENCE.md) | REST API endpoints for agreements, disputes, support, and reviews. |
| [`FRONTEND_API_TRANSITION_PLAN.md`](./api/FRONTEND_API_TRANSITION_PLAN.md) | Client API migration plan from direct PostgREST to NestJS API. |
| [`BACKEND_CONNECTIVITY_MATRIX.md`](./api/BACKEND_CONNECTIVITY_MATRIX.md) | Network, port, and security connectivity matrix across environments. |

---

## 4. Database & Storage (`docs/database/`)

| Document | Purpose |
| :--- | :--- |
| [`POSTGRESQL_DATABASE_DESIGN.md`](./database/POSTGRESQL_DATABASE_DESIGN.md) | PostgreSQL 16 schema design, table definitions, constraints, and indexes. |
| [`DATA_MIGRATION_AND_ROLLBACK_PLAN.md`](./database/DATA_MIGRATION_AND_ROLLBACK_PLAN.md) | Database migration safeguards, backup procedures, and rollback scripts. |
| [`AUTHENTICATION_MIGRATION_PLAN.md`](./database/AUTHENTICATION_MIGRATION_PLAN.md) | GoTrue/Supabase Auth to Argon2id/JWT credentials migration strategy. |
| [`STORAGE_MIGRATION_PLAN.md`](./database/STORAGE_MIGRATION_PLAN.md) | Object storage architecture: Cloudflare R2 (public) and AWS S3 (private). |
| [`SUPABASE_MIGRATION_PLAN.md`](./database/SUPABASE_MIGRATION_PLAN.md) | Migration execution plan for hosted Supabase PostgreSQL. |
| [`SUPABASE_SCHEMA_COMPARISON.md`](./database/SUPABASE_SCHEMA_COMPARISON.md) | Schema diff between Prisma ORM models and live PostgreSQL catalog. |
| [`SUPABASE_PRISMA_COMPATIBILITY_REPORT.md`](./database/SUPABASE_PRISMA_COMPATIBILITY_REPORT.md) | Verification of Prisma schema parity with hosted PostgreSQL. |

---

## 5. Security & Privacy (`docs/security/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_SECURITY_RELEASE_AUDIT.md`](./security/AASHVO_SECURITY_RELEASE_AUDIT.md) | Cryptographic Google OAuth verification, account takeover defense, token rotation. |
| [`AASHVO_CONNECT_SECURITY_REVIEW.md`](./security/AASHVO_CONNECT_SECURITY_REVIEW.md) | Privacy and authorization review of Connect matching and messaging. |
| [`FEATURE_EXPANSION_SECURITY_REVIEW.md`](./security/FEATURE_EXPANSION_SECURITY_REVIEW.md) | Security model for tenancy records, lease signing, and disputes. |
| [`GOOGLE_OAUTH_IMPLEMENTATION_REPORT.md`](./security/GOOGLE_OAUTH_IMPLEMENTATION_REPORT.md) | Technical report on Google Identity Services (GIS) integration. |
| [`SUPABASE_PRODUCTION_ROLE_SECURITY.md`](./security/SUPABASE_PRODUCTION_ROLE_SECURITY.md) | Database role permissions (`anon`, `authenticated`, `service_role`). |
| [`FINAL_SECURITY_REVIEW.md`](./security/FINAL_SECURITY_REVIEW.md) | Hardened security review: Argon2id, JWT keypairs, and IDOR protection. |

---

## 6. Development & Repository Hygiene (`docs/development/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_LAUNCH_SKILLS_AUDIT.md`](./development/AASHVO_LAUNCH_SKILLS_AUDIT.md) | Inventory of Antigravity agent skills and identified customization gaps. |
| [`DEPENDENCY_CLEANUP_REPORT.md`](./development/DEPENDENCY_CLEANUP_REPORT.md) | Workspace dependency audit and pruning analysis. |
| [`DEPENDENCY_REMEDIATION.md`](./development/DEPENDENCY_REMEDIATION.md) | Security vulnerability remediation across packages. |
| [`ENGINEERING_HARDENING_REPORT.md`](./development/ENGINEERING_HARDENING_REPORT.md) | Monorepo build, lint, and typecheck hardening summary. |
| [`CI_PIPELINE_REPAIR_REPORT.md`](./development/CI_PIPELINE_REPAIR_REPORT.md) | GitHub Actions CI workflow configuration and optimization. |

---

## 7. Deployment & Operations (`docs/deployment/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_SEO_LAUNCH_CHECKLIST.md`](./deployment/AASHVO_SEO_LAUNCH_CHECKLIST.md) | Launch verification for SEO metadata, Open Graph, JSON-LD, and robots.txt. |
| [`STAGING_DEPLOYMENT_RUNBOOK.md`](./deployment/STAGING_DEPLOYMENT_RUNBOOK.md) | Step-by-step runbook for deploying to staging environments. |
| [`FINAL_DEPLOYMENT_VERIFICATION.md`](./deployment/FINAL_DEPLOYMENT_VERIFICATION.md) | Production deployment verification checklist. |
| [`FINAL_ROLLBACK_INSTRUCTIONS.md`](./deployment/FINAL_ROLLBACK_INSTRUCTIONS.md) | Emergency rollback procedures across Vercel, Render, and PostgreSQL. |
| [`LEGACY_SUPABASE_STATUS.md`](./deployment/LEGACY_SUPABASE_STATUS.md) | Status and isolation boundaries for legacy Supabase assets. |

---

## 8. Testing & Quality Assurance (`docs/testing/`)

| Document | Purpose |
| :--- | :--- |
| [`AASHVO_FINAL_QA_REPORT.md`](./testing/AASHVO_FINAL_QA_REPORT.md) | Full QA test results across 438 automated tests (275 frontend + 163 backend). |
| [`AASHVO_CONNECT_QA_REPORT.md`](./testing/AASHVO_CONNECT_QA_REPORT.md) | Test coverage and verification for Aashvo Connect. |
| [`FEATURE_EXPANSION_QA_REPORT.md`](./testing/FEATURE_EXPANSION_QA_REPORT.md) | Test coverage for rental trust and support features. |
| [`FULL_STACK_QA_REPORT.md`](./testing/FULL_STACK_QA_REPORT.md) | Monorepo test execution and integration results. |
| [`ACCESSIBILITY_REVIEW.md`](./testing/ACCESSIBILITY_REVIEW.md) | WCAG 2.1 AA accessibility audit and WAI-ARIA evaluation. |
| [`PERFORMANCE_REVIEW.md`](./testing/PERFORMANCE_REVIEW.md) | Frontend bundle analysis, Core Web Vitals, and API latency benchmarks. |

---

## 9. Historical Archive (`docs/archive/`)

The [`docs/archive/`](./archive/) folder contains historical sprint planning documents, superseded release audits, pre-launch checklists, and point-in-time test reports preserved for institutional knowledge and audit compliance.
