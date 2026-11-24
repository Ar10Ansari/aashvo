# AASHVO CTO — Stakeholder User Acceptance Testing (UAT) Plan

**Author:** AASHVO CTO & Head of Product Quality  
**Date:** November 24, 2026  
**Target Environment:** AASHVO Staging Environment  
**Staging Frontend URL:** `https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app` (or custom staging domain)  
**Status:** **APPROVED FOR STAKEHOLDER DISTRIBUTION**

---

## 1. Objectives & Scope of UAT

The purpose of this UAT plan is to provide clear, step-by-step test scripts for internal business stakeholders, founders, product managers, and early design partners to validate end-to-end marketplace workflows across AASHVO's primary personas:
1. **The Accommodation Seeker:** Looking for verified flatmates, family stays, or entire flats.
2. **The Direct Property Owner:** Publishing zero-brokerage listings with transparent cost breakdowns.
3. **The Resident Family Host:** Offering rooms in their home with homecooked meals.
4. **The Flatmate Looking for a Room:** Creating a lifestyle profile and discovering compatible flatmates.
5. **The Marketplace Moderator / Admin:** Reviewing pending listings, adjudicating safety reports, and managing support tickets.

---

## 2. Test Environment Setup & Access

- **Web Application URL:** `https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app`
- **Automation Bypass URL:** `https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=psAYTdgheJ73qc6oV6AVSfd1DzAaokDK`
- **Supported Browsers:** Google Chrome (v120+), Apple Safari (iOS 16+ / macOS 14+), Mozilla Firefox (v120+).
- **Supported Mobile Viewports:** Apple iPhone (Safari Mobile) & Android (Chrome Mobile).

---

## 3. Personas & Test Credentials Matrix

| Persona | Role | Seed Email | Description |
| :--- | :--- | :--- | :--- |
| **P1: Seeker** | `seeker` | `seeker.uat@aashvo.in` | Professional searching for a room in Bengaluru |
| **P2: Owner** | `owner` | `owner.uat@aashvo.in` | Property owner listing a 2BHK in Indiranagar |
| **P3: Family Host** | `owner` | `familyhost.uat@aashvo.in` | Resident family host offering a room with vegetarian meals |
| **P4: Flatmate** | `seeker` | `flatmate.uat@aashvo.in` | Early-career designer seeking compatible flatmate |
| **P5: Moderator** | `admin` | `admin.uat@aashvo.in` | Operations moderator reviewing listings and tickets |

*(Note: Test accounts can be logged in via standard email/password or registered freshly during test execution.)*

---

## 4. Step-by-Step Test Scenarios

### Scenario 1: User Registration, Login & Session Survival
- **Objective:** Verify user registration, email validation, JWT issuance, and persistent session recovery after page refresh.
- **Steps:**
  1. Navigate to Homepage and click **"Register"** on top-right navbar.
  2. Enter full name (`UAT Test User`), email (`uat.user.<timestamp>@aashvo.in`), and a strong password (minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character).
  3. Click **"Create Account"**. Verify success confirmation.
  4. Log out using the user menu.
  5. Click **"Sign In"**, enter registered credentials, and submit.
  6. Refresh the browser (`F5` or `Ctrl+R`).
- **Expected Result:** User session survives page refresh without kicking user back to unauthenticated state. Navbar renders user display name.

---

### Scenario 2: Profile Onboarding & Lifestyle Dimension Matching
- **Objective:** Verify multi-step lifestyle profiling for roommate matching.
- **Steps:**
  1. Open user menu and click **"My Profile"** -> **"Edit Profile"** or trigger **"Onboarding"**.
  2. Set living preferences: Diet (`Vegetarian` / `Non-Vegetarian`), Sleep Schedule (`Early Bird` / `Night Owl`), Work Routine (`Work from Home` / `Office`), and Pet Friendliness.
  3. Set budget range (`₹15,000 - ₹25,000`) and target localities (`Koramangala, Bengaluru`).
  4. Save profile changes.
- **Expected Result:** Profile completion score updates to >= 80%. Compatibility scores on flatmate cards reflect matching preferences.

---

### Scenario 3: Property Listing Wizard & Transparent Cost Breakdown
- **Objective:** Verify 4-step listing wizard, cost itemization, and pending moderation state.
- **Steps:**
  1. Sign in as Owner (`owner.uat@aashvo.in`).
  2. Click **"List Space"** in the top navigation bar.
  3. **Step 1 (Category & Location):** Select `Entire Flat`, City: `Bengaluru`, Locality: `Indiranagar 100ft Rd`. Click Continue.
  4. **Step 2 (Financial Breakdown):** Enter Monthly Rent: `₹40,000`, Security Deposit: `₹80,000`, Society Maintenance: `₹3,000`, Electricity: `₹8/unit`. Ensure Brokerage is displayed as `₹0 (Zero Brokerage)`. Click Continue.
  5. **Step 3 (Amenities):** Check `Wifi High-Speed`, `Air Conditioning`, `Power Backup`. Select Gender: `Any / All Welcomed`. Click Continue.
  6. **Step 4 (Publish):** Click **"Publish Verified Listing"**.
- **Expected Result:** Wizard closes cleanly. Listing appears in owner's dashboard under "Pending Review".

---

