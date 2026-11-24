# AASHVO CTO — Storage Verification Report

**Author:** AASHVO CTO & Infrastructure Architect  
**Date:** November 24, 2026  
**Candidate Branch:** `staging/mvp-fasttrack-candidate`  
**Commit:** `ccfe38a5372be8ba6833d3927567055b817d79e8`  
**Storage Architecture Target:** Cloudflare R2 (Public CDN) & AWS S3 Mumbai (Encrypted Vault)  
**Status:** **ARCHITECTURE VERIFIED — UPLOADS RESTRICTED PENDING STAGING CREDENTIALS**

---

## 1. Executive Summary

Storage architecture on AASHVO handles two distinct categories of data with fundamentally different security, privacy, and durability requirements:
1. **Public Media Assets:** Property photographs, room walkthroughs, and user profile avatars.
2. **Private Confidential Documents:** Government identity proofs (Aadhaar / Passport for KYC verification) and digital tenancy lease agreements.

In compliance with CTO Directive Section 3 (*"Do not enable uploads until storage is fully verified"*), this audit validates upload authorization, file type / size bounds, presigned URL lifecycles, and access control boundaries.

---

## 2. Dual Storage Architecture & Adapter Design

AASHVO utilizes a port-and-adapter storage design:
- **Interface:** [apps/api/src/modules/media/ports/storage.port.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/media/ports/storage.port.ts)
- **Local Adapter:** [apps/api/src/modules/media/adapters/local-storage.adapter.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/media/adapters/local-storage.adapter.ts) (used for local development and deterministic E2E testing).
- **Cloud Adapter:** [apps/api/src/modules/media/adapters/cloud-storage.adapter.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/media/adapters/cloud-storage.adapter.ts) (production and staging multi-cloud storage).

```
                      +-----------------------------+
                      |   NestJS Media Controller   |
                      |    (MediaService Port)      |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
    [ Public Asset Flow ]                       [ Private Vault Flow ]
  - Property Photos & Avatars                 - Rental Agreements & KYC
  - Cloudflare R2 Bucket                      - AWS S3 ap-south-1 Mumbai
  - Direct Presigned PUT                      - Direct Presigned PUT
  - Global Edge CDN Cached                    - Server-Side KMS Encrypted
  - Public HTTPS Read Access                  - Short-Lived (300s) Presigned GET
```

---

## 3. Storage Specification & Bucket Topology

| Dimension | Public Assets (Cloudflare R2) | Private Vault (AWS S3) |
| :--- | :--- | :--- |
| **Primary Region** | Global Edge (Anycast) | `ap-south-1` (Mumbai, India) |
| **Bucket Name (Staging)** | `aashvo-staging-public` | `aashvo-staging-vault` |
| **Bucket Name (Prod)** | `aashvo-public-assets` | `aashvo-private-vault` |
| **Data Types** | Property photos, room images, avatars | Tenancy contracts, Aadhaar, KYC PDFs |
| **Default Bucket Privacy** | Public Read via CDN | **Strict Block Public Access** (All 4 settings ON) |
| **Encryption Standard** | Cloudflare Managed Encryption | AWS KMS / SSE-S3 AES-256 |
| **CORS Configuration** | Allow `PUT`, `GET` from verified origins | Allow `PUT` only from verified origins; `GET` blocked |
| **Delivery Model** | Cloudflare CDN (`https://cdn.aashvo.in`) | Time-limited signed URLs (`expiresIn = 300s`) |

---

## 4. Upload Authorization, MIME Types & Size Restrictions

Every upload request is intercepted by [apps/api/src/modules/media/media.service.ts](file:///d:/Projects/AASHVO/apps/api/src/modules/media/media.service.ts) and subjected to strict validation:

### A. MIME Type Whitelisting
- **Allowed Images:** `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- **Allowed Documents:** `application/pdf`, `image/jpeg`, `image/png`
- **Enforcement:** Any unexpected MIME type triggers an immediate HTTP 400 (`UNSUPPORTED_MEDIA_TYPE`).

### B. File Size Ceilings
- **Images:** Maximum 10 MB (`MAX_IMAGE_SIZE_BYTES = 10,485,760`).
- **Documents:** Maximum 25 MB (`MAX_DOCUMENT_SIZE_BYTES = 26,214,400`).
- **Enforcement:** Payload metadata specifying size exceeding these ceilings triggers HTTP 400 (`FILE_TOO_LARGE`).

### C. Role-Based Bucket Access Control
- **`property-photos`:** Restrictive authorization allowing only `owner`, `broker`, or `admin` roles (or renters uploading verification photos for verified flatmate profiles).
- **`rental-documents`:** Requires the requesting user to be an active counterparty (tenant or landlord) on the specified tenancy agreement, preventing cross-tenant document exposure.

---

## 5. Signed Upload & Download URL Lifecycles

1. **Presigned Upload Flow:**
   - Client sends POST to `/api/v1/media/presigned-upload` with bucket, filename, content type, and file size.
   - Server validates caller role and file metadata, registers a `MediaAsset` record with status `pending_upload`, and returns a signed upload URL with 15-minute expiration (`expiresInSeconds: 900`).
   - Client uploads raw file directly to R2 / S3 via `PUT` request with required `Content-Type` header.
   - Client calls POST `/api/v1/media/confirm` with asset ID.
   - Server verifies object presence and transitions status to `ready`.
2. **Presigned Download Flow (Private Vault):**
   - Direct GET requests to private S3 URLs are rejected by AWS S3 (Block Public Access).
   - Client requests download link via GET `/api/v1/media/:id/download`.
   - Server verifies user authorization and counterparty relationship.
   - Server generates an AWS SigV4 signed URL with a maximum TTL of 300 seconds (5 minutes).

---

## 6. Restart Persistence & Durability Audit

Unlike ephemeral disk storage on container instances (e.g. Render dynos where local disk is wiped upon restart), cloud object storage provides:
- **Cloudflare R2:** 99.999999999% (11 9s) durability across redundant distributed storage nodes.
- **AWS S3 Mumbai (`ap-south-1`):** Triple-Availability-Zone data replication with 99.999999999% durability.
- **State Survival:** Property photos and rental agreements persist indefinitely across application redeployments, scale-to-zero cycles, and server restarts.

---

## 7. Storage Go/No-Go Recommendation

**VERDICT: READY WITH CONDITIONS (Uploads Gated)**

- **Code & Security Architecture:** Verified and compliant with enterprise privacy requirements.
- **Operational Condition:** Upload features must remain disabled / pointed to `LocalStorageAdapter` in staging until the dedicated Cloudflare R2 bucket (`aashvo-staging-public`) and AWS S3 bucket (`aashvo-staging-vault`) credentials are provided in staging environment variables.
