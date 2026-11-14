# AASHVO — Sprint 4 Master Implementation Plan
## Rental Trust Engine: Tenancy Agreements, Payments, Inspections & Dispute Resolution

**Author:** Principal Software Architect & CTO Office  
**Date:** 2026-11-14  
**Status:** **READY FOR CTO APPROVAL (STRICTLY PLANNING ONLY — NO IMPLEMENTATION UNTIL AUTHORIZED)**  
**Target:** Monorepo (`apps/api` & `packages/contracts`)  
**Database:** PostgreSQL 16.16 (Port 5433 / DigitalOcean BLR1)

---

## 1. Executive Summary & Sprint Scope

Having constructed the independent authentication foundation (Sprint 2), the core domain marketplace services (Sprint 3), and completed the Sprint 3.5 engineering professionalization and quality audit (39 registered HTTP endpoints, strong enum typing, zero `as any` casts, full SEO/AEO/GEO alignment), **Sprint 4** implements the **Rental Trust & Transaction Engine** of AASHVO.

Sprint 4 introduces six high-trust transactional modules:
1. **`AgreementsModule`**: Legally sound Indian tenancy agreements, dual-party digital signing (`owner_signed_at`, `tenant_signed_at`), locking terms upon signing, and full agreement lifecycle (`draft` -> `pending_signatures` -> `active` -> `completed` / `terminated`).
2. **`PaymentsModule`**: Security deposit escrow holding, monthly rent schedule generation, immutable transaction ledger, and webhook processing for payment gateways (e.g., Razorpay/Cashfree).
3. **`InspectionsModule`**: Digital move-in and move-out condition inspection reports, itemized room checklists (walls, plumbing, electrical, furniture), photo evidence binding via `MediaModule`, and deposit deduction auditing.
4. **`ReviewsModule`**: Verified-stay review system (tenants can only review properties they have rented; owners can review verified tenants), anti-retaliation review locking, and reputation score aggregation.
5. **`DisputesModule`**: Formal security deposit dispute arbitration, evidence submission, enforcing PostgreSQL constraint `uq_active_dispute_per_agreement_type` (single active dispute per agreement), and admin mediation resolution.
6. **`SupportModule`**: Omnichannel help & support ticket system, authenticated and guest ticket routing (migrating the Supabase `create_guest_support_ticket` RPC), and notification dispatch.

---

## 2. Target Module Architecture (`apps/api/src/modules/`)

```text
apps/api/src/modules/
├── agreements/
│   ├── dto/agreement.dto.ts             # CreateAgreementDto, SignAgreementDto, AgreementViewDto
│   ├── agreements.controller.ts         # GET /agreements, POST /agreements, POST /agreements/:id/sign
│   ├── agreements.service.ts            # Agreement lifecycle, PDF document generator hook
│   └── agreements.module.ts
├── payments/
│   ├── dto/payment.dto.ts               # InitiatePaymentDto, WebhookPayloadDto, PaymentReceiptDto
│   ├── payments.controller.ts           # POST /payments/initiate, POST /payments/webhook, GET /payments/history
│   ├── payments.service.ts              # Escrow ledger, transaction state machine
│   └── payments.module.ts
├── inspections/
│   ├── dto/inspection.dto.ts            # CreateInspectionDto, InspectionSignOffDto
│   ├── inspections.controller.ts        # POST /inspections, GET /inspections/:id, PATCH /inspections/:id/sign
│   ├── inspections.service.ts           # Move-in vs move-out comparison, damage assessment
│   └── inspections.module.ts
├── reviews/
│   ├── dto/review.dto.ts                # CreateReviewDto, ReviewResponseDto
│   ├── reviews.controller.ts            # POST /reviews, GET /reviews/property/:propertyId
│   ├── reviews.service.ts               # Tenancy verification check, rating calculation
│   └── reviews.module.ts
├── disputes/
│   ├── dto/dispute.dto.ts               # FileDisputeDto, DisputeResolutionDto
│   ├── disputes.controller.ts           # POST /disputes, GET /disputes/:id, PATCH /disputes/:id/resolve
│   ├── disputes.service.ts              # Dispute lifecycle, escrow freeze, admin adjudication
│   └── disputes.module.ts
└── support/
    ├── dto/support-ticket.dto.ts        # CreateTicketDto, GuestTicketDto, TicketReplyDto
    ├── support.controller.ts            # POST /support/tickets, POST /support/tickets/guest, GET /support/tickets/mine
    ├── support.service.ts               # Auto-generated ticket ID (ASH-TKT-XXXXXX), SLA tracking
    └── support.module.ts
```

---

## 3. Database Entities & Constraint Verification

