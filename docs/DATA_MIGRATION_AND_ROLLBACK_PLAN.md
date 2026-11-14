# AASHVO — Data Migration, Reconciliation & Rollback Plan

**Directive:** Transition existing users, listings, profiles, inquiries, tenancy agreements, rent ledgers, inspections, reviews, disputes, support tickets, safety reports, and storage files from Supabase (`aashvo-dev`) to Managed PostgreSQL + S3/R2 **with zero data loss and zero modification/deletion of Supabase**.  
**Skills Applied:** `postgresql-devsec`, `database-backups`, `backup-recovery`, `deprecation-and-migration`

---

## 1. Safety Principles & Pre-Migration Inspection Gate

1. **Supabase Stays Intact:** Never `DROP`, `TRUNCATE`, reset, pause, or delete the `aashvo-dev` Supabase project or its Storage buckets. Keep it untouched in read-only standby for **at least 30 days** post-cutover.
2. **Preserve Primary UUIDs:** Every migrated `user.id`, `profile.id`, `property.id`, `flatmate_profile.id`, `tenancy_agreement.id`, `support_ticket.id`, and `safety_report.id` keeps its **exact source UUID** (`uuid`).
3. **Why a Brief Maintenance Window Beats Bi-Directional Dual-Write:**
   - Running concurrent writes to both Supabase PostgREST *and* NestJS PostgreSQL risks split-brain IDs, conflicting sequence/ticket numbers (`ASH-TKT-XXXXXX`), and stale trigger side effects.
   - Instead, execute a **Two-Phase Snapshot + Scheduled 10-Minute Maintenance Freeze**:
     - *T-48h:* Rehearse complete extract-transform-load (ETL) + Storage copy into Staging/Prod-Target (`dry run`) with zero downtime.
     - *Cutover Window (off-peak 02:00 IST):* Enable temporary read-only maintenance banner (`503` writes / read-only browse) for 5–10 minutes → run final incremental delta sync → run full verification script → flip Vercel `VITE_API_PROVIDER=nestjs` / DNS → verify smoke suite → re-open writes.

---

## 2. Step-by-Step 14-Step Migration Runbook

### Phase A — Pre-Flight Read-Only Audit (T-7 Days)
1. **Take Safety Snapshots:** Verify automated backup on target DB and take an explicit manual pre-migration snapshot of both `aashvo-dev` (via Supabase CLI / `pg_dump` read-only role) and empty initialized Target PostgreSQL.
2. **Run Read-Only Anomaly Queries on Hosted Supabase:**
   - Verify no duplicate `user_id` rows exist in `public.flatmate_profiles` (required before enforcing `UNIQUE (user_id)`).
   - Inspect `auth.users.encrypted_password` prefixes (`$2a$`/`$2b$` vs empty/unsupported) and `auth.identities` providers.
   - Check orphan counts on `support_tickets.user_id`, `ticket_messages.sender_id`, `safety_reports.reporter_id`, `property_photos.property_id`.
   - Record baseline row counts and `SUM(rent_amount)`, `SUM(monthly_rent)`, `SUM(amount)` financial checksums across every table.

### Phase B — Target Schema & Object Storage Pre-Sync (T-48h to T-2h)
3. **Provision Target Schema:** Apply Prisma migrations (`prisma migrate deploy`) + raw SQL constraints (`0002_postgres_checks_and_gin_indexes.sql`) on Target PostgreSQL under `aashvo_migrator` role. **Temporarily keep outbox worker paused** so bulk imports do not trigger spurious onboarding emails/SMS!
4. **Pre-Sync Historical Storage Objects (`scripts/migrate-storage.ts`):** Stream all existing objects in Supabase buckets (`property-photos`, `user-avatars`, `support-attachments`, `rental-documents`) to R2/S3 and record `{ supabasePath -> mediaId, sha256 }` manifest. Verify 100% checksum match.

### Phase C — Topologically Ordered PostgreSQL ETL (Cutover Window)
Extract cleanly via read-only `pg_dump` / cursor ETL script wrapped in explicit **PostgreSQL transaction batches** in strict FK dependency order:

