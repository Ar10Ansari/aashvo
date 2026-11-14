# Aashvo — User Journeys & Experience Architecture

**Platform:** Aashvo Web Platform  
**Target Region:** Nationwide (India)  
**Version:** 2.0.0  
**Status:** Approved  

---

## 1. Journey 1: Find a Place (Renter / Tenant)

```mermaid
graph TD
    A[Visitor Lands on Homepage] --> B[Hero Search: City, Locality or Budget]
    B --> C[Public Discovery Grid: Flats, Rooms, Family Stays]
    C --> D[Apply Filters: Category, Room Type, Budget, Furnishing, Food Policy]
    D --> E[Click Property Card]
    E --> F[Full Detail View: Transparent Financial Outlay]
    F --> G[Inspect Itemized Rent, Deposit, Maintenance & Electricity]
    F --> H[Check Freshness Badge & House Rules]
    G & H --> I[Click 'Schedule Visit' / 'Contact Host']
    I --> J{Authenticated?}
    J -- No --> K[Auth Modal: Google OAuth or Email/Password]
    K --> L{Email Verified?}
    L -- No --> M[Verification Link Sent: Click to Verify]
    M --> N[Email Confirmed]
    L -- Yes --> N
    J -- Yes --> N
    N --> O{Phone Verified?}
    O -- No --> P[Quick SMS OTP Verification Modal]
    P --> Q[Enter 6-Digit OTP]
    Q --> R[Phone Verified]
    O -- Yes --> R
    R --> S[Submit Inquiry with Move-in Date & Message]
    S --> T[Inquiry Saved to User Dashboard; Host Notified]
```

### Key Experience Tenets:
1. **Frictionless Anonymous Discovery:** Users can browse listings across India, run multi-city filters, and view total cost calculations without registering.
2. **Just-In-Time Friction:** Authentication is requested only when taking a high-intent action (contacting a host).
3. **Contextual Phone Verification:** The user is prompted for phone verification only when required by the host's policy.

---

## 2. Journey 2: Find a Flatmate (Shared Living / Team-Up)

```mermaid
graph TD
    A[User Selects 'Find a Flatmate' Tab] --> B[Filter by City, Budget, Gender, Lifestyle]
    B --> C[Browse Flatmate Cards]
    C --> D[View Compatibility Profile]
    D --> E[Inspect Living Habits: Sleep, Cleanliness, Food, Work Schedule]
    E --> F[Check Status: 'Has Room Available' vs 'Seeking Room Together']
    F --> G[Click 'Send Connect Request']
    G --> H{Authenticated & Email Verified?}
    H -- No --> I[Quick Sign In / Email Verification]
    H -- Yes --> J[Compose Personal Note & Move-in Timing]
    I --> J
    J --> K[Recipient receives notification; phone number masked until accepted]
```

### Compatibility Dimensions:
- **Food Habits:** Vegetarian, Eggetarian, Non-Vegetarian, Vegan.
- **Sleep & Work Routine:** Early Bird (6 AM – 10 PM), Night Owl (12 PM – 3 AM), Flexible.
- **Cleanliness Expectation:** Spotless (daily routine), Moderate, Relaxed.
- **Social & Guest Policy:** Social / Weekend gatherings, Moderate, Private & Quiet.
- **Smoking & Pets:** Non-smoker only, Pet friendly, Smoking outside only.

---

## 3. Journey 3: List a Property (Flats & Rooms)

```mermaid
graph TD
    A[Click 'List a Property'] --> B{Authenticated?}
    B -- No --> C[Sign In with Google or Email]
    B -- Yes --> D{Phone Verified?}
    C --> D
    D -- No --> E[SMS OTP Verification Modal]
    E --> F[Phone Confirmed]
    D -- Yes --> F
    F --> G[Step 1: City, Locality, Landmark Address & Device Location Helper]
    G --> H[Step 2: Room Specs & Transparent Financials: Rent, Deposit, Maintenance]
    H --> I[Step 3: Amenities, Furnishing & House Rules]
    I --> J[Step 4: Upload Verified Photos with Room Tags]
    J --> K[Step 5: Provider Identity: Owner vs Broker]
    K --> L{Is Broker / Manager?}
    L -- Yes --> M[Mandatory Brokerage Disclosure Fee]
    L -- No --> N[Verified Owner ₹0 Brokerage Declaration]
    M & N --> O[Submit for Editorial Review: Enters Pending Review State]
```

---

## 4. Journey 4: List a Family Stay (Resident Family Hosts)

```mermaid
graph TD
    A[Host Selects 'List a Family Stay'] --> B{Authenticated & Phone Verified?}
    B -- No --> C[Auth & SMS OTP Verification]
    B -- Yes --> D[Step 1: Location & Neighborhood Details]
    C --> D
    D --> E[Step 2: Co-Living Declaration]
    E --> F{Does Host Family Live in the Same Home?}
    F -- No --> G[REJECTED: Family Stays require resident family host]
    F -- Yes --> H[Confirm Family Co-Living Declaration]
    H --> I[Step 3: Meal Policy Selection]
    I --> J[Choose: Included in Rent / Optional Extra Fee / Self-Catering None]
    J --> K[Step 4: Financials & House Guidelines]
    K --> L[Step 5: Photo Upload & Family Profile Bio]
    L --> M[Submit for Priority Trust & Safety Review]
```

### Safety & Eligibility Guardrails:
1. **Direct Resident Owner Only:** Commercial brokers, real estate agents, and absentee landlords cannot select or submit Family Stays.
2. **Meal Transparency:** Renter knows upfront whether breakfast/dinner is home-cooked and included or costs an extra monthly fee.
3. **Address Masking:** Neighborhood and safety landmarks are highlighted publicly; flat door numbers are withheld until visit approval.

---

## 5. Journey 5: Authentication & Account Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant AuthService as Supabase Auth
    participant DB as PostgreSQL (RLS)

    alt Google OAuth Flow
        User->>Browser: Click 'Continue with Google'
        Browser->>AuthService: Initiate PKCE OAuth (state, code_challenge)
        AuthService->>User: Google Consent Screen
        User->>AuthService: Approves Consent
        AuthService->>Browser: Redirects to /auth/callback (code, state)
        Browser->>AuthService: Exchange code for JWT session
        AuthService->>DB: Trigger: Sync to public.profiles (email_verified=true)
    else Email/Password Flow
        User->>Browser: Enter Email, Password, Name
        Browser->>AuthService: signUp(email, password)
        AuthService->>DB: Create user (email_confirmed_at=null)
        AuthService-->>User: Dispatch Verification Email
        User->>Browser: Clicks link in email
        Browser->>AuthService: verifyOtp(token_hash, type='email')
        AuthService->>DB: Update email_confirmed_at=now()
    end
```

---

## 6. Journey 6: Moderation & Trust/Safety (Admin & Community)

- **Community Flagging:** Every user can report listings or profiles for:
  - Bait-and-switch pricing or hidden charges
  - Non-resident landlord falsely posing as Family Stay
  - Misleading photos or property already rented
  - Inappropriate behavior or harassment in flatmate inquiries
- **Admin Moderation Console:**
  - One-click Approve, Request Changes, or Reject.
  - Ban bad actors and revoke phone/email verification flags.
  - Audit Family Stay declarations against community reports.
  - Comply with Indian DPDP Act 2023 for verified account deletion requests.
