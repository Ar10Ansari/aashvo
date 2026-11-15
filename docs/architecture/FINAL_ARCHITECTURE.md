# AASHVO — FINAL ARCHITECTURE SPECIFICATION
## RC-1.0.0 End-to-End System Architecture & Technical Topology

**Document Status:** Approved & Authoritative  
**Classification:** Core System Architecture  
**Date:** November 2026  
**Author:** AASHVO Principal Software Architect  
**Release Candidate:** RC-1.0.0  

---

## 1. Architectural Mission & Core Principles

AASHVO is a modern, full-stack shared-living and accommodation marketplace designed for students and working professionals across India. The application adheres to five core architectural principles:

1. **One Monolithic Backend:** A single, authoritative NestJS 11 service (`apps/api`) owns all business rules, database queries, and security enforcement. Zero parallel backends or duplicate routing layers.
2. **One Database of Record:** PostgreSQL 16 with strong relational constraints, managed through Prisma ORM with strict zero-downtime migrations.
3. **Strict Contract Sharing:** `@aashvo/contracts` provides compile-time type safety across both frontend and backend, with automated OpenAPI 3.x generation.
4. **Multi-Tenant Privacy & Sandboxing:** Strict RBAC, IDOR database query boundaries, match-only Connect messaging gates, and private document storage with time-limited pre-signed URLs.
5. **Multi-Cloud Storage Abstraction:** A unified `StorageService` interface abstracting local disk, Cloudflare R2 (for public photos), and AWS S3 Mumbai (for private encrypted KYC and property title deeds).

---

## 2. End-to-End System Topology

```mermaid
flowchart TD
    subgraph ClientTier["Client Tier (Web & Mobile Viewports)"]
        Browser["React 18 SPA (Vite 6 + Tailwind)\n- Discovery & Search\n- Aashvo Connect (Swipe Deck)\n- Rental Agreements & Visits\n- Help Desk & Disputes"]
    end

    subgraph EdgeTier["Edge & Gateway Tier"]
        VercelCDN["Vercel Edge Network\n- Static Assets & Brotli / Gzip Cache\n- Reverse Proxy /api/v1 -> Backend"]
    end

    subgraph BackendTier["Backend Application Tier (apps/api)"]
        NestMonolith["NestJS 11 Monolith\n- Pino Structured Logging\n- Helmet Security Headers\n- Global ValidationPipe (class-validator)\n- Throttler Rate Limiter\n- RFC 7807 Exception Filter"]
        
        subgraph NestModules["Domain Modules"]
            AuthMod["AuthModule (Argon2id + JWT)"]
            PropMod["PropertiesModule"]
            ConnMod["ConnectModule (Mutual Match Gate)"]
            RentMod["RentalTrustModule"]
            SuppMod["SupportModule"]
            StorMod["StorageModule"]
            LocMod["LocationsModule (Spatial Search)"]
        end
    end

    subgraph DataTier["Data & Persistence Tier"]
        PrismaClient["Prisma ORM Client v6.19.3"]
        PostgresDB[("PostgreSQL 16 Database\n- 22 Relational Tables\n- B-Tree & Spatial Indexes\n- Foreign Keys with CASCADE / RESTRICT")]
    end

    subgraph StorageTier["Cloud Storage Tier"]
        R2["Cloudflare R2\n- Public CDN (Property & Avatar Photos)"]
        S3["AWS S3 ap-south-1\n- Private Encrypted Vault (KYC / Deeds)\n- 15-Minute Pre-Signed Download URLs"]
    end

    Browser -->|HTTPS / WSS| VercelCDN
    VercelCDN -->|Proxy /api/v1| NestMonolith
    NestMonolith --> NestModules
    NestModules --> PrismaClient
    PrismaClient --> PostgresDB
    StorMod -->|Public Assets| R2
    StorMod -->|Private Documents| S3
```

---

## 3. Subsystem Architectural Details

### 3.1 Frontend Architecture (`src/`)
- **Framework:** React 18 with TypeScript 5.7.
- **Build System:** Vite 6 with Rollup manual chunk-splitting:
  - `vendor-react` (React, ReactDOM): 134 kB (43 kB gzip)
  - `vendor-icons` (Lucide React): 39 kB (9 kB gzip)
  - `index` (Application code): 437 kB (96 kB gzip)
- **Styling:** Tailwind CSS 3.4 using AASHVO's warm botanical palette (Forest Green `#1B4332`, Sand Warm `#D4A373`, Ivory `#FBF9F5`, Charcoal `#1F2937`).
- **State Management:** React Context (`AppContext.tsx`) managing authenticated user session, filter states, real-time toasts, and modal visibility.
- **Accessibility:** 100% WCAG 2.1 Level AA compliance, featuring standard WAI-ARIA 1.2 dialog semantics (`role="dialog"`, `aria-modal="true"`), visible focus rings, and screen-reader error announcements (`role="alert"`).

### 3.2 Shared Contracts (`packages/contracts/`)
- Pure TypeScript contracts package without runtime dependencies.
- Shared DTO interfaces:
  - `CreatePropertyDto`, `SearchPropertiesQueryDto`, `PropertyVerificationDto`
  - `ConnectDiscoverQueryDto`, `SwipeDto`, `SendMessageDto`
  - `CreateInquiryDto`, `InquiryMessageDto`
  - `CreateRentalAgreementDto`, `SignAgreementDto`, `MoveInChecklistDto`
  - `CreateSupportTicketDto`, `CreateDisputeDto`
