# AASHVO — FRONTEND-TO-BACKEND API & DATA MAPPING
## Exhaustive Interface Specification: React Components, NestJS Endpoints, DTOs & PostgreSQL Schema

**Release:** RC-1.0.0  
**Contracts Package:** `@aashvo/contracts`  
**API Prefix:** `/api/v1`  
**Database:** PostgreSQL 16.16 (Prisma ORM)

---

## 1. Authentication & Session Management

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Registration** | `authService.signUpWithEmail()` | `POST /api/v1/auth/register` | `AuthController.register` | `RegisterDto`<br>`{ email, password, fullName, accountType }` | `AuthSuccessResponseDto`<br>`{ accessToken, user }` | `User`, `Profile`, `VerificationToken`, `AuditLog` |
| **User Login** | `authService.signInWithEmail()` | `POST /api/v1/auth/login` | `AuthController.login` | `LoginDto`<br>`{ email, password }` | `AuthSuccessResponseDto`<br>`{ accessToken, user }` | `User`, `RefreshSession`, `AuditLog` |
| **Token Refresh** | `apiClient` 401 Interceptor | `POST /api/v1/auth/refresh` | `AuthController.refresh` | Cookie: `aashvo_refresh_token` | `RefreshResponseDto`<br>`{ accessToken }` | `RefreshSession`, `User` |
| **User Logout** | `authService.signOut()` | `POST /api/v1/auth/logout` | `AuthController.logout` | Cookie: `aashvo_refresh_token` | `LogoutResponseDto`<br>`{ success: true }` | `RefreshSession` (revoked) |
| **Password Reset Request** | `authService.requestPasswordReset()` | `POST /api/v1/auth/password/forgot` | `AuthController.forgotPassword` | `ForgotPasswordDto`<br>`{ email }` | `GenericMessageResponseDto`<br>`{ success: true }` | `VerificationToken`, `NotificationOutbox` |
| **Password Reset Confirm** | `authService.resetPassword()` | `POST /api/v1/auth/password/reset` | `AuthController.resetPassword` | `ResetPasswordDto`<br>`{ token, newPassword }` | `GenericMessageResponseDto`<br>`{ success: true }` | `User` (hash updated), `VerificationToken` |

---

## 2. User Profiles & Flatmate Profiles

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **View My Profile** | `authService.getCurrentUserProfile()` | `GET /api/v1/profiles/me` | `ProfilesController.getMyProfile` | *None (JWT Auth)* | `ProfileResponseDto` | `Profile`, `User` |
| **Update My Profile** | `authService.updateProfile()` | `PATCH /api/v1/profiles/me` | `ProfilesController.updateMyProfile` | `UpdateProfileDto`<br>`{ fullName, phone, bio, avatarUrl, city }` | `ProfileResponseDto` | `Profile` |
| **Create/Update Flatmate Profile** | `marketplaceService.saveFlatmateProfile()` | `POST /api/v1/flatmates/me` | `FlatmatesController.upsertMyProfile` | `UpsertFlatmateProfileDto`<br>`{ occupation, age, gender, city, budgetMax, foodHabit, sleepRoutine, cleanliness, smoking, petFriendly, bio, interests }` | `FlatmateProfileResponseDto` | `FlatmateProfile` |
| **Get My Flatmate Profile** | `connectService.getMyProfile()` | `GET /api/v1/flatmates/me` | `FlatmatesController.getMyProfile` | *None (JWT Auth)* | `FlatmateProfileResponseDto` | `FlatmateProfile` |
| **Browse Flatmate Profiles** | `marketplaceService.fetchFlatmatesFromBackend()` | `GET /api/v1/flatmates` | `FlatmatesController.searchFlatmates` | Query: `SearchFlatmatesQueryDto`<br>`{ city, locality, gender, maxBudget, page, limit }` | `PaginatedFlatmatesResponseDto` | `FlatmateProfile`, `Profile` |

---

