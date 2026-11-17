# AASHVO Connect Intelligence — REST API Reference

All endpoints are hosted under `/api/v1/connect` and require a valid Bearer JWT unless otherwise noted.

---

## 1. Get Matching Preferences

`GET /api/v1/connect/preferences`

Retrieves the authenticated user's active matching priority weights and server-side normalized percentages.

### Response `200 OK`
```json
{
  "userId": "d7486e11-e6e1-455b-b9d9-7e3f8991a0c2",
  "weights": {
    "budget": 20,
    "location": 20,
    "lifestyle": 20,
    "food": 15,
    "sleep": 10,
    "moveIn": 10,
    "interests": 5
  },
  "normalizedWeights": {
    "budget": 20,
    "location": 20,
    "lifestyle": 20,
    "food": 15,
    "sleep": 10,
    "moveIn": 10,
    "interests": 5
  },
  "updatedAt": "2026-11-15T18:00:00.000Z"
}
```

---

## 2. Update Matching Preferences

`PUT /api/v1/connect/preferences`

Updates personalized dimension weights. All weights are validated and normalized on the server. Creates an audit record in `audit_logs`.

### Request Body
```json
{
  "budget": 30,
  "location": 30,
  "lifestyle": 15,
  "food": 10,
  "sleep": 5,
  "moveIn": 5,
  "interests": 5
}
```

### Response `200 OK`
```json
{
  "userId": "d7486e11-e6e1-455b-b9d9-7e3f8991a0c2",
  "weights": {
    "budget": 30,
    "location": 30,
    "lifestyle": 15,
    "food": 10,
    "sleep": 5,
    "moveIn": 5,
    "interests": 5
  },
  "normalizedWeights": {
    "budget": 30,
    "location": 30,
    "lifestyle": 15,
    "food": 10,
    "sleep": 5,
    "moveIn": 5,
    "interests": 5
  },
  "updatedAt": "2026-11-15T18:05:00.000Z"
}
```

---

## 3. Discover Candidates (Advanced Filtering & Intelligence)

`GET /api/v1/connect/candidates`

Query candidate flatmates matching filters and ranked by compatibility or budget.

### Query Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `locality` | string | Substring match on target localities. |
| `city` | string | City filter (e.g. Gurugram, Bengaluru). |
| `minBudget` | number | Minimum rent budget filter. |
| `maxBudget` | number | Maximum rent budget filter. |
| `roomType` | string | `private_room`, `shared_room`, `entire_flat`. |
| `moveInDate` | string | ISO date string (`YYYY-MM-DD`). |
| `moveInFlexible` | boolean | Whether candidate has flexible timeline. |
| `foodHabit` | string | `Vegetarian`, `Vegan`, `Non-Vegetarian`, `Eggetarian`. |
| `sleepRoutine` | string | `Early Bird`, `Night Owl`, `Flexible`. |
| `cleanliness` | string | `Spotless`, `Moderate`, `Relaxed`. |
| `petFriendly` | boolean | Must accept pets. |
| `smoking` | string | Smoking preference (e.g. `No`). |
| `sortBy` | string | `compatibility` (default), `budget_asc`, `budget_desc`. |
| `limit` | number | Page size (max 50, default 10). |
| `offset` | number | Offset for pagination. |

### Response `200 OK`
```json
[
  {
    "userId": "c859...-...",
    "profileId": "f901...-...",
    "displayName": "Priya Sharma",
    "age": 24,
    "gender": "Female",
    "occupation": "Product Designer",
    "city": "Gurugram",
    "state": "Haryana",
    "country": "India",
    "targetLocalities": ["DLF Phase 4", "Galleria"],
    "budgetMin": 18000,
    "budgetMax": 22000,
    "moveInDate": "2026-12-01",
    "moveInFlexible": true,
    "roomType": "private_room",
    "furnishing": "fully_furnished",
    "foodHabit": "Vegetarian",
    "sleepRoutine": "Early Bird",
    "cleanliness": "Spotless",
    "petFriendly": true,
    "smoking": "No",
    "bio": "Product designer seeking peaceful flat near Cyber City.",
    "interests": ["Yoga", "Specialty Coffee", "Design"],
    "avatarUrl": null,
    "verified": true,
    "hasRoom": true,
    "intentions": ["has_room", "team_up"],
    "roomDetails": "Private master bedroom with attached bath",
    "compatibility": {
      "overallScore": 94,
      "scoreAvailable": true,
      "budgetScore": 20,
      "locationScore": 20,
      "lifestyleScore": 20,
      "foodScore": 15,
      "sleepScore": 10,
      "cleanlinessScore": 20,
      "moveInScore": 10,
      "interestsScore": 5,
      "sharedInterests": ["yoga", "specialty coffee"],
      "explanations": [
        "Exact locality match: DLF Phase 4",
        "Budget overlap between ₹18,000 – ₹22,000",
        "Both Vegetarian",
        "Move-in window aligned (Flexible timing)"
      ],
      "dimensions": {
        "budget": { "score": 20, "maxScore": 20, "percentage": 100, "explanation": "Overlap" },
        "location": { "score": 20, "maxScore": 20, "percentage": 100, "explanation": "Exact match" }
      }
    }
  }
]
```
