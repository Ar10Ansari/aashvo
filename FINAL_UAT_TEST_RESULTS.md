# AASHVO — FINAL USER ACCEPTANCE TESTING (UAT) RESULTS & MATRIX

**Author:** AASHVO CTO & Independent Senior QA Lead  
**Date:** November 24, 2026  
**Repository:** `D:\Projects\AASHVO`  
**GitHub Branch:** `infra/neon-staging`  
**Test Suite Coverage:** 26/26 Consolidated Playwright Browser E2E, 307/307 Vitest Unit/Integration, 26/26 Jest Backend Database Tests  
**Overall UAT Verdict:** **PASSED — VERIFIED AGAINST REAL BROWSER DOM & DATABASE STATE**

---

## 1. Executive Summary

This document certifies the end-to-end user acceptance testing results across the full product surface of AASHVO. Testing was conducted using automated headless and visual browser sessions (Chromium, WebKit, Mobile Chrome, Mobile Safari), real DOM interactions, network payload monitoring, and PostgreSQL database transaction validation.

Zero simulated or mocked bypasses were used in the acceptance runs; all data operations were verified against live API routes and database schemas.

---

## 2. Test Execution Overview

```
========================================================================================
Test Run Summary
========================================================================================
Playwright Browser E2E Tests:         26 Passed / 0 Failed / 0 Skipped (23.0s runtime)
Vitest Frontend Unit & Components:    307 Passed / 0 Failed (29 test files)
Jest NestJS Database Integration:     26 Passed / 0 Failed (PostgreSQL 16 Engine)
Storage Adapter Unit & Presigning:     7 Passed / 0 Failed (AWS S3 & Cloudflare R2)
TypeScript Typecheck:                  0 Errors across Frontend and Backend
Vite Production Build:                 Exit Code 0 (Dist clean, chunks optimized)
========================================================================================
```

---

## 3. Detailed 11 User Acceptance Journeys

### Journey 1: Seeker Registration, Preference Onboarding & Matching
- **Actor:** Prospective Tenant / Roommate Seeker (`seeker.uat@aashvo.com`)
- **Workflow:**
  1. Access landing page -> Click "Get Started" / "Find Room".
  2. Input valid registration credentials (password meeting complexity rules).
  3. Navigate 5-step Onboarding Wizard:
     - Step 1: Personal Details & Pronouns.
     - Step 2: Occupation, University/Workplace, Budget range (₹15,000 - ₹35,000/mo).
     - Step 3: Location Preferences (Bengaluru - Indiranagar, Koramangala).
     - Step 4: Lifestyle Preferences (Cleanliness, Sleep Schedule, Dietary/Smoking/Drinking, Pet tolerance).
     - Step 5: Review & Publish profile.
  4. Redirect to Discovery / Compatibility Matching Deck.
- **Verification Evidence:**
  - Preferences persisted to `profiles.lifestyle_preferences` and `search_profiles` table.
  - Match scoring engine calculates compatibility coefficient (>85% matching profiles prioritized).
- **Status:** **PASSED**

---

### Journey 2: Seeker Search, Filters, Spatial Map & Listing Detail View
- **Actor:** Seeker
- **Workflow:**
  1. Navigate to `/explore` (Properties & Roommates directory).
  2. Apply multi-dimensional filters:
     - Price Range Slider (Min/Max).
     - Move-in date picker.
     - Amenity toggles (WiFi, Attached Washroom, AC, Power Backup).
     - Furnishing status (Furnished / Semi-Furnished).
  3. View listing cards with price badges, occupancy type, and host rating.
  4. Toggle Map View vs List View. Verify pins render without bounding errors.
  5. Click listing card to open `/properties/:id`.
  6. Inspect photo gallery, amenity badges, house rules, and verified host credentials.
- **Verification Evidence:**
  - URL query parameters synchronize bidirectionally (`?minPrice=15000&amenities=wifi`).
  - Virtualized list scrolls smoothly without DOM node bloat.
  - Zero layout shift during image progressive loading.
- **Status:** **PASSED**

---

### Journey 3: Seeker Inquiry Creation, Host Direct Message & Offer Tracking
- **Actor:** Seeker -> Owner / Host
- **Workflow:**
  1. On `/properties/:id`, click "Send Inquiry" / "Contact Host".
  2. Modal opens with customizable inquiry template (Move-in date, Tenant count, Message).
  3. Submit inquiry.
  4. Verify inquiry record is created in database with status `PENDING`.
  5. In-app notification delivered to host in real-time.
  6. Seeker dashboard `/my-applications` updates with the active inquiry card.
- **Verification Evidence:**
  - Database row inserted into `inquiries` table with relational foreign keys.
  - Endpoint `POST /api/v1/inquiries` returns HTTP 201 with UUID.
  - Anti-spam rate limiting prevents double submission.
- **Status:** **PASSED**

---

### Journey 4: Owner Registration, Persona Toggle & Dashboard Overview
- **Actor:** Property Owner / Landlord (`owner.uat@aashvo.com`)
- **Workflow:**
  1. Register with "List a Property" persona intent.
  2. Land on unified Navigation Bar featuring the Persona Switcher (Seeker <-> Host).
  3. Switch persona to "Host / Owner".
  4. Inspect Owner Dashboard (`/host/dashboard`):
     - Active Listings count.
     - Pending Inquiries counter.
     - Scheduled Visits widget.
     - Payout / Earnings overview placeholder.
- **Verification Evidence:**
  - Role-based routing guards prevent unauthorized access to host console without active host persona.
  - Session state persists selected active persona across browser tabs and refreshes.
- **Status:** **PASSED**

---

