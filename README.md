# Aashvo — Find your place. Find your people.

> **Pan-India accommodation, co-living, and flatmate discovery marketplace for students and young professionals.**  
> Built with radical financial transparency, verified co-living safety, swipe-based flatmate matching (Aashvo Connect), digital rental trust handover checklists, and an independent NestJS + PostgreSQL 16 backend.

---

## 🏛️ Brand & Product Mission

- **Brand:** `aashvo`
- **Tagline:** *Find your place. Find your people.*
- **Target Audience:** College students, interns, and young professionals relocating across major Indian tech and educational hubs (Delhi NCR, Bengaluru, Mumbai, Pune, Hyderabad, Chennai, Kota, Ahmedabad).
- **Core Product Features:**
  - **Smart Accommodation Discovery:** Verified Entire Flats, Private Rooms, and Family Stays with Indian city/locality/PIN code search.
  - **Aashvo Connect:** Flatmate discovery with 3 intentions (*Has a room*, *Needs a room*, *Rent together*), compatibility scoring, mutual matching, and match-only messaging.
  - **Rental Trust Engine:** Verified Landlord Badges, two-party Move-In Handover Checklists, digital tenancy agreements, and deposit dispute management.
  - **Fair Rent Split Calculator:** Algorithmic rent, utility, and deposit allocation with shareable URL encoding.
- **Aesthetics & Palette:**
  - **Warm Ivory:** `#FBF9F5` (Editorial canvas & warmth)
  - **Forest Green:** `#1B4332` (Primary brand accent, stability & trust)
  - **Sand Warm:** `#D4A373` (Architectural highlights & verified badges)
  - **Deep Charcoal:** `#1F2937` (Typographic contrast)
  - **Typography:** *Playfair Display* (Editorial Serif) paired with *Plus Jakarta Sans* (Clean UI Sans)

---

## 🛠️ System Architecture

AASHVO is structured as an **npm workspaces monorepo** with strict separation of concerns across the client, backend, and shared contract packages.

```text
AASHVO Monorepo
├── src/                  # React 18 + TypeScript + Vite 6 SPA (Root Frontend)
├── apps/api/             # NestJS 11 Modular Monolith REST API (/api/v1)
├── packages/contracts/   # Shared TypeScript Interfaces, Enums & OpenAPI 3.x
├── supabase/             # Legacy Supabase Archive & Disaster Recovery Rollback
└── docs/                 # Authoritative Architecture, Runbooks & Audit Reports
```

### 1. Frontend Architecture (`src/`)
- **Framework:** React 18 with TypeScript 5.7.
- **Build Tool:** Vite 6 with Rollup manual chunk-splitting (`vendor-react`, `vendor-icons`), eliminating monolithic chunks (main chunk 437 kB, 97 kB gzip).
- **Styling:** Tailwind CSS 3.4 with custom design tokens.
- **Accessibility:** 100% WCAG 2.1 Level AA compliant with standard WAI-ARIA 1.2 dialog semantics (`role="dialog"`, `aria-modal="true"`), high-contrast palette (>9.5:1), and keyboard navigation.
- **API Client:** Strongly-typed REST client (`src/services/apiClient.ts`) featuring automatic Bearer JWT injection, correlation tracking (`X-Request-Id`), and canonical error envelope unwrapping.

### 2. Backend Architecture (`apps/api`)
- **Framework:** NestJS 11 (modular monolith) running on Express and Node.js 22 LTS.
- **Architecture:** 15 domain modules (`AuthModule`, `ConnectModule`, `PropertiesModule`, `FlatmatesModule`, `RentalTrustModule`, `StorageModule`, `SupportModule`, `AdminModule`, `LocationsModule`, etc.).
- **Security Middleware:** Helmet for HTTP security headers, NestJS Throttler for rate limiting (5 req/min auth, 100 req/min global), and NestJS-Pino for structured JSON logging with automatic PII/credential redaction.
- **Authentication:** Memory-hard Argon2id password hashing ($m=65536, t=3, p=4$), short-lived 15-minute JWT access tokens, and refresh token rotation with replay detection.

