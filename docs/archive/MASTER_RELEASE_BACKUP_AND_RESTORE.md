# AASHVO — MASTER RELEASE BACKUP AND RESTORE RUNBOOK
## Business Continuity, Point-In-Time Recovery (PITR), Data Retention & Disaster Recovery Procedures

**Author:** Database Architect & DevOps Lead  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  

---

## 1. RECOVERY TARGETS (RPO & RTO)

| Metric | Target Objective | Implementation Strategy |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 15 minutes** | Managed PostgreSQL continuous Write-Ahead Log (WAL) archiving & 1-hour automated snapshots |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Infrastructure as Code (IaC) automated cluster re-provisioning & PITR restore |
| **Document Durability** | **99.999999999% (11 9s)** | AWS S3 multi-AZ storage in `ap-south-1` with versioning enabled |

---

## 2. AUTOMATED BACKUP PROCEDURES

### A. Managed PostgreSQL Automated Backups
DigitalOcean Managed PostgreSQL is configured for:
- Continuous WAL streaming to encrypted cold storage.
- Daily full base backups retained for 7 calendar days.
- Point-In-Time Recovery (PITR) enabling restoration to any specific second in the preceding 7 days.

### B. Manual / Pre-Deployment Logical Dump (`pg_dump`)
Before applying major database migrations or maintenance passes, an encrypted logical dump is captured:
```bash
# Capture full database schema and data in compressed custom format
pg_dump -h $PG_HOST -p $PG_PORT -U $PG_USER -d aashvo_prod -F c -b -v -f "aashvo_backup_$(date +%Y%m%d_%H%M%S).dump"

# Encrypt backup archive with GPG AES-256
gpg --symmetric --cipher-algo AES256 "aashvo_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### C. Object Storage Backup & Versioning
- **Cloudflare R2 (`aashvo-public-assets-prod`):** Object lifecycle rules retain current property photos and user avatars.
- **AWS S3 (`aashvo-private-docs-prod`):** Object versioning is enabled. Accidental deletions or overwrites create delete markers that can be reverted instantly.

---

## 3. STEP-BY-STEP DATABASE RESTORATION RUNBOOK

### Scenario 1: Point-In-Time Recovery (Accidental Data Corruption)
1. In the DigitalOcean Cloud Console, navigate to **Databases** -> **aashvo-db-prod**.
2. Select **Restore from Backup** -> **Restore to Point in Time**.
3. Specify the exact target timestamp prior to the incident (e.g. `2026-11-14 14:32:00 UTC`).
4. Select target cluster name: `aashvo-db-restored`.
5. Wait for cluster initialization (~12 minutes).
6. Verify data integrity:
   ```sql
   SELECT count(*) FROM users;
   SELECT count(*) FROM tenancy_agreements;
   SELECT count(*) FROM rental_disputes;
   ```
7. Update NestJS backend `DATABASE_URL` secret on App Platform to point to the restored cluster host.
8. Restart App Platform containers. Verify `/api/v1/health/db` returns 200 OK.

### Scenario 2: Logical Dump Restore (`pg_restore`)
To restore from an encrypted custom format backup to a fresh PostgreSQL 16 database:
```bash
# 1. Decrypt archive
gpg --decrypt aashvo_backup_20261114.dump.gpg > aashvo_backup_20261114.dump

# 2. Restore into clean target database
pg_restore -h $TARGET_HOST -p 25060 -U $TARGET_USER -d aashvo_target -v --clean --if-exists aashvo_backup_20261114.dump

# 3. Analyze tables for optimizer statistics
psql -h $TARGET_HOST -p 25060 -U $TARGET_USER -d aashvo_target -c "ANALYZE VERBOSE;"
```

---

## 4. RESTORE DRILL SCHEDULE & VERIFICATION

- **Frequency:** Quarterly automated restoration drill into a staging database.
- **Audit Verification:** Hash comparisons of sample rows from `users`, `properties`, and `tenancy_agreements` between production and restored target.
- **Record Keeping:** Results logged in `docs/` disaster recovery audit logs.

