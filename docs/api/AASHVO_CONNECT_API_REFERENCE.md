# AASHVO CONNECT — API REFERENCE
## REST Endpoints, DTO Schemas & Verification Examples

**API Base URL:** `/api/v1/connect`  
**Authentication:** RFC 6750 Bearer JWT in `Authorization: Bearer <access_jwt>`  
**Canonical Error Envelope:**
```json
{
  "statusCode": 403,
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not a participant in this mutual match",
    "requestId": "req_8f19da3b21",
    "timestamp": "2026-11-15T00:00:00.000Z"
  }
}
```

---

## 1. Candidate Discovery

### `GET /api/v1/connect/candidates`
Returns candidate flatmates available for the swipe deck, filtered by city/locality and sorted by deterministic compatibility. Candidates previously swiped, blocked, underage, or with `discoveryHidden: true` are excluded.

#### Query Parameters:
- `city` (string, optional): Target city name (e.g. `Gurugram`, `Delhi`).
- `locality` (string, optional): Specific locality substring.
- `intention` (string, optional): Filter by flatmate intention (`has_room` | `needs_room` | `team_up`).
- `limit` (integer, optional, default: 20, max: 50): Page size.

#### Response (200 OK):
```json
[
  {
    "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "profileId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "displayName": "Meera Sengupta",
    "age": 23,
    "gender": "female",
    "occupation": "Postgrad Law Student @ DU",
    "city": "Delhi",
    "targetLocalities": ["Hauz Khas", "Saket"],
    "budgetMax": 18000,
    "foodHabit": "vegetarian",
    "sleepRoutine": "early_bird",
    "cleanliness": "spotless",
    "petFriendly": true,
    "smoking": "No",
    "bio": "Early riser who loves yoga and clean kitchen countertops.",
    "interests": ["Yoga", "Houseplants", "Baking"],
    "avatarUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9",
    "verified": true,
    "hasRoom": false,
    "intentions": ["needs_room", "team_up"],
    "roomDetails": null,
    "compatibility": {
      "overallScore": 92,
      "foodScore": 25,
      "sleepScore": 20,
      "cleanlinessScore": 20,
      "budgetScore": 17,
      "interestsScore": 10,
      "sharedInterests": ["Yoga", "Baking"]
    }
  }
]
```

---

## 2. Swiping & Matching

### `POST /api/v1/connect/swipe`
Registers an interest (`like`) or pass (`pass`) on a candidate. Creates a mutual match if reciprocal interest exists.

#### Request Body:
```json
{
  "targetUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "action": "like"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "action": "like",
  "matched": true,
  "match": {
    "id": "e89b3f21-8172-4011-8f92-5b91a03e1345",
    "status": "active",
    "matchedAt": "2026-11-15T00:30:00.000Z",
    "lastInteractionAt": "2026-11-15T00:30:00.000Z",
    "partner": {
      "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "displayName": "Meera Sengupta",
      "avatarUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9",
      "city": "Delhi",
      "locality": "Hauz Khas",
      "occupation": "Postgrad Law Student @ DU",
      "budgetMax": 18000,
      "verified": true,
      "compatibilityScore": 92
    }
  }
}
```

### `POST /api/v1/connect/pass`
Convenience endpoint to register a `pass` action.

#### Request Body:
```json
{
  "targetUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "action": "pass",
  "matched": false
}
```

### `POST /api/v1/connect/undo`
Reverts the caller's most recent swipe action. If the reverted action created a mutual match, the match is dissolved (`unmatched`).

#### Response (200 OK):
```json
{
  "success": true,
  "undoneTargetUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "previousAction": "like",
  "matchUndone": true,
  "message": "Previous swipe action undone successfully."
}
```

---

## 3. Matches & Peer Messaging

### `GET /api/v1/connect/matches`
Lists all active mutual matches where the caller is either `user1` or `user2`.

