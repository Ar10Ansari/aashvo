# AASHVO Workflow Lifecycle & State Machine Audit

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Principal Platform Architect  
**Scope:** Exhaustive evaluation of 12 platform lifecycles across 13 canonical operational states:  
`Entry` → `Start` → `Input` → `Validation` → `Draft` → `Resume` → `Review` → `Submit` → `Process` → `Success` → `Edit` → `Status Change` → `Delete/Deactivate`.

---

## 1. Lifecycle Evaluation Framework

Every major user journey in AASHVO has been audited against the standard 13-stage SaaS state machine. The table below summarizes the health of each phase across the 12 core workflow groups:

- **✓** = Implemented, robust, and verified.
- **~** = Partially implemented (in-memory, mock fallback, or partial UI).
- **✗** = Missing, disconnected, or unhandled.
- **N/A** = State not applicable to this workflow domain.

| Group | Workflow Domain | Entry | Start | Input | Valid. | Draft | Resume | Review | Submit | Process | Success | Edit | Status | Delete |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A** | Authentication & Account | ✓ | ✓ | ✓ | ✓ | N/A | N/A | N/A | ✓ | ✓ | ✓ | ✓ | ✓ | ~ |
| **B** | Search & Discovery | ✓ | ✓ | ✓ | ✓ | N/A | N/A | N/A | ✓ | ✓ | ✓ | ~ | N/A | N/A |
| **C** | Property Listing Creation | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ~ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ |
| **D** | Flatmate Connect & Matching | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **E** | Onboarding & Multi-Persona | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A |
| **F** | Visit Scheduling | ✓ | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ |
| **G** | Saved Listings & Shortlists | ✓ | ✓ | ✓ | ✓ | N/A | N/A | N/A | ✓ | ✓ | ✓ | N/A | N/A | ✓ |
| **H** | Direct Property Inquiry | ✓ | ✓ | ✓ | ~ | N/A | N/A | N/A | ✗ | ✗ | ~ | N/A | ✗ | ✗ |
| **I** | Tenancy Agreement & Move-In | ✓ | ✓ | ✓ | ~ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **J** | Notification Lifecycle | ✓ | ✓ | ✓ | ✓ | N/A | N/A | N/A | ✓ | ✓ | ~ | N/A | ✓ | ✓ |
| **K** | Support, Safety & Disputes | ✓ | ✓ | ✓ | ✓ | N/A | N/A | N/A | ✗ | ✗ | ~ | N/A | ✗ | ✗ |
| **L** | Admin & Moderation | ✓ | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ~ | ~ | ~ | ~ | ~ | ~ |

---

## 2. In-Depth Workflow Lifecycle Analysis

