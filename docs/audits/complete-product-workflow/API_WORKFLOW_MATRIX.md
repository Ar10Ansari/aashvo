# AASHVO API Workflow & Contract Matrix

**Audit Date:** November 2026  
**Auditor:** Autonomous CTO & Principal Software Architect  

---

## 1. Traceability Matrix: Component to Endpoint to PostgreSQL Entity

| UI Component | Trigger Event | Service Method | HTTP Verb & Path | Controller Handler | Prisma Model Affected |
|---|---|---|---|---|---|
| `DiscoverySection.tsx` | Page mount / Filter change | `propertyService.getProperties()` | `GET /api/v1/properties` | `PropertiesController.findAll` | `Property`, `User` |
| `ListPropertyModal.tsx` | Wizard submit | `propertyService.createProperty()` | `POST /api/v1/properties` | `PropertiesController.create` | `Property`, `AuditLog` |
| `ListPropertyModal.tsx` | Save Draft click | `propertyService.createProperty(..., { asDraft: true })` | `POST /api/v1/properties` | `PropertiesController.create` | `Property` |
| `PropertyDetailModal.tsx` | Inquire form submit | `propertyService.submitInquiry()` | `POST /api/v1/properties/:id/inquiries` | `PropertiesController.createInquiry` | `PropertyInquiry`, `Notification` |
| `ScheduleVisitModal.tsx` | Date/time slot select | `visitService.scheduleVisit()` | `POST /api/v1/visits` | `VisitsController.create` | `Visit`, `Notification` |
| `RescheduleVisitModal.tsx` | New time propose | `visitService.rescheduleVisit()` | `POST` & `PATCH /api/v1/visits/:id/reschedule` | `VisitsController.reschedule` | `Visit`, `AuditLog` |
| `PropertyCard.tsx` | Bookmark toggle ON | `savedService.saveItem()` | `POST /api/v1/saved` | `SavedController.create` | `SavedItem` |
| `PropertyCard.tsx` | Bookmark toggle OFF | `savedService.unsaveItem()` | `DELETE /api/v1/saved/:itemType/:targetId` | `SavedController.deleteByTypeAndTarget` | `SavedItem` |
| `NotificationDropdown.tsx` | Mark all read click | `notificationService.markAllAsRead()` | `PATCH /api/v1/notifications/read-all` | `NotificationsController.markAllAsRead` | `Notification` |
| `SafetyReportModal.tsx` | Report submit | `supportService.submitSafetyReportToBackend()` | `POST /api/v1/support/reports` | `SupportController.createReport` | `SafetyReport`, `AuditLog` |
| `HelpCenterModal.tsx` | Ticket submit | `supportService.createTicket()` | `POST /api/v1/support/tickets` | `SupportController.createTicket` | `SupportTicket`, `AuditLog` |
| `AdminModerationModal.tsx` | Approve / Pause click | `propertyService.moderatePropertyInBackend()` | `PATCH /api/v1/properties/:id/moderate` | `PropertiesController.moderate` | `Property`, `AuditLog` |
| `RentalAgreementView.tsx` | Digital Sign click | `rentalTrustService.signAgreement()` | `POST /api/v1/agreements/:id/sign` | `AgreementsController.sign` | `TenancyAgreement` |
| `ConnectMatchingDeck.tsx` | Fetch roommate cards | `connectService.getMatches()` | `GET /api/v1/connect/matches` | `ConnectController.getMatches` | `Profile`, `Preference` |

---

## 2. Authentication & Authorization Guard Map

| Endpoint Pattern | Auth Guard | Role Required | Actor Constraint |
|---|---|---|---|
| `GET /api/v1/properties` | None (Public) | Any | Public listing read |
| `POST /api/v1/properties` | `JwtAuthGuard` | User / Host | Must be authenticated |
| `PATCH /api/v1/properties/:id/moderate` | `JwtAuthGuard`, `RolesGuard` | Admin / Moderator | Strict RBAC |
| `POST /api/v1/properties/:id/inquiries` | `JwtAuthGuard` | User | Prevent self-inquiry |
| `POST /api/v1/visits` | `JwtAuthGuard` | User | Cannot visit own property |
| `PATCH /api/v1/visits/:id/reschedule` | `JwtAuthGuard` | Host or Visitor | Must be participant |
| `DELETE /api/v1/saved/:itemType/:targetId` | `JwtAuthGuard` | User | Scoped to `req.user.id` |
| `POST /api/v1/support/reports` | `OptionalJwtAuthGuard` | Any / Guest | Handles null actor cleanly |
