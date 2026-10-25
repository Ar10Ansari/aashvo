/**
 * Aashvo — Rental Trust Type Definitions
 *
 * Covers:
 * 1. Tenancy Agreements (Digital terms, dates, financial parameters, status)
 * 2. Rent Payment Records (Payment evidence, receipts, categorization, verification)
 * 3. Property Condition Inspections (Move-in/out condition, damage notes, mutual acknowledgment)
 * 4. Two-Sided Rental Reputation (Verified reviews, ratings, duplicate prevention)
 * 5. Rental Disputes & Mediation (Dispute categorization, mediation status, evidence attachments)
 */

export type AgreementStatus = 'draft' | 'active' | 'terminated' | 'expired';

export type PaymentCategory =
  | 'rent'
  | 'security_deposit'
  | 'utility'
  | 'maintenance'
  | 'move_out_settlement';

export type PaymentVerificationStatus =
  | 'pending_confirmation'
  | 'confirmed_by_landlord'
  | 'disputed';

export type InspectionType = 'move_in' | 'move_out' | 'interim';

export type ConditionRating = 'pristine' | 'good' | 'fair' | 'damaged';

export type DisputeType =
  | 'security_deposit'
  | 'unauthorized_deduction'
  | 'repair_maintenance'
  | 'agreement_terms'
  | 'property_damage'
  | 'privacy_unauthorized_entry'
  | 'misrepresentation';

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'mediation_in_progress'
  | 'resolved'
  | 'closed'
  | 'appealed';

export interface TenancyAgreement {
  id: string;
  propertyId?: string;
  propertyTitle?: string;
  propertyLocality?: string;
  landlordId: string;
  landlordName?: string;
  landlordEmail?: string;
  tenantId: string;
  tenantName?: string;
  tenantEmail?: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate: string;
  agreementStatus: AgreementStatus;
  documentUrl?: string;
  termsSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentPaymentRecord {
  id: string;
  agreementId: string;
  payerId: string;
  payerName?: string;
  recipientId: string;
  recipientName?: string;
  amount: number;
  paymentCategory: PaymentCategory;
  paymentDate: string;
  receiptUrl?: string;
  transactionReference?: string;
  verificationStatus: PaymentVerificationStatus;
  notes?: string;
  createdAt: string;
}

export interface PropertyInspection {
  id: string;
  agreementId: string;
  inspectionType: InspectionType;
  conductedBy: string;
  conductedByName?: string;
  inspectionDate: string;
  roomName: string;
  conditionRating: ConditionRating;
  damageNotes?: string;
  photoUrls: string[];
  acknowledgedByCounterparty: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface TenancyReview {
  id: string;
  agreementId: string;
  reviewerId: string;
  reviewerName?: string;
  reviewerRole: 'tenant' | 'landlord';
  revieweeId: string;
  revieweeName?: string;
  communicationRating: number;
  maintenanceRating: number;
  propertyCareRating: number;
  agreementClarityRating: number;
  overallRating: number;
  reviewTitle: string;
  reviewContent: string;
  isPublic: boolean;
  moderationStatus: 'published' | 'flagged' | 'hidden';
  createdAt: string;
}

export interface RentalDispute {
  id: string;
  disputeNumber: string;
  agreementId: string;
  initiatorId: string;
  initiatorName?: string;
  respondentId: string;
  respondentName?: string;
  disputeType: DisputeType;
  disputedAmount: number;
  title: string;
  description: string;
  status: DisputeStatus;
  evidenceUrls: string[];
  resolutionSummary?: string;
  assignedModeratorId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateTenancyAgreementDTO {
  propertyId?: string;
  landlordId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate: string;
  termsSummary?: string;
  documentUrl?: string;
}

export interface CreateRentPaymentDTO {
  agreementId: string;
  payerId: string;
  recipientId: string;
  amount: number;
  paymentCategory: PaymentCategory;
  paymentDate?: string;
  transactionReference?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface CreatePropertyInspectionDTO {
  agreementId: string;
  inspectionType: InspectionType;
  conductedBy: string;
  roomName: string;
  conditionRating: ConditionRating;
  damageNotes?: string;
  photoUrls?: string[];
}

export interface CreateTenancyReviewDTO {
  agreementId: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: 'tenant' | 'landlord';
  communicationRating: number;
  maintenanceRating: number;
  propertyCareRating: number;
  agreementClarityRating: number;
  overallRating?: number;
  reviewTitle: string;
  reviewContent: string;
}

export interface CreateRentalDisputeDTO {
  agreementId: string;
  initiatorId: string;
  respondentId: string;
  disputeType: DisputeType;
  disputedAmount: number;
  title: string;
  description: string;
  evidenceUrls?: string[];
}