### 3. Database Architecture (`PostgreSQL 16` & `Prisma`)
- **Database Engine:** PostgreSQL 16.
- **ORM:** Prisma Client v6.19.3.
- **Schema Model:** 22 relational domain tables, strict foreign keys, composite indexes on spatial coordinates and swipe matches, and version-controlled migration scripts in `apps/api/prisma/migrations/`.
- **Reliability:** Built-in PostgreSQL transactional event outbox pattern (`outbox_events`) for reliable asynchronous events.

### 4. Storage Architecture
- **Unified Abstraction:** `StorageService` interface abstracting local disk and multi-cloud providers.
- **Public Assets (Photos & Avatars):** Cloudflare R2 object storage with global edge CDN caching and zero egress fees.
- **Private Vault (KYC & Leases):** AWS S3 Mumbai (`ap-south-1`) with server-side encryption, private ACLs, and 15-minute temporary signed download URLs.

### 5. Shared Contracts (`packages/contracts`)
- Dual CommonJS/ESM compilation for domain entities, HTTP error envelopes, and canonical enums.
- Automatically generated OpenAPI 3.x specification (`openapi.json`, 203 kB).

---

## ⚡ Legacy Supabase Status

> [!NOTE]
> **SUPERSEDED PROTOTYPE — PASSIVE ROLLBACK ARCHIVE ONLY**  
> AASHVO was initially prototyped on Supabase. In accordance with strategic CTO directives, all core capabilities (authentication, database queries, and storage) have migrated to our independent NestJS and PostgreSQL 16 platform.  
> 
> The `supabase/` folder is retained strictly as an immutable archive of the 12 original SQL migrations and CLI configuration. The hosted Supabase instance (`himtwnwxvnnykafyhysy`) is air-gapped; **it is not used by the staging or production NestJS application.** For complete audit details, see [docs/LEGACY_SUPABASE_STATUS.md](./docs/LEGACY_SUPABASE_STATUS.md).

---

## ☁️ Staging Infrastructure Status

> [!IMPORTANT]
> **PREPARED LOCALLY — AWAITING FOUNDER SIGN-OFF**  
> The staging execution plan, architecture topologies, and environment variables are fully prepared and locally verified.  
> **Cloud infrastructure has NOT yet been provisioned or billed.** Deployment will begin upon Founder approval of the [STAGING_EXECUTION_APPROVAL_CHECKLIST.md](./docs/STAGING_EXECUTION_APPROVAL_CHECKLIST.md).
>
> - **API Compute:** Render / Fly.io / Railway Node.js 22 container.
> - **Database:** Managed PostgreSQL 16 (Bangalore / Mumbai region).
> - **Frontend CDN:** Vercel Staging Preview.
> - **Object Storage:** Cloudflare R2 (`aashvo-public-staging`) & AWS S3 Mumbai (`aashvo-private-staging`).

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js:** Node.js 18+ LTS (Tested on `v22.x` and `v24.x`).
- **NPM:** npm 9+ (Tested on `v11.x`).
- **PostgreSQL 16:** Local PostgreSQL 16 instance running on port 5433 or via Docker.

### 2. Install Monorepo Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create local environment files from the provided templates:
```bash
# Frontend configuration
cp .env.example .env.local

# Backend configuration
cp apps/api/.env.example apps/api/.env
```

### 4. Database Migrations
Apply version-controlled Prisma migrations to your local PostgreSQL 16 database:
```bash
# Validate Prisma schema
npm run api:prisma:validate

# Generate Prisma Client
npm --workspace=@aashvo/api run prisma:generate

# Apply migrations
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### 5. Running the Application
Start the frontend and backend in separate terminal sessions:
```bash
# Terminal 1: Start NestJS Backend API (http://localhost:4000)
npm run api:dev

