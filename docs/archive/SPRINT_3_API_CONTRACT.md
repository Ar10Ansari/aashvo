# AASHVO — Sprint 3 API Contract & Endpoint Specification
## RESTful API v1 for Domain Services, Media Vault & Marketplace

**Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Protocol:** HTTPS / JSON  
**Specification:** OpenAPI 3.0 (`packages/contracts/openapi.json`)

---

## 1. Global Conventions & Envelopes

### 1.1 Headers
- **`Authorization`**: `Bearer <access_jwt>` (required for authenticated routes).
- **`X-Request-ID`**: Client or gateway correlation UUID (reflected in response).
- **`Content-Type`**: `application/json`.

### 1.2 Canonical Error Envelope
All error responses adhere to the unified AASHVO error schema:
```json
{
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Applicant must be at least 18 years old to create a flatmate listing.",
    "requestId": "61a1b156-f949-411a-8c8d-8c4600277ee2",
    "timestamp": "2026-11-14T16:40:00.000Z",
    "details": null
  }
}
```

---

## 2. Profiles Module (`/api/v1/profiles`)

### `GET /api/v1/profiles/me`
- **Auth:** Bearer token (any role)
- **Response 200 OK:**
  ```json
  {
    "id": "c0a8012e-8cb5-4a5f-9e8a-0123456789ab",
    "email": "renter@aashvo-test.in",
    "role": "renter",
    "fullName": "Ananya Sharma",
    "phoneNumber": "+919876543210",
    "avatarUrl": "https://assets.aashvo.in/user-avatars/ananya.webp",
    "bio": "Data science postgraduate looking for flatmate in Gurugram.",
    "occupation": "Data Scientist",
    "college": "IIT Delhi",
    "idVerified": false,
    "phoneVerified": false,
    "profileCompletionPercent": 85,
    "createdAt": "2026-11-14T10:00:00.000Z",
    "updatedAt": "2026-11-14T10:15:00.000Z"
  }
  ```

### `PATCH /api/v1/profiles/me`
- **Auth:** Bearer token (any role)
- **Request Body:**
  ```json
  {
    "fullName": "Ananya Sharma",
    "phoneNumber": "+919876543210",
    "avatarUrl": "https://assets.aashvo.in/user-avatars/ananya.webp",
    "bio": "Data science postgraduate looking for flatmate in Gurugram.",
    "occupation": "Data Scientist",
    "college": "IIT Delhi"
  }
  ```
- **Response 200 OK:** Returns updated `ProfileResponseDto`.
- **Response 409 Conflict:** If `phoneNumber` is already linked to another account.

### `GET /api/v1/profiles/:userId`
- **Auth:** Public
- **Response 200 OK:**
  ```json
  {
    "id": "c0a8012e-8cb5-4a5f-9e8a-0123456789ab",
    "fullName": "Ananya Sharma",
    "avatarUrl": "https://assets.aashvo.in/user-avatars/ananya.webp",
    "bio": "Data science postgraduate looking for flatmate in Gurugram.",
    "occupation": "Data Scientist",
    "college": "IIT Delhi",
    "idVerified": false,
    "phoneVerified": false,
    "profileCompletionPercent": 85,
    "createdAt": "2026-11-14T10:00:00.000Z"
  }
  ```
  *(Note: email and phone number are stripped from public projections).*

---

## 3. Locations Module (`/api/v1/locations`)

### `GET /api/v1/locations/cities`
- **Auth:** Public
- **Query Params:** `withInventoryOnly=true|false`
- **Response 200 OK:**
  ```json
  {
    "totalCities": 6,
    "cities": [
      {
        "name": "Gurugram",
        "state": "Haryana",
        "popularLocalities": ["Cyber City", "Golf Course Road", "Sector 48"],
        "activeListingsCount": 14
      }
    ]
  }
  ```

### `GET /api/v1/locations/localities`
- **Auth:** Public
- **Query Params:** `city=Gurugram`, `search=Cyber`
- **Response 200 OK:**
  ```json
  [
    {
      "name": "Cyber City",
      "city": "Gurugram",
      "pincode": "122002",
      "nearestMetro": "Cyber City Rapid Metro",
      "activeListingsCount": 8
    }
  ]
  ```

