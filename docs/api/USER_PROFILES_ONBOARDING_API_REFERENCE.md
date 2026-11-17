# AASHVO API Reference — Marketplace Profiles, Progressive Onboarding & Connect Matching

**Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Authentication:** Cookie-based (`aashvo_access_token`) or Bearer Header (`Authorization: Bearer <token>`)

---

## Overview

This document specifies the REST API endpoints supporting:
1. **Multi-Persona Marketplace Profiles** under a single account.
2. **Progressive 5-Step Onboarding** and dynamic profile completion calculation.
3. **Aashvo Connect Extensions** (Incoming Likes, Outgoing Likes, and Mutual Unmatching).

---

## 1. Marketplace Profiles (`/api/v1/profiles/marketplace`)

### 1.1 Get My Marketplace Profiles
`GET /api/v1/profiles/marketplace`

Retrieves all persona profiles associated with the authenticated user. Automatically bootstraps a default `flatmate_seeker` persona if none exists.

**Response (200 OK):**
```json
[
  {
    "id": "mp_cly1234567890",
    "userId": "usr_9876543210",
    "profileType": "flatmate_seeker",
    "status": "active",
    "isCurrentActive": true,
    "displayName": "Aarav Sharma",
    "completionPercent": 85,
    "metadata": {},
    "createdAt": "2026-11-15T15:00:00.000Z",
    "updatedAt": "2026-11-15T15:30:00.000Z"
  }
]
```

---

### 1.2 Create a Secondary Persona Profile
`POST /api/v1/profiles/marketplace`

Creates a new marketplace persona under the caller's account.

**Request Body:**
```json
{
  "profileType": "property_owner",
  "displayName": "Aarav (Property Owner)",
  "metadata": {}
}
```

**Validation:**
- `profileType`: Required enum (`flatmate_seeker`, `property_owner`, `family_stay_host`, `family_stay_seeker`).
- Rejects duplicate profile types under the same account with `409 Conflict`.

**Response (201 Created):**
```json
{
  "id": "mp_cly9876543210",
  "userId": "usr_9876543210",
  "profileType": "property_owner",
  "status": "active",
  "isCurrentActive": false,
  "displayName": "Aarav (Property Owner)",
  "completionPercent": 0,
  "metadata": {},
  "createdAt": "2026-11-15T15:35:00.000Z",
  "updatedAt": "2026-11-15T15:35:00.000Z"
}
```

---

### 1.3 Switch Active Persona Profile
`POST /api/v1/profiles/marketplace/switch`

Atomically sets the target persona profile as the single active persona for the user.

**Request Body:**
```json
{
  "profileType": "property_owner"
}
```

**Response (200 OK):**
```json
{
  "id": "mp_cly9876543210",
  "userId": "usr_9876543210",
  "profileType": "property_owner",
  "status": "active",
  "isCurrentActive": true,
  "displayName": "Aarav (Property Owner)",
  "completionPercent": 0,
  "metadata": {},
  "createdAt": "2026-11-15T15:35:00.000Z",
  "updatedAt": "2026-11-15T15:40:00.000Z"
}
```

---

### 1.4 Update Persona Profile
`PATCH /api/v1/profiles/marketplace/:type`

Updates metadata, display name, or status (`active`, `paused`, `draft`) for a specific persona.

**Request Body:**
```json
{
  "displayName": "Aarav S. (Owner)",
  "status": "active"
}
```

---

## 2. Progressive Onboarding & Profile Completion

### 2.1 Save Onboarding Information (Draft or Publish)
`POST /api/v1/profiles/onboarding`

Saves progressive multi-step onboarding data. When `publishImmediately` is `false`, the profile is saved as `draft` and excluded from public Connect discovery. When `true`, it is published as `active`.

**Request Body:**
```json
{
  "fullName": "Aarav Sharma",
  "avatarUrl": "https://example.com/avatar.jpg",
  "age": 24,
  "gender": "male",
  "profession": "Software Engineer",
  "collegeOrWorkplace": "IIT Delhi / Tech Corp",
  "bio": "Quiet, friendly techie looking for a clean flatmate in DLF Phase 4.",
  "languages": ["English", "Hindi"],
  "interests": ["Design", "Specialty Coffee", "Tech"],
  "city": "Gurugram",
  "targetLocalities": ["DLF Phase 4", "Galleria"],
  "budgetMin": 15000,
  "budgetMax": 25000,
  "moveInDate": "2026-12-01",
  "moveInFlexible": true,
  "roomType": "private_room",
  "furnishing": "fully_furnished",
  "hasRoom": false,
  "intentions": ["needs_room", "team_up"],
  "foodHabit": "vegetarian",
  "sleepRoutine": "early_bird",
  "cleanliness": "spotless",
  "smoking": "no",
  "drinking": "socially",
  "petFriendly": true,
  "socialLifestyle": "moderate",
  "wfhHabits": "hybrid",
  "noiseTolerance": "moderate",
  "publishImmediately": true
}
```

**Validation:**
- `age`: Must be $\ge 18$.
- `budgetMax`: Must be $> 0$.
- `city`: Required string.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile published successfully.",
  "profile": { ... },
  "completion": {
    "totalPercent": 95,
    "basicInfoPercent": 25,
    "locationPercent": 20,
    "housingPercent": 20,
    "lifestylePercent": 20,
    "photoPercent": 10,
    "missingFields": [],
    "isComplete": true,
    "isPublished": true
  }
}
```

---

### 2.2 Get Profile Completion Breakdown
`GET /api/v1/profiles/completion`

Computes the caller's live profile completion score across 5 dimension categories.

**Response (200 OK):**
```json
{
  "totalPercent": 85,
  "basicInfoPercent": 25,
  "locationPercent": 20,
  "housingPercent": 20,
  "lifestylePercent": 20,
  "photoPercent": 0,
  "missingFields": ["Profile Photo"],
  "isComplete": true,
  "isPublished": true
}
```

---

### 2.3 Publish Flatmate Profile
`POST /api/v1/profiles/publish`

Activates the user's flatmate profile and marks it discoverable in Aashvo Connect.

---

### 2.4 Pause Flatmate Profile
`POST /api/v1/profiles/pause`

Temporarily hides the user's flatmate profile from Connect discovery without losing onboarding progress.

---

## 3. Aashvo Connect Extensions

### 3.1 Get Incoming Likes
`GET /api/v1/connect/likes/received`

Retrieves pending candidate swipes where another member expressed interest in teaming up with the caller.

---

### 3.2 Get Outgoing Likes
`GET /api/v1/connect/likes/sent`

Retrieves candidate swipes where the caller previously expressed interest in another member.

---

### 3.3 Unmatch Active Match
`POST /api/v1/connect/matches/:id/unmatch`

Deactivates an active mutual match, sets its status to `unmatched`, and archives the direct messaging thread. Subsequent message attempts return `400 Bad Request`.

**Request Body:**
```json
{
  "reason": "Found alternative accommodation"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully unmatched."
}
```
