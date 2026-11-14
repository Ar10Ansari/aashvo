# Aashvo — Engineering Development Log

## Entry 1: Discovery, Architecture & Planning (2026-10-18)
- **Phase 0 & 1 Complete:**
  - Workspace inspected: `d:\Projects\AASHVO` was empty.
  - Runtime environment verified: Node `v24.15.0`, npm `11.12.1`, Git `2.54.0`.
  - Git repository initialized with comprehensive `.gitignore` preventing secret leaks.
  - Skill discovery performed: `agy-customizations`, `antigravity_guide`, `permissioned-github` audited.
  - Core architectural and product artifacts authored:
    - `docs/SKILLS_AND_WORKFLOWS.md`
    - `docs/PRODUCT_REQUIREMENTS.md`
    - `docs/USER_JOURNEYS.md`
    - `docs/COMPETITOR_AND_ASSUMPTIONS.md`
    - `docs/ROADMAP.md`
    - `docs/TECHNICAL_ARCHITECTURE.md`
    - `docs/DATABASE_DESIGN.md`
    - `docs/SECURITY_AND_PRIVACY.md`
    - `docs/TEST_STRATEGY.md`
    - `docs/SPRINT_PLAN.md`

## Entry 2: Full MVP Implementation & Quality Verification (2026-10-18)
- **Sprint 1 (Foundation & Brand):**
  - Scaffolded Vite + React 18 + TypeScript + Tailwind CSS application.
  - Configured approved brand palette (`#F5F3ED` Warm Ivory, `#244737` Forest Green, `#D9B98C` Sand, `#292D2A` Charcoal).
  - Integrated *Playfair Display* (Editorial Serif) and *Plus Jakarta Sans* (UI Sans) typography.
  - Implemented responsive navigation with wordmark, quick tabs, and profile switcher.
  - Created custom vector SVG `ArchitecturalLandscape` anchored at the bottom of the hero.
  - Built centered Hero with mandatory headline: *"A better way to call a place home."* and supporting copy.
- **Sprint 2 (Property Discovery & Cost Transparency):**
  - Built `PropertyCard` with verified freshness badges and transparent financial breakdown (Rent, Deposit, Maintenance).
  - Implemented real-time multi-dimensional search & filtering (Locality, Budget slider, Room type, Furnishing, Provider type).
  - Created `PropertyDetailModal` featuring full itemized cost calculator (Rent + Deposit + Maintenance + Electricity + Brokerage), photo gallery, and visit scheduling.
- **Sprint 3 (Authentication & Listing Management):**
  - Built `ListPropertyModal` 5-step guided wizard for owners and brokers with validation and transparent pricing inputs.
  - Implemented `AuthModal` supporting instant persona switching (Renter, Direct Owner, Property Manager, Admin).
  - Pluggable data layer syncing with `localStorage` and configured for Supabase.
- **Sprint 4 (Flatmate Discovery):**
  - Built `FlatmateCard` and `FlatmateDetailModal` displaying living compatibility dimensions (Diet, Routine, Cleanliness, Pets, Smoking, Budget, Localities).
  - Implemented gated connect request message flow with real-time toast feedback.
- **Sprint 5 (Admin & Safety):**
  - Built `AdminModerationModal` allowing one-click approval, pausing, and status updates for inventory and community violation reports.
  - Implemented community reporting form in `PropertyDetailModal`.
- **Sprint 6 (Testing & Quality Gates):**
  - Executed strict TypeScript validation (`tsc --noEmit`) — 0 errors.
  - Executed production Vite build (`npm run build`) — Clean output in `dist/`.
  - Executed automated end-to-end browser audit using `browser_subagent` at `http://localhost:5173/`.
  - Verified visual rendering, navigation, property modal, flatmate modal, and listing wizard with zero console errors.

