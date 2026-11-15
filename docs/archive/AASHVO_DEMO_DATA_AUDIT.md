# AASHVO Hosted Database Demo Data & Integrity Audit

**Target Database:** Hosted Supabase PostgreSQL (`himtwnwxvnnykafyhysy.supabase.co`)
**Region:** AWS Mumbai (`ap-south-1`)
**Audit Mode:** Strictly Read-Only (Zero DDL, Zero DML, Zero Schema Modifications)
**Date:** November 15, 2026
**Auditor:** AASHVO Engineering (CTO & Security Lead)

---

## 1. Audit Scope & Protocol

In accordance with strict CTO release guidelines, a non-destructive read-only inspection of the hosted Supabase PostgreSQL catalog was performed via the pooled interface.

The objective was to:
1. Verify whether any prototype fixtures, demo personas (`rohan@example.com`, `usr-demo-*`), or mock listings (`prop-1`, `fm-1`) exist in the production database.
2. Confirm the exact record count across all core marketplace and authentication tables.
3. Validate database constraints, relational integrity, and session records without modifying, dropping, or altering any live data.

---

## 2. Table Record Census & Inspection Results

| Database Table | Record Count | Record Identifiers / Details | Demo Fixture Detected |
| :--- | :--- | :--- | :--- |
| `public.users` | **2** | `2d5afbed-a0a0-487f-8741-f02586e3dd7a` (`e2e_gate_1794743442438@aashvo.in`)<br>`c4d53018-d939-4e92-8b2b-d61e5ab19731` (`abdul.professional10@gmail.com`) | **NONE** (Zero mock users) |
| `public.profiles` | **2** | 1. "Release Gate Auditor" (Automated test profile)<br>2. "Abdul Ansari" (Co-founder & CTO profile) | **NONE** |
| `public.oauth_identities`| **0** | Empty catalog ready for authentic Google OAuth users | **NONE** |
| `public.properties` | **0** | Empty catalog ready for authentic homeowner listings | **NONE** (Zero mock properties) |
| `public.flatmate_profiles`| **0** | Empty catalog ready for authentic flatmate profiles | **NONE** (Zero mock flatmates) |
| `public.tenancy_agreements`| **0** | Empty catalog ready for authentic digital agreements | **NONE** |
| `public.support_tickets` | **0** | Empty catalog ready for customer tickets | **NONE** |
| `public.disputes` | **0** | Empty catalog ready for rental disputes | **NONE** |
| `public.refresh_sessions`| **14** | Active and rotated session records associated strictly with the 2 genuine user IDs above | **NONE** |

---

## 3. Account Analysis & Protection Verification

1. **Founder Account Safeguard:**
   - User `c4d53018-d939-4e92-8b2b-d61e5ab19731` (`abdul.professional10@gmail.com`) represents the genuine account of Abdul Rehman Ansari (Co-founder & CTO).
   - This account was preserved intact without modification or deletion.
2. **E2E Gate Auditor Account:**
   - User `2d5afbed-a0a0-487f-8741-f02586e3dd7a` (`e2e_gate_1794743442438@aashvo.in`) was created by the automated release gate verification suite to validate user registration, session issuance, and refresh token rotation.
3. **Absence of Prototype Fixtures:**
   - No records with IDs such as `demo-*`, `prop-1`, `fm-1`, `test-*`, or emails such as `rohan@example.com`, `anil.mehra@delhihomes.org`, or `rajesh@urbanstay.in` exist in the database.
   - The production database is pristine and prepared for live user onboarding.

---

## 4. Session & Security Log Inspection

Inspection of `public.refresh_sessions` demonstrated that cryptographic security controls are actively functioning:
- Session family IDs correctly link token generations (`familyId`).
- `revokedReason` fields correctly record `"rotated"` upon legitimate token refresh and `"refresh_token_reuse_detected"` upon replayed token presentation.
- Client metadata (`userAgent`, `ipAddress`, `clientPlatform`) is populated accurately across iOS Safari, macOS Web, and Windows Chrome sessions.

---

## 5. Non-Destructive Compliance Certification

I hereby certify that:
- **Zero DELETE, UPDATE, INSERT, ALTER, or DROP operations** were executed against the hosted database during this audit.
- **Zero migrations or schema baselining operations** were triggered.
- All database queries were executed using `SELECT` statements via Prisma Client read transactions.
- The hosted Supabase database remains in a consistent, uncorrupted, and production-ready state.
