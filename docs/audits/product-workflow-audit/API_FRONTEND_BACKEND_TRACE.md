# AASHVO API Frontend-to-Backend Full-Stack Trace

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Principal Platform Architect  
**Scope:** Complete cross-layer trace of all 17 NestJS Controllers (64 HTTP endpoints), client-side services (`src/services/`), React state actions (`AppContext.tsx`), and Prisma database models.

---

## 1. Architectural Disconnect Root Cause Analysis

AASHVO currently exhibits a split-brain architecture between two conflicting backend strategies:

1. **Strategy A (Modern NestJS REST API + PostgreSQL 16 via Prisma ORM):**
   - 17 production-grade controllers located in `apps/api/src/modules/`.
   - Comprehensive validation pipes (`class-validator`), JWT authentication guards (`JwtAuthGuard`), role-based access control (`RolesGuard`), and 34 normalized relational tables.
2. **Strategy B (Legacy Supabase Direct Client):**
   - Implemented in `src/services/supabase.ts` and referenced directly in `src/context/AppContext.tsx` and legacy services (`marketplaceService.ts`, `rentalTrustService.ts`).
   - When environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured or when running against the NestJS backend, these operations fall back to local in-memory React state with fake UI notifications.

### Disconnect Impact Matrix
| Frontend Action | UI Component | Service Called | Expected NestJS Endpoint | Actual Runtime Behavior | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **List Property** | `ListPropertyModal.tsx` | `AppContext.addProperty` | `POST /api/v1/properties` | Calls `createPropertyInSupabase()` or saves to local state. **NestJS bypassed.** | **P0 - Critical** |
| **Send Inquiry** | `PropertyDetailModal.tsx` | `AppContext.submitConnectRequest` | `POST /api/v1/inquiries` | Calls Supabase `inquiries` table or shows mock toast. **NestJS bypassed.** | **P0 - Critical** |
| **Tenancy Agreement** | `RentalTrustModal.tsx` | `rentalTrustService.ts` | `GET /api/v1/agreements/mine`<br>`POST /api/v1/agreements` | Directly queries PostgREST `tenancy_agreements`. **NestJS bypassed.** | **P1 - High** |
| **Support Ticket** | `SupportModal.tsx` | `AppContext.createSupportTicket` | `POST /api/v1/support/tickets` | Calls Supabase `support_tickets` or local state. **NestJS bypassed.** | **P1 - High** |
| **Safety Report** | `SafetyModal.tsx` | `AppContext.createSafetyReport` | `POST /api/v1/support/disputes` | Calls Supabase `safety_reports` or local state. **NestJS bypassed.** | **P1 - High** |
| **Mark Notifications Read** | `NotificationCenter.tsx` | `notificationService.markAllAsRead` | `POST /api/v1/notifications/read-all` | Calls `/notifications/mark-all-read`, resulting in **404 Not Found**. | **P1 - High** |

---

## 2. Exhaustive NestJS Controller Coverage Matrix (64 Endpoints)

### 2.1 Auth Module (`apps/api/src/modules/auth/auth.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | `authService.register` | `RegisterDto` (email, password, name, role) | **VERIFIED** |
| `POST` | `/api/v1/auth/login` | `authService.login` | `LoginDto` (email, password) | **VERIFIED** |
| `POST` | `/api/v1/auth/google` | `authService.googleLogin` | `GoogleLoginDto` (idToken) | **VERIFIED** |
| `POST` | `/api/v1/auth/refresh` | Axios response interceptor | Cookies / Refresh token | **VERIFIED** |
| `POST` | `/api/v1/auth/logout` | `authService.logout` | Authenticated session | **VERIFIED** |
| `GET` | `/api/v1/auth/me` | `authService.getCurrentUser` | `JwtAuthGuard` | **VERIFIED** |

### 2.2 Marketplace Profiles Module (`apps/api/src/modules/profiles/profiles.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/profiles/me` | `marketplaceProfileService.getMyProfile` | `JwtAuthGuard` | **VERIFIED** |
| `PATCH` | `/api/v1/profiles/me` | `marketplaceProfileService.updateProfile` | `UpdateProfileDto` | **VERIFIED** |
| `POST` | `/api/v1/profiles/switch-role` | `marketplaceProfileService.switchRole` | `SwitchRoleDto` (role) | **VERIFIED** |
| `POST` | `/api/v1/profiles/onboarding/draft` | `marketplaceProfileService.saveDraft` | `SaveDraftDto` (step, data) | **VERIFIED** |
| `POST` | `/api/v1/profiles/onboarding/publish` | `marketplaceProfileService.publish` | `PublishProfileDto` | **VERIFIED** |
| `GET` | `/api/v1/profiles/:userId` | `marketplaceProfileService.getPublicProfile` | Public param | **VERIFIED** |