---

## 4. Properties Module (`/api/v1/properties`)

### `GET /api/v1/properties`
- **Auth:** Public
- **Query Params:** `city`, `locality`, `listingCategory`, `minRent`, `maxRent`, `page`, `limit`
- **Response 200 OK:** Paginated active properties (`PaginatedPropertiesResponseDto`).

### `POST /api/v1/properties`
- **Auth:** Bearer token (`owner` or `admin`)
- **Request Body:**
  ```json
  {
    "title": "Sunlit 2BHK Near DLF Cyber City",
    "description": "Fully furnished luxury apartment for working professionals.",
    "listingCategory": "apartment",
    "furnishingStatus": "furnished",
    "propertyType": "residential",
    "addressLine1": "Tower 4, Phase 2, DLF Cyber City",
    "locality": "Cyber City",
    "city": "Gurugram",
    "state": "Haryana",
    "pincode": "122002",
    "rentAmount": 38000,
    "depositAmount": 76000,
    "maintenanceAmount": 3500,
    "amenities": ["Air Conditioning", "High-speed Wi-Fi", "Power Backup", "Gym"],
    "familyLivesOnProperty": false,
    "mealIncluded": "none",
    "photoUrls": ["https://assets.aashvo.in/property-photos/cyber-living-1.webp"]
  }
  ```
- **Response 201 Created:** Returns `PropertyResponseDto` with `moderationStatus: "pending_review"`.

### `GET /api/v1/properties/mine`
- **Auth:** Bearer token (`owner` or `admin`)
- **Response 200 OK:** List of all properties created by current user regardless of moderation status.

### `GET /api/v1/properties/:id`
- **Auth:** Public (for active listings; inactive listings require owner or admin)
- **Response 200 OK:** Full `PropertyResponseDto`.

### `PATCH /api/v1/properties/:id`
- **Auth:** Bearer token (property owner only)
- **Response 200 OK:** Updated property. Throws 403 `FORBIDDEN` if caller does not own the listing.

### `DELETE /api/v1/properties/:id`
- **Auth:** Bearer token (owner or admin)
- **Response 204 No Content.**

### `PATCH /api/v1/properties/:id/moderate`
- **Auth:** Bearer token (`admin` strictly)
- **Request Body:**
  ```json
  {
    "status": "active",
    "reason": "Listing verified against electricity bill."
  }
  ```
- **Response 200 OK:** Updated property with updated `moderationStatus`.

---

## 5. Media Vault Module (`/api/v1/media`)

### `POST /api/v1/media/presigned-upload`
- **Auth:** Bearer token
- **Request Body:**
  ```json
  {
    "purpose": "property-photos",
    "mimeType": "image/webp",
    "fileName": "balcony-view.webp",
    "sizeBytes": 2048576
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "assetId": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "uploadUrl": "http://127.0.0.1:4000/api/v1/media/upload-mock/e1f2a3b4...",
    "publicUrl": "http://127.0.0.1:4000/assets/property-photos/e1f2a3b4.webp",
    "storageBucket": "aashvo-public-assets",
    "storageKey": "property-photos/e1f2a3b4-balcony-view.webp",
    "expiresInSeconds": 900
  }
  ```

### `POST /api/v1/media/confirm`
- **Auth:** Bearer token
- **Request Body:**
  ```json
  {
    "assetId": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "propertyId": "optional-property-id"
  }
  ```
- **Response 200 OK:** Confirms asset into database `media_assets` table.

### `GET /api/v1/media/:id/download`
- **Auth:** Bearer token (asset owner or admin)
- **Response 200 OK:**
  ```json
  {
    "downloadUrl": "https://s3.ap-south-1.amazonaws.com/aashvo-private-vault/...",
    "expiresInSeconds": 300
  }
  ```

---

## 6. Flatmates Module (`/api/v1/flatmates`)

### `GET /api/v1/flatmates`
- **Auth:** Public (optional Bearer token)
- **Query Params:** `city`, `locality`, `gender`, `foodHabit`, `sleepRoutine`, `cleanliness`, `maxBudget`, `page`, `limit`
- **Response 200 OK:** Paginated list with computed `compatibilityScore` if authenticated.