## 3. AASHVO Connect — Swipe Discovery & Mutual Matching

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Connect Discovery Feed** | `connectService.getDiscoveryFeed()` | `GET /api/v1/connect/discover` | `ConnectController.getDiscoveryFeed` | Query: `{ city, limit }` | `ConnectCandidateCard[]`<br>`[{ userId, compatibility, ... }]` | `FlatmateProfile`, `FlatmateInterest`, `UserBlock` |
| **Swipe Right (Like)** | `connectService.expressInterest(id, 'like')` | `POST /api/v1/connect/interests` | `ConnectController.expressInterest` | `ExpressInterestDto`<br>`{ targetUserId, action: 'like' }` | `InterestResultDto`<br>`{ matched: boolean, match?: { id } }` | `FlatmateInterest`, `FlatmateMatch`, `NotificationOutbox` |
| **Swipe Left (Pass)** | `connectService.expressInterest(id, 'pass')` | `POST /api/v1/connect/pass` | `ConnectController.passCandidate` | `PassCandidateDto`<br>`{ targetUserId }` | `{ success: true, matched: false }` | `FlatmateInterest` (`interest_type=pass`) |
| **Undo Recent Swipe** | `connectService.undoLastSwipe()` | `POST /api/v1/connect/undo` | `ConnectController.undoSwipe` | *None (JWT Auth)* | `{ success: true }` | `FlatmateInterest` (deleted) |
| **List Mutual Matches** | `connectService.getMatches()` | `GET /api/v1/connect/matches` | `ConnectController.getMatches` | *None (JWT Auth)* | `ConnectMatchListItem[]` | `FlatmateMatch`, `MatchMessage`, `Profile` |
| **Get Match Conversation** | `connectService.getMessages(matchId)` | `GET /api/v1/connect/matches/:id/messages` | `ConnectController.getMessages` | Param: `id` (UUID) | `ConnectMessageItem[]` | `MatchMessage`, `FlatmateMatch` |
| **Send Match Message** | `connectService.sendMessage(matchId, text)` | `POST /api/v1/connect/matches/:id/messages` | `ConnectController.sendMessage` | `SendConnectMessageDto`<br>`{ content }` | `ConnectMessageItem` | `MatchMessage`, `FlatmateMatch`, `NotificationOutbox` |
| **Unmatch / Block User** | `connectService.unmatch(matchId)` | `DELETE /api/v1/connect/matches/:id` | `ConnectController.unmatch` | Param: `id` (UUID), Body: `{ reason }` | `{ success: true }` | `FlatmateMatch` (status=unmatched), `UserBlock` |

---

## 4. Explore Marketplace, Entire Flats & Family Stays

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Search Properties** | `marketplaceService.fetchPropertiesFromBackend()` | `GET /api/v1/properties` | `PropertiesController.searchProperties` | Query: `SearchPropertiesQueryDto`<br>`{ city, locality, minRent, maxRent, roomType, furnishing, genderPreference, category }` | `PaginatedPropertiesResponseDto` | `Property`, `PropertyPhoto`, `PropertyVerification` |
| **View Property Details** | `marketplaceService.fetchPropertyById()` | `GET /api/v1/properties/:id` | `PropertiesController.getPropertyById` | Param: `id` (UUID) | `PropertyDetailDto` | `Property`, `PropertyPhoto`, `Profile`, `PropertyVerification` |
| **Create Property Listing** | `marketplaceService.createPropertyInBackend()` | `POST /api/v1/properties` | `PropertiesController.createProperty` | `CreatePropertyDto`<br>`{ title, description, category, propertyType, roomType, furnishing, locality, city, state, pincode, rentAmount, depositAmount, providerType, availableFrom, photoUrls }` | `PropertyDetailDto` | `Property`, `PropertyPhoto`, `AuditLog` |
| **Moderate Listing (Admin)** | `marketplaceService.moderatePropertyInBackend()` | `PATCH /api/v1/properties/:id/moderate` | `PropertiesController.moderateProperty` | `ModeratePropertyDto`<br>`{ status: 'active'\|'rejected', reason }` | `PropertyDetailDto` | `Property`, `AuditLog` |
| **Search Family Stays** | `marketplaceService.fetchFamilyStaysFromBackend()` | `GET /api/v1/family-stays` | `FamilyStaysController.searchFamilyStays` | Query: `SearchFamilyStaysQueryDto`<br>`{ city, locality, mealsOffered, minRent, maxRent }` | `PaginatedFamilyStaysResponseDto` | `Property` (`category=family_stays`, `family_lives_on_property=true`) |
| **View Family Stay Details**| `marketplaceService.fetchFamilyStayById()` | `GET /api/v1/family-stays/:id` | `FamilyStaysController.getFamilyStayById` | Param: `id` (UUID) | `FamilyStayDetailDto` | `Property`, `Profile`, `PropertyPhoto` |

