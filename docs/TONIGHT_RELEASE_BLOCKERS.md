# AASHVO MVP Release — Blockers, Risks & Mitigations Report
**Date:** November 15, 2026  
**Auditor:** CTO & DevOps Lead  
**Scope:** MVP Release Tonight

---

## 1. Executive Status Matrix

| Component | Status | Blocker Level | Immediate Path Forward |
| :--- | :---: | :---: | :--- |
| **Monorepo Codebase & Contracts** | **READY** | None | Verified 100% via test suites & builds. |
| **Backend NestJS Application** | **READY** | None | Fully builds and starts; health probes verified. |
| **Frontend React / Vite Web App** | **READY** | None | Fully builds; connects to `VITE_API_BASE_URL`. |
| **Render Infrastructure (`render.yaml`)** | **READY** | None | Iac configured for zero-cost deployment. |
| **Neon Staging Database** | **READY** | None | **Live & 100% Migrated** (33 tables, AWS Singapore). |
| **Supabase Primary Database** | **BLOCKED** | **Requires Password** | Awaiting database password for `himtwnwxvnnykafyhysy`. |

---

## 2. Hard Blocker: Supabase Primary Database Password

### Description
In accordance with the CTO directive to transition to the existing Supabase project (`himtwnwxvnnykafyhysy`, Mumbai region), Prisma migrations need to be deployed to the target Supabase PostgreSQL instance.

However, **no database password for project `himtwnwxvnnykafyhysy` exists in the local workspace or environment files**. In accordance with strict security standards:
- The system never guessed or brute-forced credentials.
- No dummy credentials were used.
- Git history was confirmed clean of Supabase database passwords.

### Unblocking Action Required
The project owner/founder must retrieve or reset the database password in the Supabase Dashboard:
1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/himtwnwxvnnykafyhysy/settings/database).
2. Note the database password (or click "Reset Database Password").
3. Create `apps/api/.env.supabase` (strictly git-ignored) with:
   ```env
   DATABASE_URL="postgresql://postgres.himtwnwxvnnykafyhysy:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.himtwnwxvnnykafyhysy:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
   ```
4. Run:
   ```bash
   npx dotenv -e apps/api/.env.supabase -- npm --prefix apps/api run prisma:migrate:deploy
   ```

---

## 3. Zero-Delay Staging Alternative (Unblocked Path)

If the founder wishes to deploy and test the live application **immediately tonight without waiting** for Supabase password retrieval:

### The Neon Alternative
The Neon staging database (`ancient-union-03679564`) in AWS Singapore was already audited, provisioned, and migrated during this sprint:
- **33 tables** (full domain model including properties, personas, trust engine, marketplace, tickets).
- **38 enums** and **406 constraints** are fully active.
- Read/write pooled and direct connections are validated.
- The Render service can be deployed immediately pointing to this Neon database.
- Once the Supabase credentials are ready, the database can be transitioned seamlessly following `docs/SUPABASE_MIGRATION_PLAN.md`.

---

## 4. Operational Considerations & Free-Tier Limitations

### Consideration 1: Render Free Tier Spin-Down (Cold Start)
- **Behavior:** Render free web services automatically spin down after 15 minutes of inactivity. When a new incoming request hits the API, Render spins the container back up, resulting in an initial cold-start latency of approximately 30 to 50 seconds.
- **Mitigation:**
  - The liveness endpoint `GET /api/v1/health/live` is lightweight and requires 0 database queries.
  - A free external uptime monitor (such as UptimeRobot, cron-job.org, or a GitHub Action) can ping `https://aashvo-api.onrender.com/api/v1/health/live` every 10 minutes to keep the instance warm.

### Consideration 2: Vercel Frontend Environment Configuration
- **Behavior:** The frontend in production needs to know the live Render backend URL.
- **Requirement:** Add `VITE_API_BASE_URL=https://aashvo-api.onrender.com/api/v1` to the Vercel project environment variables and trigger a redeploy.

### Consideration 3: CORS Configuration
- **Behavior:** Browsers block cross-origin credentialed requests if CORS headers do not match the exact client origin.
- **Mitigation:** The NestJS API is configured with `CORS_ALLOWED_ORIGINS=https://aashvo.vercel.app` and `credentials: true`. Pre-flight `OPTIONS` requests and cookie transports are verified.