### `POST /api/v1/flatmates/me`
- **Auth:** Bearer token
- **Request Body:**
  ```json
  {
    "occupation": "Frontend Engineer",
    "age": 24,
    "gender": "Female",
    "hasRoom": false,
    "targetLocalities": ["Cyber City", "Sector 48"],
    "city": "Gurugram",
    "budgetMax": 22000,
    "foodHabit": "Vegetarian",
    "sleepRoutine": "Early Bird",
    "cleanliness": "Spotless",
    "petFriendly": true,
    "smoking": "Non-smoker",
    "bio": "Clean and quiet software engineer at DLF Phase 2.",
    "interests": ["Badminton", "Reading", "Yoga"]
  }
  ```
- **Response 201 Created:** Created flatmate profile. Throws 400 if `age < 18`. Throws 409 if profile already exists.

### `PATCH /api/v1/flatmates/me`
- **Auth:** Bearer token
- **Response 200 OK:** Updated flatmate profile.

### `GET /api/v1/flatmates/:id`
- **Auth:** Public (optional Bearer token)
- **Response 200 OK:** Returns profile with `compatibilityScore` (0–100%) computed when caller has a profile.

---

## 7. Family Stays Module (`/api/v1/family-stays`)

### `GET /api/v1/family-stays`
- **Auth:** Public
- **Query Params:** `city`, `mealIncluded`, `minRent`, `maxRent`, `page`, `limit`
- **Response 200 OK:** Curated properties where `familyLivesOnProperty === true`.

### `GET /api/v1/family-stays/:id`
- **Auth:** Public
- **Response 200 OK:** Verified family stay listing.

---

## 8. Inquiries Module (`/api/v1/inquiries`)

### `POST /api/v1/inquiries`
- **Auth:** Bearer token
- **Request Body:**
  ```json
  {
    "propertyId": "p-1234-uuid",
    "flatmateProfileId": null,
    "message": "Hi, I am interested in visiting the property this Saturday morning.",
    "proposedMoveInDate": "2026-12-01",
    "contactPhone": "+919876543210"
  }
  ```
- **Response 201 Created:** Returns `InquiryResponseDto` with `status: "pending"` and phone number masked for property owner.
- **Response 409 Conflict:** If a pending inquiry already exists for this target.

### `GET /api/v1/inquiries/sent`
- **Auth:** Bearer token
- **Response 200 OK:** All inquiries submitted by the caller.

### `GET /api/v1/inquiries/received`
- **Auth:** Bearer token
- **Response 200 OK:** Inquiries received for properties or flatmate profiles owned by the caller. Contact phone is masked unless `status === "accepted"`.

### `PATCH /api/v1/inquiries/:id/status`
- **Auth:** Bearer token (listing owner)
- **Request Body:**
  ```json
  {
    "status": "accepted",
    "responseNotes": "Welcome! Please call me to schedule the visit."
  }
  ```
- **Response 200 OK:** Updated inquiry. Phone number is now fully visible to the owner.

---

## 9. Error Codes Catalog

| Error Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Payload validation failed (e.g., age `< 18`, invalid email) |
| `UNSUPPORTED_MEDIA_TYPE` | 400 | Disallowed MIME type uploaded to media vault |
| `FILE_TOO_LARGE` | 400 | Uploaded file exceeds size ceiling (10MB image / 25MB doc) |
| `INQUIRY_TARGET_INVALID` | 400 | Must specify either `propertyId` XOR `flatmateProfileId` |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired Bearer token |
| `FORBIDDEN` | 403 | Insufficient role or attempt to mutate another user's resource |
| `NOT_FOUND` | 404 | Requested generic resource does not exist |
| `PROPERTY_NOT_FOUND` | 404 | Property listing does not exist |
| `FLATMATE_PROFILE_NOT_FOUND`| 404 | Flatmate profile does not exist |
| `INQUIRY_NOT_FOUND` | 404 | Inquiry does not exist |
| `MEDIA_ASSET_NOT_FOUND` | 404 | Storage asset does not exist |
| `CONFLICT` | 409 | Duplicate resource (e.g., phone number, flatmate profile) |
| `DUPLICATE_INQUIRY` | 409 | User already has an active pending inquiry for this target |

