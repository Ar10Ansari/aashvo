# AASHVO — Master Release Initial Codebase Audit & Gap Analysis

**Author:** Principal Software Architect & QA Lead  
**Date:** 2026-11-14  
**Workspace:** `D:\Projects\AASHVO` | GitHub: `https://github.com/Ar10Ansari/aashvo.git` | Branch: `master`  
**Phase:** **MASTER RELEASE AUDIT (WORKSTREAM A)**

---

## 1. Executive Summary

This initial audit establishes an objective baseline of implemented functionality versus the full product requirements specified in the Master Release Directive. 

Sprint 1 through Sprint 3.5 established a robust independent backend foundation:
- **Verified Working Backend:** 33 unique URL paths / 39 HTTP operations across 9 NestJS modules in `apps/api`.
- **Verified Relational Database:** 23 base tables, 15 CHECK constraints, 47 foreign keys, and 5 GIN/partial indexes in PostgreSQL 16.16.
- **Verified Authentication:** Argon2id hashing, RS256 JWTs, rotating refresh sessions, RFC 6265bis cookies, and account lockout defenses.
- **Verified Core Domain:** User profiles, locations, properties with admin moderation, media vault, flatmates with lifestyle compatibility, family stays with host residence checks, and single-target inquiries with phone masking.
- **Verified Test Baselines:** 48 backend Jest tests and 232 frontend Vitest tests passing with 0 errors.

---

## 2. Component-by-Component Gap Analysis

### 2.1 Frontend-to-Backend Integration Layer
| Area | Existing State | Production Requirement | Gap Severity |
|---|---|---|---|
| **API Client** | Frontend calls Supabase JS SDK (`@supabase/supabase-js`) directly or falls back to in-memory seeds. | Unified REST client calling NestJS backend at `/api/v1` with bearer tokens, credentials, and refresh rotation. | **HIGH (Release Blocker)** |
| **Authentication Flow** | `AuthModal.tsx` connects to Supabase GoTrue or mock auth. | Must authenticate against `/api/v1/auth/login` and `/api/v1/auth/register`, receiving RS256 JWTs and `__Host-` cookies. | **HIGH (Release Blocker)** |
| **Marketplace Data** | `DiscoverySection.tsx` reads from `AppContext` (Supabase query / seeds). | Reads active listings from `/api/v1/properties`, `/api/v1/flatmates`, and `/api/v1/family-stays`. | **HIGH (Release Blocker)** |

### 2.2 User Profiles, Dashboard & Saved Items
| Area | Existing State | Production Requirement | Gap Severity |
|---|---|---|---|
| **User Dashboard** | Partial profile modal; lacks unified dashboard. | Central dashboard: My Listings, Saved Properties, Saved Flatmates, Sent Inquiries, Received Inquiries, Account Settings. | **MEDIUM** |
| **Saved Items** | In-memory / localStorage only. | Persistent user bookmarks for properties and flatmate profiles. | **MEDIUM** |
| **In-App Notifications** | DB table `notification_outbox` exists; no frontend bell or user inbox endpoint. | User notification center with read/unread indicators. | **MEDIUM** |

### 2.3 Rental Trust Engine (`apps/api`)
| Area | Existing State | Production Requirement | Gap Severity |
|---|---|---|---|
| **Tenancy Agreements** | DB table `agreements` exists; frontend has mock/Supabase mapper. NestJS `AgreementsModule` not yet built. | Backend `AgreementsModule` with digital signature state machine (`draft` -> `pending_signatures` -> `active`). | **HIGH (Trust Engine Core)** |
| **Property Inspections** | DB table `inspection_reports` exists; NestJS `InspectionsModule` not yet built. | Backend `InspectionsModule` for itemized room checklists and condition reports. | **HIGH (Trust Engine Core)** |
| **Verified Reviews** | DB table `reviews` exists (`chk_review_rating_range`); NestJS `ReviewsModule` not yet built. | Backend `ReviewsModule` enforcing verified tenancy before review publication. | **HIGH (Trust Engine Core)** |
| **Disputes & Arbitration** | DB table `disputes` exists (`uq_active_dispute_per_agreement_type`); NestJS `DisputesModule` not yet built. | Backend `DisputesModule` handling security deposit dispute filing and admin resolution. | **HIGH (Trust Engine Core)** |
| **Support Tickets** | DB table `support_tickets` exists; frontend uses Supabase RPC. NestJS `SupportModule` not yet built. | Backend `SupportModule` replacing Supabase RPC with omnichannel support endpoints. | **HIGH (Trust Engine Core)** |

### 2.4 Media Vault Frontend Connection
| Area | Existing State | Production Requirement | Gap Severity |
|---|---|---|---|
| **Media Uploads** | Backend `MediaModule` has presigned upload/confirm endpoints. Frontend modal uses mock photo URLs. | Connect frontend image picker to `POST /api/v1/media/presigned-upload` and `POST /api/v1/media/confirm`. | **MEDIUM** |

### 2.5 Admin Moderation Console
| Area | Existing State | Production Requirement | Gap Severity |
|---|---|---|---|
| **Moderation Flow** | `AdminModerationModal.tsx` exists; currently connects to Supabase or mock data. | Connect to NestJS `GET /api/v1/properties/mine` / staff queues and `PATCH /api/v1/properties/:id/moderate`. | **MEDIUM** |

---

## 3. Production Infrastructure & External Integrations Audit

| Integration Target | Current Codebase Status | Missing Production Dependency | Production Readiness Status |
|---|---|---|---|
| **PostgreSQL 16 Engine** | 100% verified on local port 5433 (`127.0.0.1:5433`). | DigitalOcean Managed PG BLR1 provisioning. | **LOCAL READY** |
| **NestJS Backend Service** | 100% verified locally on port 4000. | DigitalOcean App Platform BLR1 deployment. | **LOCAL READY** |
| **Cloudflare R2** | Adapter prepared in `CloudStorageAdapter`. | Production R2 bucket & API token. | **ADAPTER READY** |
| **AWS S3 Mumbai (Private)**| Adapter prepared in `CloudStorageAdapter`. | Production S3 bucket & IAM credentials. | **ADAPTER READY** |
| **Transactional Email** | Port `MailDispatchPort` / `NoopMailer` verified. | SMTP / Amazon SES credentials. | **PORT READY** |
| **Google OAuth** | Frontend UI triggers callback; backend handles JWTs. | Google Cloud OAuth Client ID & Secret. | **CONFIG PENDING** |

---

## 4. Priority Workstream Mapping

Based on the audit findings, the implementation workstreams will execute in the following dependency order:

1. **Workstream B:** Authentication & User Accounts (Frontend + Backend full-stack integration).
2. **Workstream C & D:** Marketplace Frontend & Backend Integration (Properties, Flatmates, Family Stays).
3. **Workstream E:** Saved Items, User Dashboard, Inquiries & Notifications.
4. **Workstream F:** Admin Panel & Staff Moderation Console.
5. **Workstream G:** Rental Trust Engine (Agreements, Inspections, Reviews, Disputes, Support).
6. **Workstream H:** Media Storage & External Integration Register.
7. **Workstream I, J, K, L:** Security, Performance, SEO Verification, End-to-End QA, and Release Candidate Runbook.

