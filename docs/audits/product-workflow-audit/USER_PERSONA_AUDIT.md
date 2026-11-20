# AASHVO User Persona End-to-End Audit

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Principal Platform Architect  
**Scope:** Evaluation of all 9 user personas across journey completeness, feature accessibility, permissions, UI friction, and failure modes.

---

## 1. Persona Matrix Overview

| Persona ID | Persona Name | Role / Account Type | Primary Goal | Access Level | Journey Health | Score (1–10) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P-01** | Guest / Anonymous User | Unauthenticated | Browse listings, explore flatmates, preview connect | Public Only | **Good** (Clear auth gates, smooth discovery) | **8.5 / 10** |
| **P-02** | Registered Renter | `renter` | Find rental property, schedule visits, contact owners | Authenticated Renter | **Fair** (Visits work; direct inquiry bypasses NestJS) | **7.0 / 10** |
| **P-03** | Flatmate Seeker | `flatmate` | Find compatible flatmates via AASHVO Connect swiping | Authenticated Flatmate | **Excellent** (Connect & scoring 100% verified) | **9.5 / 10** |
| **P-04** | Property Owner / Landlord | `owner` | Post property listings, verify units, manage viewings | Authenticated Owner | **Poor** (Listings write to Supabase/state; verification orphaned) | **4.5 / 10** |
| **P-05** | Family Stay Host | `family_stay_host` | List family-friendly homes, manage seasonal/family guests | Authenticated Host | **Poor** (Listing creation disconnected; family filter tag only) | **4.0 / 10** |
| **P-06** | Family Stay Seeker | `family_stay_seeker` | Search child/family-friendly accommodations | Authenticated Seeker | **Fair** (Can filter by family tag; specialized amenities missing) | **6.5 / 10** |
| **P-07** | Multi-Persona User | Dynamic Role | Switch between seeker, host, and flatmate seamlessly | Authenticated Multi-Role | **Very Good** (Role switcher & distinct onboarding complete) | **8.5 / 10** |
| **P-08** | Platform Administrator | `admin` | Platform oversight, verification approval, user management | Admin Guard (`ADMIN`) | **Fair** (Admin modal renders metrics; mutations lack full REST sync) | **6.0 / 10** |
| **P-09** | Content / Safety Moderator | `moderator` | Review flagged content, resolve disputes, monitor safety | Moderator Guard | **Poor** (Dispute & Safety modal disconnected from NestJS API) | **4.0 / 10** |

---

## 2. In-Depth Persona Audits