#### Response (200 OK):
```json
[
  {
    "id": "e89b3f21-8172-4011-8f92-5b91a03e1345",
    "status": "active",
    "matchedAt": "2026-11-15T00:30:00.000Z",
    "lastInteractionAt": "2026-11-15T00:35:00.000Z",
    "partner": {
      "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "displayName": "Meera Sengupta",
      "avatarUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9",
      "city": "Delhi",
      "locality": "Hauz Khas",
      "occupation": "Postgrad Law Student",
      "budgetMax": 18000,
      "verified": true,
      "compatibilityScore": 92
    },
    "lastMessage": {
      "id": "msg-9921",
      "senderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "content": "Hi! When are you planning to move in?",
      "createdAt": "2026-11-15T00:35:00.000Z",
      "read": false
    }
  }
]
```

### `GET /api/v1/connect/matches/:id/messages`
Retrieves chronological message history for a match. Automatically marks unread partner messages as read.

#### Response (200 OK):
```json
[
  {
    "id": "msg-9921",
    "matchId": "e89b3f21-8172-4011-8f92-5b91a03e1345",
    "senderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "content": "Hi! When are you planning to move in?",
    "createdAt": "2026-11-15T00:35:00.000Z",
    "readAt": "2026-11-15T00:36:12.000Z"
  }
]
```

### `POST /api/v1/connect/matches/:id/messages`
Sends a message to the partner.

#### Request Body:
```json
{
  "content": "Hi Meera! I am looking at 1st of next month near South Campus."
}
```

#### Response (201 Created):
```json
{
  "id": "msg-9922",
  "matchId": "e89b3f21-8172-4011-8f92-5b91a03e1345",
  "senderId": "caller-uuid-001",
  "content": "Hi Meera! I am looking at 1st of next month near South Campus.",
  "createdAt": "2026-11-15T00:37:00.000Z",
  "readAt": null
}
```

---

## 4. Safety & Visibility Controls

### `POST /api/v1/connect/block`
Blocks a user, dissolving mutual matches and preventing future discovery in both directions.

#### Request Body:
```json
{
  "targetUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reason": "Inappropriate conversation"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "User blocked successfully."
}
```

### `POST /api/v1/connect/report`
Files an official safety report against a flatmate profile. Enqueues report in the platform moderation console.

#### Request Body:
```json
{
  "targetUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reason": "Misleading flatmate details",
  "details": "User claimed to have a room in DLF Phase 4 but refused in-person inspection."
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Safety report received and queued for staff moderation."
}
```

### `PATCH /api/v1/connect/visibility`
Toggles discovery visibility (`discoveryHidden: true | false`).

#### Request Body:
```json
{
  "discoveryHidden": true
}
```

#### Response (200 OK):
```json
{
  "discoveryHidden": true
}
```

### `PATCH /api/v1/connect/intentions`
Updates the caller's multi-select flatmate intentions (`has_room`, `needs_room`, `team_up`). At least one intention must be provided. Automatically synchronizes legacy `hasRoom` boolean flag.

#### Request Body:
```json
{
  "intentions": ["has_room", "team_up"]
}
```

#### Response (200 OK):
```json
{
  "intentions": ["has_room", "team_up"]
}
```

---

## 6. Architecture Boundaries & Messaging Gates

### 6.1 Mutual Match Messaging Gate
- **Unilateral likes DO NOT unlock messaging.**
- If User A likes User B, but User B has not liked User A, no `flatmate_matches` tuple is created.
- Calling `POST /api/v1/connect/matches/:id/messages` without an active mutual match tuple returns `404 Not Found` or `403 Forbidden`.

### 6.2 Complete Independence of Direct Inquiries
- Direct inquiries via `POST /api/v1/inquiries` remain 100% functional and uncoupled from Connect matching.
- Any authenticated user can submit an inquiry for a property or flatmate profile with `senderName`, `senderPhone`, `senderEmail`, and `message`.
- Direct inquiries do not require a swipe, do not create a Connect match, and are not restricted by mutual consent gates.

### 6.3 Decoupling from Family Stays
- Family Stays listings are whole-property short/long stays for families and are never shown in Connect candidate feeds.

