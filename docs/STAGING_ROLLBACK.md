# AASHVO — STAGING DATABASE ROLLBACK RUNBOOK

**Author:** AASHVO Senior Backend Engineer & DevOps Lead  
**Date:** November 24, 2026  
**Target:** Neon PostgreSQL `aashvo_staging`  

---

## 1. Rollback Overview & Scenarios

If an unrecoverable schema corruption, migration failure, or critical defect occurs in the staging database during QA or pre-release testing, follow this runbook to restore the staging environment cleanly without affecting production.

```
+-------------------------------------------------------------------------------------------------+
| ROLLBACK PATHWAYS                                                                               |
|                                                                                                 |
| [ Scenario 1: Unstable Application Code ] ----> Revert Git commit & redeploy Render Staging   |
| [ Scenario 2: Failed Schema Migration ] -------> Rollback via Neon Branch Point-in-Time Restore |
| [ Scenario 3: Complete Database Reset ] -------> Re-create Staging Branch & Re-apply Migrations |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Scenario 1: Unstable Staging Application Code

If the software release has a bug but the database schema is intact:
1. Revert the problematic commit on branch `infra/neon-staging`:
   ```bash
   git revert <commit-hash>
   git push origin infra/neon-staging
   ```
2. In the Render Dashboard under `aashvo-api-staging`, trigger **Manual Deploy** -> **Deploy latest commit**.

---

## 3. Scenario 2: Schema Migration Rollback (Neon Point-in-Time Restore)

Neon provides zero-downtime branching and instant point-in-time recovery (PITR) without needing heavy SQL dump restores:

1. Open the [Neon Console](https://console.neon.tech).
2. Select project `aashvo-staging` (`small-butterfly-15738810`).
3. Under **Branches**, select `main` (`br-restless-base-bi8ybn3a`).
4. Click **Restore from point in time** -> Select the timestamp immediately prior to the failed migration.
5. Neon will restore the database to the exact pre-migration state in seconds.

---

## 4. Scenario 3: Complete Clean-Slate Re-initialization

Because `aashvo_staging` contains only disposable synthetic test data, if the database ever needs to be cleanly reset:

1. Connect to Neon staging using `psql` or Neon SQL editor:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO aashvo_staging_owner;
   GRANT ALL ON SCHEMA public TO public;
   ```
2. Re-apply all 7 pristine migrations from scratch:
   ```bash
   node apps/api/test/verify-and-migrate-neon.cjs deploy
   ```
3. Verify table regeneration:
   ```bash
   npm --workspace=apps/api test test/neon-staging.integration.spec.ts
   ```
