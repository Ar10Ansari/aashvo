# AASHVO Canonical Repository Structure

**Author:** AASHVO Engineering (CTO & Repository Maintainer)
**Date:** November 15, 2026
**Repository:** `D:\Projects\AASHVO`
**Monorepo Tooling:** npm workspaces

---

## 1. Top-Level Directory Layout

```text
D:\Projects\AASHVO
├── .github/              # Continuous Integration & Automation workflows
│   └── workflows/        # GitHub Actions (api-ci.yml)
├── apps/                 # Independent application services
│   └── api/              # NestJS 11 Modular Monolith REST API (/api/v1)
├── packages/             # Shared monorepo packages
│   └── contracts/        # TypeScript DTOs, domain enums, OpenAPI specification
├── src/                  # React 18 SPA Frontend (Vite 6, Tailwind CSS)
├── public/               # Web root assets, robots.txt, sitemap.xml, llms.txt, favicon.svg
├── supabase/             # Historical Supabase migrations & disaster recovery archive
├── docs/                 # Authoritative categorized documentation & knowledge base
│   ├── product/          # Feature specs and user journeys
│   ├── architecture/     # System topology and module designs
│   ├── api/              # Endpoint references and contract schemas
│   ├── database/         # PostgreSQL schema and migration plans
│   ├── security/         # Cryptographic reviews and RLS policies
│   ├── development/      # Monorepo setup and dependency hygiene
│   ├── deployment/       # Staging and production deployment runbooks
│   ├── testing/          # QA reports and accessibility reviews
│   └── archive/          # Historical sprint reports and superseded audits
├── .env.example          # Safe environment template for frontend overrides
├── .gitignore            # Multi-tier gitignore rules
├── index.html            # Main HTML entrypoint with Schema.org JSON-LD and GIS script
├── package.json          # Root monorepo workspace definition and top-level scripts
├── render.yaml           # Render deployment configuration for production API
├── tsconfig.json         # Root TypeScript compiler options (strict, noUnusedLocals)
├── vercel.json           # Vercel SPA routing and security header configuration
└── vite.config.ts        # Vite 6 bundler config with Rollup chunk splitting
```

---

## 2. Frontend Application (`src/`)

The frontend is a single-page application built with React 18, TypeScript, and Vite.

```text
src/
├── components/           # Modular UI components
│   ├── about/            # Founders & Mission components
│   ├── activity/         # User inquiry and listing activity modals
│   ├── admin/            # Role-restricted moderation and ticket review
│   ├── auth/             # Authentication modal (Email/Password & Google Identity Services)
│   ├── calculator/       # Fair Rent Split Calculator modal
│   ├── connect/          # Aashvo Connect profile cards, match celebration, and messaging
│   ├── discovery/        # Marketplace search bar, filters, inventory grid, empty states
│   ├── features/         # Marketing feature callouts and value propositions
│   ├── flatmate/         # Flatmate detail view and lifestyle breakdown
│   ├── help/             # Support center and guest ticket submission
│   ├── hero/             # Hero banner with locality search dropdown
│   ├── layout/           # Global Navbar, Footer, and Notification badge
│   ├── listing/          # ListPropertyModal (direct owner ₹0 listing fee onboarding)
│   ├── notifications/    # Notification center dropdown and badge
│   ├── property/         # Property detail modal, cards, and filters
│   ├── rental/           # RentalTrustModal (agreements, handover checklists, disputes)
│   ├── saved/            # Saved properties modal
│   ├── ui/               # Reusable UI primitives (buttons, modals, badges)
│   └── visit/            # Schedule in-person property visit modal
├── context/
│   └── AppContext.tsx    # Monolithic application state provider (user, listings, filters)
├── data/
│   ├── faqData.ts        # Comprehensive FAQ content for customer support
│   └── seedData.ts       # Locality constants and unit testing fixtures
├── services/
│   ├── apiClient.ts      # Strongly-typed Axios/Fetch REST client with JWT Bearer injection
│   ├── authService.ts    # Authentication methods, session storage, and Google OAuth
│   ├── connectService.ts # Connect profiles, swipe actions, and mutual matches
│   ├── marketplaceService.ts # Property fetching and listing submission
│   ├── rentalTrustService.ts # Digital tenancy agreements and dispute handling
│   └── supportService.ts # Support ticket submission and messaging
├── test/                 # 25 Vitest test suites (275 automated tests)
├── types/                # Domain TypeScript interfaces and types
└── utils/                # Date formatters and currency calculations
```