---

## 5. Direct Property Inquiries (Independent of Connect)

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Send Property Inquiry** | `marketplaceService.sendInquiryToBackend()` | `POST /api/v1/inquiries` | `InquiriesController.createInquiry` | `CreateInquiryDto`<br>`{ propertyId, senderName, senderEmail, senderPhone, message, moveInDate }` | `InquiryResponseDto` | `InterestRequest`, `Property`, `NotificationOutbox` |
| **List Sent Inquiries** | `marketplaceService.fetchSentInquiries()` | `GET /api/v1/inquiries/sent` | `InquiriesController.getSentInquiries` | *None (JWT Auth)* | `InquiryResponseDto[]` | `InterestRequest`, `Property` |
| **List Received Inquiries** | `marketplaceService.fetchReceivedInquiries()` | `GET /api/v1/inquiries/received` | `InquiriesController.getReceivedInquiries` | *None (JWT Auth)* | `InquiryResponseDto[]` | `InterestRequest`, `Property` |
| **Accept/Decline Inquiry** | `marketplaceService.updateInquiryStatus()` | `PATCH /api/v1/inquiries/:id/status` | `InquiriesController.updateInquiryStatus` | `UpdateInquiryStatusDto`<br>`{ status: 'accepted'\|'declined' }` | `InquiryResponseDto` | `InterestRequest`, `NotificationOutbox` |

---

## 6. Property Visits & In-Person Viewing Scheduling

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Request Property Visit** | `visitService.requestVisit()` | `POST /api/v1/visits` | `VisitsController.createVisit` | `CreateVisitDto`<br>`{ propertyId, scheduledAt, visitorMessage }` | `PropertyVisitResponseDto` | `PropertyVisit`, `NotificationOutbox` |
| **List User Visits** | `visitService.getMyVisits()` | `GET /api/v1/visits` | `VisitsController.getMyVisits` | Query: `{ role: 'visitor'\|'host', status }` | `PropertyVisitResponseDto[]` | `PropertyVisit`, `Property`, `Profile` |
| **Confirm/Decline Visit** | `visitService.updateVisitStatus()` | `PATCH /api/v1/visits/:id/status` | `VisitsController.updateVisitStatus` | `UpdateVisitStatusDto`<br>`{ action: 'confirm'\|'cancel'\|'complete', hostNotes }` | `PropertyVisitResponseDto` | `PropertyVisit`, `NotificationOutbox` |
| **Reschedule Visit** | `visitService.rescheduleVisit()` | `PATCH /api/v1/visits/:id/reschedule` | `VisitsController.rescheduleVisit` | `RescheduleVisitDto`<br>`{ scheduledAt, reason }` | `PropertyVisitResponseDto` | `PropertyVisit`, `NotificationOutbox` |

---

## 7. Saved Listings & Shortlists

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Save Item to Shortlist** | `savedService.saveItem()` | `POST /api/v1/saved` | `SavedController.saveItem` | `CreateSavedItemDto`<br>`{ itemType: 'property'\|'flatmate', targetId, notes }` | `SavedItemResponseDto` | `SavedItem` |
| **List Saved Items** | `savedService.getSavedItems()` | `GET /api/v1/saved` | `SavedController.getSavedItems` | Query: `{ itemType }` | `SavedItemResponseDto[]` | `SavedItem`, `Property`, `FlatmateProfile` |
| **Remove Saved Item** | `savedService.removeSavedItem()` | `DELETE /api/v1/saved/:id` | `SavedController.removeSavedItem` | Param: `id` (UUID) | `{ success: true }` | `SavedItem` (deleted) |

---

## 8. Smart Locations & Landmark Directory

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Landmarks & Proximity** | `marketplaceService.fetchLandmarks()` | `GET /api/v1/locations/landmarks` | `LocationsController.getLandmarks` | Query: `{ city, category, lat, lng, radiusKm }` | `LandmarkItemDto[]` | In-memory verified catalog + Haversine |

