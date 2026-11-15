# AASHVO — Monorepo Transition & Repository Architecture Plan (Sprint 0)

**Decision Reference:** CTO Confirmed Decisions #6 & #7 — Monorepo inside existing `Ar10Ansari/aashvo`, preserving the existing React + Vite application at repository root until an independent post-migration review approves any frontend directory relocation.  
**Skills Applied:** `vercel-deployments`, `ci-cd-and-automation`, `github-actions`, `docker-management`, `frontend-architecture`, `openapi-spec-generator`

---

## 1. Pre-Transition Audit of Existing Vite, TypeScript & Vercel Configuration (Verified)

Direct inspection of `D:\Projects\AASHVO` established the exact configuration baseline:

| File Audited | Verified Current Configuration | Monorepo Compatibility Assessment |
|---|---|---|
| `package.json` | `"name": "aashvo"`, `"type": "module"`, scripts `dev` (`vite`), `build` (`tsc && vite build`), `preview`, `typecheck`, `test` (`vitest run`), Vite `6.0.11`, React `18.3.1`, TypeScript `~5.7.2`, Vitest `5.0.5`. | Uses **npm + `package-lock.json`** with root scripts expected directly by Vercel. Adding npm `"workspaces": ["apps/api", "packages/contracts"]` preserves every root script (`npm run build`, `npm test`, `npm run typecheck`) identically. |
| `vite.config.ts` | Root-based Vite React config (`port: 5173`, embedded Vitest `jsdom` config referencing `./src/test/setup.ts`). | Expects `index.html`, `public/`, and `src/` at repository root. Zero changes needed during Sprint 1–9 when frontend stays in place. |
| `tsconfig.json` & `tsconfig.node.json` | Root TS uses `"moduleResolution": "bundler"`, `"noEmit": true`, `"jsx": "react-jsx"`, `"include": ["src"]`; node TS targets `vite.config.ts`. | **Important Isolation Boundary:** NestJS uses CommonJS/NodeNext (`emitDecoratorMetadata: true`, `experimentalDecorators: true`), incompatible with browser Vite TS settings. Therefore `apps/api/tsconfig.json` **must NOT extend** root browser `tsconfig.json`; keep separate `apps/api/tsconfig.json` (and shared strict base `tsconfig.base.json` if extracted later). |
| `vercel.json` | Root-level SPA rewrite `/(.*) -> /` plus security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`). | Expects Vercel Project Root Directory = `.` (repo root) and build output `dist/`. Moving frontend to `apps/web` without coordinated Vercel Root Directory updates would immediately break production builds — hence deferred per CTO directive #7. |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `.env*` (preserving `!.env.example`), `supabase/.branches/`, `supabase/.temp/`. | Compatible with adding `apps/api/dist/`, `apps/api/.env*`, `packages/*/dist/`. |
| `.github/` | **Does not exist today** (zero automated CI workflows in repo). | Sprint 1 must introduce `.github/workflows/ci.yml` with separate path-filtered Frontend, Backend, and Contracts jobs. |

---

## 2. Approved Stage 1 Monorepo Structure (Zero Frontend Relocation!)

During Sprints 1–10, the existing React + Vite frontend remains **100% intact at repository root**, while backend and shared OpenAPI contracts live in cleanly isolated workspace directories:

```text
D:\Projects\AASHVO\                       # Repository root (existing React + Vite app preserved!)
├── index.html                            # Existing root entrypoint (UNTOUCHED)
├── public/                               # Existing static assets (UNTOUCHED)
├── src/                                  # Existing React + Tailwind frontend (UNTOUCHED until Sprint 9 adapter)
├── supabase/                             # Retained historical migrations & standby baseline (UNTOUCHED)
├── docs/                                 # Architecture, Sprint 0 & runbook documentation
├── vite.config.ts                        # UNTOUCHED
├── vercel.json                           # UNTOUCHED until Sprint 9 staging CSP update
├── package.json                          # Future Sprint 1: adds npm "workspaces": ["apps/api", "packages/contracts"]
│
├── apps/
│   └── api/                              # NEW (Sprint 1+): Independent NestJS 11 + Prisma + PostgreSQL backend
│       ├── package.json                  # @aashvo/api (NestJS 11, Prisma 6, Argon2, S3 SDK, OpenTelemetry)
│       ├── tsconfig.json                 # Standalone Node/NestJS TS config (decorators enabled, never mixes w/ React)
│       ├── nest-cli.json
│       ├── Dockerfile                    # Multi-stage non-root node:22-alpine container for DO App Platform / AWS ECS
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/               # Includes raw SQL constraints (0002_postgres_checks_and_gin_indexes.sql)
│       ├── scripts/                      # Non-production / cutover ETL & verification scripts (migrate-storage, migrate-db, verify)
│       └── src/                          # 16 Domain Modules + Common + Infrastructure
│
└── packages/
    └── contracts/                        # NEW (Sprint 1+): Single Source of Truth API Contract Package
        ├── package.json                  # @aashvo/contracts
        ├── openapi.json                  # Exported from NestJS Swagger during CI/dev build
        ├── src/
        │   ├── generated/openapi.d.ts    # Auto-generated TS interfaces (shared with React & future mobile)
        │   ├── enums.ts                  # Canonical shared enums (UserRole, PropertyCategory, TicketStatus, etc.)
        │   └── error-codes.ts            # Standardized error code registry (INQUIRY_PHONE_VERIFICATION_REQUIRED, etc.)
        └── tsconfig.json
```

### Why **npm Workspaces** (Before Optional Turborepo)
- Root repo already uses `npm` + `package-lock.json` natively on both Vercel and developer Windows machines.
- Switching to `pnpm` or `yarn` adds zero migration value while risking Vercel install command / lockfile breakage.
- **npm workspaces** (`npm install` once at root, `npm --workspace=apps/api run test`, `npm --workspace=packages/contracts run build`) handles hoisted resolution cleanly with **zero extra toolchain dependencies**. Turborepo can be layered strictly as an optional task runner later without changing folder boundaries.

---

## 3. Dependency Isolation & Build Safety Rules

1. **Zero Backend Dependencies in Frontend Bundle:**
   - NestJS, `@prisma/client`, `argon2`, `@aws-sdk/client-s3`, `ioredis`, and secrets validation live strictly inside `apps/api/package.json`.
   - `packages/contracts` exports **pure TypeScript types and constant enums/schemas only** — zero Node built-ins (`fs`, `crypto`, `pg`) so Vite bundling never fails or pulls server packages into the browser.
2. **Type-Safety & Shared Contracts Workflow:**
   - Backend change to DTO / Controller → regenerate `packages/contracts/openapi.json` + `openapi.d.ts` → CI verifies `packages/contracts` builds AND root frontend `npm run typecheck` passes against any updated DTOs automatically.
3. **Docker Build Context Discipline (`apps/api/Dockerfile`):**
   - Because `apps/api` depends on `@aashvo/contracts`, `Dockerfile` builds from repo root context (`COPY package*.json apps/api/package.json packages/contracts/package.json ./`) using `npm ci --workspace=apps/api --workspace=packages/contracts --omit=dev` cleanly in a multi-stage non-root Alpine image.
   - Include a root `.dockerignore` excluding `src/`, `dist/`, `.git/`, `supabase/`, `.vercel/`, and `docs/` so API container builds stay small and never bake frontend source or local artifacts into server containers.

---

## 4. CI/CD & Vercel Deployment Coordination

### 4.1 Recommended GitHub Actions Pipeline (`.github/workflows/ci.yml` — Added in Sprint 1)
Configure three deterministic path-aware checks on Pull Requests & `master` pushes:
1. **`contracts-ci`:** Triggers on `packages/contracts/**` or `apps/api/**` → builds `@aashvo/contracts` and verifies OpenAPI schema matches committed `openapi.json` (fails PR if DTO changed without regenerating contract!).
2. **`frontend-ci`:** Triggers on `src/**`, `public/**`, `index.html`, `package*.json`, `vite.config.ts`, `packages/contracts/**` → runs `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`.
3. **`api-ci`:** Triggers on `apps/api/**`, `packages/contracts/**` → spins up `postgres:16` + `redis:7` service containers → `prisma migrate deploy` + raw SQL constraint check → NestJS unit + Supertest real-Postgres integration suite → container build check.

### 4.2 Protecting Vercel Production From Backend-Only Commits
In Vercel Project Settings (at Sprint 1 onboarding), configure an **Ignored Build Step** so pure backend changes inside `apps/api/**` or `docs/**` do not churn production Vercel deployments unnecessarily:
```bash
git diff --quiet HEAD^ HEAD -- src/ public/ index.html package.json package-lock.json vite.config.ts tsconfig.json vercel.json packages/contracts/
```
*(Exit code `0` skips Vercel build safely; exit code `1` triggers build whenever frontend or shared contracts change.)*

---

## 5. Phase 2 Deferral: Future `apps/web` Relocation Gate

Relocating root `src/` → `apps/web/` is **explicitly out of scope** for Sprints 1–10 and requires a dedicated post-migration CTO review meeting all 4 conditions:
1. Independent backend is live in production for `≥ 30 days` with zero rollback dependency on root scripts.
2. Staging Vercel preview project validates `Root Directory = apps/web` cleanly including `vercel.json` headers & rewrites.
3. All CI workflows, Playwright paths, and contributor docs update in a single atomic PR.
4. `@supabase/supabase-js` has already been formally deprecated and removed per `docs/FRONTEND_API_TRANSITION_PLAN.md`.

