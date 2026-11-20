# AASHVO Edge Case, Concurrency & Failure Mode Audit

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Principal Quality Architect  
**Scope:** Resilience analysis covering Network Disconnects, Concurrency Races, Rapid Form Submissions, Extreme Inputs, Session Interruptions, and Boundary Conditions.

---

## 1. Executive Resilience Summary

The AASHVO frontend demonstrates high visual polish with graceful loading skeletons and toast notifications. However, under adversarial conditions, rapid clicking, and intermittent network failures, several edge cases reveal race conditions or silent failures.

---

## 2. Comprehensive Edge Case Audit

### 2.1 Rapid Clicks & Double-Submission Races
- **Scenario:** User clicks "Publish Profile", "Schedule Visit", or "Send Message" multiple times in quick succession before the first network response returns.
- **Audit Findings:**
  - **Schedule Visit (`ScheduleVisitModal.tsx`):** The submit button does not disable synchronously on first click; `isSubmitting` state is updated asynchronously. A double-click sends two simultaneous `POST /api/v1/visits` requests, resulting in two duplicate visit appointments created in PostgreSQL for the same user and property.
  - **Connect Swiping (`ConnectModal.tsx`):** Handled cleanly. An internal `isSwiping` lock and optimistic card pop immediately prevents duplicate swipes on the same candidate.
  - **Listing Creation (`ListPropertyModal.tsx`):** Lacks synchronous debounce. Can create duplicate listing cards in local state.
- **Remediation:** Introduce a synchronous submission ref (`submittingRef.current = true`) or disabled state on all primary action buttons.

---

### 2.2 Boundary Inputs & Extreme Values
- **Scenario:** User enters unexpected strings, zero/negative numbers, or unicode payloads.
- **Audit Findings:**
  - **Budget Filters (`FilterModal.tsx`):** If user types negative price values, the slider gracefully clamps to minimum `0`. However, setting min budget higher than max budget in text inputs causes inverted queries where `min > max`, returning 0 results.
  - **Connect Bio & Messages:** Supports full Unicode and emoji sets without encoding errors. Bio text over 1,000 characters is rejected by backend DTO validation (`@MaxLength(1000)`).
  - **Property Pricing:** Prisma schema defines `price` and `deposit` as `Int` or `Float`. Backend validation enforces `@Min(0)`. Submitting zero price for a rental property is accepted (treated as "Free / Contact for Price").

---

### 2.3 Network Failures & Offline Resilience
- **Scenario:** Network drops midway through onboarding, visit booking, or swiping.
- **Audit Findings:**
  - **Axios Interceptor Handling:** Global interceptor in `apiClient.ts` captures network errors (`ERR_NETWORK`, `ECONNREFUSED`). It displays a standardized toast: *"Unable to reach the server. Please check your internet connection."*
  - **Onboarding Auto-Save:** If network drops during onboarding step progression, local draft in `localStorage` persists. The user can refresh or reopen the wizard without losing input data.
  - **Connect Swiping:** If a swipe fails due to network loss, the UI currently discards the card optimistically. On subsequent reload, the un-recorded candidate re-appears in the candidate deck (graceful degradation).

---

### 2.4 Session Expiration During Multi-Step Workflows
- **Scenario:** User begins a multi-step workflow (e.g. 5-step onboarding or 4-step property listing), leaves tab open for 30 minutes until access token expires, then submits.
- **Audit Findings:**
  - **Automated Refresh:** Axios interceptor attempts to call `/api/v1/auth/refresh`. If the refresh token cookie is still valid, the token is refreshed transparently, and the form submission completes without user interruption.
  - **Hard Refresh Failure:** If the refresh token has expired, the interceptor redirects or opens the Auth modal. However, the active modal state in `ListPropertyModal` is closed and unpersisted, discarding user input.
- **Remediation:** Persist listing form state in temporary session storage so that after re-login, the modal re-hydrates.

---

### 2.5 Empty States & Zero-Result Handling
- **Scenario:** User searches for a non-existent city or sets incompatible filter criteria (e.g. Budget < $100 in Manhattan).
- **Audit Findings:**
  - **Property Grid:** Displays clean illustration, "No properties match your criteria", and a prominent "Reset Filters" button that clears all filter parameters to defaults.
  - **Connect Matching Deck:** When all candidates in the user's city are swiped, the deck shows "You're all caught up! Check back later or expand your search distance."

---

### 2.6 Concurrency & Database Race Conditions
- **Scenario:** Two flatmate users swipe "Like" on each other at the exact same second.
- **Audit Findings:**
  - **Verified in Connect Engine:** The `recordSwipe()` method in `connect.service.ts` uses Prisma transaction isolation. It checks for reciprocal interest with `findFirst` within the transaction. A unique composite index on `(senderId, receiverId)` prevents duplicate interest records.

---

## 3. Edge Case Vulnerability Summary

| Failure Mode | Component | Impact | Risk Level | Status |
| :--- | :--- | :--- | :--- | :--- |
| Duplicate Visit Booking on rapid double-click | `ScheduleVisitModal.tsx` | Creates 2 identical bookings in DB | Medium | Open |
| Session loss discards listing input | `ListPropertyModal.tsx` | User loses multi-step progress | Medium | Open |
| Inverted price filter (min > max) | `FilterModal.tsx` | Silently returns 0 results | Low | Open |
| Discarded swipe on network drop | `ConnectModal.tsx` | Candidate re-appears on reload | Low (Graceful) | Handled |
