# [DEPRECATED / SUPERSEDED] Deployment Runbook (Legacy Supabase Prototype)

> [!WARNING]
> **SUPERSEDED DEPLOYMENT RUNBOOK (OCTOBER 2026)**  
> This document describes the legacy Supabase frontend-only deployment runbook and is retained for historical reference only.  
> The active production staging and release runbooks are defined in:  
> **[STAGING_DEPLOYMENT_RUNBOOK.md](file:///D:/Projects/AASHVO/docs/STAGING_DEPLOYMENT_RUNBOOK.md)** and **[MASTER_RELEASE_DEPLOYMENT_RUNBOOK.md](file:///D:/Projects/AASHVO/docs/MASTER_RELEASE_DEPLOYMENT_RUNBOOK.md)**.

## Local checks

```bash
npm ci
npm run typecheck
npm test -- --run
npm run build
npm audit --omit=dev
```

## Vercel configuration

Required public client variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV=production`
- `VITE_MARKETPLACE_REGION=Pan-India`

Never place a service-role key or provider secret in a `VITE_*` variable.

## Supabase release gate

Confirm the target project's actual migration/catalog state before applying the
reconciliation migration. Verify Auth email configuration, Google OAuth
redirects if enabled, Storage buckets, RLS, and the production public views.

## Release verification

After deployment, verify the actual Vercel revision, HTTPS response, asset
loading, authentication, empty marketplace behavior, listing persistence,
inquiry privacy, support lookup, and public metadata. Do not report a release as
production-verified without evidence from the live deployment.

## Current environment

The local workspace has no `.env` or Vercel CLI credentials. Hosted deployment
and live Supabase verification therefore remain external operations.