---

## 9. Tenancy Agreements, Payments & Move-in Checklist

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Create Agreement Draft** | `rentalTrustService.createAgreementInBackend()` | `POST /api/v1/agreements` | `AgreementsController.createAgreement` | `CreateAgreementDto`<br>`{ tenantId, propertyId, monthlyRent, securityDeposit, startDate, endDate, termsSummary }` | `AgreementResponseDto` | `TenancyAgreement`, `NotificationOutbox` |
| **List My Agreements** | `rentalTrustService.fetchAgreementsFromBackend()` | `GET /api/v1/agreements/mine` | `AgreementsController.getMyAgreements` | *None (JWT Auth)* | `AgreementResponseDto[]` | `TenancyAgreement`, `Property`, `Profile` |
| **Update Agreement Status**| `rentalTrustService.updateAgreementStatusInBackend()` | `PATCH /api/v1/agreements/:id/status` | `AgreementsController.updateAgreementStatus` | `UpdateAgreementStatusDto`<br>`{ agreementStatus: 'active'\|'terminated'\|'expired' }` | `AgreementResponseDto` | `TenancyAgreement`, `NotificationOutbox` |
| **Record Rent Payment** | `rentalTrustService.recordPaymentInBackend()` | `POST /api/v1/agreements/:id/payments` | `AgreementsController.recordPayment` | `CreatePaymentRecordDto`<br>`{ payerId, recipientId, amount, paymentCategory, paymentDate, transactionReference }` | `RentPaymentRecordResponseDto` | `RentPaymentRecord`, `TenancyAgreement` |
| **Create Move-In Checklist**| `rentalTrustService.createInspectionInBackend()` | `POST /api/v1/inspections` | `InspectionsController.createInspection` | `CreateInspectionDto`<br>`{ agreementId, inspectionType: 'move_in', inspectionDate, roomName, conditionRating, meterReadings, inventory, keyHandoverConfirmed, depositConfirmed }` | `PropertyInspectionResponseDto` | `PropertyInspection`, `TenancyAgreement` |
| **Acknowledge Checklist** | `rentalTrustService.acknowledgeInspectionInBackend()` | `PATCH /api/v1/inspections/:id/acknowledge`| `InspectionsController.acknowledgeInspection` | Param: `id` (UUID) | `PropertyInspectionResponseDto` | `PropertyInspection` (`acknowledged_by_counterparty=true`) |

---

## 10. Rental Disputes & Two-Sided Trust Reviews

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Raise Rental Dispute** | `rentalTrustService.createDisputeInBackend()` | `POST /api/v1/disputes` | `DisputesController.createDispute` | `CreateDisputeDto`<br>`{ agreementId, disputeType, disputedAmount, title, description, evidenceUrls }` | `DisputeResponseDto` | `RentalDispute`, `AuditLog`, `NotificationOutbox` |
| **List User Disputes** | `rentalTrustService.fetchDisputesFromBackend()` | `GET /api/v1/disputes/mine` | `DisputesController.getMyDisputes` | *None (JWT Auth)* | `DisputeResponseDto[]` | `RentalDispute`, `TenancyAgreement` |
| **Resolve Dispute (Admin)**| `rentalTrustService.resolveDisputeInBackend()` | `PATCH /api/v1/disputes/:id/resolve` | `DisputesController.resolveDispute` | `ResolveDisputeDto`<br>`{ status: 'resolved_tenant'\|'resolved_landlord'\|'dismissed', resolutionSummary }` | `DisputeResponseDto` | `RentalDispute`, `AuditLog`, `NotificationOutbox` |
| **Submit Tenancy Review** | `rentalTrustService.createReviewInBackend()` | `POST /api/v1/reviews` | `ReviewsController.createReview` | `CreateTenancyReviewDto`<br>`{ agreementId, revieweeId, communicationRating, maintenanceRating, propertyCareRating, agreementClarityRating, overallRating, reviewTitle, reviewContent }` | `TenancyReviewResponseDto` | `TenancyReview`, `AuditLog` |
| **Property Reviews** | `rentalTrustService.fetchPropertyReviewsFromBackend()`| `GET /api/v1/reviews/property/:id` | `ReviewsController.getPropertyReviews` | Param: `id` (UUID) | `TenancyReviewResponseDto[]` | `TenancyReview`, `Profile` |