### 2.3 Connect Intelligence Module (`apps/api/src/modules/connect/connect.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/connect/candidates` | `connectService.getCandidates` | `JwtAuthGuard` + Preferences vector | **VERIFIED** |
| `GET` | `/api/v1/connect/preferences` | `connectService.getPreferences` | `JwtAuthGuard` | **VERIFIED** |
| `PUT` | `/api/v1/connect/preferences` | `connectService.updatePreferences` | `UpdatePreferencesDto` | **VERIFIED** |
| `POST` | `/api/v1/connect/swipe` | `connectService.recordSwipe` | `SwipeDto` (candidateId, direction) | **VERIFIED** |
| `GET` | `/api/v1/connect/matches` | `connectService.getMatches` | `JwtAuthGuard` | **VERIFIED** |
| `GET` | `/api/v1/connect/matches/:id/messages` | `connectService.getMatchMessages` | `JwtAuthGuard` | **VERIFIED** |
| `POST` | `/api/v1/connect/matches/:id/messages` | `connectService.sendMessage` | `SendMessageDto` (content) | **VERIFIED** |
| `POST` | `/api/v1/connect/matches/:id/unmatch` | `connectService.unmatch` | `JwtAuthGuard` | **VERIFIED** |
| `POST` | `/api/v1/connect/block` | `connectService.blockUser` | `BlockUserDto` (targetUserId, reason) | **VERIFIED** |
| `POST` | `/api/v1/connect/report` | `connectService.reportUser` | `ReportUserDto` (targetUserId, reason, details) | **VERIFIED** |

### 2.4 Properties Module (`apps/api/src/modules/properties/properties.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/properties` | `apiClient` (direct call or seed) | Query params (city, minPrice, etc.) | **PARTIALLY VERIFIED** |
| `GET` | `/api/v1/properties/:id` | `apiClient.get` | Param `:id` | **PARTIALLY VERIFIED** |
| `POST` | `/api/v1/properties` | **UNCONNECTED** (Called via Supabase) | `CreatePropertyDto` | **DISCONNECTED** |
| `PATCH` | `/api/v1/properties/:id` | **UNCONNECTED** | `UpdatePropertyDto` | **DISCONNECTED** |
| `DELETE` | `/api/v1/properties/:id` | **UNCONNECTED** | Owner Guard | **NOT IMPLEMENTED IN UI** |
| `GET` | `/api/v1/properties/mine` | **UNCONNECTED** | `JwtAuthGuard` | **NOT IMPLEMENTED IN UI** |

### 2.5 Flatmates Module (`apps/api/src/modules/flatmates/flatmates.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/flatmates` | `apiClient.get` | Query params | **PARTIALLY VERIFIED** |
| `GET` | `/api/v1/flatmates/:id` | `apiClient.get` | Param `:id` | **PARTIALLY VERIFIED** |
| `POST` | `/api/v1/flatmates/profile` | `marketplaceProfileService` | `CreateFlatmateProfileDto` | **VERIFIED** |
| `PATCH` | `/api/v1/flatmates/profile` | `marketplaceProfileService` | `UpdateFlatmateProfileDto` | **VERIFIED** |

### 2.6 Visits Module (`apps/api/src/modules/visits/visits.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/visits` | `visitService.scheduleVisit` | `ScheduleVisitDto` | **VERIFIED** |
| `GET` | `/api/v1/visits/mine` | `visitService.getMyVisits` | `JwtAuthGuard` | **VERIFIED** |
| `PATCH` | `/api/v1/visits/:id/status` | `visitService.updateVisitStatus` | `UpdateVisitStatusDto` | **VERIFIED** |
| `DELETE` | `/api/v1/visits/:id` | `visitService.cancelVisit` | `JwtAuthGuard` | **VERIFIED** |

