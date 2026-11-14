# AASHVO Backend API (`@aashvo/api`)

Independent NestJS 11 + TypeScript + PostgreSQL (Prisma) backend inside the `Ar10Ansari/aashvo` npm workspace monorepo.

> **Current Status:** Sprint 1 Foundation (configuration validation, health checks, Prisma schema scaffold, structured Pino logging with PII redaction, global standardized error envelope, Helmet/CORS/validation/rate-limiting security foundations, OpenAPI generation, and unit/integration test harness). Domain endpoints (`AuthModule`, `PropertiesModule`, etc.) begin in Sprint 2+ upon CTO sign-off.

---

## Prerequisites

- **Node.js:** `v22 LTS` or `v24+` (`npm 10+` / `11+` supporting npm workspaces)
- **PostgreSQL 16+** (local Docker container or native local Postgres — **never** point local `.env` at production or hosted Supabase)

---

## Workspace Installation & Setup (From Repository Root `D:\Projects\AASHVO`)

```bash
# 1. Install workspace dependencies (installs root Vite frontend + packages/contracts + apps/api cleanly)
npm install

# 2. Build shared contracts package (@aashvo/contracts)
npm run contracts:build

# 3. Validate Prisma schema & generate Prisma client
npm run api:prisma:validate
npm --workspace=apps/api run prisma:generate
```

---

## Local Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` for local development (**never commit `.env`**):

```bash
cp apps/api/.env.example apps/api/.env
```

Mandatory variables validated strictly at startup (`apps/api/src/infrastructure/config/env.schema.ts`):
- `DATABASE_URL` (`postgresql://...`)
- `JWT_SIGNING_PRIVATE_KEY` (`>= 32` characters; placeholders rejected in `staging`/`production`)
- `JWT_SIGNING_PUBLIC_KEY` (`>= 32` characters; placeholders rejected in `staging`/`production`)
- `CORS_ALLOWED_ORIGINS` (comma-separated `http://`/`https://` origins; wildcard `*` rejected)
- `PORT` (default `4000`)

---

## Running & Verifying Locally

```bash
# Start NestJS API in watch mode (port 4000)
npm run api:dev

# Run unit + Supertest HTTP integration tests
npm run api:test

# Generate OpenAPI specification into packages/contracts/openapi.json
npm run api:openapi

# Build backend bundle
npm run api:build

# Verify existing root frontend remains 100% healthy
npm run typecheck
npm test
npm run build
```

### Health & Documentation Endpoints (Local Development)

- `GET http://localhost:4000/api/v1/health/live` — Process liveness (`200 OK`)
- `GET http://localhost:4000/api/v1/health/ready` — Real PostgreSQL `SELECT 1` readiness probe (`200 OK` when local Postgres is up; honest `503 Service Unavailable` `status: "degraded"` when unreachable)
- `GET http://localhost:4000/api/docs` — Interactive Swagger UI (disabled automatically when `NODE_ENV=production`)