## Entry 3: Security Hardening, Test Foundation & Regional Analysis (2026-10-19)
- **Independent Verification & AppSec Audit:**
  - Preserved working tree modifications; zero deleted files.
  - Verified that client-side persona switching in `localStorage` is strictly simulated for UX demonstration and decoupled from cryptographic PostgreSQL RLS.
  - Identified and patched critical vulnerabilities in `supabase/migrations/20261019000000_security_fixes.sql`:
    * Trigger `trg_prevent_role_escalation` on `public.profiles`.
    * Trigger `trg_prevent_status_bypass` on `public.properties` on direct API `INSERT` & `UPDATE`.
    * Restricted direct `SELECT` on `public.profiles` to own profile; created public view `public.public_profiles` with phone/email masked.
    * Explicit `SET search_path = public, pg_temp;` on all `SECURITY DEFINER` functions.
    * Storage bucket policies for `property-photos` (5MB cap, MIME whitelist, user folder scoped).
- **Automated Testing Suite (Sprint 2 Foundation):**
  - Configured Vitest + React Testing Library + JSDOM.
  - Implemented 6 test suites with 41 passing automated tests covering financial math, search filters, form validation, persistence, RLS authorization models, and React UI.
- **Regional Database Strategy:**
  - Evaluated existing Tokyo project (`ap-northeast-1`, ~150ms latency) vs. dedicated AWS Mumbai (`ap-south-1`, ~20ms latency).
  - Recommended retaining Tokyo for zero-cost staging sandbox and provisioning Mumbai for production launch.
- **Documentation Authored:**
  - Created `docs/SECURITY_TEST_RESULTS.md` and updated `docs/CTO_VERIFICATION_AUDIT.md`.

## Entry 4: Progressive Profiles, Phone Verification & Nationwide Architecture (2026-10-20)
- **Confirmed Authentication & Progressive Profile Architecture:**
  - Architected Supabase Auth integration supporting Google OAuth (PKCE, state validation) and Email/Password with mandatory email verification links.
  - Implemented progressive profile completion rules: users browse freely; inquiries require verified email and contextual phone verification; listing creation requires verified host phone.
  - Server-persisted profile completion state derived from backend rules (`evaluateActionEligibility`), preventing client-controlled boolean bypasses.
  - Implemented strict identity linking rules: rejecting automatic merges of unverified email accounts with incoming OAuth providers to prevent account pre-hijacking.
- **Phone Verification Policy & Gateway State Machine:**
  - Designed contextual phone verification policy (no universal signup OTP).
  - Created server-side OTP dispatcher and verifier with 60s cooldown, max 4 sends/hour, 10-minute expiry, and brute-force lockout after 5 incorrect attempts.
  - Authored anti-forgery sanitizer (`sanitizeUserUpdateRequest`) rejecting client attempts to self-grant `phoneVerified`, `emailVerified`, or `role`.
- **Nationwide Marketplace & Family Stay Category:**
  - Extended domain models and marketplace service to support unconstrained Indian geography (Bengaluru, Mumbai, Pune, Gurugram, etc.) with free-text search.
  - Preserved three distinct categories: **Flats & Rooms**, **Flatmates**, and **Family Stays**.
  - Codified strict Family Stay eligibility rules: resident home owners only (`familyLivesOnProperty = true`, `providerType = 'owner'`), mandatory meal policy declaration (`included`, `optional_extra`, `none`), and complete prohibition of commercial brokers or non-resident landlords.
  - Implemented location privacy masking (stripping door and flat numbers from public views) and distance calculations via the Haversine formula.
- **SQL Migration Authored:**
  - Created `supabase/migrations/20261020000000_nationwide_auth_and_family_stays.sql` containing:
    * Category column and nationwide geography columns on `public.properties`.
    * Database check constraint `chk_family_stay_eligibility`.
    * Anti-forgery trigger `trg_prevent_verification_forgery` on `public.profiles`.
    * Workflow triggers `trg_enforce_inquiry_prerequisites` and `trg_enforce_listing_host_prerequisites`.
    * Privacy view `public.public_properties`.
- **Automated Testing Suite Expansion:**
  - Added 3 new test suites:
    * `src/test/authFlows.test.ts` (10 tests)
    * `src/test/progressiveProfilesAndVerification.test.ts` (10 tests)
    * `src/test/nationwideMarketplaceAndFamilyStays.test.ts` (14 tests)
  - Full automated test suite now stands at **9 test files, 75 passing tests (100%), 0 failures**.
- **Quality Gates Execution:**
  - `npm test`: 75 passed (6.46s).
  - `npm run typecheck`: 0 errors.
  - `npm run build`: 0 errors (built in 3.58s).
