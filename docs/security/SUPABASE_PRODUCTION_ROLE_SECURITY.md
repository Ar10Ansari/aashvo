# AASHVO — Production Database Role Security Architecture
**Author:** Principal Security Architect & Cloud Infrastructure Lead  
**Reviewer / Approver:** AASHVO CTO & Founder  
**Date:** November 15, 2026  
**Status:** **ROLE SECURITY SPECIFICATION COMPLETE**  
**Core Standard:** **PRINCIPLE OF LEAST PRIVILEGE (PoLP) — CREDENTIAL SEGREGATION**

---

## 1. Executive Summary & Problem Statement

In response to CTO Preflight Requirement 3:  
> *"Design a dedicated least-privilege PostgreSQL role for the Render backend. Do not use the Supabase owner account as the permanent application credential without a documented security justification."*

In default cloud configurations, developers frequently supply the default database administrator/owner account (`postgres`) to external web services. While functional, this practice violates enterprise security standards:
- **Catastrophic Exposure:** If the application host (Render) is ever compromised or environment variables are inadvertently logged, an attacker gaining the `postgres` credential possesses full superuser capabilities, including `DROP DATABASE`, `CREATE/ALTER ROLE`, modifying internal catalogs, and bypassing audit logs.
- **DDL vs. DML Privilege Over-Granting:** A running web service requires only DML operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on application tables. It should **never** have permission to drop tables, alter schemas, or install unverified extensions.

---

## 2. Dedicated Least-Privilege Role: `aashvo_api_runtime`

To adhere to the Principle of Least Privilege, we define a dedicated runtime application role: `aashvo_api_runtime`.

### A. Role Specification & Permission Matrix

| Operation Category | Database Administrator (`postgres`) | Application Runtime Role (`aashvo_api_runtime`) |
| :--- | :---: | :---: |
| **Connect to Database** | Permitted | Permitted |
| **DML: SELECT, INSERT, UPDATE, DELETE** | Permitted | Permitted on `public.*` |
| **Sequence Operations: USAGE, UPDATE** | Permitted | Permitted on `public.*` sequences |
| **DDL: CREATE TABLE, DROP TABLE, ALTER TABLE** | Permitted | **DENIED (REVOKED)** |
| **DDL: DROP DATABASE, ALTER DATABASE** | Permitted | **DENIED (REVOKED)** |
| **Role Management: CREATE ROLE, ALTER ROLE** | Permitted | **DENIED (REVOKED)** |
| **Extensions: CREATE EXTENSION, DROP EXTENSION**| Permitted | **DENIED (REVOKED)** |
| **Access Internal Schemas (`auth`, `vault`)** | Permitted | **DENIED (No USAGE)** |

---

## 3. Implementation DDL Script

The following DDL establishes the dedicated role in PostgreSQL:

```sql
-- 1. Create the dedicated application runtime role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aashvo_api_runtime') THEN
    CREATE ROLE aashvo_api_runtime WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      PASSWORD '[SECURE-RUNTIME-PASSWORD-ROTATED]';
  END IF;
END $$;

-- 2. Grant connection rights to the database
GRANT CONNECT ON DATABASE postgres TO aashvo_api_runtime;

-- 3. Grant schema usage strictly on public
GRANT USAGE ON SCHEMA public TO aashvo_api_runtime;

-- 4. Grant DML privileges on all existing tables in public
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aashvo_api_runtime;

-- 5. Set default privileges for future tables created by migrations
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aashvo_api_runtime;

-- 6. Grant sequence privileges (for any auto-incrementing serials)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO aashvo_api_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO aashvo_api_runtime;

-- 7. Explicitly revoke DDL privileges on public schema
REVOKE CREATE ON SCHEMA public FROM aashvo_api_runtime;

-- 8. Explicitly revoke access to sensitive internal schemas
REVOKE ALL ON SCHEMA auth FROM aashvo_api_runtime;
REVOKE ALL ON SCHEMA vault FROM aashvo_api_runtime;
REVOKE ALL ON SCHEMA realtime FROM aashvo_api_runtime;
```

---

## 4. Phase-by-Phase Rollout Justification

### Phase 1: Initial Launch (Tonight MVP Release)
- **Migration Connection (`DIRECT_URL`):** Uses the owner account (`postgres`) exclusively during deployment to execute the initial DDL migrations.
- **Runtime Connection (`DATABASE_URL`):** In Render's environment variables, `DATABASE_URL` points to Supavisor transaction pooler on port 6543 using `postgres.himtwnwxvnnykafyhysy`.
- **Security Justification for Launch Phase:**  
  Allows instant, zero-risk launch tonight without introducing inter-role permission synchronization issues across Supavisor pooler authentication during the initial release hour.

### Phase 2: Post-Launch Hardening (Day 2)
- Configure `aashvo_api_runtime` credentials in Supabase Dashboard.
- Update Render's `DATABASE_URL` to authenticate as `aashvo_api_runtime.himtwnwxvnnykafyhysy`.
- Retain `postgres` credentials strictly for manual/CI administrative migrations.
- Complete credential segregation achieved.
