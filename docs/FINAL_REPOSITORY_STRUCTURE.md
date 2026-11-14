# AASHVO — FINAL REPOSITORY STRUCTURE
## Authoritative Monorepo Directory Layout & Module Organization

**Document Status:** Approved & Final  
**Classification:** Engineering Architecture & Repository Governance  
**Date:** November 2026  
**Auditor:** AASHVO Principal Software Architect & Repository Maintainer  
**Release Candidate:** RC-1.0.0  
**Workspace:** `D:\Projects\AASHVO`  

---

## 1. Executive Overview

AASHVO is structured as an npm workspaces monorepo combining a high-performance React single-page frontend, an independent NestJS 11 REST API service, and a zero-dependency shared contracts package.

```text
AASHVO/
├── .github/                      # CI/CD Workflows
│   └── workflows/
│       └── api-ci.yml            # Automated GitHub Actions test & migration pipeline
├── apps/                         # Monorepo Applications
│   └── api/                      # Independent NestJS 11 REST API Backend
│       ├── prisma/               # PostgreSQL 16 schema & migrations
│       ├── src/                  # Domain modules, controllers, and services
│       └── test/                 # PostgreSQL 16 Jest integration & unit suites
├── packages/                     # Monorepo Shared Libraries
│   └── contracts/                # Shared TypeScript contracts & OpenAPI 3.x schema
├── public/                       # Static Web Assets & SEO Metadata
│   ├── favicon.ico
│   ├── llms.txt                  # LLM crawler discovery manifest
│   ├── robots.txt                # Search engine crawler policies
│   └── sitemap.xml               # Canonical sitemap
├── src/                          # Root React 18 / Vite 6 Single Page Application
│   ├── components/               # Modular UI components & modal dialogs
│   ├── context/                  # AppContext & multi-tenant application state
│   ├── data/                     # Seed datasets & static FAQs
│   ├── services/                 # Unified REST API clients & legacy adapters
│   ├── styles/                   # Tailwind design system stylesheets
│   ├── test/                     # Vitest component & integration test suites
│   ├── types/                    # Core TypeScript domain models
│   ├── utils/                    # Currency and date formatters
│   ├── App.tsx                   # Top-level shell & modal coordination
│   ├── main.tsx                  # React DOM root entry point
│   └── vite-env.d.ts             # Vite client environment type definitions
├── supabase/                     # Archived Legacy Supabase Artifacts
│   ├── migrations/               # 12 historical SQL migrations (Rollback reference)
│   ├── .gitignore                # Supabase CLI gitignore
│   └── config.toml               # Historical local Supabase CLI configuration
├── docs/                         # Active Authoritative Engineering Documentation
│   └── archive/                  # 68 historical sprint reports & legacy analyses
├── .env.example                  # Environment variable template for new developers
├── .gitattributes                # Line ending and git attribute settings
├── .gitignore                    # Root gitignore rules
├── index.html                    # Root HTML entry template
├── package.json                  # Root npm workspace manifest
├── package-lock.json             # Synchronized lockfile
├── postcss.config.js             # PostCSS plugin configuration
├── README.md                     # Comprehensive project documentation
├── tailwind.config.js            # Design tokens & color system
├── tsconfig.json                 # TypeScript compiler configuration
├── tsconfig.node.json            # Node-specific TypeScript rules
├── vercel.json                   # Vercel SPA rewrite & proxy rules
└── vite.config.ts                # Vite 6 build & Rollup chunk-splitting config
```

---

## 2. Monorepo Workspaces Breakdown

### 2.1 Shared Contracts (`packages/contracts`)
Contains pure TypeScript contracts shared between the NestJS backend and the React frontend. Compiles to both CommonJS and ECMAScript Modules (`dist/cjs` and `dist/esm`).

```text
packages/contracts/
├── src/
│   ├── common/                   # Pagination, envelopes, error codes
│   ├── connect/                  # Aashvo Connect DTOs, intentions, compatibility types
│   ├── inquiries/                # Direct property inquiries & messages
│   ├── moderation/               # Admin reports & moderation actions
│   ├── properties/               # Listing creation, search filters, verification DTOs
│   ├── rental-trust/             # Agreements, inspections, dispute resolution
│   ├── support/                  # Support tickets, priorities, guest queries
│   ├── users/                    # Auth DTOs, KYC, profile update payloads
│   └── index.ts                  # Canonical root barrel export
├── openapi.json                  # Generated OpenAPI 3.x specification (203 kB)
├── package.json                  # Workspaces package manifest
├── tsconfig.cjs.json             # CJS compilation configuration
├── tsconfig.esm.json             # ESM compilation configuration
└── tsconfig.json                 # Base TypeScript configuration
```

### 2.2 Independent Backend (`apps/api`)
Production-grade NestJS 11 monolithic REST application backed by PostgreSQL 16 and Prisma ORM.

