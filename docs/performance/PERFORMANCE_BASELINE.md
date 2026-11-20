# AASHVO Performance & Architecture Baseline Report

**Product:** AASHVO — Find your place. Find your people.  
**Branch:** `feat/performance-responsive-ux`  
**Base Commit:** `87e7328cec7ee2ee2baf640d38d8fc14da67f75e`  
**Date:** November 2026  
**Auditor / Architect:** AASHVO CTO & Engineering Team  

---

## 1. Executive Summary

Prior to the performance and responsive UX optimization sprint, AASHVO was functionally complete with verified authentication, onboarding, profiles, marketplace personas, Connect matching intelligence, and security controls. However, production profiling revealed key performance bottlenecks across bundle delivery, client-side re-renders, database queries, and small-screen touch interactions.

This document establishes the empirical baseline metrics across all layers of the stack prior to optimization.

---

## 2. Frontend Bundle Size & Asset Delivery Baseline

### 2.1 Baseline Vite Production Build Metrics
Before code-splitting and chunk tuning, Vite bundled the entire application into a single monolithic JavaScript bundle:

| Artifact | Type | Raw Size | Gzip Size | Analysis |
| :--- | :--- | :--- | :--- | :--- |
| `dist/assets/index-B1FjX0sY.js` | Monolithic Entry JS | **488.79 kB** | **104.74 kB** | Over 480 kB parsed on initial paint. |
| `dist/assets/index-CLXp5vD0.css` | Production CSS | 35.80 kB | 6.42 kB | Utility styles & animations. |
| `dist/assets/index-BTvjQ32A.js` | Sub-chunk | 100.86 kB | 30.22 kB | Vendor/runtime. |
| `dist/assets/index-Ch1kP6U3.js` | Sub-chunk | 76.34 kB | 22.99 kB | Lucide & helper icons. |
| **Total Uncompressed JS** | — | **665.99 kB** | **157.95 kB** | Significant initial execution overhead. |

