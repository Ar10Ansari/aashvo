# Aashvo — Test Strategy & Quality Assurance Framework

**Version:** 2.0.0-Nationwide  
**Lead:** Principal QA Architect & Application Security Engineer  
**Status:** Implemented (75 Automated Tests Passing)  

---

## 1. Quality Gates & Continuous Verification

Every commit and pull request must satisfy the following automated Quality Gates before deployment:

```
[Lint & TypeScript Strict] ──► [Vitest Automated Suite (75 Tests)] ──► [Vite Production Build]
          │                                      │                                 │
          ▼                                      ▼                                 ▼
   tsc --noEmit (0 errors)              vitest run (100% pass)           dist/ bundle integrity
```

1. **Gate 1: Strict TypeScript Validation (`npm run typecheck`)**
   - Zero unresolved typing errors, zero unsafe `any` leaks in domain models, strict unused parameter validation.
2. **Gate 2: Automated Unit, Component & Security Tests (`npm test`)**
   - Execution of all 9 test suites across application logic, security boundaries, and React components.
3. **Gate 3: Production Build Compilation (`npm run build`)**
   - Verified compilation into optimized assets (`dist/`) with zero warnings or unresolved chunk imports.
4. **Gate 4: Automated Browser Subagent Inspection**
   - Headless and interactive verification of desktop (1280px) and mobile (375px) viewports with zero console exceptions.

---

## 2. Test Execution Matrix (75 Automated Tests)

| Test Suite File | Test Count | Scope & Focus Areas |
| :--- | :---: | :--- |
| **`authFlows.test.ts`** | 10 | Email/password registration; unverified email gating; Google OAuth PKCE and origin verification; state mismatch defense; password reset enumeration prevention; identity linking anti-hijacking. |
| **`progressiveProfilesAndVerification.test.ts`** | 10 | Public browsing without auth; authenticated inquiry submission; phone verification workflow requirement; OTP rate-limiting cooldown; brute-force lockout after 5 tries; rejection of forged `phoneVerified` and `role` update payloads. |
| **`nationwideMarketplaceAndFamilyStays.test.ts`** | 14 | Nationwide listing submission (Bengaluru, Mumbai, Pune); required financial fields; Family Stay eligibility enforcement (resident owner, meals policy declaration, rejection of brokers); address masking; cross-account privacy isolation; regression tests for seed data. |
| **`authorizationPolicies.test.ts`** | 15 | PostgreSQL RLS and trigger enforcement across 5 roles (Anonymous, Renter, Owner, Flatmate Recipient, Admin); role escalation rejection; direct API insert/update moderation bypass prevention; contact privacy masking. |
| **`costCalculations.test.ts`** | 8 | INR currency formatting, move-in outlay (`rent + deposit + maintenance`), zero-brokerage rules, 48-hour freshness badges, verified owner badges. |
| **`searchFilters.test.ts`** | 8 | Multi-locality filtering, room type filtering, budget slider ceiling, provider type, empty state handling. |
| **`listingValidation.test.ts`** | 4 | 5-step listing form validation (titles, landmarks, positive rent and deposit amounts, pending review default). |
| **`stateAndSecurity.test.ts`** | 4 | Persona switching across refreshes, visit request persistence, community report resolution, frontend vs backend role separation. |
| **`PropertyCard.test.tsx`** | 2 | React component DOM rendering, price breakdown badges, card click and keyboard accessibility (`Enter` key activation). |

---

## 3. Testing Permitted vs. Denied Operations

Every critical workflow is tested symmetrically for both authorized behavior and adversarial rejection:

```
┌─────────────────────────────────┬──────────────────────────────────┐
│       Permitted Operations      │        Denied Operations         │
├─────────────────────────────────┼──────────────────────────────────┤
│ • Valid email/password signup   │ • Weak password (<8 chars / no #)│
│ • Verified user inquiry submit  │ • Unverified email inquiry submit│
│ • Valid Google OAuth callback   │ • OAuth state mismatch (CSRF)    │
│ • Valid phone OTP verification  │ • 60s cooldown rate limit breach │
│ • Valid Family Stay by owner    │ • Broker posing as Family Stay   │
│ • Admin role update via console │ • User self-granting admin role  │
│ • Public view reading masked bio│ • Direct query reading raw phone │
└─────────────────────────────────┴──────────────────────────────────┘
```

---

## 4. Verification of Live Database Readiness

1. **Pre-Deployment SQL Review:**
   - All migrations (`20261018000000_initial_schema.sql`, `20261019000000_security_fixes.sql`, `20261020000000_nationwide_auth_and_family_stays.sql`) use idempotent DDL (`IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`).
2. **Execution Boundary:**
   - Automated tests run against deterministic domain engines and simulated PostgreSQL triggers.
   - Migrations are tested in local isolation prior to cloud application.

---

## 5. Help & Support Test Suite (`src/test/helpAndSupportSystem.test.ts`)

26 dedicated unit and security integration tests covering:
1. **Unique Reference Code Generation:** Pattern match `ASH-TKT-[A-Z0-9]{6}` and statistical uniqueness across 100 consecutive generations.
2. **Form Input Validation:** Email regex, minimum 2-character names, subject bounds (5-120 chars), description bounds (10-2000 chars), category whitelisting.
3. **Attachment Restrictions:** Max 3 files ceiling, 5MB individual file size cap, strict MIME type whitelisting (rejection of `.exe`, `.js`, `.html`).
4. **Automated Priority Determination:** `urgent` for scam/fraud/harassment; `high` for deposit/verification disputes; `normal` for standard inquiries.
5. **State Machine Transitions:** Enforces valid forward states (`open -> in_review -> awaiting_user | resolved | closed`), confirms `closed` as terminal, and prevents backwards invalid states.
6. **Privacy & Confidential Internal Staff Notes:** `sanitizeTicketForClient` tests confirming that non-admin and guest actors never receive internal staff notes or audit event logs.
7. **Safety Reports & Anti-Spam Duplicate Safeguard:** Validates that duplicate reports for the same target by the same reporter within 24 hours are blocked, while allowing re-reports if previous report was dismissed.
8. **Knowledge Base & Realistic Expectations:** Verifies FAQs across all 8 mandatory categories, confirms presence of anti-advance and anti-scam warnings, and ensures zero false 24/7 SLA promises.