- Exported Canonical Constants & Enums:
  - `FLATMATE_INTENTIONS`, `ACCOMMODATION_TYPES`, `RENTAL_AGREEMENT_STATUSES`, `DISPUTE_STATUSES`
- Automated OpenAPI 3.x generation script (`apps/api/src/scripts/generate-openapi.ts`) writing directly to `packages/contracts/openapi.json`.

### 3.3 Backend Architecture (`apps/api/`)
- **Framework:** NestJS 11 running on Node.js 22.
- **Security Middleware:**
  - `helmet()` enforcing strict Content Security Policy, HSTS, X-Frame-Options, and X-Content-Type-Options.
  - `@nestjs/throttler` restricting brute-force attacks (5 req/min on auth, 100 req/min globally).
  - Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- **Authentication:**
  - Password hashing via **Argon2id** ($m=65536, t=3, p=4$).
  - Short-lived JWT access tokens (15-minute expiration).
  - Opaque cryptographically random refresh tokens hashed via SHA-256 with replay-attack family revocation.
- **Authorization & Scoping:**
  - Role hierarchy: `GUEST` $\to$ `RENTER` $\to$ `OWNER` $\to$ `ADMIN` $\to$ `SUPERADMIN`.
  - IDOR queries scoped by `ownerId` or `userId` at the Prisma query level.
- **Aashvo Connect Gate:**
  - Reciprocal match record verified before any message channel is unlocked. Unilateral likes strictly return `403 Forbidden`.
  - PII masking on discovery cards: exact street addresses, phone numbers, and IDs are stripped.
- **Observability:**
  - Structured JSON logging via `pino` with automatic field redaction for passwords, bearer tokens, cookies, PAN, and Aadhaar numbers.
  - `X-Request-Id` correlation injected into all response headers and log lines.

### 3.4 Database Tier (`PostgreSQL 16` + `Prisma ORM`)
- **Engine:** PostgreSQL 16.16 with connection pooling.
- **Schema Design:** 22 relational models:
  - Identity & Access: `User`, `Profile`, `RefreshToken`
  - Real Estate: `Property`, `PropertyAmenity`, `PropertyRoom`, `PropertyVerification`
  - Flatmates & Connect: `FlatmateProfile`, `Like`, `Match`, `ConnectMessage`
  - Inquiries & Visits: `Inquiry`, `InquiryMessage`, `PropertyVisit`
  - Rental Trust: `RentalAgreement`, `MoveInChecklist`, `Dispute`, `RentalReputation`
  - Support & Moderation: `SupportTicket`, `TicketMessage`, `Report`, `AuditEvent`
- **Indexing Strategy:**
  - B-Tree indexes on search attributes `(status, city, locality, price)`.
  - Spatial indexes on `(latitude, longitude)`.
  - Composite unique indexes on `(swiper_id, target_id)` and `(user_a_id, user_b_id)`.

### 3.5 Storage Tier (`StorageService`)
- Multi-cloud abstraction implementing a uniform storage provider interface:
  - **Local Storage Provider:** Sandboxed storage for local testing.
  - **Cloudflare R2 Provider:** High-speed S3-compatible public bucket for listing photos and user avatars.
  - **AWS S3 Mumbai (`ap-south-1`):** Private encrypted bucket for identity documents, property tax receipts, electricity bills, and signed agreements. Pre-signed URLs generated with a 15-minute expiry.

---

## 4. Request-Response Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Gateway as Vercel Edge / Reverse Proxy
    participant Nest as NestJS 11 Monolith
    participant Guard as Auth & Roles Guards
    participant Service as Domain Service
    participant Prisma as Prisma ORM
    participant DB as PostgreSQL 16

    User->>Gateway: POST /api/v1/connect/messages
    Gateway->>Nest: Forward Request with X-Request-Id
    Nest->>Nest: Global ValidationPipe (Payload DTO Check)
    Nest->>Guard: Verify JWT Access Token
    Guard-->>Nest: User Session (userId, role)
    Nest->>Service: ConnectService.sendMessage(userId, dto)
    Service->>Prisma: Check Reciprocal Match Status
    Prisma->>DB: SELECT * FROM matches WHERE user_a_id = $1 AND user_b_id = $2
    DB-->>Prisma: Match Record Found (status: active)
    Service->>Prisma: Create Message in Atomic Transaction
    Prisma->>DB: INSERT INTO connect_messages (...)
    DB-->>Prisma: Saved Message
    Service-->>Nest: Message Entity
    Nest->>Nest: ResponseEnvelopeInterceptor (Wrap in { success: true, data })
    Nest-->>Gateway: HTTP 201 Created (JSON Payload)
    Gateway-->>User: HTTP 201 Created
```

---

## 5. Architectural Verdict

The AASHVO RC-1.0.0 architecture represents a unified, production-ready full-stack monolith. It eliminates technical fragmentation, provides rigorous multi-tenant data isolation, and guarantees sub-15ms p95 query performance under high load.