### Scenario 4: Marketplace Discovery, Search & Category Filtering
- **Objective:** Verify multi-category tabs, search query filtering, and locality pills.
- **Steps:**
  1. Scroll to the Discovery section on the homepage.
  2. Click tab **"Flatmates"** -> verify flatmate profiles render with lifestyle compatibility badges.
  3. Click tab **"Family Stays"** -> verify listings display meal plan badges (`Meals Included in Rent` / `Meals Extra (Optional)`).
  4. Click tab **"Entire Flats"** -> verify direct-owner independent apartments.
  5. Use Locality dropdown to filter by `Indiranagar, Bengaluru`.
  6. Type search query (e.g. `Wifi`) in search bar and click Search.
- **Expected Result:** Listing grid instantly updates to show only matching properties in the selected category and locality.

---

### Scenario 5: Saved Listings & Shortlist Management
- **Objective:** Verify bookmarking, shortlisting, and modal management.
- **Steps:**
  1. On any property card, click the **Bookmark / Heart** icon.
  2. Verify heart icon fills and bookmark count increments.
  3. Click **"Saved"** in the top navbar.
  4. Verify modal opens showing the saved listing under "Properties (1)".
  5. Click the remove/unsave button in the modal.
- **Expected Result:** Listing is removed from shortlists and badge updates to `(0)`.

---

### Scenario 6: Seeker-to-Host Inquiry Submission & Host Notification
- **Objective:** Verify direct inquiry modal, host notification generation, and database persistence.
- **Steps:**
  1. Sign in as Seeker (`seeker.uat@aashvo.in`).
  2. Click on a property card to open the Property Detail dialog.
  3. Click **"Contact Host"** / **"Send Inquiry"**.
  4. Select Move-in Date, Duration (`11 months`), and enter message: `"Hello, I am interested in viewing this space this weekend."`.
  5. Submit the inquiry.
  6. Log out and sign in as Host (`owner.uat@aashvo.in`).
  7. Check the bell icon in the top navbar.
- **Expected Result:** Host receives an unread notification: `"New inquiry received for [Property Title]"`. Inquiry is listed under Host's inquiries ledger.

---

### Scenario 7: In-Person Visit Scheduling & Confirmation
- **Objective:** Verify physical inspection scheduling, host confirmation, and rescheduling.
- **Steps:**
  1. In the property detail view, click **"Schedule Visit"**.
  2. Select upcoming date and time slot (e.g. `Saturday 11:00 AM`). Submit request.
  3. Sign in as Host -> navigate to Visits dashboard.
  4. Click **"Confirm Visit"**.
- **Expected Result:** Status transitions from `pending` to `confirmed`. Both parties view confirmed walkthrough details.

---

### Scenario 8: Family Stays with Home-Cooked Meals
- **Objective:** Verify resident family stay constraints and meal fee transparency.
- **Steps:**
  1. Filter Discovery by **"Family Stays"**.
  2. Verify every listing displays badge `Resident Host on Premises`.
  3. Verify meal fee breakdown:
     - If meals included: Monthly rent reflects food with `₹0 extra food charge`.
     - If optional: Optional food fee is itemized separately (e.g. `+ ₹3,500/month`).
- **Expected Result:** Clear meal disclosure prevents double-charging and hidden food expenses.

---

### Scenario 9: Rent Split Calculator
- **Objective:** Verify mathematical calculations for fair roommate rent sharing.
- **Steps:**
  1. Click **"Rent Split"** in the navigation bar.
  2. Enter Total Rent: `₹45,000`.
  3. Define 3 rooms:
     - Room 1: Master bedroom with attached bath & balcony (Size: Large).
     - Room 2: Standard bedroom with attached bath (Size: Medium).
     - Room 3: Small bedroom with common bath (Size: Small).
  4. Click **"Calculate Fair Split"**.
- **Expected Result:** Mathematical breakdown allocates higher share to Room 1 and lower share to Room 3, totaling exactly ₹45,000 with zero remainder error.

---

### Scenario 10: Mobile Web Usability & Drawer Navigation
- **Objective:** Verify mobile phone responsiveness on smartphone viewports.
- **Steps:**
  1. Open Chrome DevTools in device emulation mode (iPhone 14 / Pixel 7) or open on a physical smartphone.
  2. Verify brand header and hamburger button are visible.
  3. Verify no horizontal scrollbar or content clipping occurs.
  4. Tap hamburger button -> verify slide-out drawer opens smoothly.
  5. Tap a navigation category inside drawer -> verify drawer closes and page scrolls to discovery section.
- **Expected Result:** 100% compliant touch interactions (>= 44x44px) and zero horizontal overflow.

---

### Scenario 11: Admin Moderation Quality Gates
- **Objective:** Verify administrator review queue and listing approval.
- **Steps:**
  1. Sign in as Admin (`admin.uat@aashvo.in`).
  2. Click user menu -> **"Admin Moderation"**.
  3. Locate the listing created in Scenario 3 under "Pending Review".
  4. Review itemized financials, photos, and house rules.
  5. Click **"Approve Listing"**.
- **Expected Result:** Listing status transitions from `pending_review` to `active`. Listing becomes visible in the public marketplace discovery grid.

---

## 5. UAT Sign-Off & Feedback Collection

Stakeholders should record test execution status, browser version, and observations in the UAT Feedback Sheet or submit findings to the release management team.
