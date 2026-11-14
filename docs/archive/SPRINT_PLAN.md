# Aashvo — Sprint Implementation Plan

**Scope:** End-to-End Implementation Across 6 Core Sprints  
**Current Milestone:** Sprint 2.5 Complete (Progressive Auth, Phone Verification & Nationwide Schemas)  
**Next Milestone:** Sprint 3 (Live Backend & Cloud Integration)  

---

## Sprint Breakdown & Delivery Status

### Sprint 1: Brand Foundation & Editorial UI (Status: Complete)
- Scaffold Vite + React 18 + TypeScript + Tailwind CSS application.
- Establish Warm Ivory (`#F5F3ED`), Forest Green (`#244737`), Sand (`#D9B98C`), and Charcoal (`#292D2A`) brand palette.
- Implement Editorial Typography (*Playfair Display* serif headlines, *Plus Jakarta Sans* UI).
- Build anchored vector SVG `ArchitecturalLandscape` at the base of the Hero.
- Validate mobile responsiveness and 100% build integrity.

### Sprint 2: Property Discovery, Quality Foundation & SQL Security (Status: Complete)
- Seed high-fidelity Delhi NCR listings and verified flatmate profiles.
- Build `PropertyCard` with verified freshness badges and transparent financial breakdowns.
- Install Vitest + React Testing Library foundation (41 passing tests).
- Author PostgreSQL security patch `20261019000000_security_fixes.sql` resolving role escalation, moderation bypass, and contact scraping.
- Evaluate Supabase infrastructure: Tokyo (`ap-northeast-1`) vs. AWS Mumbai (`ap-south-1`).

### Sprint 2.5: Progressive Profiles, Phone Verification & Nationwide Schemas (Status: Complete)
- **Domain Models & Services:**
  - Authored `src/services/authService.ts` implementing Google OAuth PKCE, email verification gating, progressive profile rule evaluator, phone OTP state machine, and anti-forgery sanitizer.
  - Authored `src/services/marketplaceService.ts` supporting nationwide free-text searches, Family Stay validation, and location privacy masking.
- **SQL Migration Authored:**
  - Authored `supabase/migrations/20261020000000_nationwide_auth_and_family_stays.sql` adding nationwide location columns, Family Stay constraint `chk_family_stay_eligibility`, anti-forgery trigger `trg_prevent_verification_forgery`, and workflow inquiry/listing triggers.
- **Automated Testing Suite Expanded:**
  - Added 3 comprehensive test suites bringing total automated coverage to **75 passing tests across 9 test files**:
    * `src/test/authFlows.test.ts` (10 tests)
    * `src/test/progressiveProfilesAndVerification.test.ts` (10 tests)
    * `src/test/nationwideMarketplaceAndFamilyStays.test.ts` (14 tests)
- **Documentation Updated:**
  - Unified PRD, User Journeys, Architecture, Database Design, Security, Roadmap, and Sprint Plan with verified acceptance criteria.

---

## Upcoming Sprints

### Sprint 3: Live Backend & Infrastructure Integration (Target: Next)
- **Supabase Cloud Setup:** Provision production Supabase project in AWS Mumbai (`ap-south-1`).
- **Migration Application:** Apply all 3 declarative SQL migrations via Supabase CLI:
  1. `20261018000000_initial_schema.sql`
  2. `20261019000000_security_fixes.sql`
  3. `20261020000000_nationwide_auth_and_family_stays.sql`
- **SDK Installation:** Install `@supabase/supabase-js` and configure repository adapter with offline local fallback.
- **Auth Provider Setup:**
  - Configure Google Cloud OAuth Client ID with authorized redirect URIs.
  - Configure SMS Gateway (Exotel / Twilio) for Indian mobile OTP delivery.
  - Configure custom SMTP email delivery for email confirmation and password reset links.

### Sprint 4: Family Stay UI & Category Portal Experience
- Build dedicated "Family Stays" exploration tab on the homepage.
- Add resident family declaration step and meal policy selector to `ListPropertyModal`.
- Implement verified family host badge and home-cooked meal icons on property cards.
- Integrate Supabase Storage photo uploader with client-side image compression.

### Sprint 5: Nationwide Search Scaling & Location Intelligence
- Connect open Indian city autocomplete API (e.g. Mapbox / OpenStreetMap Nominatim).
- Integrate browser Geolocation API for "Near Me" radius searching.
- Implement interactive map view toggle for desktop and tablet users.

### Sprint 6: Production Launch Readiness & Compliance Certification
- End-to-end automated browser verification across mobile, tablet, and desktop.
- Security vulnerability audit and penetration test on live REST endpoints.
- Indian DPDP Act 2023 legal privacy policy and consent banner integration.
- Public launch on custom domain (`aashvo.in`).