- **Documentation Synchronization:**
  - Synchronized all 9 core documents with complete acceptance criteria, ER diagrams, user journeys, threat matrices, and sprint roadmaps.

## Entry 5: Product Hierarchy Correction, Founders Section & Pre-Backend Validation (2026-10-20)
- **Product Hierarchy Realignment (Part 1, 2, 3):**
  - Confirmed business positioning: Pan-India affordable-living platform for students and working professionals. Tagline: *"Find your place. Find your people."*
  - Re-anchored homepage, discovery, and navigation to prioritize two co-equal primary features:
    1. **Primary Feature A: Find Flatmates & Roommates** (lifestyle compatibility: food habits, sleep routines, cleanliness, guest policy; room seeking vs room offering).
    2. **Primary Feature B: Family Stays** (affordable rooms in resident-family homes with optional home-cooked food facilities).
    3. **Secondary Feature C: Entire Flats** (accessible and searchable via navigation and filters, but intentionally de-emphasized from dominating first screen).
  - Updated Hero copy: *"Affordable living / starts with the right people."* with dual primary CTA buttons (*Find Flatmates & Rooms* and *Explore Family Stays*) and a secondary anchor link for entire flats.
  - Reconciled `localStorage` caching logic in `AppContext.tsx` to automatically populate new Family Stay seed listings even when older cached arrays exist.
- **Family Stays Mechanics & Cost Integrity:**
  - Resident family eligibility enforced in UI and database schema: `category === 'family_stays'` requires `familyLivesOnProperty === true` and `providerType === 'owner'`. Commercial property managers and non-resident landlords are blocked.
  - Canonical meal values implemented: `included`, `optional_extra`, `none`.
  - Implemented `calculateMoveInCost` utility guaranteeing **zero double-counting** of included meals into tenant move-in outlay, with clean separation between recurring monthly costs and one-time refundable security deposits.
- **Our Founders Section (Part 4):**
  - Created `src/components/about/OurFounders.tsx` with heading strictly *"Our Founders"* (not "Our Funders").
  - Featured co-founders with factual, verified details:
    * **Abdul Rehman Ansari** (Co-founder: product vision, strategy, technology direction, and platform architecture).
    * **Tushar Jaisawl** (Co-founder: community-led shared living solutions and family stay partnerships).
  - Designed an editorial text-first monogram layout (monograms `AA` and `TJ`) respecting brand colors (`#F5F3ED` Warm Ivory, `#244737` Forest Green, `#D9B98C` Sand, `#292D2A` Charcoal).
  - Zero stock portraits, zero fake metrics, zero invented funding or investor claims.
- **Pan-India Location Support (Part 5):**
  - Added dual location mode in listing wizard:
    * **Option A: Use Current Location** (requests browser geolocation only upon user selection, populates coordinates with user confirmation/editability, gracefully handles denied permissions/timeout).
    * **Option B: Select Manually** (State/UT, City, Locality, PIN Code without requiring GPS permissions).
  - Displayed prominent public address privacy masking notice (door/flat numbers masked publicly).
- **Automated Testing & Pre-Backend Validation (Part 9):**
  - Created `src/test/productHierarchyAndFounders.test.tsx` (12 tests) verifying Founders heading, co-founder details, text-first design, Family Stay resident eligibility, zero meal double-counting, and nationwide listing submission.
  - Updated `src/test/searchFilters.test.ts` to reflect the expanded 8-property seed inventory with Family Stays.
  - Test suite status: **10 test files, 87 passing tests (100%), 0 failures**.
  - TypeScript validation: `npm run typecheck` passed with 0 errors.
  - Production build: `npm run build` passed with 0 errors (`dist/` generated cleanly in 4.03s).
- **Database Migrations Integrity Review (Part 7):**
  - Verified migrations:
    * `supabase/migrations/20261018000000_initial_schema.sql` (Base tables, initial RLS).
    * `supabase/migrations/20261019000000_security_fixes.sql` (search_path, role escalation trigger, moderation bypass trigger, masked public view).
    * `supabase/migrations/20261020000000_nationwide_auth_and_family_stays.sql` (Nationwide geography, category column, `chk_family_stay_eligibility` constraint, anti-forgery triggers).
  - Confirm: No SQL migrations applied to live Supabase during this sprint; live connection remains pending configuration.