| Step | Source (`aashvo-dev`) | Target Table(s) | Conflict / Transform Rule |
|---|---|---|---|
| **5** | `auth.users` | `users` | Preserve exact `id` UUID; set `password_hash_algorithm = 'bcrypt_migrated'` for `$2a$`/`$2b$` else `'none'` + `password_reset_required = true` (if no OAuth); derive `account_status`. |
| **6** | `auth.identities` | `oauth_identities` | Copy non-`email` providers (`google`) mapping `provider_id -> provider_subject`. |
| **7** | `public.profiles` | `profiles` | Merge `email_verified` (`auth.users.email_confirmed_at IS NOT NULL OR profiles.email_verified`). Preserve `id`, `role`, `phone_verified`, `id_verified`. |
| **8** | `public.properties` | `properties` | Copy all 29 columns; default `featured = false`; verify `chk_family_stay_eligibility`. |
| **9** | `public.flatmate_profiles` | `flatmate_profiles` | Copy 1:1 after verifying unique `user_id`. |
| **10** | `public.property_photos` (+ storage manifest) | `media_assets` + `property_photos` | Insert verified `media_assets` rows for Supabase-stored objects; rewrite `photo_url` to CDN URL & set `media_id`; leave Unsplash URLs intact. |
| **11** | `public.interest_requests`, `public.tenancy_agreements`, `public.support_tickets`, `public.listing_reports` | Corresponding target tables | Rewrite `tenancy_agreements.document_url` and `support_tickets.attachments` storage refs using media manifest. |
| **12** | `public.rent_payment_records`, `public.property_inspections`, `public.tenancy_reviews`, `public.rental_disputes`, `public.ticket_messages`, `public.ticket_audit_events`, `public.safety_reports` | Corresponding target tables | Rewrite private storage URLs/arrays (`receipt_url`, `photo_urls`, `evidence_urls`, `evidence_url`) to `media://<mediaId>`; preserve all timestamps & constraints. |
| **13** | Storage Final Delta | `media_assets` + R2/S3 | Sync any files uploaded between T-2h and Cutover Freeze; record delta in manifest. |

### Phase D — Verification, Cutover & Post-Launch Monitoring
14. **Automated Reconciliation Verification Gate (`scripts/verify-migration.ts` — ALL must pass before unfreezing):**
    - **Row Count Parity:** Exact `source_count === target_count` across all 15 marketplace/trust/support tables + `users === auth.users`.
    - **Financial & Integrity Sums:** Exact equality of `SUM(rent_amount)`, `SUM(monthly_rent)`, `SUM(amount)` (`rent_payment_records`), `SUM(disputed_amount)`.
    - **Orphaned FK Check:** `0` broken references across every foreign key and `0` missing `media_assets` for migrated Storage keys.
    - **Random Golden-Record Hash Check:** Compare serialized JSON digests on sampled users, properties, agreements, and tickets.
    - **Auth & Private Download Smoke Test:** Against staging/prod NestJS pointed at Target DB: verify 1 bcrypt login (confirm transparent Argon2id upgrade!), 1 Google OAuth test account, 1 public property query (`owner_id` absent), 1 private rental document 15m presigned download (passes for party, returns `403` for stranger).
15. **Switch Traffic:** Set Vercel env `VITE_API_PROVIDER=nestjs` & `VITE_API_BASE_URL=https://api.aashvo.in`, promote deployment (`https://aashvo.vercel.app/`), resume `NotificationsModule` outbox worker, lift maintenance mode, and monitor 5xx / latency / Auth success metrics continuously for 72 hours.

---

## 3. Rollback & Contingency Procedures

| Rollback Stage | Trigger Condition | Exact Reversible Action | Data Loss Risk |
|---|---|---|---|
| **Stage A: Pre-Cutover Dry Run / Migration Script Fails** | Verification script mismatch, constraint error, or checksum failure during ETL. | Abort cutover; target DB remains unused; lift maintenance if started. Zero impact on live Supabase or Vercel. | **Zero (0%)** |
| **Stage B: Immediate Cutover Smoke Failure (T+0 to T+30m)** | Auth error spike > 2%, `5xx` rate > 1%, broken private file download, or CORS outage. | Instantly revert Vercel alias / `VITE_API_PROVIDER=supabase` and restore previous Vercel deployment (`< 60s`). Users fall back seamlessly to untouched Supabase `aashvo-dev`. | **Minimal** (only writes in those <30m on Target DB; exported cleanly if needed) |
| **Stage C: Post-Cutover Rollback (1h to 7d)** | Critical undiscovered NestJS logic regression requiring extended fix. | 1. Freeze NestJS API writes briefly.<br>2. Run reverse-delta script exporting any net-new `profiles`, `properties`, `interest_requests`, `support_tickets`, `tenancy_*` created after `cutover_timestamp` back into Supabase Postgres + Storage.<br>3. Flip Vercel flag back to `supabase`. *(Wait until reverse sync passes row count verification before flipping DNS/env!)* | **Zero** once reverse-delta executes cleanly |
| **Non-Reversible Point (T+30 Days+)** | After 30 days of zero-incident independent production + cold archive backup verification. | Only with explicit **CTO written sign-off**: export final `aashvo-dev` archival snapshot to encrypted offline storage, then pause/decommission Supabase project. | N/A |

