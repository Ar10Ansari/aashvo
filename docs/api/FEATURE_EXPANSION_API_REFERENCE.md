# AASHVO MASTER FEATURE EXPANSION — API REFERENCE
## REST Endpoints, DTO Schemas & Verification Payloads

**Base URL:** `/api/v1`  
**Authentication:** RFC 6750 Bearer JWT (`Authorization: Bearer <token>`)  
**Error Envelope:** Standard AASHVO RFC-7807 compatible error envelope  

---

## 1. Locations & Smart Discovery Endpoints

### `GET /api/v1/locations/landmarks`
Searches verified landmarks (universities, colleges, IT parks, metro stations) across supported Indian cities.

**Query Parameters:**
- `city` (string, optional): Filter by city name (e.g. `delhi-ncr`, `bengaluru`, `gurugram`).
- `category` (string, optional): `university` | `office_park` | `metro_station`.
- `search` (string, optional): Text query matching landmark name.

**Response (200 OK):**
```json
[
  {
    "id": "landmark-iit-delhi",
    "name": "IIT Delhi",
    "category": "university",
    "city": "Delhi NCR",
    "locality": "Hauz Khas",
    "latitude": 28.545,
    "longitude": 77.1926,
    "nearestMetro": "IIT Metro Station (Magenta Line)"
  }
]
```

---

## 2. Saved Items & Shortlists Endpoints

### `POST /api/v1/saved`
Saves a property, flatmate profile, Connect candidate, or Family Stay to the caller's private shortlist.

**Request Body:**
```json
{
  "itemType": "property",
  "targetId": "4c9e6679-7425-40de-944b-e07fc1f90ae7",
  "notes": "Close to Cyber Hub office, fits budget"
}
```

**Response (201 Created):**
```json
{
  "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "itemType": "property",
  "targetId": "4c9e6679-7425-40de-944b-e07fc1f90ae7",
  "notes": "Close to Cyber Hub office, fits budget",
  "createdAt": "2026-11-15T01:30:00.000Z"
}
```

### `GET /api/v1/saved`
Retrieves all items saved by the caller, decorated with live availability and metadata.

**Query Parameters:**
- `itemType` (optional): Filter by `property` | `flatmate_profile` | `connect_profile` | `family_stay`.

**Response (200 OK):**
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "itemType": "property",
    "targetId": "4c9e6679-7425-40de-944b-e07fc1f90ae7",
    "notes": "Close to Cyber Hub office, fits budget",
    "isAvailable": true,
    "availabilityStatus": "active",
    "title": "Private Room in DLF Phase 2",
    "city": "Gurugram",
    "locality": "Cyber City",
    "monthlyRent": 22000,
    "thumbnailUrl": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    "savedAt": "2026-11-15T01:30:00.000Z"
  }
]
```

### `DELETE /api/v1/saved/:id`
Removes an item from the caller's shortlist.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Item removed from saved list"
}
```

---

## 3. Property Visit Scheduling Endpoints

### `POST /api/v1/visits`
Submits a viewing request for an active property listing.

**Request Body:**
```json
{
  "propertyId": "4c9e6679-7425-40de-944b-e07fc1f90ae7",
  "scheduledAt": "2026-11-20T11:00:00.000Z",
  "visitorMessage": "Hi, I work in Cyber City and would like to inspect the room on Saturday morning."
}
```

**Response (201 Created):**
```json
{
  "id": "vst-91823a-12904b",
  "propertyId": "4c9e6679-7425-40de-944b-e07fc1f90ae7",
  "visitorId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "hostId": "8b9e6679-7425-40de-944b-e07fc1f90fe2",
  "scheduledAt": "2026-11-20T11:00:00.000Z",
  "scheduledAtIST": "20 Nov 2026, 04:30 PM IST",
  "status": "pending",
  "visitorMessage": "Hi, I work in Cyber City and would like to inspect the room on Saturday morning.",
  "createdAt": "2026-11-15T01:35:00.000Z"
}
```

### `PATCH /api/v1/visits/:id/status`
Host updates visit status (`confirm` | `reject` | `complete` | `cancel`).

**Request Body:**
```json
{
  "action": "confirm",
  "hostNotes": "Confirmed. I will meet you at the society entrance."
}
```

---

## 4. Notifications Endpoints

### `GET /api/v1/notifications`
Retrieves paginated in-app notifications for the authenticated caller.

**Query Parameters:**
- `unreadOnly` (boolean, optional, default: false)
- `limit` (integer, optional, default: 20)

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "notif-1",
      "category": "visit_update",
      "title": "Visit Confirmed",
      "body": "Your viewing request for Private Room in DLF Phase 2 was confirmed for 20 Nov 2026, 04:30 PM IST.",
      "targetUrl": "/my-activity/visits",
      "read": false,
      "createdAt": "2026-11-15T01:40:00.000Z"
    }
  ],
  "unreadCount": 1,
  "total": 1
}
```

### `POST /api/v1/notifications/read-all`
Marks all caller notifications as read.

**Response (200 OK):**
```json
{
  "success": true,
  "markedCount": 3
}
```