```text
apps/api/
├── prisma/
│   ├── migrations/               # PostgreSQL 16 DDL migration scripts
│   │   └── 20261112204500_init/  # Initial schema migration
│   └── schema.prisma             # 22 Prisma data models & relation mappings
├── src/
│   ├── common/                   # Global filters, interceptors, guards, decorators
│   │   ├── decorators/           # @CurrentUser(), @Roles(), @Public()
│   │   ├── filters/              # GlobalExceptionFilter (RFC 7807 compliance)
│   │   ├── guards/               # JwtAuthGuard, RolesGuard, AdminGuard
│   │   └── interceptors/         # ResponseEnvelopeInterceptor, LoggingInterceptor
│   ├── config/                   # Strongly-typed environment validation
│   ├── modules/                  # 15 Encapsulated domain feature modules
│   │   ├── admin/                # Moderation queue, verification, user suspension
│   │   ├── auth/                 # Argon2id hashing, JWT issuance, token rotation
│   │   ├── connect/              # Swipe deck, mutual matches, match-only messaging
│   │   ├── flatmates/            # Flatmate profile discovery & search
│   │   ├── health/               # /live and /ready database probes
│   │   ├── inquiries/            # Direct property inquiries & negotiation
│   │   ├── locations/            # Cities, localities, PIN codes, spatial search
│   │   ├── outbox/               # Event outbox reliability pattern
│   │   ├── profiles/             # User profiles, lifestyle habits, KYC status
│   │   ├── properties/           # Real estate listings, verification, Family Stays
│   │   ├── rental-trust/         # Agreements, inspections, deposit disputes
│   │   ├── storage/              # Multi-cloud storage (Local / Cloudflare R2 / AWS S3)
│   │   ├── support/              # Support tickets & audit logs
│   │   └── users/                # User accounts & role management
│   ├── scripts/
│   │   └── generate-openapi.ts   # Automated OpenAPI 3.x spec generator
│   ├── app.module.ts             # Root application module
│   └── main.ts                   # Bootstrap entry point (Pino, Helmet, CORS, Pipes)
├── test/                         # 11 PostgreSQL 16 Jest test suites (107 tests)
│   ├── app.integration.spec.ts
│   ├── auth.postgres.integration.spec.ts
│   ├── config.validation.spec.ts
│   ├── connect.postgres.integration.spec.ts
│   ├── domain.unit.spec.ts
│   ├── exception-filter.spec.ts
│   ├── logger-redaction.spec.ts
│   ├── marketplace.postgres.integration.spec.ts
│   ├── master-features.postgres.integration.spec.ts
│   ├── personas.postgres.integration.spec.ts
│   └── trust-engine.postgres.integration.spec.ts
├── nest-cli.json                 # NestJS CLI configuration
├── package.json                  # Backend package manifest
├── tsconfig.build.json           # Production build TypeScript configuration
└── tsconfig.json                 # Base backend TypeScript configuration
```

### 2.3 Single Page Application Frontend (`src`)
Modern, accessible React 18 SPA bundled via Vite 6 with Tailwind CSS.

```text
src/
├── components/                   # Modular UI components
│   ├── about/                    # OurFounders team showcase
│   ├── activity/                 # MyActivityModal (Visits, agreements, checklists)
│   ├── admin/                    # AdminModerationModal
│   ├── auth/                     # AuthModal (Login, register, password reset)
│   ├── calculator/               # RentSplitCalculatorModal
│   ├── connect/                  # ConnectModal, ConnectSwipeDeck, ConnectMatchesList
│   ├── discovery/                # DiscoverySection (City filters, property grids)
│   ├── features/                 # TrustFeatures showcase
│   ├── flatmate/                 # FlatmateCard, FlatmateDetailModal
│   ├── help/                     # HelpCenterModal, ReportModal
│   ├── hero/                     # Hero banner, ArchitecturalLandscape
│   ├── layout/                   # Navbar (6-section navigation), Footer
│   ├── listing/                  # ListPropertyModal (Multi-step listing creation)
│   ├── notifications/            # NotificationCenter bell & popover
│   ├── property/                 # PropertyCard, PropertyDetailModal, PropertyVerificationModal
│   ├── rental/                   # RentalTrustModal, MoveInChecklistModal
│   ├── saved/                    # SavedListingsModal
│   ├── ui/                       # Toast notification system
│   └── visit/                    # ScheduleVisitModal
├── context/
│   └── AppContext.tsx            # Global application state & mutation dispatcher
├── data/
│   ├── faqData.ts                # Help center knowledge base items
│   └── seedData.ts               # Demo listings, flatmate profiles, mock records
├── services/
│   ├── apiClient.ts              # Unified fetch client with JWT bearer handling
│   ├── authService.ts            # Authentication methods & demo session sandbox
│   ├── authorizationService.ts   # Client-side permission evaluator
│   ├── connectService.ts         # Aashvo Connect REST integration
│   ├── marketplaceService.ts     # Properties, searches, verification requests
│   ├── notificationService.ts    # User notifications
│   ├── rentalTrustService.ts     # Rental agreements, inspections, disputes
│   ├── rentCalculatorService.ts  # Fair split algorithms & share link encoding
│   ├── savedService.ts           # Saved property bookmark persistence
│   ├── storageService.ts         # Document and photo upload coordinator
│   ├── supabase.ts               # Legacy fallback adapter & test harness
│   ├── supportService.ts         # Tickets & dispute reporting
│   └── visitService.ts           # In-person visit scheduling
├── test/                         # 23 Vitest component & integration suites (257 tests)
├── types/
│   └── index.ts                  # Frontend domain models & view state interfaces
├── utils/
│   └── formatters.ts             # Currency (INR ₹), dates, relative freshness
├── App.tsx                       # Main application shell
└── main.tsx                      # Vite React entry point
```

---

## 3. Directory Governance & Maintainer Guidelines

For engineers adding new capabilities to AASHVO:
1. **Adding API Endpoints:** First define DTO interfaces and enums in `packages/contracts/src/<domain>/`, run `npm run contracts:build`, then implement the controller and service in `apps/api/src/modules/<domain>/`.
2. **Adding Frontend Views:** Utilize existing design tokens (`forest-*`, `sand-*`, `charcoal-*`). All modals must include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
3. **Writing Tests:** Frontend tests belong in `src/test/` using Vitest; backend API tests belong in `apps/api/test/` using Jest against PostgreSQL.
4. **Preserving Architecture:** Do not introduce alternative ORMs, duplicate backends, or bypass the shared contracts library.