### 2.7 Saved Module (`apps/api/src/modules/saved/saved.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/saved/toggle` | `savedService.toggleSaved` | `ToggleSavedDto` | **VERIFIED** |
| `GET` | `/api/v1/saved` | `savedService.getSaved` | `JwtAuthGuard` | **VERIFIED** |
| `DELETE` | `/api/v1/saved/:id` | `savedService.removeSaved` | `JwtAuthGuard` | **VERIFIED** |

### 2.8 Inquiries Module (`apps/api/src/modules/inquiries/inquiries.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/inquiries` | **UNCONNECTED** (Bypassed via Supabase) | `CreateInquiryDto` | **DISCONNECTED** |
| `GET` | `/api/v1/inquiries/mine` | **UNCONNECTED** | `JwtAuthGuard` | **NOT IMPLEMENTED IN UI** |
| `PATCH` | `/api/v1/inquiries/:id/status` | **UNCONNECTED** | Owner Guard | **NOT IMPLEMENTED IN UI** |

### 2.9 Agreements Module (`apps/api/src/modules/agreements/agreements.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/agreements` | **UNCONNECTED** (Calls Supabase) | `CreateAgreementDto` | **DISCONNECTED** |
| `GET` | `/api/v1/agreements/mine` | **UNCONNECTED** (Calls Supabase) | `JwtAuthGuard` | **DISCONNECTED** |
| `GET` | `/api/v1/agreements/:id` | **UNCONNECTED** | Participant Guard | **DISCONNECTED** |
| `POST` | `/api/v1/agreements/:id/sign` | **UNCONNECTED** | Digital signature payload | **DISCONNECTED** |

### 2.10 Inspections Module (`apps/api/src/modules/inspections/inspections.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/inspections` | **ORPHANED** (`MoveInChecklistModal`) | `CreateInspectionDto` | **ORPHANED** |
| `GET` | `/api/v1/inspections/:id` | **ORPHANED** | `JwtAuthGuard` | **ORPHANED** |

### 2.11 Notifications Module (`apps/api/src/modules/notifications/notifications.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | `notificationService.getNotifications` | `JwtAuthGuard` | **VERIFIED** |
| `PATCH` | `/api/v1/notifications/:id/read` | `notificationService.markAsRead` | Param `:id` | **VERIFIED** |
| `POST` | `/api/v1/notifications/read-all` | **MISMATCHED ROUTE** | Frontend calls `mark-all-read` | **ROUTE BUG (404)** |

### 2.12 Support & Disputes Modules (`apps/api/src/modules/support/` & `disputes/`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/support/tickets` | **UNCONNECTED** (Calls Supabase) | `CreateTicketDto` | **DISCONNECTED** |
| `POST` | `/api/v1/support/disputes` | **UNCONNECTED** (Calls Supabase) | `CreateDisputeDto` | **DISCONNECTED** |
| `GET` | `/api/v1/support/tickets/mine` | **UNCONNECTED** | `JwtAuthGuard` | **NOT IMPLEMENTED IN UI** |

### 2.13 Admin Module (`apps/api/src/modules/admin/admin.controller.ts`)
| HTTP Method | Route Path | Frontend Caller | DTO / Payload Validation | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/overview` | `AdminDashboardModal.tsx` | `RolesGuard('ADMIN')` | **PARTIALLY VERIFIED** |
| `GET` | `/api/v1/admin/verifications` | `AdminDashboardModal.tsx` | `RolesGuard('ADMIN')` | **PARTIALLY VERIFIED** |
| `POST` | `/api/v1/admin/verifications/:id/approve` | **UNCONNECTED** | Admin Guard | **DISCONNECTED** |
| `POST` | `/api/v1/admin/verifications/:id/reject` | **UNCONNECTED** | Admin Guard | **DISCONNECTED** |

---

## 3. Summary of Disconnects & Remediation Priority

1. **Unify Data Layer:** Deprecate `src/services/supabase.ts` and route all listing creations, inquiries, agreements, and support tickets through `src/services/apiClient.ts`.
2. **Fix Notification Route:** Rename frontend call in `notificationService.ts` from `/notifications/mark-all-read` to `/notifications/read-all`.
3. **Mount Orphaned Inspections:** Connect [MoveInChecklistModal.tsx](file:///d:/Projects/AASHVO/src/components/rental/MoveInChecklistModal.tsx) to property owner and tenant agreement views.