---

## 11. Property Ownership Verification

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Submit Documents** | `marketplaceService.submitPropertyVerification()` | `POST /api/v1/properties/:id/verification` | `PropertiesController.submitVerification` | `SubmitPropertyVerificationDto`<br>`{ documentType: 'electricity_bill', documentUrl, ownerIdType: 'pan' }` | `PropertyVerificationResponseDto` | `PropertyVerification`, `Property` |
| **Get Verification Status** | `marketplaceService.getPropertyVerification()` | `GET /api/v1/properties/:id/verification` | `PropertiesController.getVerification` | Param: `id` (UUID) | `PropertyVerificationResponseDto` | `PropertyVerification` |
| **Admin Review** | `marketplaceService.reviewPropertyVerification()` | `PATCH /api/v1/properties/:id/verification/review` | `PropertiesController.reviewVerification` | `ReviewPropertyVerificationDto`<br>`{ action: 'approve'\|'reject', reviewNotes, expiresInDays }` | `PropertyVerificationResponseDto` | `PropertyVerification`, `Property` (`verification_status=verified`), `AuditLog` |

---

## 12. Customer Support & Tickets

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Submit Ticket (User)** | `supportService.createSupportTicketInBackend()` | `POST /api/v1/support/tickets` | `SupportController.createTicket` | `CreateSupportTicketDto`<br>`{ category, subject, description, priority: 'medium' }` | `SupportTicketResponseDto` | `SupportTicket`, `TicketMessage`, `TicketAuditEvent` |
| **Submit Guest Ticket** | `supportService.createGuestSupportTicketInBackend()` | `POST /api/v1/support/tickets/guest` | `SupportController.createGuestTicket` | `GuestSupportTicketDto`<br>`{ userName, userEmail, userPhone, category, subject, description }` | `SupportTicketResponseDto` | `SupportTicket`, `TicketMessage` |
| **List My Tickets** | `supportService.fetchMySupportTicketsFromBackend()` | `GET /api/v1/support/tickets/mine` | `SupportController.getMyTickets` | *None (JWT Auth)* | `SupportTicketResponseDto[]` | `SupportTicket`, `TicketMessage` |
| **Reply to Ticket** | `supportService.addTicketMessageInBackend()` | `POST /api/v1/support/tickets/:id/messages` | `SupportController.addTicketMessage` | `CreateTicketMessageDto`<br>`{ message }` | `TicketMessageResponseDto` | `TicketMessage`, `SupportTicket`, `TicketAuditEvent` |
| **Resolve Ticket (Admin)** | `supportService.updateTicketStatusInBackend()` | `PATCH /api/v1/support/tickets/:id/status` | `SupportController.updateTicketStatus` | `UpdateTicketStatusDto`<br>`{ status: 'resolved'\|'in_review'\|'closed' }` | `SupportTicketResponseDto` | `SupportTicket`, `TicketAuditEvent` |

---

## 13. Smart Notifications

| User Journey / Screen | Frontend Action / Service Call | HTTP Method & Route | NestJS Controller & Method | Request DTO / Payload | Response DTO | Database Models |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **List User Notifications**| `notificationService.getNotifications()` | `GET /api/v1/notifications` | `NotificationsController.getNotifications` | Query: `{ category, isRead, limit }` | `UserNotificationResponseDto[]` | `UserNotification` |
| **Get Unread Count** | `notificationService.getUnreadCount()` | `GET /api/v1/notifications/unread-count` | `NotificationsController.getUnreadCount` | *None (JWT Auth)* | `{ unreadCount: number }` | `UserNotification` |
| **Mark Notification Read** | `notificationService.markAsRead()` | `PATCH /api/v1/notifications/:id/read` | `NotificationsController.markAsRead` | Param: `id` (UUID) | `UserNotificationResponseDto` | `UserNotification` (`is_read=true`) |
| **Mark All Read** | `notificationService.markAllAsRead()` | `POST /api/v1/notifications/mark-all-read` | `NotificationsController.markAllAsRead` | *None (JWT Auth)* | `{ markedCount: number }` | `UserNotification` |

