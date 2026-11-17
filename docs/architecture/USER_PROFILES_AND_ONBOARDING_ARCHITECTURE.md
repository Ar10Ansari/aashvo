# AASHVO Architecture Specification — User Profiles, Multi-Persona Management & Connect Matching

**Status:** APPROVED FOR PRODUCTION  
**Architect:** AASHVO CTO & Engineering Team  
**Date:** November 2026

---

## 1. Architectural Principles

### 1.1 Separation of Account Roles vs. Marketplace Personas
A critical design requirement is the separation of **Account-Level Security Roles** from **Marketplace Profile Personas**:
- **Account Roles (`UserRole`):** `renter`, `owner`, `broker`, `admin`. These dictate platform RBAC, billing, legal liabilities, and administrative privilege boundaries.
- **Marketplace Personas (`MarketplaceProfileType`):** `flatmate_seeker`, `property_owner`, `family_stay_host`, `family_stay_seeker`. These represent contextual intentions on the marketplace.
- **Multi-Persona Capability:** A single registered account may operate multiple marketplace personas simultaneously (e.g. searching for a flatmate in one city while listing an apartment in another) without re-authenticating or maintaining duplicate email credentials.

```
+-----------------------------------------------------------+
|                        User Account                       |
|   (id, email, passwordHash, role: renter/owner/broker)    |
+-----------------------------+-----------------------------+
                              | 1:N
                              v
+-----------------------------------------------------------+
|                    Marketplace Profiles                   |
+-----------------------------+-----------------------------+
| • flatmate_seeker           | (active, completion: 90%)   |
| • property_owner            | (draft,  completion: 40%)   |
| • family_stay_host          | (paused, completion: 100%)  |
+-----------------------------------------------------------+
```

---

## 2. Database Schema Design (Prisma & PostgreSQL 16)

### 2.1 Prisma Migration: `20261115030000_marketplace_profiles_and_onboarding`

#### `MarketplaceProfile` Model
```prisma
enum MarketplaceProfileType {
  flatmate_seeker
  property_owner
  family_stay_host
  family_stay_seeker
}

enum MarketplaceProfileStatus {
  active
  paused
  draft
}

model MarketplaceProfile {
  id                String                   @id @default(cuid())
  userId            String                   @map("user_id")
  profileType       MarketplaceProfileType   @map("profile_type")
  status            MarketplaceProfileStatus @default(draft)
  isCurrentActive   Boolean                  @default(false) @map("is_current_active")
  displayName       String?                  @map("display_name")
  completionPercent Int                      @default(0) @map("completion_percent")
  metadata          Json                     @default("{}")
  createdAt         DateTime                 @default(now()) @map("created_at")
  updatedAt         DateTime                 @updatedAt @map("updated_at")

  user              Profile                  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, profileType])
  @@index([userId, isCurrentActive])
  @@map("marketplace_profiles")
}
```

#### Extended `FlatmateProfile` Schema
`FlatmateProfile` was extended with normalized fields supporting the 5-step progressive onboarding:
- `budgetMin`: Minimum rent budget in INR.
- `moveInDate`: Target occupancy date.
- `moveInFlexible`: Boolean flag for scheduling tolerance.
- `roomType`: Private room, shared room, or entire flat.
- `furnishing`: Fully furnished, semi-furnished, or unfurnished.
- `drinking`: Alcohol consumption habit preference.
- `languages`: String array of spoken languages.
- `collegeOrWorkplace`: Verified educational institution or employer.
- `socialLifestyle`: Social preference (quiet, moderate, outgoing).
- `wfhHabits`: Remote work frequency (in-office, hybrid, full-remote).
- `noiseTolerance`: Noise sensitivity level.
- `isPublished`: Discovery visibility toggle in Aashvo Connect.
- `state`, `country`: Geographical administrative divisions.

---

## 3. Atomic Multi-Persona Switching Invariant

When switching active personas (`/api/v1/profiles/marketplace/switch`), the backend enforces an atomic transaction:
1. Validates that the requested persona exists under the authenticated user's ID.
2. Updates all persona records for `userId` to `isCurrentActive = false`.
3. Sets the target persona record to `isCurrentActive = true`.
4. Returns the updated persona view in a single round-trip.

This guarantees that exactly zero or one persona is marked active at any point in time.

---

## 4. Profile Completion Scoring Model

The profile completion score is deterministically calculated across 5 categories totaling 100 points:

| Category | Max Points | Required Criteria |
| :--- | :---: | :--- |
| **Basic Info** | 25 | Full Name (5), Age $\ge 18$ (5), Profession (5), Bio $\ge 10$ chars (10) |
| **Location** | 20 | City (10), Target Localities (10) |
| **Housing** | 20 | Budget Max $> 0$ (10), Room Type / Intention (10) |
| **Lifestyle** | 20 | Food Habit (5), Sleep Routine (5), Cleanliness (5), Smoking Habit (5) |
| **Photo** | 15 | Profile Avatar URL (15) |

Profiles are flagged `isComplete: true` when all required fields are present ($\ge 80\%$).

---

## 5. Aashvo Connect Integration & Discovery Invariants

### 5.1 Strict Zero Fake Profile Guarantee
Under no circumstances are synthetic, fabricated, or seed mock profiles returned to authenticated users or represented as active platform members.
- When an authenticated user has no published flatmate profile: Connect displays an onboarding setup prompt ("Create Your Flatmate Profile").
- When an authenticated user's profile is in draft: Connect displays a publish prompt with completion percentage and missing fields ("Publish Profile to Start Matching").
- When no compatible candidates exist in the caller's radius: Connect displays "You're all caught up!" with undo and filter refresh options.

### 5.2 5-Dimension Compatibility Algorithm
Matches are computed using the verified deterministic model:
- **Food Habits:** 25 points.
- **Sleep Routines:** 20 points.
- **Cleanliness:** 20 points.
- **Budget Overlap:** 20 points.
- **Shared Interests:** 15 points.
- **Total:** 100 points.

### 5.3 Mutual Unmatch Transaction
Unmatching (`POST /api/v1/connect/matches/:id/unmatch`) transitions the match record status to `unmatched`. Subsequent messaging attempts return `400 Bad Request` to preserve safety boundaries.