### 2.1 Persona P-01: Guest / Anonymous User
- **Profile:** First-time visitor arriving via web or search. No credentials.
- **Primary Journeys:**
  1. Lands on homepage (`/`), views hero banner, search bar, category tabs (`All`, `Properties`, `Flatmates`, `Family Stay`).
  2. Executes keyword search, adjusts price/city filters in [FilterModal.tsx](file:///d:/Projects/AASHVO/src/components/FilterModal.tsx).
  3. Views listing cards, opens property modal or flatmate detail modal.
  4. Attempts gated actions: "Save to Favorites", "Schedule Visit", "Connect", "List Property".
- **Authentication Gates & Guarding:**
  - Clicking "Heart" (Save) prompts `openAuthModal('login')`.
  - Clicking "Schedule Visit" prompts `openAuthModal('login')`.
  - Clicking "Connect" opens [ConnectModal.tsx](file:///d:/Projects/AASHVO/src/components/connect/ConnectModal.tsx), displaying the dedicated unauthenticated gate screen (`01_connect_unauthenticated_gate.png`) with benefits and a "Sign In to Connect" CTA.
  - Clicking "List Property" triggers `openAuthModal('login')`.
- **Friction Points:**
  - After logging in from an action gate, the user's intent is occasionally dropped (e.g. they must re-click "Schedule Visit").
- **Persona Verdict:** **8.5 / 10**. High discovery appeal, transparent value proposition, robust guest gates.

---

### 2.2 Persona P-02: Registered Renter
- **Profile:** Student or young professional looking for an apartment or private room in a new city.
- **Primary Journeys:**
  1. Signs up / logs in via email or Google OAuth.
  2. Sets up renter profile in [MyProfileModal.tsx](file:///d:/Projects/AASHVO/src/components/profile/MyProfileModal.tsx).
  3. Searches verified properties, reviews high-res photo carousels and amenities.
  4. Books in-person or virtual property tour via [ScheduleVisitModal.tsx](file:///d:/Projects/AASHVO/src/components/ScheduleVisitModal.tsx).
  5. Reviews digital lease agreement via [RentalTrustModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/RentalTrustModal.tsx).
- **Failure Modes & Broken Paths:**
  - **Critical Disconnect:** Direct inquiry submission ("Send Inquiry" in Property Detail) invokes `AppContext.submitConnectRequest()`. When backend is in NestJS REST mode, it does not hit `POST /api/v1/inquiries`. It shows a local toast notification, so landlords never receive the inquiry in PostgreSQL.
  - Tenancy agreements in `RentalTrustModal` attempt to query Supabase directly (`tenancy_agreements` table) instead of NestJS `GET /api/v1/agreements/mine`.
- **Persona Verdict:** **7.0 / 10**. Search, saved properties, and visits are stellar; direct inquiry and agreement lifecycles suffer from backend disconnects.

---

### 2.3 Persona P-03: Flatmate Seeker
- **Profile:** Relocating individual looking for compatible roommates sharing lifestyle, cleanliness, and budget expectations.
- **Primary Journeys:**
  1. Launches AASHVO Connect via navigation or hero banner.
  2. Completes 5-step onboarding wizard ([OnboardingModal.tsx](file:///d:/Projects/AASHVO/src/components/onboarding/OnboardingModal.tsx)) with lifestyle traits (cleanliness, smoking, pets, sleeping schedule, dietary habits, remote work).
  3. Enters Connect matching deck ([ConnectModal.tsx](file:///d:/Projects/AASHVO/src/components/connect/ConnectModal.tsx)).
  4. Inspects compatibility match percentage (e.g. 94% Match) with detailed breakdown: Cleanliness 100%, Budget 95%, Habits 90%.
  5. Swipes right (like) or left (pass).
  6. Upon mutual like, celebratory match dialog opens with immediate messaging.
  7. In-modal messaging with read indicators and safety block/report buttons.
- **Engineering Findings:**
  - **100% Verified:** Driven by NestJS `ConnectModule` and `MarketplaceProfilesModule` with PostgreSQL backing.
  - Missing-data fallback is normalized to neutral 0.5 without distorting scores.
- **Persona Verdict:** **9.5 / 10**. Best-in-class product experience, robust algorithm, zero disconnects.

---

### 2.4 Persona P-04: Property Owner / Landlord
- **Profile:** Homeowner or landlord seeking verified tenants for single/multi-unit properties.
- **Primary Journeys:**
  1. Registers as an Owner or switches role to Owner via [MyProfileModal.tsx](file:///d:/Projects/AASHVO/src/components/profile/MyProfileModal.tsx).
  2. Clicks "List Property" button in top navigation bar.
  3. Fills out multi-step listing modal ([ListPropertyModal.tsx](file:///d:/Projects/AASHVO/src/components/ListPropertyModal.tsx)): title, category, price, deposit, bedrooms, amenities, location, photos.
  4. Submits listing.
  5. Requests physical property verification inspection ([PropertyVerificationModal.tsx](file:///d:/Projects/AASHVO/src/components/verification/PropertyVerificationModal.tsx)).
  6. Manages tenant inquiries and visit requests.
- **Failure Modes & Broken Paths:**
  - **Severe Disconnect:** `ListPropertyModal` executes `AppContext.addProperty()`, which calls `createPropertyInSupabase()` or simply pushes to local React memory state! The NestJS `POST /api/v1/properties` controller is completely skipped. Listings disappear on page reload!
  - `PropertyVerificationModal` is not accessible from the Owner listing management UI (unmounted trigger).
- **Persona Verdict:** **4.5 / 10**. Polished UI, but unusable for real-world hosting until the listing submission is wired to NestJS REST API.

---

### 2.5 Persona P-05: Family Stay Host
- **Profile:** Host offering entire apartments or homes suited for families with children, elderly guests, or long-term vacations.
- **Primary Journeys:**
  1. Switches persona to `family_stay_host`.
  2. Attempts to create a family-specialized listing with family amenities (crib, high chair, child safety gates, garden).
  3. Manages reservations and family stay inquiries.
- **Failure Modes:**
  - Inherits P-04 listing creation disconnect.
  - Family-specific fields (e.g. child safety features, quiet hours, school proximity) are collapsed into generic text or tags rather than structured database columns.
- **Persona Verdict:** **4.0 / 10**. Lacks domain-specific validation and suffers from disconnected listing creation.

---

### 2.6 Persona P-06: Family Stay Seeker
- **Profile:** Parents traveling with children seeking verified, quiet, family-safe properties.
- **Primary Journeys:**
  1. Clicks "Family Stay" category filter on homepage.
  2. Filters by bedroom count (2BHK, 3BHK, Villa) and verified safety badges.
  3. Inspects listing safety details, neighborhood safety score, and proximity to parks/schools.
  4. Schedules a visit or contacts the host.
- **Friction Points:**
  - Search filtering relies on client-side array filtering in `AppContext`.
  - Inquiries fail to reach the host in PostgreSQL due to the inquiry disconnect.
- **Persona Verdict:** **6.5 / 10**. Good discovery experience; booking and communication break down downstream.

---

### 2.7 Persona P-07: Multi-Persona User
- **Profile:** Modern urbanite who rents an apartment in one city, leases out a spare room, and seeks a flatmate simultaneously.
- **Primary Journeys:**
  1. Opens [MyProfileModal.tsx](file:///d:/Projects/AASHVO/src/components/profile/MyProfileModal.tsx).
  2. Views Active Persona badge and persona selection pill: `Renter`, `Property Owner`, `Flatmate Seeker`, `Family Stay Host`, `Family Stay Seeker`.
  3. Switches persona: UI calls `POST /api/v1/profiles/switch-role` and updates global context immediately.
  4. Sees persona-specific progress checklists and profile completeness scores.
- **Engineering Findings:**
  - **100% Verified:** Handled by NestJS `MarketplaceProfilesModule` and Prisma `MarketplaceProfile` table with distinct JSON metadata per role.
- **Persona Verdict:** **8.5 / 10**. Fluid role transitions, clear separation of profile states.

---

### 2.8 Persona P-08: Platform Administrator
- **Profile:** Internal operations manager responsible for platform metrics, user moderation, and property verification.
- **Primary Journeys:**
  1. Logs in with user having `role: 'admin'` or `accountType: 'admin'`.
  2. Clicks Admin link in profile dropdown or navbar.
  3. Opens [AdminDashboardModal.tsx](file:///d:/Projects/AASHVO/src/components/AdminDashboardModal.tsx).
  4. Views platform metrics: total users, active listings, pending verifications, open disputes.
  5. Reviews submitted property verifications and approves/rejects them.
- **Friction Points:**
  - Admin modal displays mock data when backend admin endpoints are unreachable or when admin authentication headers are not cleanly forwarded by `apiClient`.
- **Persona Verdict:** **6.0 / 10**. UI architecture is ready, but administrative actions require full REST synchronization.

---

### 2.9 Persona P-09: Content / Community Moderator
- **Profile:** Safety agent tasked with reviewing user reports, inappropriate chat messages, fraudulent listings, and security disputes.
- **Primary Journeys:**
  1. Accesses moderation queue.
  2. Reviews flagged flatmate messages and user reports from Connect.
  3. Reviews submitted safety reports from [SafetyModal.tsx](file:///d:/Projects/AASHVO/src/components/SafetyModal.tsx).
  4. Bans abusive users or resolves tenancy disputes.
- **Failure Modes:**
  - Safety reports submitted via [SafetyModal.tsx](file:///d:/Projects/AASHVO/src/components/SafetyModal.tsx) delegate to `AppContext.createSafetyReport()`, which bypasses NestJS `DisputesModule` and writes to Supabase or local state.
  - As a result, moderator queues in PostgreSQL are never populated with user safety reports!
- **Persona Verdict:** **4.0 / 10**. Broken end-to-end data pipeline from user report submission to moderation review.
