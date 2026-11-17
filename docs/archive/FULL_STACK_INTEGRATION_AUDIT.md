# AASHVO — FULL-STACK INTEGRATION AUDIT
## Architectural Verification: React Frontend, NestJS Backend & PostgreSQL 16 Database

**Version:** 1.0.0-RC  
**Target Environment:** Local Air-Gapped Verification / Staging Preparation  
**Database Engine:** PostgreSQL 16.16 (PostGIS / Citext / UUIDv4 enabled)  
**Backend Framework:** NestJS 11.2.9  
**Frontend Framework:** React 18.3.1 + Vite 6.4.4 + Tailwind CSS  
**Shared Contracts:** `@aashvo/contracts` (TypeScript 5.7.2)

---

## 1. Executive Summary & Verification Boundaries

AASHVO has completed comprehensive full-stack integration connecting its React frontend to its dedicated NestJS REST API service (`apps/api`) and PostgreSQL 16 database. All legacy dependencies on hosted third-party BaaS infrastructure (`himtwnwxvnnykafyhysy.supabase.co`) have been cleanly decommissioned. The application executes inside an air-gapped boundary with 100% locally verified transactional state.

### Non-Negotiable Operational Boundaries Maintained
- **Air-Gapped Isolation:** Zero outbound HTTP network requests to hosted Supabase.
- **Zero Paid Cloud Provisioning:** No active AWS/Cloudflare billable assets provisioned during testing.
- **Working-Tree Preservation:** Zero Git commits, pushes, or disruptive git resets.
- **Additive Database Schema:** All PostgreSQL tables, indexes, partial unique constraints, and foreign keys applied additively without dropping active data structures.
- **Zero False Success Fallbacks:** Real HTTP errors (400, 401, 403, 404, 409, 500) bubble to UI feedback components without silent simulation or fake success flags.

---

## 2. API Communication & Dev Proxy Architecture

### 2.1 API Base URL & Vite Reverse Proxy
Communication between the browser and NestJS operates transparently in both local development and containerized environments:
- **Client Configuration (`src/services/apiClient.ts`):** Defaults to `/api/v1` when `VITE_API_BASE_URL` is omitted.
- **Vite Development Proxy (`vite.config.ts`):** Routes all `/api` traffic to `http://localhost:4000` with HTTP connection keep-alive and WebSocket header upgrade support.
- **Cookie & Origin Alignment:** In local development, cookies are set on `localhost` with `SameSite=Lax`, allowing standard cookie-based refresh flows without CORS third-party cookie blocking.

### 2.2 JWT Authentication & Session Lifecycle
```
[ Browser / React App ]
     |
     | (1) POST /api/v1/auth/login (email + password)
     v
[ NestJS AuthController ]
     |
     |--> Verify Argon2id password hash
     |--> Issue short-lived access JWT (15 mins) in HTTP response body
     |--> Issue cryptographically signed refresh token in HttpOnly SameSite=Strict cookie
     v
[ Browser ApiClient ]
     |--> Stores accessToken in memory (fallback: sessionStorage for multi-tab recovery)
     |--> Injects `Authorization: Bearer <token>` on all requests
     |
     | (2) 401 Unauthorized Intercept (Token Expired)
     v
[ ApiClient Auto-Refresh Interceptor ]
     |--> Queues pending failed requests
     |--> Calls POST /api/v1/auth/refresh (sending HttpOnly refresh cookie)
     |--> Receives new access JWT
     |--> Replays original queued requests with refreshed Authorization header
     v
[ User UI ] --> Seamless, uninterrupted session
```

### 2.3 Request Tracing & Correlation IDs
- **Request ID Middleware (`RequestIdInterceptor`):** Injects a unique `X-Request-Id` (UUIDv4) into every incoming HTTP request header.
- **Pino Structured Logging:** Request ID is propagated into logger context for every database query, authentication challenge, and domain event.
- **Response Headers:** `X-Request-Id` is echoed in all HTTP responses, enabling instant frontend-to-backend trace correlation in debugging logs.

---

## 3. Backend Architecture, Controllers & Services Audit

The NestJS backend (`apps/api/src/modules/`) is organized into domain-driven modular boundaries:

