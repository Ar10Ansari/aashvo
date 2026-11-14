# AASHVO — Sprint 3 Master Implementation Plan
## Domain Core Services, Media Vault & Marketplace Modules

**Author:** Principal Software Architect & CTO Office  
**Date:** 2026-11-13  
**Status:** **READY FOR CTO APPROVAL (STRICTLY PLANNING ONLY — NO CODE IMPLEMENTATION UNTIL APPROVED)**  
**Workspace:** `D:\Projects\AASHVO` | Monorepo: `apps/api` & `packages/contracts`  
**Database Target:** PostgreSQL 16 (Verified on port 5433 / DigitalOcean Managed PG BLR1)  
**Cloud Storage Direction:** Cloudflare R2 (Public Media) & AWS S3 `ap-south-1` Mumbai (Private Rental Vault)

---

## 1. Executive Summary & Sprint Scope

With the core authentication foundation, cryptographic JWT signing (RS256), session rotation, and PostgreSQL 16 schema constraints verified, **Sprint 3** constructs the domain heart of the AASHVO platform.

Sprint 3 delivers seven interconnected modules:
1. **`ProfilesModule`**: Extended user profiles, KYC verification tier tracking, avatar management, and privacy-respecting views.
2. **`LocationsModule`**: Curated city, locality, university cluster, and transit metro hubs.
3. **`PropertiesModule`**: Complete listing management, search, filtering, moderation workflow, and dedicated **Family Stays** support.
4. **`MediaModule`**: Dual-provider presigned media vault (Cloudflare R2 for public photos, AWS S3 Mumbai for sensitive tenancy/KYC documents) with magic-byte validation and virus-safe processing.
5. **`FlatmatesModule`**: Flatmate search, lifestyle preference indexing (GIN arrays), adult age verification (`age >= 18`), and compatibility scoring.
6. **`FamilyStaysModule`**: Dedicated domain service and validation rules enforcing verified family host residence (`family_lives_on_property = true`).
7. **`InquiriesModule`**: Inquiries and interest requests with exclusive target validation (`property_id` OR `flatmate_profile_id`), rate limiting, and owner notifications.

---

## 2. Module Architecture & Responsibility Matrix

```text
apps/api/src/modules/
├── profiles/
│   ├── dto/profile.dto.ts               # UpdateProfileDto, KYCSubmissionDto, PublicProfileDto
│   ├── profiles.controller.ts           # GET /me, PATCH /me, GET /:id (sanitized)
│   ├── profiles.service.ts              # Tier advancement, profile synchronization
│   └── profiles.module.ts
├── locations/
│   ├── data/tier1-cities.json           # Delhi NCR, Bengaluru, Mumbai, Pune, Hyderabad
│   ├── dto/location-query.dto.ts        # CitySearchDto, LocalityFilterDto
│   ├── locations.controller.ts          # GET /locations/cities, GET /locations/localities
│   ├── locations.service.ts             # In-memory cached locality lookup & geo-bounds
│   └── locations.module.ts
├── properties/
│   ├── dto/property.dto.ts              # CreatePropertyDto, SearchPropertiesDto, ModerationDto
│   ├── properties.controller.ts         # CRUD, search, featured, owner listings
│   ├── properties.service.ts            # Moderation states, price range filters, full-text search
│   └── properties.module.ts
├── media/
│   ├── ports/storage.port.ts            # StorageServicePort interface
│   ├── adapters/
│   │   ├── cloudflare-r2.adapter.ts     # S3Client configured for Cloudflare R2 endpoint (public)
│   │   └── aws-s3-vault.adapter.ts      # S3Client configured for AWS S3 ap-south-1 (private)
│   ├── dto/presigned-upload.dto.ts      # PresignedUploadRequestDto, AssetConfirmDto
│   ├── media.controller.ts              # POST /presigned-upload, POST /confirm
│   ├── media.service.ts                 # Magic-byte inspection, MIME validation, access authorization
│   └── media.module.ts
├── flatmates/
│   ├── dto/flatmate.dto.ts              # FlatmateProfileDto, SearchFlatmatesDto
│   ├── flatmates.controller.ts          # CRUD, lifestyle matching, GIN array search
│   ├── flatmates.service.ts             # Compatibility algorithm, adult age verification
│   └── flatmates.module.ts
├── family-stays/
│   ├── dto/family-stay.dto.ts           # FamilyStayVerificationDto
│   ├── family-stays.service.ts          # Enforces family residence check, home-cooked meal metadata
│   └── family-stays.module.ts
└── inquiries/
    ├── dto/inquiry.dto.ts               # CreateInquiryDto, InquiryStatusUpdateDto
    ├── inquiries.controller.ts          # Tenant requests, owner inbox, status updates
    ├── inquiries.service.ts             # Single-target constraint enforcement, notification outbox
    └── inquiries.module.ts
```

