# [DEPRECATED / SUPERSEDED] Database Schema and Migrations (Legacy Supabase)

> [!WARNING]
> **SUPERSEDED MIGRATION DOCUMENT (OCTOBER 2026)**  
> This document describes the legacy Supabase SQL migrations sequence and is retained for historical/rollback reference only.  
> The active production database schema is defined in:  
> **[POSTGRESQL_DATABASE_DESIGN.md](file:///D:/Projects/AASHVO/docs/POSTGRESQL_DATABASE_DESIGN.md)** and managed via Prisma in `apps/api/prisma/schema.prisma`.

## Migration order

Migrations are chronological and forward-only. The current sequence includes
the original marketplace, security, nationwide/family-stay, support, rental
trust, flatmate privacy, repair, and backend-contract reconciliation changes.

The newest reconciliation migration is:

`supabase/migrations/20261027100000_backend_contract_reconciliation.sql`

It adds optional meal pricing, safety-report target metadata, support-ticket
attachment metadata, a privacy-safe `public_properties` view, and the secure
guest support lookup RPC.

## Safety rules

Before applying migrations to a hosted project:

1. Inspect migration history and actual catalog state.
2. Confirm backups/PITR.
3. Review foreign-key and policy dependencies.
4. Apply the narrowest forward-only migration.
5. Re-run catalog, RLS, Storage, and cross-user access checks.

Never reset, truncate, drop, or recreate a hosted database containing customer
data. The repository's migration files are not evidence that a hosted project
has actually been migrated.

## Verification targets

Verify RLS on every user-owned table, public view column minimization, private
Storage access, profile provisioning, listing moderation, inquiry privacy,
support ticket isolation, and rental counterparty isolation.
