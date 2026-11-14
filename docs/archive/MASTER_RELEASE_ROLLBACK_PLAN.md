# AASHVO — MASTER RELEASE ROLLBACK & CONTINGENCY PLAN
## Multi-Tier Incident Triage, Reversion Runbooks & Zero-Data-Loss Fallback Protocols

**Author:** CTO & Incident Commander  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  

---

## 1. ROLLBACK TRIGGERS & DECISION THRESHOLDS

A release rollback or emergency traffic diversion must be initiated if any of the following triggers are observed within 60 minutes of production cutover:

| Trigger Indicator | Critical Threshold | Action Required |
| :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | > 1.0% of total requests over a 5-minute window | Immediate Level 1 or Level 2 Rollback |
| **P95 Latency Degradation** | > 1,500 ms on core read endpoints | Connection pool check / Level 2 Rollback |
| **Authentication Failure Rate** | > 5% of valid login attempts failing with 500 | Immediate Backend Rollback (Level 2) |
| **Database Connection Exhaustion** | Active connections > 90% of pool capacity | Restart PgBouncer / Level 2 Rollback |
| **Data Integrity Violation** | Unhandled constraint violation on lease or payment | Immediate incident declaration |

---

## 2. MULTI-TIER ROLLBACK EXECUTION RUNBOOKS

```
[Incident Detected]
        │
        ├── Tier 1: Frontend Issue Only? ──────► Vercel Instant Rollback (1 click, 15 sec)
        │
        ├── Tier 2: Backend API Failure? ─────► DigitalOcean App Platform Rollback (2 min)
        │
        ├── Tier 3: Database Migration Issue? ──► Prisma Migration Down / PITR (10 min)
        │
        └── Tier 4: Total Cloud Outage? ──────► Dual-Mode Client Fallback (Zero Downtime)
```

### Level 1: Frontend Instant Rollback (Vercel)
*Estimated Duration: 15 seconds | Impact: Zero data loss*
1. Open the Vercel Dashboard for `aashvo`.
2. Navigate to **Deployments**.
3. Select the immediately preceding production deployment (Sprint 3.5 baseline).
4. Click **Instant Rollback**.
5. Traffic immediately routes to the previous immutable deployment.
6. Verify `https://aashvo.vercel.app` is operational.

### Level 2: Backend Container Rollback (DigitalOcean App Platform)
*Estimated Duration: 2 minutes | Impact: Zero database modifications*
1. In DigitalOcean App Platform, navigate to `aashvo-api-prod`.
2. Navigate to **Deployments** tab.
3. Select the prior verified container release hash.
4. Click **Rollback to this deployment**.
5. Traffic is shifted via zero-downtime rolling update.
6. Verify `/api/v1/health` returns HTTP 200 OK.

### Level 3: Database Schema Reversion
*Estimated Duration: 5 - 15 minutes | Impact: Requires transactional safety*
If a database migration introduced an unforeseen schema constraint conflict:
1. Stop mutating API traffic by setting maintenance mode on App Platform.
2. If the issue is localized to a migration, execute the reverse SQL script:
   ```bash
   psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d aashvo_prod -f apps/api/prisma/migrations/rollback_script.sql
   ```
3. If structural data corruption occurred, invoke Point-In-Time Recovery (PITR) to restore the database to the exact timestamp prior to migration deployment (refer to `docs/MASTER_RELEASE_BACKUP_AND_RESTORE.md`).

### Level 4: Dual-Mode Client Fallback Protocol
AASHVO was engineered with an intentional **Dual-Mode Architectural Bridge**:
- If `apiClient` encounters continuous connection refusals (`503 Service Unavailable` or network timeouts), the frontend transparently falls back to the read-only Supabase archive or safe seed data.
- User sessions do not crash; offline banners alert users of temporary degradation while read operations remain functional.

---

## 3. POST-ROLLBACK INCIDENT TRIAGE & POST-MORTEM TEMPLATE

Following any rollback execution, the Incident Commander must produce a Root Cause Analysis (RCA) containing:
1. **Incident Timeline:** Precise UTC timestamps of deployment, detection, decision, rollback, and restoration.
2. **Root Cause:** Detailed technical explanation of failure mechanism (e.g. unhandled Prisma constraint, environment variable typo, timeout).
3. **Customer Impact:** Number of affected requests, user sessions, or failed transactions.
4. **Preventive Action Items:** New integration test added, monitoring alert threshold updated, runbook revised.