Sprint 4 brings online the remaining 6 tables of the 23-table schema:
- `agreements`: Linked to `properties`, `users (owner)`, `users (tenant)`. Enforces valid dates (`end_date > start_date`) and positive amounts.
- `payments`: Foreign keys to `agreements`, `users (payer)`. Enforces positive payment amounts.
- `inspection_reports`: Foreign keys to `agreements`, `users (inspector)`. Checklists stored as JSONB with photo asset IDs.
- `reviews`: Foreign keys to `properties`, `users (reviewer)`. Rating integer constrained between 1 and 5 (`chk_review_rating_range`). Verified tenancy constraint enforced before creation.
- `disputes`: Foreign key to `agreements`. Partial unique index:
  ```sql
  CREATE UNIQUE INDEX uq_active_dispute_per_agreement_type
  ON disputes (agreement_id, dispute_type)
  WHERE status IN ('opened', 'under_review', 'mediation');
  ```
- `support_tickets`: Tracks `ticket_number`, `user_id` (nullable for guests), `email`, `subject`, `status`, `priority`.

---

## 4. Detailed Implementation Phases

### Phase 4.1: Contracts & Error Codes
- Update `packages/contracts`:
  - New domain error codes: `AGREEMENT_NOT_FOUND`, `AGREEMENT_ALREADY_SIGNED`, `PAYMENT_FAILED`, `ACTIVE_DISPUTE_EXISTS`, `UNVERIFIED_TENANCY_REVIEW`, `TICKET_NOT_FOUND`.
  - Export full DTO interfaces and enums.
  - Compile contracts: `npm run contracts:build`.

### Phase 4.2: Agreements & Digital Signatures
- Implement `AgreementsModule`:
  - Drafting agreement with owner and tenant terms.
  - Dual signature workflow: recording IP address, timestamp, and user cryptographic confirmation.
  - State machine: `draft` -> `pending_owner_signature` -> `pending_tenant_signature` -> `active`.

### Phase 4.3: Payments & Escrow Ledger
- Implement `PaymentsModule`:
  - Payment initiation and order creation.
  - Gateway webhook signature verification (HMAC SHA-256).
  - Escrow balance tracking in PostgreSQL: deposits held until move-in sign-off or dispute resolution.

### Phase 4.4: Inspections & Damage Audit
- Implement `InspectionsModule`:
  - Room-by-room condition reporting with photo uploads.
  - Comparison engine: comparing move-out report against baseline move-in report for deposit reconciliation.

### Phase 4.5: Verified Reviews & Anti-Spam
- Implement `ReviewsModule`:
  - Validates that reviewer completed a tenancy agreement for the target property.
  - Rating aggregation (`averageRating`, `totalReviews`).

### Phase 4.6: Disputes & Security Deposit Arbitration
- Implement `DisputesModule`:
  - Enforces `uq_active_dispute_per_agreement_type`.
  - Freezes deposit disbursement in `PaymentsModule` when an active dispute is filed.
  - Admin adjudication: approving deposit refund, deposit deduction, or split disbursement.

### Phase 4.7: Omnichannel Support Tickets
- Implement `SupportModule`:
  - Replaces Supabase RPC `create_guest_support_ticket`.
  - Formats ticket number `ASH-TKT-XXXXXX`.
  - Dispatches email alerts via `notification_outbox`.

---

## 5. Verification & Testing Strategy

1. **Unit Tests (`apps/api/test/trust-engine.unit.spec.ts`):**
   - Agreement signature validation.
   - Escrow balance arithmetic.
   - Inspection room checklist delta calculation.
   - Review eligibility verification.
2. **Integration Tests (`apps/api/test/trust-engine.postgres.integration.spec.ts`):**
   - Complete end-to-end lease signing, payment escrow, inspection, review, and dispute lifecycle against PostgreSQL 16.16.
   - Partial unique index violation test on disputes (`409 ACTIVE_DISPUTE_EXISTS`).
3. **Monorepo & Frontend Regression:**
   - Full backend test suite passing.
   - OpenAPI specification regeneration (`npm run api:openapi`).
   - Root Vitest (21 files, 232 tests) passing.
   - Root Vite build passing.

---

## 6. Strict CTO Boundaries & Safety Checklist

Implementation of Sprint 4 must strictly follow these rules:
- **No Unapproved Execution:** Do not begin code implementation until CTO explicitly approves this plan.
- **Zero Production Risk:** No modifications to hosted Supabase, Vercel production settings, or paid cloud services.
- **Local Isolation:** All tests run strictly against local PostgreSQL 16 on port 5433.
- **Git Discipline:** Preserve all uncommitted changes; no git commits or pushes without explicit instruction.