## Entry 6: Help & Support System, Safety Reporting & Admin Operations (2026-10-20)
- **Help Centre & Searchable FAQs:**
  - Designed and implemented `HelpCenterModal.tsx` accessible from main header, user profile dropdown, and footer.
  - Comprehensive knowledge base with 24 verified FAQs organized into 8 categories:
    * Account & Login
    * Finding Flatmates
    * Rooms & Listings
    * Family Stays & Meals
    * Location
    * Verification
    * Privacy & Safety
    * Technical Issues
  - Prominent Anti-Fraud & Scam Advisory banner warning against advance token payments prior to physical inspection, UPI QR code scanning scams, and confidential OTP/password rules.
  - Transparent realistic SLAs: strictly avoids promising 24/7 telephonic call-centers or instant bot resolutions.
- **Support Tickets & Multi-Tenant Tracking:**
  - Validated contact form: name, email, phone (optional), category (select), subject (5-120 chars), description (10-2000 chars), relevant listing reference (optional), and evidence attachments.
  - Attachment validation: max 3 attachments, max 5MB size cap each, restricted to JPG, PNG, WebP, and PDF with FileReader base64 previews.
  - Server-grade ticket reference generator: formatted as `ASH-TKT-[A-Z0-9]{6}`.
  - Authenticated user ticket view: lists all user tickets with status badges (`Open`, `In Review`, `Awaiting User`, `Resolved`, `Closed`) and interactive conversation thread.
  - Unauthenticated guest ticket tracking: dual-key verification requiring both Ticket Reference Number and contact email.
  - Bi-directional messaging: replies from users automatically transition `awaiting_user` back to `in_review`. Terminal status `closed` enforces read-only state.
- **Contextual Safety & Fraud Reporting:**
  - Built `ReportModal.tsx` and wired contextual report triggers to `PropertyDetailModal.tsx` and `FlatmateDetailModal.tsx`.
  - 7 standardized reporting reason codes: `scam_fraud`, `misleading_charges`, `unavailable_listing`, `duplicate_fake`, `inappropriate_conduct`, `harassment`, `other`.
  - Automatic context capture (entity ID, entity title, reporter identity) with confidentiality disclaimer.
  - Anti-spam duplicate prevention: 24-hour cooldown per reporter per target record (unless previously dismissed).
  - High-priority routing: suspected scams, financial fraud, and safety harassment are automatically escalated to urgent priority queue.
- **Admin Moderation Console & Internal Staff Notes Isolation:**
  - Enhanced `AdminModerationModal.tsx` with dedicated Support Tickets console and enhanced Safety Reports queue.
  - Strict Authorization Gate: non-admin roles attempting access are intercepted with an unauthorized shield citing PostgreSQL RLS rules.
  - Dual-mode staff composer: supports public replies to user versus private internal staff notes (`is_internal: true`).
  - Strict privacy isolation: `sanitizeTicketForClient()` and database RLS ensure non-admin users and guests never receive internal staff notes or audit event logs.
  - Complete auditable history log tracking actor, action, timestamp, and transition notes.
- **Database Architecture & Migration (`20261021000000_help_and_support_system.sql`):**
  - Forward-only migration creating `public.support_tickets`, `public.ticket_messages`, `public.ticket_audit_events`, `public.safety_reports`.
  - Database trigger `trg_validate_ticket_status_transition` enforcing state machine constraints.
  - Private Supabase Storage bucket `support-attachments` with 5MB cap and MIME whitelist.
  - Forward-only migration prepared in repository; **NOT applied to live Supabase** as requested.
- **Automated Testing & Production Verification:**
  - Created `src/test/helpAndSupportSystem.test.ts` (26 tests) covering reference formatting, validation, attachment limits, priority determination, state machine transitions, privacy isolation, duplicate safeguards, and FAQ category coverage.
  - Test suite status: **11 test files, 113 passing tests (100%), 0 failures**.
  - TypeScript validation: `npm run typecheck` passed with 0 errors.
  - Production build: `npm run build` passed with 0 errors (`dist/` generated cleanly in 3.85s).
  - Visual browser verification: validated Help Centre modal, FAQ search, ticket submission, guest tracking, contextual reporting, and admin console via browser subagent.

