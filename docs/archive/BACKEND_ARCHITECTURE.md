# [DEPRECATED / SUPERSEDED] Aashvo Backend Architecture (Legacy Supabase)

> [!WARNING]
> **SUPERSEDED ARCHITECTURE DOCUMENT (OCTOBER 2026)**  
> This document describes the legacy Supabase prototype architecture and is retained for historical/rollback reference only.  
> The active production backend architecture is defined in:  
> **[INDEPENDENT_BACKEND_ARCHITECTURE.md](file:///D:/Projects/AASHVO/docs/INDEPENDENT_BACKEND_ARCHITECTURE.md)** (NestJS 11 + PostgreSQL 16 + Prisma).

## Runtime model

Aashvo uses Supabase Auth, PostgreSQL, Row Level Security, and Storage as the
authoritative production backend. The React client contains a deterministic
local preview mode for development only. When `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are configured, production discovery and writes use
Supabase; localStorage is not used as the source of truth.

## Public discovery

Public property discovery uses `public.public_properties`, not the base
`properties` table. The view exposes active listings, coarse location data,
provider display name, itemized pricing, and aggregated property photo URLs.
Internal owner IDs and exact address fields are excluded.

Flatmate discovery uses `public.public_flatmates`. The private
`flatmate_profiles` table is never used as a public fallback.

## Write boundaries

- Listings are inserted into `properties` with `pending_review` status.
- Property images are persisted as rows in `property_photos`.
- Inquiries are inserted into `interest_requests` and protected by RLS and
  verification triggers.
- Safety reports map their target to the normalized reported-property,
  reported-flatmate, or reported-user columns.
- Support attachments are uploaded to private Storage before ticket metadata is
  inserted.
- Guest ticket lookup is served by the restricted
  `lookup_support_ticket(ticket_number, user_email)` RPC.

## Failure behavior

Live writes are awaited. Client state is updated only after persistence
succeeds. Preview mode may use local state, but demo identities are never sent
to Supabase.

## Future mobile clients

Native clients should use the same Supabase Auth, database views, RLS policies,
Storage buckets, and server-side triggers. No client should receive a service-
role key or bypass the public views and authorization policies.