| Module | Primary Controller | Primary Service | Key Database Tables | Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **AuthModule** | `AuthController` | `AuthService`, `JwtAuthService` | `users`, `refresh_sessions`, `verification_tokens` | Registration, Argon2id hashing, login, token refresh, logout, password reset |
| **UsersModule** | `UsersController` | `UsersService` | `users`, `profiles`, `audit_logs` | User identity lifecycle, account status, security settings |
| **ProfilesModule** | `ProfilesController` | `ProfilesService` | `profiles` | User profiles, phone verification state, emergency contact, role |
| **PropertiesModule** | `PropertiesController` | `PropertiesService` | `properties`, `property_photos`, `property_verifications` | Property CRUD, photo management, owner verification document submissions |
| **FlatmatesModule** | `FlatmatesController` | `FlatmatesService` | `flatmate_profiles` | Flatmate profile creation, budget, room intentions, lifestyle preferences |
| **ConnectModule** | `ConnectController` | `ConnectService` | `flatmate_interests`, `flatmate_matches`, `match_messages` | Swipe discovery feed, compatibility calculation, mutual matching, match-only messaging |
| **FamilyStaysModule** | `FamilyStaysController` | `FamilyStaysService` | `properties` (filtered: `category=family_stays`) | Homestay search, host family verification, meal plan selections |
| **InquiriesModule** | `InquiriesController` | `InquiriesService` | `interest_requests` | Direct independent property inquiries & flatmate contact requests |
| **VisitsModule** | `VisitsController` | `VisitsService` | `property_visits` | In-person visit scheduling, host confirmation, conflict prevention |
| **SavedModule** | `SavedController` | `SavedService` | `saved_items` | Unified shortlisted properties, flatmates, and Family Stays |
| **AgreementsModule** | `AgreementsController` | `AgreementsService` | `tenancy_agreements`, `rent_payment_records` | Tenancy agreement drafts, digital signing, activation, rent payment ledgers |
| **InspectionsModule** | `InspectionsController` | `InspectionsService` | `property_inspections` | Move-in & move-out checklists, meter readings, digital counterparty acknowledgment |
| **DisputesModule** | `DisputesController` | `DisputesService` | `rental_disputes` | Formal rental dispute filing, evidence attachment, admin binding resolution |
| **ReviewsModule** | `ReviewsController` | `ReviewsService` | `tenancy_reviews` | Two-sided verified reviews, ratings across 5 trust dimensions, moderation |
| **NotificationsModule**| `NotificationsController` | `NotificationsService` | `user_notifications`, `notification_outbox` | User notification center, unread counters, category filtering, email/SMS dispatch |
| **LocationsModule** | `LocationsController` | `LocationsService` | In-memory catalog + Haversine | Indian metro & landmark directory, proximity calculations, pincode lookup |
| **SupportModule** | `SupportController` | `SupportService` | `support_tickets`, `ticket_messages`, `ticket_audit_events` | Authenticated & guest support tickets, message threading, status workflows |
| **AuditModule** | `AuditService` | `AuditService` | `audit_logs` | Immutable tamper-evident audit trails for security and admin actions |
| **MediaModule** | `MediaController` | `MediaService`, `MediaStorageAdapter` | Local filesystem / S3 / Cloudflare R2 | Multipart upload handling, MIME validation, thumbnail generation, signed URLs |

---

## 4. Database Schema & Migration Verification

The database is powered by PostgreSQL 16.16 with Prisma ORM 6.19.3. All migrations have been executed in strictly additive order:
- **Extensions Active:** `uuid-ossp`, `citext`, `pgcrypto`.
- **Integrity Constraints:**
  - Foreign keys configured with cascading deletes where appropriate (`property_photos -> properties`, `ticket_messages -> support_tickets`) and restricted deletes for legal tenancy records (`tenancy_agreements -> properties`).
  - Partial unique index on `property_visits(property_id, scheduled_at)` for `status IN ('pending', 'confirmed')` to prevent double-booking visit slots.
  - Unique index on `flatmate_interests(initiator_user_id, target_user_id)` to prevent duplicate swipe records.
  - Unique constraint on `flatmate_matches` using ordered pair `(LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))` to guarantee exactly one match per mutual pair.
  - Partial index on `notification_outbox(status, created_at)` for reliable polling and zero-lock dispatch.

---

## 5. Storage & Media Management

### 5.1 Storage Adapter Abstraction
The `MediaStorageAdapter` interface decouples the application from concrete cloud storage providers:
- **Local Disk Adapter (`LocalMediaStorageAdapter`):** Stores uploads in `apps/api/uploads/` with UUID-based filenames and sanitization. Used in all local testing and air-gapped development.
- **S3 / R2 Cloud Adapter (`S3MediaStorageAdapter`):** Prepared for staging and production via AWS SDK v3 with bucket isolation:
  - `property-photos` (Public CDN read)
  - `user-avatars` (Public CDN read)
  - `rental-documents` (Private encrypted, signed URL read with 15-minute TTL)
  - `support-attachments` (Private encrypted, admin/staff authenticated access)

### 5.2 Upload Security & Sanitation
- MIME type validation via magic bytes (not file extension).
- Maximum payload bounds: 10 MB for property photos, 5 MB for KYC and utility bill documents, 2 MB for avatars.
- Path traversal prevention: Filenames stripped of special characters and prefixed with deterministic UUIDv4.

---

## 6. Error Handling & Security Boundary Audit

### 6.1 Global Exception Filter (`AllExceptionsFilter`)
All controller exceptions are caught by a unified NestJS exception filter ensuring consistent error formatting compliant with `@aashvo/contracts`:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Monthly rent must be a positive number.",
    "details": ["rentAmount must not be less than 0"]
  },
  "meta": {
    "requestId": "c1f7b022-7729-43c2-b258-fc24e75d0482",
    "timestamp": "2026-11-15T02:30:00.000Z"
  }
}
```

### 6.2 Security Guard Matrix
- **`JwtAuthGuard`:** Validates access JWT signature, checks `User.accountStatus !== 'suspended'`, and verifies token revocation via session database.
- **`RolesGuard`:** Enforces role-based access (`@Roles('admin', 'owner', 'renter')`). Demotes forged client-side claims.
- **`ThrottlerGuard`:** Enforces rate-limiting on sensitive endpoints:
  - `/auth/login`: 5 attempts per 15 minutes.
  - `/auth/register`: 3 attempts per hour.
  - `/inquiries`: 10 requests per 15 minutes.
  - `/support/tickets/guest`: 5 requests per 15 minutes.
- **`PublicGuard`:** Explicit `@Public()` decorator required to bypass authentication; all routes default to secure.

---

## 7. Audit Conclusion

The AASHVO full-stack architecture is fully integrated, locally verified on PostgreSQL 16.16, and free of any hidden third-party BaaS dependencies. The contract layer `@aashvo/contracts` provides 100% type safety between React and NestJS, preventing payload drift. The system is verified and ready for staging environment provisioning.

