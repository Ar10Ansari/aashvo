# AASHVO — FINAL ROLLBACK INSTRUCTIONS & DISASTER RECOVERY RUNBOOK
## Emergency Rollback Procedures, State Reversal & Incident Management

**Document Status:** Approved & Authoritative  
**Release Candidate:** RC-1.0.0  
**Date:** November 2026  
**Auditor:** AASHVO Release Manager & Senior DevOps Engineer  
**Baseline Known-Good Commit:** `ab867c1` (*fix: reconcile live backend contracts and persistence*)  

---

## 1. Rollback Architecture & Recovery Point Objective

AASHVO's deployment topology enables independent multi-tier rollback:

| Subsystem | Rollback Mechanism | Recovery Time Objective (RTO) | Data Loss Exposure (RPO) |
| :--- | :--- | :---: | :---: |
| **Frontend (Vercel CDN)** | Vercel Instant Rollback / Git Revert | **< 60 seconds** | Zero |
| **Backend Compute (NestJS)** | Git Tag Re-deploy / Container Rollback | **< 3 minutes** | Zero |
| **Database (PostgreSQL 16)** | Forward Migration Patch / PITR Restore | **< 10 minutes** | Zero (Transactions preserved) |
| **Object Storage (R2 / S3)** | Bucket Object Versioning | **< 5 minutes** | Zero |

---

## 2. Frontend Rollback Procedures

### Scenario A: Vercel Instant Rollback (Fastest — < 60 seconds)
If the deployed frontend exhibits an unexpected visual or routing defect in production:
1. Log into the **Vercel Dashboard** -> Project `aashvo`.
2. Navigate to the **Deployments** tab.
3. Locate the previous verified deployment corresponding to commit `ab867c1`.
4. Click the three dots (`...`) -> Select **Promote to Production**.
5. Vercel's edge network instantly updates traffic routing to the previous build without requiring a code rebuild.

### Scenario B: Git Revert (Authoritative Forward-Only Rollback)
To revert code in the GitHub repository without force-pushing or rewriting history:
```bash
# 1. Ensure working on clean master branch
git checkout master
git pull origin master

# 2. Revert the release commit cleanly
git revert <RELEASE_COMMIT_SHA> -m 1 --no-edit

# 3. Verify tests on reverted state
npm test

# 4. Push revert commit to trigger automated Vercel deployment
git push origin master
```

---

## 3. Database Migration Rollback & Safety Policy

> [!CAUTION]
> **STRICT DATABASE SAFETY BOUNDARIES:**
> 1. **No Destructive Drops:** Never run `prisma migrate reset` in staging or production.
> 2. **Additive Schema Principle:** The 5 RC-1.0.0 migrations (`aashvo_connect_matching`, `flatmate_intentions`, `master_feature_expansion`) are strictly additive. Tables and columns added (`likes`, `matches`, `connect_messages`, `property_verifications`, `move_in_checklists`) do not alter or delete existing columns.
> 3. **Backward Compatibility:** Older code continues to function against the updated PostgreSQL schema without errors.

If an emergency schema reversal is mandated:
1. Do not delete migration history files.
2. Author an additive forward-migration:
   ```bash
   npx prisma migrate dev --name rollback_feature_flags
   ```
3. Apply via `npx prisma migrate deploy`.

---

## 4. Emergency Incident Contact Matrix

- **CTO / Technical Lead:** `engineering@aashvo.com`
- **GitHub Admin:** `Ar10Ansari`
- **Vercel Project Admin:** `abdul.professional10@gmail.com`