---

## 3. Backend Service (`apps/api/`)

The backend is an independent NestJS 11 service implementing a modular monolith architecture.

```text
apps/api/
├── prisma/
│   ├── schema.prisma     # Authoritative PostgreSQL 16 schema (22 models)
│   └── migrations/       # Version-controlled Prisma migration history
├── src/
│   ├── common/           # Cross-cutting decorators, filters, guards, and interceptors
│   │   ├── decorators/   # @CurrentUser, @Roles, @Public
│   │   ├── filters/      # GlobalExceptionFilter (RFC 7807 error envelopes)
│   │   ├── guards/       # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   │   └── interceptors/ # LoggingInterceptor, ResponseTransformInterceptor
│   ├── infrastructure/   # Database and storage adapters
│   │   ├── database/     # PrismaService and transaction management
│   │   └── storage/      # StorageService (Local, Cloudflare R2, AWS S3)
│   ├── modules/          # 15 Domain modules
│   │   ├── auth/         # Password auth, Google token verification, refresh sessions
│   │   ├── connect/      # Connect profiles, preferences, swipes, matches, messaging
│   │   ├── properties/   # Marketplace listings, pricing, filters, and amenities
│   │   ├── flatmates/    # Flatmate profiles, intentions, and lifestyle habits
│   │   ├── family-stays/ # Family stay categorization and meal disclosure rules
│   │   ├── agreements/   # Tenancy agreement lifecycle and digital signatures
│   │   ├── disputes/     # Tenancy dispute resolution framework
│   │   ├── inspections/  # Two-party Move-In Handover Checklists
│   │   ├── inquiries/    # Renter-to-landlord inquiries with contact masking
│   │   ├── support/      # Support ticketing and moderation notes
│   │   ├── notifications/# Real-time notification creation and delivery
│   │   ├── reviews/      # Landlord and tenant rating records
│   │   ├── saved/        # User saved property bookmarks
│   │   ├── visits/       # Scheduled property visit appointments
│   │   └── users/        # User accounts and progressive profile management
│   ├── app.module.ts     # Root NestJS dependency injection module
│   ├── app.factory.ts    # Application factory for bootstrap and testing
│   └── main.ts           # Entrypoint listening on PORT 4000
└── test/                 # 14 Jest integration test suites (163 automated tests)
```

---

## 4. Shared Contracts (`packages/contracts/`)

```text
packages/contracts/
├── src/
│   ├── domain.ts         # Shared TypeScript interfaces for users, properties, flatmates
│   ├── enums.ts          # Canonical enums (Role, PropertyCategory, FoodHabit, etc.)
│   ├── errors.ts         # Standardized application error codes and envelopes
│   ├── health.ts         # Health check response schemas
│   └── index.ts          # Central package exports
├── openapi.json          # Generated OpenAPI 3.x specification
└── package.json          # Dual CJS/ESM compilation configuration
```

---

## 5. Architectural Boundaries & Communication Rules

1. **Client to Backend:**
   - The React frontend communicates strictly via the REST API at `/api/v1` using standard HTTP methods.
   - Authentication tokens are passed via `Authorization: Bearer <JWT>`.
2. **Contracts Independence:**
   - Both `src/` and `apps/api/` import domain types and enums from `@aashvo/contracts` to guarantee contract parity without circular dependencies.
3. **Database Isolation:**
   - Only `apps/api` communicates directly with PostgreSQL 16 via Prisma Client. The frontend has zero direct database credentials.