# Terminal 2: Start React Frontend (http://localhost:5173)
npm run dev
```

---

## 🧪 Testing & Verification Commands

AASHVO maintains a comprehensive suite of **364 automated tests** across the backend and frontend with a **100% pass rate**.

```bash
# 1. Build Shared Contracts (CJS + ESM)
npm run contracts:build

# 2. Typecheck Entire Monorepo
npm --workspace=packages/contracts run typecheck
npm --workspace=@aashvo/api run typecheck
npm run typecheck

# 3. Run Backend Integration Tests (Jest on PostgreSQL 16 — 11 suites, 107 tests)
npm run api:test

# 4. Run Frontend Unit & Integration Tests (Vitest — 23 files, 257 tests)
npm test

# 5. Generate OpenAPI 3.x Specification
npm run api:openapi

# 6. Build Production Frontend Bundle (Vite 6 Code-Split)
npm run build
```

---

## 📚 Key Engineering Documentation

Authoritative architecture specifications, runbooks, and audit logs are available in the [`docs/`](./docs) directory:

- [docs/FINAL_ARCHITECTURE.md](./docs/FINAL_ARCHITECTURE.md) — Authoritative end-to-end system architecture & topology.
- [docs/FINAL_REPOSITORY_STRUCTURE.md](./docs/FINAL_REPOSITORY_STRUCTURE.md) — Repository layout & module organization.
- [docs/FINAL_ENGINEERING_DOCUMENTATION_INDEX.md](./docs/FINAL_ENGINEERING_DOCUMENTATION_INDEX.md) — Comprehensive guide to all 46 active specs and 68 archived reports.
- [docs/FINAL_SECURITY_REVIEW.md](./docs/FINAL_SECURITY_REVIEW.md) — Hardened security architecture, Argon2id, JWT, and IDOR defenses.
- [docs/PERFORMANCE_REVIEW.md](./docs/PERFORMANCE_REVIEW.md) — Bundle code-splitting metrics, database indexes, and API benchmarks.
- [docs/ACCESSIBILITY_REVIEW.md](./docs/ACCESSIBILITY_REVIEW.md) — WCAG 2.1 AA evaluation and WAI-ARIA 1.2 modal dialog matrix.
- [docs/DEPENDENCY_REMEDIATION.md](./docs/DEPENDENCY_REMEDIATION.md) — Vulnerability audit (`zod`, `vite`, `deepmerge-ts`).
- [docs/ENGINEERING_HARDENING_REPORT.md](./docs/ENGINEERING_HARDENING_REPORT.md) — Executive hardening summary and release sign-off.
- [docs/POSTGRESQL_DATABASE_DESIGN.md](./docs/POSTGRESQL_DATABASE_DESIGN.md) — PostgreSQL 16 relational design, 22 tables, and indexes.
- [docs/STAGING_DEPLOYMENT_RUNBOOK.md](./docs/STAGING_DEPLOYMENT_RUNBOOK.md) — Step-by-step cloud staging deployment runbook.
- [docs/STAGING_ROLLBACK_PLAN.md](./docs/STAGING_ROLLBACK_PLAN.md) — Multi-tier rollback procedures.
- [docs/LEGACY_SUPABASE_STATUS.md](./docs/LEGACY_SUPABASE_STATUS.md) — Classification and decoupling roadmap for legacy Supabase assets.

---

## 🔒 Security & Privacy Notice

AASHVO adheres strictly to OWASP and DPDP (Digital Personal Data Protection) principles:
- Passwords hashed with memory-hard **Argon2id**.
- JWT access tokens (15m expiry) with cryptographic refresh token rotation and replay family revocation.
- Fine-grained RBAC with database-level ownership checks (zero IDOR exposure).
- Connect messaging strictly locked behind reciprocal mutual likes.
- Private KYC and title deeds protected in encrypted vaults with 15-minute expiring download links.
- Structured Pino logging automatically redacting sensitive Indian PII (Aadhaar, PAN), credentials, and tokens.