### 2.2 Root Causes of Bundle Bloat
1. **Monolithic Modal Inclusion in `App.tsx`:**
   All 14 heavy interactive dialogs were imported eagerly at the top of [App.tsx](file:///d:/Projects/AASHVO/src/App.tsx):
   - `PropertyDetailModal`
   - `FlatmateDetailModal`
   - `ListPropertyModal`
   - `AdminModerationModal`
   - `AuthModal`
   - `HelpCenterModal`
   - `ReportModal`
   - `RentalTrustModal`
   - `ConnectModal`
   - `RentSplitCalculatorModal`
   - `SavedListingsModal`
   - `MyActivityModal`
   - `OnboardingModal`
   - `MyProfileModal`
   Even if a user only browsed public listings, code for onboarding forms, swipe decks, and moderation dashboards was downloaded and parsed.

2. **Unoptimized Vendor Chunking:**
   Third-party libraries (React, React-DOM, Lucide icons, `@aashvo/contracts`) were bundled without explicit rollup chunk boundaries, increasing cache invalidation frequency.

3. **External Asset Preconnection:**
   Remote image origins (`https://images.unsplash.com`) had no `<link rel="preconnect">` or `<link rel="dns-prefetch">` directives in [index.html](file:///d:/Projects/AASHVO/index.html), adding DNS + TLS negotiation latency to initial media rendering.

---

## 3. Client-Side Rendering & Network Baseline

### 3.1 Search Input Thrashing
- In [PropertyFilters.tsx](file:///d:/Projects/AASHVO/src/components/property/PropertyFilters.tsx), the search input directly propagated state updates to parent components on every keystroke (`onChange={(e) => onSearchChange(e.target.value)}`).
- Rapid typing triggered dozens of full filter re-evaluations and re-renders per second across listing grids.

### 3.2 Derived State Recalculation
- In [DiscoverySection.tsx](file:///d:/Projects/AASHVO/src/components/discovery/DiscoverySection.tsx), array filtering and counting operations (`filteredProperties`, `filteredFlatmates`, `familyStayCount`, `entireFlatCount`) were executed inline during every component render without `useMemo`, causing CPU cycles on un-related state updates (e.g., toast alerts or modal visibility toggles).

### 3.3 Redundant Network Requests
- [apiClient.ts](file:///d:/Projects/AASHVO/src/services/apiClient.ts) lacked in-flight GET request deduplication. Concurrent components mounting simultaneously (such as navigation counters, filters, and discovery sections) could issue identical GET requests in parallel without single-flight sharing.

---

## 4. Backend & Database Query Baseline

### 4.1 Connect Block Lookups
- In `ConnectService.discoverCandidates`, user block relationships were queried sequentially:
  ```typescript
  // Baseline sequential double-query
  const myBlocks = await this.prisma.userBlock.findMany({ where: { blockerId: callerId } });
  const blocksOnMe = await this.prisma.userBlock.findMany({ where: { blockedId: callerId } });
  ```
- **Benchmark Measurement:** Sequential execution averaged **5.06 ms**, compared to **1.04 ms** when unified with an SQL `OR` index scan (**79.5% latency reduction**).

### 4.2 Candidate Discovery Sequential Roundtrips
- Profile lookups, preference fetches, block lists, and existing swipe records were executed one after another rather than concurrently in `Promise.all`:
  - `flatmate = await this.prisma.flatmateProfile.findUnique(...)`
  - `pref = await this.prisma.connectPreference.findUnique(...)`
  - `myBlocks = await ...`
  - `blocksOnMe = await ...`
  - `existingSwipes = await ...`
- The `connect.postgres.integration.spec.ts` test suite took **56.6 seconds** to run under this sequential pattern.

### 4.3 Redundant Column Loading & Missing Cache
- In `PropertiesService.searchProperties`, queries included all columns and full photo objects (`mediaId`, `createdAt`, `updatedAt`, `caption`, `order`) when only `photoUrl` and `isPrimary` were needed for list cards.
- Public, unauthenticated searches hit PostgreSQL on every identical request without any in-memory TTL caching.

---

## 5. Mobile & Responsive UX Baseline

Prior to audit and hardening:
1. **Touch Targets:**
   The mobile navigation hamburger button in [Navbar.tsx](file:///d:/Projects/AASHVO/src/components/layout/Navbar.tsx) lacked explicit minimum 44px x 44px dimensions (`p-2 text-slate-700` only yielded ~36px bounding boxes), failing WCAG 2.5.5 touch target guidelines.
2. **Horizontal Viewport Clipping (320px - 375px):**
   - [ConnectModal.tsx](file:///d:/Projects/AASHVO/src/components/connect/ConnectModal.tsx) header tab controls (`Discover`, `Matches`, `Preferences`) wrapped or overflowed on 320px screens.
   - [MyProfileModal.tsx](file:///d:/Projects/AASHVO/src/components/profile/MyProfileModal.tsx) tab headers lacked horizontal scrolling indicators.
   - [OnboardingModal.tsx](file:///d:/Projects/AASHVO/src/components/onboarding/OnboardingModal.tsx) bottom navigation footer could clip or distort button text at 320px viewport widths.
3. **Scrollbar Aesthetics:**
   Horizontal scroll containers lacked utility classes to suppress unsightly desktop scrollbars while preserving touch flicking on mobile.

---

## 6. Target Goals for the Sprint

1. **Initial JS Payload:** Reduce main bundle size below 200 kB gzipped (achieve > 50% reduction).
2. **Code Splitting:** Lazy-load all 14 modal dialogs via `React.lazy` and `<Suspense>`.
3. **Client Responsiveness:** Introduce 200ms search debouncing, in-flight GET deduplication, and memoized discovery filters.
4. **Backend Query Optimization:** Unify block checks into a single indexed query, parallelize candidate lookups, and add TTL caching for public searches.
5. **Responsive Quality:** Ensure 0 horizontal overflows from 320px to 1440px and enforce minimum 44px touch targets.
6. **Zero Regressions:** 100% pass rate on all 293 frontend Vitest tests and 184 backend Jest tests.