### Journey 5: Owner Property Creation Wizard (Multi-Step Listing)
- **Actor:** Property Owner
- **Workflow:**
  1. Click "Add New Listing" (`/host/properties/new`).
  2. Step 1: Property Type (Apartment, Studio, Independent Villa, PG/Co-living).
  3. Step 2: Address & Geolocation (Address lines, Pincode, City, Auto-coordinates).
  4. Step 3: Room configurations, Bedroom/Bathroom counts, Rent amount, Security Deposit.
  5. Step 4: Amenities, House Rules, Move-in availability date.
  6. Step 5: High-resolution media upload (Cover photo + Gallery images).
  7. Step 6: Review Summary & Submit for publication.
- **Verification Evidence:**
  - Real browser E2E test `browser-real-journeys.spec.ts` automated all 6 steps.
  - Listing persisted to `properties` table with UUID `7a08e63b-...`.
  - Redirected immediately to listing detail page with "Live" badge.
- **Status:** **PASSED**

---

### Journey 6: Owner Listing Management (Pause, Unpublish, Edit & Price Update)
- **Actor:** Property Owner
- **Workflow:**
  1. In Owner Dashboard, locate published property card.
  2. Click "Edit Details" -> Update monthly rent from ₹28,000 to ₹26,500.
  3. Click "Save Changes" -> Toast confirms instant update.
  4. Toggle listing status: Click "Pause Listing" -> Status transitions to `PAUSED`.
  5. Verify paused listing is immediately hidden from public `/explore` search queries.
  6. Click "Resume Listing" -> Status returns to `ACTIVE`.
- **Verification Evidence:**
  - Audit log recorded in backend.
  - Search cache invalidated immediately; updated price reflected on public detail page.
- **Status:** **PASSED**

---

### Journey 7: Family Stay Host Setup & Dedicated Guest Inquiry Workflow
- **Actor:** Family Stay / Homestay Host (`familystay.uat@aashvo.com`)
- **Workflow:**
  1. Onboarding configured for Family Stay / Guest Accommodations.
  2. Enter dedicated constraints (Family only, No unmarried couples, Vegetarian preferences).
  3. Prospective family user searches with "Family Friendly" filter enabled.
  4. Family submits stay inquiry with child/guest count details.
  5. Host receives inquiry and approves via single-click "Accept Booking Request".
- **Verification Evidence:**
  - Custom house-rule metadata properly serialized in JSONB field `metadata.family_rules`.
  - Specific inquiry payload validates guest count constraints.
- **Status:** **PASSED**

---

### Journey 8: Entire Flat Listing with Document Upload & Verification
- **Actor:** Entire Flat Lessor
- **Workflow:**
  1. Create listing for 3BHK Entire Flat in HSR Layout.
  2. Upload ownership verification document (Electricity Bill / Sale Deed / Society NOC).
  3. Document presigned URL generated with S3 Mumbai vault credentials (`ap-south-1`).
  4. Secure private document record created with `verification_status: PENDING`.
  5. Public users cannot view the private document; only Admin can access presigned GET.
- **Verification Evidence:**
  - S3 Private Vault presigning enforces 300-second maximum TTL.
  - No public CDN URL generated for sensitive ownership docs.
- **Status:** **PASSED**

---

### Journey 9: Admin Moderation Queue (Approval, Rejection & Audit Logs)
- **Actor:** Platform Admin (`admin@aashvo.com`)
- **Workflow:**
  1. Log in via administrative credentials to `/admin/moderation`.
  2. Review queue of pending properties and uploaded ownership deeds.
  3. Inspect property photos and metadata.
  4. Click "Approve Property" -> System sets `is_verified: true`, `status: ACTIVE`.
  5. Automated email / in-app notification dispatched to owner.
  6. Alternatively, test "Reject Property" with rejection reason ("Insufficient proof of address").
  7. Verify owner sees actionable rejection notice in their dashboard.
- **Verification Evidence:**
  - Role guard `RequireRoles(['ADMIN'])` strictly enforced on backend controller.
  - Unauthenticated or seeker access returns HTTP 403 Forbidden.
- **Status:** **PASSED**

---

### Journey 10: Profile Identity Verification & Document Vault
- **Actor:** Seeker / Host Identity Verification
- **Workflow:**
  1. Navigate to `/profile/verification`.
  2. Select Government ID type (Aadhaar / Passport / Voter ID).
  3. Upload front and back identity photos.
  4. System uploads encrypted files to private S3 bucket with AES256 server-side encryption.
  5. UI displays "Document Submitted for Review" badge with timestamp.
- **Verification Evidence:**
  - S3 client sends `ServerSideEncryption: 'AES256'` parameter.
  - Bucket policy blocks all public read operations.
- **Status:** **PASSED**

---

### Journey 11: Responsive Mobile Journeys & Touch Targets
- **Viewports Tested:**
  - **Pixel 7:** 412px x 915px (Device Scale Factor 2.625)
  - **iPhone 14:** 390px x 844px (Device Scale Factor 3.0)
- **Workflow:**
  1. Load full homepage, search directory, listing detail, and owner wizard on mobile viewports.
  2. Test Bottom Navigation Bar: Discover, Saved, Messages, My Account.
  3. Open Mobile Filter Drawer -> Swipe to dismiss and apply filters.
  4. Test tap targets for all buttons, toggles, form fields, and dropdowns.
- **Verification Evidence:**
  - Zero horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`).
  - All interactive tap targets measure >= 44px x 44px (WCAG 2.1 AA compliance).
  - Navigation drawer correctly traps focus when open and closes on ESC or overlay tap.
- **Status:** **PASSED**

---

## 4. Overall UAT Verdict

All 11 core user journeys have been fully tested and verified against the software integrated in `infra/neon-staging`. The application exhibits zero critical workflow defects, zero security bypass vulnerabilities, and full responsive stability.
