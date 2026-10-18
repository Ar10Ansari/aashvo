# Aashvo — User Journeys & Experience Architecture

**Platform:** Aashvo Web Platform  
**Target Region:** Delhi NCR  
**Status:** Approved  

---

## 1. Journey 1: Find a Place (Tenant / Flat Seeker)

```mermaid
graph TD
    A[Visitor Lands on Homepage] --> B[Hero Search: Locality & Budget]
    B --> C[Property Discovery Grid]
    C --> D[Apply Filters: Furnishing, Room Type, Amenities, Broker/Owner]
    D --> E[Click Property Card]
    E --> F[Full Property Detail View / Modal]
    F --> G[Inspect Financial Breakdown: Rent + Deposit + Maintenance]
    F --> H[Check Freshness Badge & House Rules]
    G & H --> I[Click 'Contact Provider' / 'Schedule Visit']
    I --> J{Authenticated?}
    J -- No --> K[Auth Modal: Quick Sign In / Up]
    J -- Yes --> L[Submit Inquiry / Direct WhatsApp or Call Access]
    K --> L
    L --> M[Inquiry Saved to User Dashboard & Landlord Notified]
```

### Detailed Steps:
1. **Discovery:**
   - User inputs locality (e.g. "DLF Phase 4", "Saket") and selects budget slider or presets.
   - Real-time instant filtering with animated card transitions.
2. **Evaluation:**
   - Listing card showcases primary image, monthly rent, deposit requirement, occupancy type (Private / Shared), verified status, and freshness date.
   - Deep-dive view reveals photo gallery, room specs, transparent breakdown (Rent, Maintenance, Electricity per unit, Deposit, Lock-in period), amenities, and exact location radius (with safety/transit proximity).
3. **Action:**
   - "Schedule Visit" or "Send Message" triggers interest request.
   - User receives immediate confirmation and tracking in their dashboard.

---

## 2. Journey 2: Find a Flatmate (Shared Living / Team-Up)

```mermaid
graph TD
    A[User Navigates to 'Find a Flatmate'] --> B[Filter by Location, Budget, Gender, Lifestyle]
    B --> C[Browse Flatmate Profile Cards]
    C --> D[View Detailed Compatibility Profile]
    D --> E[Review Living Habits: Sleep, Cleanliness, Food, Work]
    E --> F[Check Status: 'Has Room' vs 'Seeking Room Together']
    F --> G[Click 'Send Connect Request']
    G --> H{Authenticated?}
    H -- No --> I[Auth Modal]
    H -- Yes --> J[Compose Personal Note & Send Request]
    J --> K[Recipient receives notification to accept/decline]
```

### Compatibility Dimensions Tracked:
- **Food Habits:** Vegetarian, Eggetarian, Non-Veg, Jain.
- **Sleep & Work Routine:** Early Bird (6 AM - 10 PM), Night Owl (12 PM - 3 AM), Regular 9-to-5.
- **Guests & Social Policy:** Chill with weekend gatherings, Moderate, Quiet/Private space.
- **Cleanliness Expectation:** High / Daily rota, Moderate, Relaxed.
- **Smoking / Alcohol / Pets:** Non-smoker only, Pet friendly, Smoking outside only.

---

## 3. Journey 3: List a Property (Owner / Current Tenant / Broker)

```mermaid
graph TD
    A[Click 'List a Property'] --> B{Authenticated?}
    B -- No --> C[Sign Up / Login as Provider]
    B -- Yes --> D[Step 1: Property Type & Locality]
    C --> D
    D --> E[Step 2: Room Types & Financials: Rent, Deposit, Maintenance]
    E --> F[Step 3: Amenities & House Rules]
    F --> G[Step 4: Upload Verified Photos]
    G --> H[Step 5: Provider Identity Declaration: Owner vs Broker]
    H --> I[Submit for Moderation Review]
    I --> J[Listing placed in 'Pending Review' state]
    J --> K[Admin Moderation Panel: Approve or Request Changes]
    K -- Approved --> L[Live on Aashvo with 'Verified Fresh' Badge]
```

### Provider Verification & Trust Rules:
- If **Owner**: Zero brokerage allowed; requires contact verification.
- If **Tenant looking for Flatmate**: Must list current lease tenure and room type.
- If **Broker / Agent**: Explicit brokerage disclosure (e.g. "15 days brokerage" or "Fixed ₹5,000 service fee"). Unstated fees lead to permanent blacklisting.

---

## 4. Moderation & Safety Journey (Admin & Community)

- Every user can click **"Report Listing"** or **"Report User"** with specific reasons:
  - Bait and switch pricing
  - Inaccurate photos or already rented out
  - Harassment or inappropriate conduct
  - Unregistered broker posing as owner
- Reports feed into the Admin Moderation Console with one-click actions:
  - Auto-flag / Warn provider
  - Request updated photos
  - Pause listing immediately
  - Suspend fraudulent account