---

## 3. Detailed Technical Specification by Module

### 3.1 `ProfilesModule`
- **Endpoints:**
  - `GET /api/v1/profiles/me`: Returns full authenticated profile including email, phone, verification tier, preferences.
  - `PATCH /api/v1/profiles/me`: Updates bio, occupation, emergency contact, dietary preferences, and avatar URL.
  - `GET /api/v1/profiles/:userId`: Returns sanitized public profile (strips phone, email, and internal KYC metadata).
- **Security & Authorization:**
  - Profile modification is restricted to the resource owner (`CurrentUser.id === profile.id`) or administrators.
  - Verification tier advancement (`unverified` → `phone_verified` → `id_verified` → `full_verified`) is strictly guarded against client manipulation.

### 3.2 `LocationsModule`
- **Supported Geographies:**
  - Curated seed coverage for Indian student/tech hubs: **Delhi NCR** (South Delhi, North Campus, Gurugram Cyber City, Noida Sectors 62/128), **Bengaluru** (Koramangala, Indiranagar, HSR Layout, Whitefield), **Pune** (Kothrud, Viman Nagar, Hinjewadi), **Mumbai / Navi Mumbai**.
- **Endpoints:**
  - `GET /api/v1/locations/cities`: Returns supported cities, state, and geographic bounding boxes.
  - `GET /api/v1/locations/localities?city=Delhi`: Returns fast autocomplete list of verified localities and nearby metro lines.
- **Performance:**
  - In-memory static cache with fast substring and prefix indexing to guarantee `<5ms` response latency without database round-trips.

### 3.3 `PropertiesModule` & `FamilyStaysModule`
- **Database Mapping:** Direct integration with Prisma `properties` and `property_photos` tables.
- **CHECK Constraint Enforcement:**
  - `chk_properties_non_negative_money`: `rent_amount >= 0`, `security_deposit >= 0`, `maintenance_fee >= 0`.
  - `chk_family_stay_eligibility`: When `category = 'family_stays'`, `family_lives_on_property` MUST be `true`.
- **Endpoints:**
  - `GET /api/v1/properties`: Public search with query filters:
    - `city`, `locality`, `minRent`, `maxRent`, `propertyType`, `roomType`, `furnishing`, `category` (`standard`, `family_stays`, `pg_coliving`).
    - Pagination via `page` and `limit` (max 50).
  - `GET /api/v1/properties/:id`: Detailed view including approved photos and owner trust badges.
  - `POST /api/v1/properties`: Owner listing creation (starts in status `pending_review` or `draft`).
  - `PATCH /api/v1/properties/:id`: Owner listing updates.
  - `DELETE /api/v1/properties/:id`: Soft deletion / archiving.
- **Database Query Strategy:**
  - Filter by `status = 'active'` for public queries.
  - GIN array query for amenities (`amenities @> ARRAY['wifi', 'ac']::text[]`).
  - Uses partial index `idx_properties_active_featured` for homepage highlights.

### 3.4 `MediaModule` (Dual Cloud Storage Vault)
- **Architectural Separation:**
  1. **Public Bucket (Cloudflare R2):**
     - Purpose: Property photographs, user avatars, public marketing assets.
     - Access: Direct public CDN URL (cacheable, DDoS protected).
     - Keys: `public/properties/{propertyId}/{uuid}.webp`, `public/avatars/{userId}/{uuid}.webp`.
  2. **Private Bucket (AWS S3 `ap-south-1` Mumbai):**
     - Purpose: Rental agreements, identity verification documents, safety reports, dispute evidence.
     - Access: STRICTLY private; zero public read permissions.
     - Retrieval: Presigned download URLs with 15-minute maximum TTL, generated exclusively after validating caller authorization.
     - Keys: `private/documents/{userId}/{tenancyId}/{uuid}.pdf`.
