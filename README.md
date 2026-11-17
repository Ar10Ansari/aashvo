# Aashvo — Find your place. Find your people.

> **Pan-India verified accommodation, co-living, and flatmate discovery marketplace for university students and young working professionals.**
> Built with radical financial transparency, zero brokerage fees, lifestyle compatibility matching (Aashvo Connect), family stays with homecooked meal disclosures, digital rental trust handover checklists, and an independent NestJS + PostgreSQL 16 backend.

---

## 🏛️ Brand & Product Overview

- **Brand:** Aashvo
- **Tagline:** *Find your place. Find your people.*
- **Production Website:** [https://aashvo.vercel.app](https://aashvo.vercel.app)
- **Production API:** [https://aashvo-api.onrender.com/api/v1](https://aashvo-api.onrender.com/api/v1)
- **Founders:**
  - **Abdul Rehman Ansari** — Co-founder & Chief Technology Officer (CTO)
  - **Tushar Jaisawl** — Co-founder & Head of Marketing
- **Target Audience:** College students, interns, and young working professionals relocating across major Indian tech and educational hubs (Delhi NCR, Gurugram, Bengaluru, Mumbai, Pune, Hyderabad).
- **Core Product Pillars:**
  1. **Find Flatmates (Primary):** Connect with compatible roommates based on lifestyle compatibility (food habits, sleep routines, cleanliness, pet-friendliness) with adult age verification (18+).
  2. **Aashvo Connect Intelligence:** 7-dimension deterministic matching (budget, location, lifestyle, food, sleep, move-in date, shared interests) with personalized priority weights, data-driven "Why You Match" explanations, mutual double-opt-in consent, and match-only messaging.
  3. **Family Stays:** Private rooms inside primary homes of resident host families living on-premises full-time, with transparent meal options (Included, Optional Extra, or Self-Catering).
  4. **Entire Flats & Rooms:** Direct property owner listings with ₹0 listing fee, zero broker markups, and itemized upfront monthly costs.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend SPA** | React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Lucide React |
| **Backend API** | NestJS 11 (Modular Monolith), Express, Node.js 22 LTS, TypeScript 5.7 |
| **Database & ORM** | PostgreSQL 16 (Hosted on Supabase Mumbai `ap-south-1`), Prisma ORM v6.19 |
| **Authentication** | Google Identity Services (GIS), Asymmetric RS256 JWT, Argon2id, Refresh Token Rotation |
| **Storage & Media** | Unified Storage Abstraction: Cloudflare R2 (Public assets) & AWS S3 Mumbai (Encrypted KYC vault) |
| **Hosting & CI/CD** | Vercel (Frontend CDN), Render (Backend Compute), GitHub Actions (API CI) |
| **Testing** | Vitest & Testing Library (Frontend, 293 tests), Jest & Supertest (Backend, 182 tests) |

---

## 📁 Repository Structure

AASHVO is structured as an **npm workspaces monorepo** with clear architectural boundaries:

```text
AASHVO Monorepo
├── src/                  # React 18 SPA Frontend (Vite 6, Tailwind CSS)
│   ├── components/       # Accessible UI components (Auth, Connect, Discovery, Rental, etc.)
│   ├── context/          # Application context & global state management
│   ├── services/         # Strongly-typed API client & feature services
│   ├── test/             # 27 Vitest test suites (293 automated tests)
│   ├── types/            # Frontend domain TypeScript definitions
│   └── utils/            # Formatting and calculation helpers
├── apps/
│   └── api/              # NestJS 11 Modular Monolith REST API (/api/v1)
│       ├── prisma/       # Prisma schema (24 models) and SQL migrations
│       ├── src/          # 15 domain modules, guards, decorators, and interceptors
│       └── test/         # 16 Jest integration test suites (182 automated tests)
├── packages/
│   └── contracts/        # Shared TypeScript interfaces, canonical enums & OpenAPI 3.x
├── public/               # Static assets, robots.txt, sitemap.xml, llms.txt, favicon.svg
├── supabase/             # Immutable migration archive & disaster recovery reference
└── docs/                 # Categorized engineering specifications & runbooks
    ├── product/          # Feature specs and user journeys
    ├── architecture/     # System topology and module designs
    ├── api/              # Endpoint references and contract schemas
    ├── database/         # PostgreSQL schema and migration plans
    ├── security/         # Cryptographic review and RLS policies
    ├── development/      # Monorepo setup and dependency hygiene
    ├── deployment/       # Staging and production deployment runbooks
    ├── testing/          # QA reports and accessibility reviews
    └── archive/          # Historical sprint reports and audits
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js:** Node.js 20+ LTS or 22 LTS (Tested on `v22.x` and `v24.x`).
- **NPM:** npm 9+ (Tested on `v10.x` / `v11.x`).
- **PostgreSQL 16:** Local instance running on port 5433 or hosted PostgreSQL.

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Ar10Ansari/aashvo.git
cd aashvo

# Install monorepo dependencies
npm install

# Build shared contracts package
npm run contracts:build
```

### 3. Environment Configuration
Copy the provided environment templates:
```bash
# Frontend configuration
cp .env.example .env.local

# Backend configuration
cp apps/api/.env.example apps/api/.env
```

### 4. Database Setup & Migrations
```bash
# Validate Prisma schema
npm run api:prisma:validate

# Generate Prisma Client
npm --workspace=@aashvo/api run prisma:generate

# Apply migrations to local database
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### 5. Running the Application
Start the frontend and backend services concurrently or in separate terminals:
```bash
# Terminal 1: Start NestJS Backend API (http://localhost:4000/api/v1)
npm run api:dev

# Terminal 2: Start React Frontend (http://localhost:5173)
npm run dev
```

---

## 🧪 Testing & Verification Commands

AASHVO enforces strict test automation across the workspace with **438 automated tests** passing at a **100% pass rate**:

```bash
# 1. Run Frontend Tests (Vitest — 25 suites, 275 tests)
npm test

# 2. Run Backend Integration Tests (Jest — 14 suites, 163 tests)
npm run api:test

# 3. Static Type Checking (Zero Errors)
npm run typecheck
npm --workspace=@aashvo/api run typecheck

# 4. Production Bundling & Builds
npm run build
npm run api:build

# 5. OpenAPI Specification Generation
npm run api:openapi
```

---

## 📚 Documentation Index

For detailed specifications, architectural diagrams, security reviews, and operational runbooks, consult the categorized documentation in [`docs/`](./docs/README.md):

- [**Product Specifications**](./docs/product/): [`AASHVO_CONNECT_PRODUCT_SPEC.md`](./docs/product/AASHVO_CONNECT_PRODUCT_SPEC.md), [`FEATURE_EXPANSION_PRODUCT_SPEC.md`](./docs/product/FEATURE_EXPANSION_PRODUCT_SPEC.md)
- [**System Architecture**](./docs/architecture/): [`FINAL_ARCHITECTURE.md`](./docs/architecture/FINAL_ARCHITECTURE.md), [`INDEPENDENT_BACKEND_ARCHITECTURE.md`](./docs/architecture/INDEPENDENT_BACKEND_ARCHITECTURE.md)
- [**API References**](./docs/api/): [`AASHVO_CONNECT_API_REFERENCE.md`](./docs/api/AASHVO_CONNECT_API_REFERENCE.md), [`FEATURE_EXPANSION_API_REFERENCE.md`](./docs/api/FEATURE_EXPANSION_API_REFERENCE.md)
- [**Database & Migrations**](./docs/database/): [`POSTGRESQL_DATABASE_DESIGN.md`](./docs/database/POSTGRESQL_DATABASE_DESIGN.md), [`SUPABASE_MIGRATION_PLAN.md`](./docs/database/SUPABASE_MIGRATION_PLAN.md)
- [**Security & OAuth**](./docs/security/): [`AASHVO_SECURITY_RELEASE_AUDIT.md`](./docs/security/AASHVO_SECURITY_RELEASE_AUDIT.md), [`FINAL_SECURITY_REVIEW.md`](./docs/security/FINAL_SECURITY_REVIEW.md)
- [**Deployment & SEO**](./docs/deployment/): [`AASHVO_SEO_LAUNCH_CHECKLIST.md`](./docs/deployment/AASHVO_SEO_LAUNCH_CHECKLIST.md), [`STAGING_DEPLOYMENT_RUNBOOK.md`](./docs/deployment/STAGING_DEPLOYMENT_RUNBOOK.md)
- [**QA & Verification**](./docs/testing/): [`AASHVO_FINAL_QA_REPORT.md`](./docs/testing/AASHVO_FINAL_QA_REPORT.md), [`ACCESSIBILITY_REVIEW.md`](./docs/testing/ACCESSIBILITY_REVIEW.md)

---

## 🔒 Security & Privacy Commitments

AASHVO strictly adheres to OWASP Top 10 and DPDP (Digital Personal Data Protection) principles:
- **Zero Account Takeover Vulnerabilities:** Google Identity Services ID tokens are verified against Google's public JWKS certificates (RS256); pre-existing password accounts cannot be claimed without password authentication and explicit linking.
- **Credential Protection:** Passwords hashed with memory-hard **Argon2id**; sessions managed via dual-token JWTs with cryptographic refresh token rotation and family reuse detection.
- **Data Privacy Masking:** Phone numbers and precise residential addresses are masked publicly until mutual inquiry acceptance.
- **Role Isolation:** LocalStorage admin tampering is automatically demoted client-side and strictly enforced server-side via `RolesGuard` and `JwtAuthGuard`.
