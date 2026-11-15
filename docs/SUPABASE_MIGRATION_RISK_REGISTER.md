# AASHVO — SUPABASE MIGRATION RISK REGISTER & MITIGATION MATRIX

**Author**: Senior Cloud Infrastructure Engineer & Database Migration Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: Comprehensive Risk Audit Completed  

---

## 1. Risk Register Summary Matrix

| Risk ID | Category | Risk Description | Likelihood | Impact | Inherent Risk | Mitigation Strategy | Residual Risk | Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| **RSK-S01** | **Credentials** | Supabase database password is not present in local environment | High | High | **HIGH** | Developer creates git-ignored `apps/api/.env.supabase` following template | Low | **PENDING CONFIG** |
| **RSK-S02** | **Free-Tier** | Supabase Free tier automatically pauses database after 7 days of inactivity | Medium | High | **HIGH** | Schedule a daily HTTP health-check ping to `/api/v1/health` from an external uptime monitor | Low | **PLANNED** |
| **RSK-S03** | **Connection** | Direct PostgreSQL connection limits exceeded on Supabase Free (~60 direct conns) | High | High | **HIGH** | Direct NestJS API runtime traffic strictly to Supavisor transaction pooler (port `6543`) | Negligible | **MITIGATED** |
| **RSK-S04** | **Tooling** | Prisma Migrate fails on advisory locks if connected to transaction pooler | Medium | High | **HIGH** | Configure `DIRECT_URL` strictly to session pooler port `5432` for all migration CLI commands | Negligible | **MITIGATED** |
| **RSK-S05** | **Collision** | Target Supabase database already contains legacy prototype tables | Medium | High | **MEDIUM** | Execute read-only preflight probe; follow Path B reconciliation plan if tables exist | Low | **GOVERNED** |
| **RSK-S06** | **Local Dev** | Local PostgreSQL on port 5433 inadvertently overwritten | Low | High | **HIGH** | `apps/api/.env` retains port 5433 defaults; test suites enforce local isolation | Negligible | **VERIFIED INTACT** |
| **RSK-S07** | **Render Free** | Render Free tier spins down after 15 minutes of idle, causing ~50s cold start | High | Medium | **MEDIUM** | Frontend `apiClient.ts` has 15s timeout and automatic retry logic; uptime ping keeps alive | Low | **ACCEPTED MVP** |
| **RSK-S08** | **Source Control**| Accidental commit of `apps/api/.env.supabase` to Git | Low | Critical| **HIGH** | `apps/api/.gitignore:5:.env.*` verified via `git check-ignore` | Negligible | **PROTECTED** |

---

## 2. In-Depth Risk Analysis & Remediation Plans

### Risk Item RSK-S01: Missing Database Password in Local Environment
- **Risk Assessment**: The hosted Supabase project ref (`himtwnwxvnnykafyhysy`) is known, but the database user password was never placed in local environment files. Without it, direct automated inspection or migration execution cannot connect.
- **Action Plan**:
  1. Developer retrieves the database password from their secure credential vault or resets it in the Supabase Dashboard:
     **Supabase Dashboard -> Project `himtwnwxvnnykafyhysy` -> Settings -> Database -> Reset Database Password**.
  2. Developer saves the connection string into `apps/api/.env.supabase` (strictly git-ignored).
  3. No secrets are pasted into chat or terminal outputs.

---

### Risk Item RSK-S02: Supabase Free-Tier Inactivity Pause
- **Risk Assessment**: Free-tier Supabase projects automatically pause if no queries or API requests are made for 7 consecutive days. If paused, incoming requests from the frontend or mobile clients fail until manually unpaused via the dashboard.
- **Remediation**:
  - Configure an external free uptime monitoring service (e.g. UptimeRobot, Better Uptime) to ping `https://api.aashvo.in/api/v1/health` or `https://aashvo.onrender.com/api/v1/health` every 10 minutes.
  - The health check runs a real `SELECT 1` query via `PrismaService.checkDatabaseHealth()`, guaranteeing the database remains active and preventing idle sleep.

---

### Risk Item RSK-S03: Supabase Free Connection Pool Exhaustion
- **Risk Assessment**: Supabase Free projects allocate limited direct Postgres connections (~60 connections). Multiple NestJS API instances, background cron tasks, or developer tools can quickly exhaust available slots.
- **Remediation**:
  - NestJS runtime connects exclusively to **Supavisor Transaction Pooler on port `6543`**:
    `aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=15`
  - Transaction pooling allows thousands of concurrent client queries over a small pool of PostgreSQL backend workers.

---

### Risk Item RSK-S07: Render Free Web Service Cold Starts
- **Risk Assessment**: Render Free web services spin down after 15 minutes of inactivity. The initial request experiences a ~50-second delay while the container boots.
- **Remediation**:
  - The external health monitor pinging `/api/v1/health` every 10 minutes simultaneously keeps the Render web service warm during daytime traffic hours.
  - The frontend `apiClient.ts` displays a user-friendly loading skeleton during initial connection negotiation.

---

## 3. Go / No-Go Decision Gate for Supabase Migration

| Gate # | Check Criterion | Status | Verification Evidence |
| :---: | :--- | :---: | :--- |
| **G-S01** | `apps/api/.env.supabase` created and valid | **PENDING** | Awaiting developer local credential file creation |
| **G-S02** | Live read-only probe executed on Supabase | **PENDING** | Awaiting G-S01 |
| **G-S03** | Schema state determined (Path A clean vs Path B reconciliation) | **PENDING** | Awaiting G-S02 |
| **G-S04** | Dual-connection Prisma architecture configured | **GO** | `directUrl` in `schema.prisma` verified ready |
| **G-S05** | Local PostgreSQL 16 on port 5433 intact | **GO** | 33 tables preserved; 107/107 tests pass |
| **G-S06** | Secret exposure protection | **GO** | All `.env.*` files git-ignored |
| **G-S07** | Explicit CTO Migration Sign-Off | **PENDING** | Awaiting final CTO authorization |