- **Upload Flow:**
  1. Client sends `POST /api/v1/media/presigned-upload` with file name, content type, declared size, and target folder.
  2. Server validates MIME type (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), size limits (`<= 10MB` for photos, `<= 25MB` for PDF documents), and user role.
  3. Server creates record in `media_assets` with `status = 'pending_upload'`.
  4. Server generates presigned S3/R2 `PUT` URL valid for 10 minutes.
  5. Client uploads directly to bucket.
  6. Client calls `POST /api/v1/media/confirm` with `assetId`.
  7. Server verifies object exists in bucket, validates S3 `Content-Length`, inspects magic bytes if required, and marks status `uploaded`.

### 3.5 `FlatmatesModule`
- **Database Mapping:** Prisma `flatmate_profiles` table.
- **CHECK Constraint Enforcement:**
  - `chk_flatmate_adult_age`: `age >= 18` strictly enforced at PostgreSQL level.
  - `chk_flatmate_budget_positive`: `budget_max > 0`.
- **Search & Compatibility Scoring:**
  - Query GIN indexes `idx_flatmates_localities_gin` and `idx_flatmates_interests_gin`.
  - Compatibility scoring algorithm (0-100%):
    - Food habit alignment (Vegetarian / Non-veg / Vegan): 25 pts.
    - Sleep routine alignment (Early Bird / Night Owl): 20 pts.
    - Cleanliness expectation (Strict / Moderate / Relaxed): 20 pts.
    - Budget overlap: 20 pts.
    - Shared interests: up to 15 pts.

### 3.6 `InquiriesModule` & Interest Requests
- **Database Mapping:** Prisma `interest_requests` table.
- **CHECK Constraint Enforcement:**
  - `chk_interest_request_target`: `(property_id IS NOT NULL AND flatmate_profile_id IS NULL) OR (property_id IS NULL AND flatmate_profile_id IS NOT NULL)` ensures an inquiry points to either a property or a flatmate, never both or neither.
- **Status Lifecycle:** `pending` → `accepted` | `rejected` | `withdrawn` | `expired`.
- **Outbox Notification:** Creates transactional entry in `notification_outbox` notifying the listing owner or flatmate candidate.

---

## 4. Contract Definitions (`packages/contracts`)

Before writing backend code, the following shared contracts will be authored in `packages/contracts`:
1. `dtos/profile.dto.ts`: Profile schemas, update validators.
2. `dtos/property.dto.ts`: Property create/update, search filters, pagination.
3. `dtos/media.dto.ts`: Presigned URL request/response, asset metadata.
4. `dtos/flatmate.dto.ts`: Flatmate listing, matching filters.
5. `dtos/inquiry.dto.ts`: Interest request creation, status transition.
6. Regenerated `openapi.json` contract for frontend synchronization.

---

## 5. Testing & Verification Strategy for Sprint 3

1. **Unit Tests:**
   - Property validation logic and price calculators.
   - Flatmate compatibility scoring algorithm.
   - Media presigned URL generation and MIME allowlist parser.
2. **PostgreSQL 16 Integration Tests:**
   - Property creation testing `chk_properties_non_negative_money` and `chk_family_stay_eligibility`.
   - Flatmate creation testing `chk_flatmate_adult_age` (rejection of minor `< 18`).
   - GIN index queries on amenities, target localities, and interests.
   - Dual-target inquiry rejection (`chk_interest_request_target`).
   - Presigned upload authorization and private document isolation.
3. **Frontend Non-Regression:**
   - Full execution of root `npm run typecheck`, `npm test` (232 tests), and `npm run build`.

---

## 6. Implementation Phasing & Next Action

- **Step 1:** CTO review and formal authorization of this Master Plan.
- **Step 2:** Add DTOs, schemas, and enums to `packages/contracts`.
- **Step 3:** Implement `LocationsModule` and `ProfilesModule`.
- **Step 4:** Implement `MediaModule` (R2 & S3 adapters with local test mock).
- **Step 5:** Implement `PropertiesModule` and `FamilyStaysModule`.
- **Step 6:** Implement `FlatmatesModule` and `InquiriesModule`.
- **Step 7:** Run full integration test suite on PostgreSQL 16 and produce Sprint 3 Completion Report.

**Strict Prohibition:** No Sprint 3 implementation code will be written until the CTO approves this plan.

