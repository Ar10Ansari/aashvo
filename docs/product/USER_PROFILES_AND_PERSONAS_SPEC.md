# AASHVO Product Specification — User Profiles, Onboarding & Multi-Persona Personas

**Product:** AASHVO — Find your place. Find your people.  
**Target Audience:** College students, working professionals, property owners, and family stay hosts.  
**Version:** 1.0.0

---

## 1. Problem Statement & User Value

Modern urban accommodation seekers frequently occupy multiple distinct marketplace roles:
1. A college graduate starting work in a new city needs a compatible flatmate (`flatmate_seeker`).
2. An existing tenant with an empty second bedroom in a 2BHK wants to sublease to a verified roommate (`has_room` co-living host).
3. A property owner wants to manage listings while occasionally seeking temporary accommodations (`property_owner`).

Forcing users to register multiple accounts or log out to switch contexts causes high drop-off and fragmented communications. AASHVO solves this through **Multi-Persona Profiles** under one unified account with atomic role switching.

---

## 2. Progressive 5-Step Onboarding Flow

The onboarding modal (`OnboardingModal.tsx`) provides a progressive stepper with auto-saving, draft resilience, and full keyboard/screen-reader accessibility:

```
[ Step 1: Basic Info ] -> [ Step 2: Location ] -> [ Step 3: Housing ] -> [ Step 4: Lifestyle ] -> [ Step 5: Review & Publish ]
```

### Step 1: Basic Information
- Full Name (Mandatory)
- Age (Mandatory, $\ge 18$ validation)
- Gender Preference
- Profession / Occupation (Student, Working Professional, Freelancer, Other)
- College or Workplace (Optional verification field)
- About Me / Bio (Mandatory, $\ge 10$ characters)
- Languages Spoken (Multi-chip select: English, Hindi, Punjabi, Bengali, Marathi, Tamil, etc.)
- Personal Interests & Hobbies (Tech, Reading, Yoga, Music, Gaming, Fitness, Specialty Coffee, etc.)

### Step 2: Location Preferences
- Country (Default: India)
- State / Province
- Primary City (Gurugram, Bengaluru, Delhi, Mumbai, Pune, Hyderabad, Noida, etc.)
- Target Localities (Multi-select tags)

### Step 3: Housing Requirements
- Budget Range (Minimum & Maximum INR/month)
- Target Move-in Date & Scheduling Flexibility toggle
- Preferred Room Type (Private Room, Shared Room, Entire Flat)
- Furnishing Preference (Fully Furnished, Semi-Furnished, Unfurnished)
- Co-Living Intention:
  - `has_room`: User currently holds a lease with an available room.
  - `needs_room`: User is searching for an available room in an existing flat.
  - `team_up`: User is looking to jointly search and lease a flat with roommates.

### Step 4: Lifestyle & Compatibility
- Food Habits: Vegetarian, Eggetarian, Non-Vegetarian, Vegan, Any
- Sleep Routine: Early Bird, Night Owl, Flexible
- Cleanliness Standards: Spotless, Moderate, Relaxed
- Smoking & Drinking Tolerance
- Pet Friendly (Yes / No)
- Social Lifestyle: Quiet, Moderate, Outgoing
- Remote Work Habits: Office-first, Hybrid, Remote
- Noise Tolerance: Low, Moderate, High

### Step 5: Review & Publish
- Live completion score widget (0–100%).
- Full summary of entered preferences.
- Two explicit completion paths:
  1. **"Save as Draft"**: Retains all progress; profile remains private and hidden from Connect.
  2. **"Publish Profile"**: Immediately activates profile, triggers Connect candidate discovery, and enters the active matching pool.

---

## 3. Navbar Profile & Persona Switcher

Located in the top navigation bar (`Navbar.tsx`):
- Desktop: Top-right user avatar dropdown displays:
  - User's primary account role (`RENTER`, `OWNER`, `BROKER`).
  - Active marketplace persona with status badge (`ACTIVE`, `DRAFT`, `PAUSED`).
  - One-click persona switcher: switch between `Flatmate Seeker` and `Property Owner` without page reloads.
  - Direct access to **"My Profile"** and **"Onboarding Flow"**.
- Mobile: Integrated into slide-out navigation menu.

---

## 4. Connect Integration & Match Safety

1. **Gating Rules:**
   - Unauthenticated visitors see a prompt to sign in.
   - Authenticated users without a flatmate profile see an invitation to create one.
   - Users with draft profiles see a completion checklist and publish button.
   - Published profiles enter the live 5-dimension matching deck.
2. **Safety & Unmatching:**
   - Mutual matches enable real-time co-living chat.
   - Either participant can unmatch at any time via the chat thread menu (`ConnectChatThread.tsx`), immediately closing the conversation and deactivating the match.
   - Reporting and blocking controls are accessible from every card and thread.