### Group A: Authentication & Account Management
1. **Entry:** Top navbar buttons ("Sign In", "Get Started") or gated feature triggers (Connect, Schedule Visit, Favorite).
2. **Start:** [AuthModal.tsx](file:///d:/Projects/AASHVO/src/components/auth/AuthModal.tsx) opens with tab toggle (`login` / `register`).
3. **Input:** Form accepts `email`, `password`, `name`, `role` (renter, owner, flatmate).
4. **Validation:** Client-side Zod/form validation enforces minimum 8-character passwords and valid email format.
5. **Submit:** `authService.login()` or `authService.register()` posts to `/api/v1/auth/login` or `/api/v1/auth/register`.
6. **Process:** NestJS `AuthService` validates bcrypt hash or creates `User` & `Account` in PostgreSQL.
7. **Success:** Returns user object, access token, sets HTTP-only refresh cookie; `AppContext` hydrates user session.
8. **Edit / Status:** Profile details editable via `MyProfileModal`. Role switchable via `POST /api/v1/profiles/switch-role`.
9. **Delete / Deactivate:** Account soft-delete exists in Prisma (`isDeleted` flag) but lacks self-service UI trigger.

---

### Group B: Search & Discovery Lifecycle
1. **Entry:** Homepage hero search bar, quick category pills (`Properties`, `Flatmates`, `Family Stay`).
2. **Start:** User types keywords (city, neighborhood, university) or opens [FilterModal.tsx](file:///d:/Projects/AASHVO/src/components/FilterModal.tsx).
3. **Input:** Sliders for budget range ($300 - $3,500+), checkboxes for bedrooms, amenities (WiFi, AC, Parking, Pet Friendly).
4. **Validation:** Bounds checking on price ranges (min cannot exceed max).
5. **Submit / Process:** Currently filtered in-memory via `AppContext` filter reducer.
6. **Success:** Listing grid dynamically re-renders matching cards. Responsive empty state ("No listings found") with reset CTA.
7. **Limitation:** In-memory filtering means search is performed over the cached set (or mock seed) rather than sending paginated query params to NestJS `GET /api/v1/properties`.

---

### Group C: Property Listing Lifecycle (Host / Owner)
1. **Entry:** Navbar "List Property" button.
2. **Start:** [ListPropertyModal.tsx](file:///d:/Projects/AASHVO/src/components/ListPropertyModal.tsx) opens 4-step wizard.
3. **Input:** Step 1 (Basic Details: title, category, price, deposit), Step 2 (Location: address, city, landmark), Step 3 (Features: bedrooms, bathrooms, amenities), Step 4 (Photos: URL inputs or upload dropzone).
4. **Validation:** Checks mandatory fields before advancing steps.
5. **Draft & Resume:** **MISSING.** Form does not persist draft state to localStorage or backend. Closing the modal discards all inputs!
6. **Submit:** Clicks "Publish Listing".
7. **CRITICAL DEFECT (Process & Success):** Form invokes `AppContext.addProperty()`, which calls `createPropertyInSupabase()`. When Supabase is not configured (or in standard NestJS REST mode), it falls back to appending to local React state array with a success toast. **The listing is never written to PostgreSQL via NestJS `POST /api/v1/properties`!**
8. **Edit / Status Change / Delete:** Landlords cannot update listing availability, change price, or delete listings from a persistent backend dashboard.

---

### Group D: Flatmate Connect & Matching Lifecycle
1. **Entry:** Navbar "AASHVO Connect" pill or banner CTA.
2. **Start:** [ConnectModal.tsx](file:///d:/Projects/AASHVO/src/components/connect/ConnectModal.tsx) mounts. If unauthenticated, displays auth gate screen. If authenticated but profile incomplete, prompts onboarding wizard.
3. **Input / Candidates:** Calls `GET /api/v1/connect/candidates`. Compatibility engine evaluates candidate profile vectors against user's preferences.
4. **Review:** Candidate card displays profile photo, occupation, location, bio, lifestyle badges, and multidimensional match score (e.g. 92% Match with Breakdown tooltip).
5. **Submit (Action):** User clicks "Pass" (Left Swipe) or "Like" (Right Swipe). Calls `POST /api/v1/connect/swipe`.
6. **Process:** NestJS `ConnectService` records `FlatmateInterest`. If mutual like exists, creates `FlatmateMatch`.
7. **Success:** Trigger celebration overlay ("It's a Match!") with confetti and immediate messaging CTA.
8. **Messaging:** Matched users chat in-modal via `GET/POST /api/v1/connect/matches/:id/messages`.
9. **Status Change / Delete:** User can "Unmatch", "Block User", or "Report User", which immediately purges candidate from matching deck via `POST /api/v1/connect/block` and `POST /api/v1/connect/report`.
10. **State Health:** **100% Complete & Verified.**

---

### Group E: Onboarding & Multi-Persona Profile Lifecycle
1. **Entry:** Auto-triggered after registration or manually opened via "Complete Profile" in `MyProfileModal`.
2. **Start:** [OnboardingModal.tsx](file:///d:/Projects/AASHVO/src/components/onboarding/OnboardingModal.tsx) launches 5-step progress wizard.
3. **Steps:**
   - Step 1: Basic Info (Age, gender, occupation, college/company, bio).
   - Step 2: Location & Budget (Target city, preferred areas, budget range, move-in date).
   - Step 3: Housing Preferences (Furnished, private room, sharing, lease duration).
   - Step 4: Lifestyle & Habits (Sleep schedule, cleanliness rating, smoking, alcohol, pets, dietary preference, work-from-home schedule).
   - Step 5: Review & Publish.
4. **Validation:** Each step validates required fields before permitting the "Next" button.
5. **Draft & Resume:** User can click "Save Draft" or close modal. State is saved to backend (`POST /api/v1/profiles/onboarding/draft`) and localStorage. On re-opening, wizard resumes from saved step!
6. **Submit & Process:** Step 5 "Publish Profile" issues `POST /api/v1/profiles/onboarding/publish`.
7. **Success:** Profile is marked active and published; Connect matching engine immediately includes user in candidate pool.

---

### Group F: Property Visit Scheduling Lifecycle
1. **Entry:** "Schedule Visit" button in [PropertyDetailModal.tsx](file:///d:/Projects/AASHVO/src/components/PropertyDetailModal.tsx).
2. **Start:** [ScheduleVisitModal.tsx](file:///d:/Projects/AASHVO/src/components/ScheduleVisitModal.tsx) opens.
3. **Input:** Preferred date (calendar picker), time slot dropdown (Morning 10-12, Afternoon 2-4, Evening 5-7), visit type (`in-person` vs `virtual`), custom message.
4. **Validation:** Date must be in the future; message must meet minimum character length.
5. **Submit:** Calls `visitService.scheduleVisit()`, posting to NestJS `POST /api/v1/visits`.
6. **Process & Success:** Creates `PropertyVisit` record in PostgreSQL with status `pending`. Confirmation modal displayed with calendar download option.
7. **Status Transitions:** Endpoint supports transitions to `confirmed`, `completed`, and `cancelled`.

---

### Group G: Saved Listings & Shortlists Lifecycle
1. **Entry:** Clicking heart icon on property card or flatmate card; clicking "Saved" in top navigation.
2. **Process:** [savedService.ts](file:///d:/Projects/AASHVO/src/services/savedService.ts) calls `POST /api/v1/saved/toggle` with `itemType` (`property` or `flatmate`) and `itemId`.
3. **State:** Optimistic UI update in React; persists to Prisma `SavedItem` table.
4. **View & Delete:** [SavedListingsModal.tsx](file:///d:/Projects/AASHVO/src/components/SavedListingsModal.tsx) displays tabs for Saved Properties and Saved Flatmates with one-click remove.

---

### Group H: Direct Property Inquiry Lifecycle
1. **Entry:** "Contact Owner" / "Send Inquiry" button in Property Detail view.
2. **Input:** Form for tenant contact details, intended move-in date, and inquiry message.
3. **CRITICAL DEFECT:** Invokes `AppContext.submitConnectRequest()`. If Supabase client is unconfigured, it simply fires a local success toast. **The NestJS controller `POST /api/v1/inquiries` is never invoked.**
4. **Impact:** Landlords never receive inquiries in PostgreSQL; renters receive false confirmation that inquiry was delivered.

---

### Group I: Tenancy Agreement & Move-In Inspection Lifecycle
1. **Entry:** "Rental Trust" link in navigation bar.
2. **Start:** [RentalTrustModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/RentalTrustModal.tsx) opens.
3. **CRITICAL DEFECT 1:** `rentalTrustService.ts` contains raw Supabase queries (`supabase.from('tenancy_agreements')`), completely bypassing NestJS `AgreementsModule` (`/api/v1/agreements`).
4. **CRITICAL DEFECT 2 (Orphaned Component):** [MoveInChecklistModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/MoveInChecklistModal.tsx) (a 400-line full-featured inspection component with meter readings, inventory items, and photo documentation) is completely unmounted in the application.

---

### Group J: Notification Lifecycle
1. **Entry:** Bell icon in top navbar with unread badge counter.
2. **Start:** [NotificationCenter.tsx](file:///d:/Projects/AASHVO/src/components/NotificationCenter.tsx) opens dropdown popover.
3. **Data Fetch:** Calls `notificationService.getNotifications()`, querying `GET /api/v1/notifications`.
4. **Mark As Read (Individual):** Clicking a notification marks it read via `PATCH /api/v1/notifications/:id/read`.
5. **CRITICAL DEFECT (Mark All Read):** Clicking "Mark all as read" invokes `notificationService.markAllAsRead()`, which posts to `/notifications/mark-all-read`. The NestJS backend endpoint is `@Post('read-all')` (`/api/v1/notifications/read-all`). **This results in an immediate 404 Not Found error!**

---

### Group K: Support, Dispute & Safety Lifecycle
1. **Entry:** "Help & Support" and "Report Safety Concern" in footer or listing menus.
2. **Start:** [SupportModal.tsx](file:///d:/Projects/AASHVO/src/components/SupportModal.tsx) and [SafetyModal.tsx](file:///d:/Projects/AASHVO/src/components/SafetyModal.tsx).
3. **CRITICAL DEFECT:** Submissions invoke `AppContext.createSupportTicket()` and `AppContext.createSafetyReport()`, which route to Supabase or local state. The comprehensive NestJS `SupportModule` (`POST /api/v1/support/tickets`) and `DisputesModule` (`POST /api/v1/support/disputes`) are bypassed.

---

### Group L: Admin & Moderation Lifecycle
1. **Entry:** "Admin Panel" link in profile dropdown (restricted by `role === 'admin'`).
2. **Start:** [AdminDashboardModal.tsx](file:///d:/Projects/AASHVO/src/components/AdminDashboardModal.tsx).
3. **Status:** Metric cards render correctly. However, verification approval and user moderation actions must be connected to the dedicated NestJS `AdminController` endpoints to mutate live PostgreSQL state.
