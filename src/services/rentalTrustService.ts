/**
 * Aashvo — Rental Trust & Protection System Service
 *
 * Provides end-to-end data access and business logic for:
 * 1. Tenancy Agreements (Digital terms, dates, financial parameters, status)
 * 2. Rent Payment Records (Payment ledger, receipts, verification state)
 * 3. Property Condition Inspections (Move-in/out logs, photo evidence, mutual acknowledgment)
 * 4. Two-Sided Rental Reputation (Verified reviews, ratings, duplicate prevention)
 * 5. Rental Disputes & Mediation (Dispute categorization, status tracking, evidence)
 */

import { supabase, isLiveBackendConfigured } from './supabase';
import { apiClient } from './apiClient';
import {
  TenancyAgreement,
  RentPaymentRecord,
  PropertyInspection,
  TenancyReview,
  RentalDispute,
  CreateTenancyAgreementDTO,
  CreateRentPaymentDTO,
  CreatePropertyInspectionDTO,
  CreateTenancyReviewDTO,
  CreateRentalDisputeDTO,
  DisputeStatus,
} from '../types/rentalTrust';
import { User } from '../types';

// ==========================================
// IN-MEMORY SEED STORE (FOR OFFLINE / FALLBACK)
// ==========================================

const SEED_AGREEMENTS: TenancyAgreement[] = [
  {
    id: 'ag-demo-001',
    propertyId: 'prop-gurugram-01',
    propertyTitle: 'Bright Private Room in DLF Phase 2',
    propertyLocality: 'DLF Phase 2, Gurugram',
    landlordId: 'user-demo-host-1',
    landlordName: 'Ananya Sharma',
    landlordEmail: 'ananya.host@aashvo.in',
    tenantId: 'user-demo-renter-1',
    tenantName: 'Rohan Verma',
    tenantEmail: 'rohan.renter@aashvo.in',
    monthlyRent: 22000,
    securityDeposit: 22000,
    startDate: '2026-06-01',
    endDate: '2027-05-31',
    agreementStatus: 'active',
    documentUrl: 'https://aashvo.in/docs/agreements/sample_tenancy_agreement.pdf',
    termsSummary: '11-month lease with 1-month notice period. Rent due by 5th of each calendar month. No commercial activities.',
    createdAt: '2026-05-25T10:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
];

const SEED_PAYMENTS: RentPaymentRecord[] = [
  {
    id: 'pay-001',
    agreementId: 'ag-demo-001',
    payerId: 'user-demo-renter-1',
    payerName: 'Rohan Verma',
    recipientId: 'user-demo-host-1',
    recipientName: 'Ananya Sharma',
    amount: 22000,
    paymentCategory: 'security_deposit',
    paymentDate: '2026-05-28',
    transactionReference: 'UPI-REF-984210948',
    verificationStatus: 'confirmed_by_landlord',
    notes: 'Security deposit received in full via UPI.',
    createdAt: '2026-05-28T14:30:00Z',
  },
  {
    id: 'pay-002',
    agreementId: 'ag-demo-001',
    payerId: 'user-demo-renter-1',
    payerName: 'Rohan Verma',
    recipientId: 'user-demo-host-1',
    recipientName: 'Ananya Sharma',
    amount: 22000,
    paymentCategory: 'rent',
    paymentDate: '2026-06-04',
    transactionReference: 'UPI-REF-109283019',
    verificationStatus: 'confirmed_by_landlord',
    notes: 'Rent for June 2026.',
    createdAt: '2026-06-04T09:15:00Z',
  },
  {
    id: 'pay-003',
    agreementId: 'ag-demo-001',
    payerId: 'user-demo-renter-1',
    payerName: 'Rohan Verma',
    recipientId: 'user-demo-host-1',
    recipientName: 'Ananya Sharma',
    amount: 22000,
    paymentCategory: 'rent',
    paymentDate: '2026-07-03',
    transactionReference: 'IMPS-REF-773829104',
    verificationStatus: 'confirmed_by_landlord',
    notes: 'Rent for July 2026.',
    createdAt: '2026-07-03T11:00:00Z',
  },
];

const SEED_INSPECTIONS: PropertyInspection[] = [
  {
    id: 'insp-001',
    agreementId: 'ag-demo-001',
    inspectionType: 'move_in',
    conductedBy: 'user-demo-host-1',
    conductedByName: 'Ananya Sharma',
    inspectionDate: '2026-06-01',
    roomName: 'Master Bedroom',
    conditionRating: 'pristine',
    damageNotes: 'Freshly painted walls, brand new mattress protector, AC serviced on May 29.',
    photoUrls: [
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
    ],
    acknowledgedByCounterparty: true,
    acknowledgedAt: '2026-06-02T15:20:00Z',
    createdAt: '2026-06-01T12:00:00Z',
  },
  {
    id: 'insp-002',
    agreementId: 'ag-demo-001',
    inspectionType: 'move_in',
    conductedBy: 'user-demo-host-1',
    conductedByName: 'Ananya Sharma',
    inspectionDate: '2026-06-01',
    roomName: 'Attached Bathroom',
    conditionRating: 'good',
    damageNotes: 'Minor water mark near exhaust fan. Geyser and fixtures in clean working order.',
    photoUrls: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    ],
    acknowledgedByCounterparty: true,
    acknowledgedAt: '2026-06-02T15:20:00Z',
    createdAt: '2026-06-01T12:30:00Z',
  },
];

const SEED_REVIEWS: TenancyReview[] = [
  {
    id: 'rev-001',
    agreementId: 'ag-demo-001',
    reviewerId: 'user-demo-renter-1',
    reviewerName: 'Rohan Verma',
    reviewerRole: 'tenant',
    revieweeId: 'user-demo-host-1',
    revieweeName: 'Ananya Sharma',
    communicationRating: 5,
    maintenanceRating: 5,
    propertyCareRating: 5,
    agreementClarityRating: 5,
    overallRating: 5.0,
    reviewTitle: 'Exceptional, transparent landlord',
    reviewContent: 'Ananya was very responsive during move-in. The terms were transparent with zero hidden fees.',
    isPublic: true,
    moderationStatus: 'published',
    createdAt: '2026-07-10T16:00:00Z',
  },
];

const SEED_DISPUTES: RentalDispute[] = [];

// Local memory stores
let mockAgreements = [...SEED_AGREEMENTS];
let mockPayments = [...SEED_PAYMENTS];
let mockInspections = [...SEED_INSPECTIONS];
let mockReviews = [...SEED_REVIEWS];
let mockDisputes = [...SEED_DISPUTES];

// ==========================================
// MAPPERS (SNAKE_CASE <-> CAMELCASE)
// ==========================================

export function mapDbAgreementToApp(row: any): TenancyAgreement {
  return {
    id: row.id,
    propertyId: row.propertyId || row.property_id,
    propertyTitle: row.property?.title || row.properties?.title || row.propertyTitle || row.property_title || 'Aashvo Verified Property',
    propertyLocality: row.property?.locality || row.properties?.locality || row.propertyLocality || row.property_locality || 'Delhi NCR',
    landlordId: row.landlordId || row.landlord_id,
    landlordName: row.landlord?.fullName || row.landlord?.full_name || row.landlordName || 'Verified Landlord',
    landlordEmail: row.landlord?.email || row.landlordEmail,
    tenantId: row.tenantId || row.tenant_id,
    tenantName: row.tenant?.fullName || row.tenant?.full_name || row.tenantName || 'Verified Tenant',
    tenantEmail: row.tenant?.email || row.tenantEmail,
    monthlyRent: Number(row.monthlyRent ?? row.monthly_rent ?? 0),
    securityDeposit: Number(row.securityDeposit ?? row.security_deposit ?? 0),
    startDate: row.startDate || row.start_date,
    endDate: row.endDate || row.end_date,
    agreementStatus: row.agreementStatus || row.agreement_status || 'draft',
    documentUrl: row.documentUrl || row.document_url,
    termsSummary: row.termsSummary || row.terms_summary,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

export function mapDbPaymentToApp(row: any): RentPaymentRecord {
  return {
    id: row.id,
    agreementId: row.agreementId || row.agreement_id,
    payerId: row.payerId || row.payer_id,
    payerName: row.payer?.fullName || row.payer?.full_name || 'Tenant',
    recipientId: row.recipientId || row.recipient_id,
    recipientName: row.recipient?.fullName || row.recipient?.full_name || 'Landlord',
    amount: Number(row.amount || 0),
    paymentCategory: row.paymentCategory || row.payment_category || 'rent',
    paymentDate: row.paymentDate || row.payment_date,
    receiptUrl: row.receiptUrl || row.receipt_url,
    transactionReference: row.transactionReference || row.transaction_reference,
    verificationStatus: row.verificationStatus || row.verification_status || 'pending_confirmation',
    notes: row.notes,
    createdAt: row.createdAt || row.created_at,
  };
}

export function mapDbInspectionToApp(row: any): PropertyInspection {
  return {
    id: row.id,
    agreementId: row.agreementId || row.agreement_id,
    inspectionType: row.inspectionType || row.inspection_type,
    conductedBy: row.conductedBy || row.conducted_by,
    conductedByName: row.conductor?.fullName || row.conductor?.full_name || 'Inspector',
    inspectionDate: row.inspectionDate || row.inspection_date,
    roomName: row.roomName || row.room_name,
    conditionRating: row.conditionRating || row.condition_rating,
    damageNotes: row.damageNotes || row.damage_notes,
    photoUrls: row.photoUrls || row.photo_urls || [],
    acknowledgedByCounterparty: Boolean(row.acknowledgedByCounterparty ?? row.acknowledged_by_counterparty),
    acknowledgedAt: row.acknowledgedAt || row.acknowledged_at,
    createdAt: row.createdAt || row.created_at,
  };
}

export function mapDbReviewToApp(row: any): TenancyReview {
  return {
    id: row.id,
    agreementId: row.agreementId || row.agreement_id,
    reviewerId: row.reviewerId || row.reviewer_id,
    reviewerName: row.reviewer?.fullName || row.reviewer?.full_name || 'Verified User',
    reviewerRole: row.reviewerRole || row.reviewer_role,
    revieweeId: row.revieweeId || row.reviewee_id,
    revieweeName: row.reviewee?.fullName || row.reviewee?.full_name || 'Counterparty',
    communicationRating: Number(row.communicationRating ?? row.communication_rating),
    maintenanceRating: Number(row.maintenanceRating ?? row.maintenance_rating),
    propertyCareRating: Number(row.propertyCareRating ?? row.property_care_rating),
    agreementClarityRating: Number(row.agreementClarityRating ?? row.agreement_clarity_rating),
    overallRating: Number(row.overallRating ?? row.overall_rating),
    reviewTitle: row.reviewTitle || row.review_title,
    reviewContent: row.reviewContent || row.review_content,
    isPublic: Boolean(row.isPublic ?? row.is_public),
    moderationStatus: row.moderationStatus || row.moderation_status,
    createdAt: row.createdAt || row.created_at,
  };
}

export function mapDbDisputeToApp(row: any): RentalDispute {
  return {
    id: row.id,
    disputeNumber: row.disputeNumber || row.dispute_number,
    agreementId: row.agreementId || row.agreement_id,
    initiatorId: row.initiatorId || row.initiator_id,
    initiatorName: row.initiator?.fullName || row.initiator?.full_name || 'Initiator',
    respondentId: row.respondentId || row.respondent_id,
    respondentName: row.respondent?.fullName || row.respondent?.full_name || 'Respondent',
    disputeType: row.disputeType || row.dispute_type,
    disputedAmount: Number(row.disputedAmount ?? row.disputed_amount ?? 0),
    title: row.title,
    description: row.description,
    status: row.status,
    evidenceUrls: row.evidenceUrls || row.evidence_urls || [],
    resolutionSummary: row.resolutionSummary || row.resolution_summary,
    assignedModeratorId: row.assignedModeratorId || row.assigned_moderator_id,
    createdAt: row.createdAt || row.created_at,
    resolvedAt: row.resolvedAt || row.resolved_at,
  };
}

let demoModeOverride: boolean | null = null;
export function setDemoModeOverride(enabled: boolean | null) {
  demoModeOverride = enabled;
}

let backendAvailableOverride: boolean | null = null;
export function setBackendAvailableOverrideForTesting(available: boolean | null) {
  backendAvailableOverride = available;
}

export function isDemoEnvironment(): boolean {
  if (demoModeOverride !== null) return demoModeOverride;
  return !import.meta.env.PROD;
}

export function isBackendActive(): boolean {
  if (backendAvailableOverride !== null) return backendAvailableOverride;
  return Boolean(isLiveBackendConfigured && supabase);
}

// ==========================================
// FEATURE D: TENANCY AGREEMENTS
// ==========================================

export async function fetchAgreementsForUser(
  userId: string
): Promise<{ success: boolean; agreements: TenancyAgreement[]; error?: string; isDemo?: boolean }> {
  // 1. Authoritative NestJS REST endpoint
  try {
    const backendRes = await fetchAgreementsFromBackend();
    if (backendRes.success && backendRes.agreements) {
      return { success: true, agreements: backendRes.agreements };
    }
  } catch {
    // continue to fallback checks
  }

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .select(`
          *,
          properties:property_id (title, locality),
          landlord:landlord_id (full_name, email),
          tenant:tenant_id (full_name, email)
        `)
        .or(`landlord_id.eq.${userId},tenant_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) return { success: false, agreements: [], error: error.message };
      return { success: true, agreements: (data || []).map(mapDbAgreementToApp) };
    } catch (err) {
      return { success: false, agreements: [], error: err instanceof Error ? err.message : 'Fetch agreements failed' };
    }
  }

  // Production must never silently fall back to in-memory demo records
  if (!isDemoEnvironment()) {
    return {
      success: false,
      agreements: [],
      error: 'Live database connection is unavailable in production. Cannot load agreements.',
    };
  }

  // Explicit demo mode in development
  const userAgreements = mockAgreements.filter(
    a => a.landlordId === userId || a.tenantId === userId
  );
  return {
    success: true,
    agreements: userAgreements.length ? userAgreements : mockAgreements,
    isDemo: true,
  };
}

export async function createTenancyAgreement(
  dto: CreateTenancyAgreementDTO,
  creator: User
): Promise<{ success: boolean; agreement?: TenancyAgreement; error?: string; isDemo?: boolean }> {
  // Client validation
  if (!dto.landlordId || !dto.tenantId) {
    return { success: false, error: 'Both landlord and tenant must be specified.' };
  }
  if (dto.landlordId === dto.tenantId) {
    return { success: false, error: 'Landlord and tenant must be distinct user accounts.' };
  }
  if (dto.monthlyRent <= 0) {
    return { success: false, error: 'Monthly rent must be a positive amount.' };
  }
  if (new Date(dto.endDate) <= new Date(dto.startDate)) {
    return { success: false, error: 'End date must be strictly after start date.' };
  }

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .insert({
          property_id: dto.propertyId || null,
          landlord_id: dto.landlordId,
          tenant_id: dto.tenantId,
          monthly_rent: dto.monthlyRent,
          security_deposit: dto.securityDeposit || 0,
          start_date: dto.startDate,
          end_date: dto.endDate,
          agreement_status: 'draft',
          terms_summary: dto.termsSummary || null,
          document_url: dto.documentUrl || null,
        })
        .select(`
          *,
          properties:property_id (title, locality),
          landlord:landlord_id (full_name, email),
          tenant:tenant_id (full_name, email)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Agreement insertion returned no data.' };
      return { success: true, agreement: mapDbAgreementToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Create agreement failed' };
    }
  }

  // Production must never report a write as successful when the write failed/offline
  if (!isDemoEnvironment()) {
    return {
      success: false,
      error: 'Live database connection is unavailable in production. Cannot persist agreement.',
    };
  }

  const newAgreement: TenancyAgreement = {
    id: `ag-${Date.now()}`,
    propertyId: dto.propertyId,
    propertyTitle: 'Aashvo Verified Homestay',
    propertyLocality: 'Sector 54, Gurugram',
    landlordId: dto.landlordId,
    landlordName: creator.id === dto.landlordId ? creator.name : 'Verified Landlord',
    landlordEmail: creator.id === dto.landlordId ? creator.email : undefined,
    tenantId: dto.tenantId,
    tenantName: creator.id === dto.tenantId ? creator.name : 'Prospective Tenant',
    tenantEmail: creator.id === dto.tenantId ? creator.email : undefined,
    monthlyRent: dto.monthlyRent,
    securityDeposit: dto.securityDeposit,
    startDate: dto.startDate,
    endDate: dto.endDate,
    agreementStatus: 'draft',
    termsSummary: dto.termsSummary,
    documentUrl: dto.documentUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockAgreements.unshift(newAgreement);
  return { success: true, agreement: newAgreement, isDemo: true };
}
// ==========================================
// FEATURE A & C: RENT PAYMENTS & DEPOSIT LEDGER
// ==========================================

export async function fetchPaymentsForAgreement(
  agreementId: string
): Promise<{ success: boolean; payments: RentPaymentRecord[]; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('rent_payment_records')
        .select(`
          *,
          payer:payer_id (full_name),
          recipient:recipient_id (full_name)
        `)
        .eq('agreement_id', agreementId)
        .order('payment_date', { ascending: false });

      if (error) return { success: false, payments: [], error: error.message };
      return { success: true, payments: (data || []).map(mapDbPaymentToApp) };
    } catch (err) {
      return { success: false, payments: [], error: err instanceof Error ? err.message : 'Fetch payments failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, payments: [], error: 'Live database connection is unavailable in production.' };
  }

  const list = mockPayments.filter(p => p.agreementId === agreementId);
  return { success: true, payments: list, isDemo: true };
}

export async function recordRentPayment(
  dto: CreateRentPaymentDTO,
  payer: User
): Promise<{ success: boolean; payment?: RentPaymentRecord; error?: string; isDemo?: boolean }> {
  if (dto.amount <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' };
  }

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('rent_payment_records')
        .insert({
          agreement_id: dto.agreementId,
          payer_id: dto.payerId,
          recipient_id: dto.recipientId,
          amount: dto.amount,
          payment_category: dto.paymentCategory,
          payment_date: dto.paymentDate || new Date().toISOString().split('T')[0],
          transaction_reference: dto.transactionReference || null,
          receipt_url: dto.receiptUrl || null,
          notes: dto.notes || null,
          verification_status: 'pending_confirmation',
        })
        .select(`
          *,
          payer:payer_id (full_name),
          recipient:recipient_id (full_name)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Payment insertion returned no data.' };
      return { success: true, payment: mapDbPaymentToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Record payment failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot record payment in production.' };
  }

  const newPayment: RentPaymentRecord = {
    id: `pay-${Date.now()}`,
    agreementId: dto.agreementId,
    payerId: dto.payerId,
    payerName: payer.name,
    recipientId: dto.recipientId,
    amount: dto.amount,
    paymentCategory: dto.paymentCategory,
    paymentDate: dto.paymentDate || new Date().toISOString().split('T')[0],
    transactionReference: dto.transactionReference || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
    verificationStatus: 'pending_confirmation',
    receiptUrl: dto.receiptUrl,
    notes: dto.notes,
    createdAt: new Date().toISOString(),
  };

  mockPayments.unshift(newPayment);
  return { success: true, payment: newPayment, isDemo: true };
}

export async function confirmPaymentByLandlord(
  paymentId: string,
  landlord: User
): Promise<{ success: boolean; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('rent_payment_records')
        .update({ verification_status: 'confirmed_by_landlord' })
        .eq('id', paymentId)
        .eq('recipient_id', landlord.id)
        .select();

      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Payment not found or confirmation unauthorized under RLS.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Confirm payment failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot confirm payment in production.' };
  }

  const p = mockPayments.find(item => item.id === paymentId);
  if (!p) {
    return { success: false, error: 'Payment record not found.' };
  }
  if (p.recipientId !== landlord.id) {
    return { success: false, error: 'Only the recipient landlord can confirm payment receipt.' };
  }
  p.verificationStatus = 'confirmed_by_landlord';
  return { success: true, isDemo: true };
}

// ==========================================
// FEATURE E: PROPERTY CONDITION INSPECTIONS
// ==========================================

export async function fetchInspectionsForAgreement(
  agreementId: string
): Promise<{ success: boolean; inspections: PropertyInspection[]; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('property_inspections')
        .select(`
          *,
          conductor:conducted_by (full_name)
        `)
        .eq('agreement_id', agreementId)
        .order('inspection_date', { ascending: false });

      if (error) return { success: false, inspections: [], error: error.message };
      return { success: true, inspections: (data || []).map(mapDbInspectionToApp) };
    } catch (err) {
      return { success: false, inspections: [], error: err instanceof Error ? err.message : 'Fetch inspections failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, inspections: [], error: 'Live database connection is unavailable in production.' };
  }

  const list = mockInspections.filter(i => i.agreementId === agreementId);
  return { success: true, inspections: list, isDemo: true };
}

export async function recordPropertyInspection(
  dto: CreatePropertyInspectionDTO,
  inspector: User
): Promise<{ success: boolean; inspection?: PropertyInspection; error?: string; isDemo?: boolean }> {
  if (!dto.roomName.trim()) {
    return { success: false, error: 'Room or area name is required.' };
  }

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('property_inspections')
        .insert({
          agreement_id: dto.agreementId,
          inspection_type: dto.inspectionType,
          conducted_by: dto.conductedBy,
          room_name: dto.roomName.trim(),
          condition_rating: dto.conditionRating,
          damage_notes: dto.damageNotes?.trim() || null,
          photo_urls: dto.photoUrls || [],
          acknowledged_by_counterparty: false,
        })
        .select(`
          *,
          conductor:conducted_by (full_name)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Inspection insertion returned no data.' };
      return { success: true, inspection: mapDbInspectionToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Record inspection failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot record inspection in production.' };
  }

  const newInspection: PropertyInspection = {
    id: `insp-${Date.now()}`,
    agreementId: dto.agreementId,
    inspectionType: dto.inspectionType,
    conductedBy: dto.conductedBy,
    conductedByName: inspector.name,
    inspectionDate: new Date().toISOString().split('T')[0],
    roomName: dto.roomName.trim(),
    conditionRating: dto.conditionRating,
    damageNotes: dto.damageNotes?.trim(),
    photoUrls: dto.photoUrls || [],
    acknowledgedByCounterparty: false,
    createdAt: new Date().toISOString(),
  };

  mockInspections.unshift(newInspection);
  return { success: true, inspection: newInspection, isDemo: true };
}

export async function acknowledgeInspection(
  inspectionId: string
): Promise<{ success: boolean; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('property_inspections')
        .update({
          acknowledged_by_counterparty: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', inspectionId)
        .select();

      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Inspection not found or acknowledgment unauthorized under RLS.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Acknowledge inspection failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot acknowledge inspection in production.' };
  }

  const item = mockInspections.find(i => i.id === inspectionId);
  if (!item) {
    return { success: false, error: 'Inspection record not found.' };
  }
  item.acknowledgedByCounterparty = true;
  item.acknowledgedAt = new Date().toISOString();
  return { success: true, isDemo: true };
}

// ==========================================
// FEATURE B: TWO-SIDED RENTAL REPUTATION
// ==========================================

export async function fetchReviewsForAgreement(
  agreementId: string
): Promise<{ success: boolean; reviews: TenancyReview[]; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('tenancy_reviews')
        .select(`
          *,
          reviewer:reviewer_id (full_name),
          reviewee:reviewee_id (full_name)
        `)
        .eq('agreement_id', agreementId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, reviews: [], error: error.message };
      return { success: true, reviews: (data || []).map(mapDbReviewToApp) };
    } catch (err) {
      return { success: false, reviews: [], error: err instanceof Error ? err.message : 'Fetch reviews failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, reviews: [], error: 'Live database connection is unavailable in production.' };
  }

  const list = mockReviews.filter(r => r.agreementId === agreementId);
  return { success: true, reviews: list, isDemo: true };
}

export async function submitTenancyReview(
  dto: CreateTenancyReviewDTO,
  reviewer: User
): Promise<{ success: boolean; review?: TenancyReview; error?: string; isDemo?: boolean }> {
  if (dto.reviewerId === dto.revieweeId) {
    return { success: false, error: 'Self-reviews are not permitted.' };
  }
  if (!dto.reviewTitle.trim() || !dto.reviewContent.trim()) {
    return { success: false, error: 'Review title and written content are required.' };
  }

  const overall = Number(
    ((dto.communicationRating + dto.maintenanceRating + dto.propertyCareRating + dto.agreementClarityRating) / 4.0).toFixed(1)
  );

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('tenancy_reviews')
        .insert({
          agreement_id: dto.agreementId,
          reviewer_id: dto.reviewerId,
          reviewee_id: dto.revieweeId,
          reviewer_role: dto.reviewerRole,
          communication_rating: dto.communicationRating,
          maintenance_rating: dto.maintenanceRating,
          property_care_rating: dto.propertyCareRating,
          agreement_clarity_rating: dto.agreementClarityRating,
          overall_rating: overall,
          review_title: dto.reviewTitle.trim(),
          review_content: dto.reviewContent.trim(),
          is_public: true,
          moderation_status: 'published',
        })
        .select(`
          *,
          reviewer:reviewer_id (full_name),
          reviewee:reviewee_id (full_name)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Review insertion returned no data.' };
      return { success: true, review: mapDbReviewToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Submit review failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot submit review in production.' };
  }

  // Validate that agreement is active in demo mode
  const ag = mockAgreements.find(a => a.id === dto.agreementId);
  if (ag && ag.agreementStatus === 'draft') {
    return { success: false, error: 'Reviews cannot be submitted for draft agreements.' };
  }
  const dup = mockReviews.find(r => r.agreementId === dto.agreementId && r.reviewerId === dto.reviewerId);
  if (dup) {
    return { success: false, error: 'You have already submitted a review for this tenancy agreement.' };
  }

  const newReview: TenancyReview = {
    id: `rev-${Date.now()}`,
    agreementId: dto.agreementId,
    reviewerId: dto.reviewerId,
    reviewerName: reviewer.name,
    reviewerRole: dto.reviewerRole,
    revieweeId: dto.revieweeId,
    communicationRating: dto.communicationRating,
    maintenanceRating: dto.maintenanceRating,
    propertyCareRating: dto.propertyCareRating,
    agreementClarityRating: dto.agreementClarityRating,
    overallRating: overall,
    reviewTitle: dto.reviewTitle.trim(),
    reviewContent: dto.reviewContent.trim(),
    isPublic: true,
    moderationStatus: 'published',
    createdAt: new Date().toISOString(),
  };

  mockReviews.unshift(newReview);
  return { success: true, review: newReview, isDemo: true };
}

// ==========================================
// FEATURE F: RENTAL DISPUTE MANAGEMENT
// ==========================================

export async function fetchDisputesForAgreement(
  agreementId: string
): Promise<{ success: boolean; disputes: RentalDispute[]; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('rental_disputes')
        .select(`
          *,
          initiator:initiator_id (full_name),
          respondent:respondent_id (full_name)
        `)
        .eq('agreement_id', agreementId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, disputes: [], error: error.message };
      return { success: true, disputes: (data || []).map(mapDbDisputeToApp) };
    } catch (err) {
      return { success: false, disputes: [], error: err instanceof Error ? err.message : 'Fetch disputes failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, disputes: [], error: 'Live database connection is unavailable in production.' };
  }

  const list = mockDisputes.filter(d => d.agreementId === agreementId);
  return { success: true, disputes: list, isDemo: true };
}

export async function fileRentalDispute(
  dto: CreateRentalDisputeDTO,
  initiator: User
): Promise<{ success: boolean; dispute?: RentalDispute; error?: string; isDemo?: boolean }> {
  if (!dto.title.trim() || !dto.description.trim()) {
    return { success: false, error: 'Dispute title and detailed statement are required.' };
  }

  const disputeCode = `ASH-DSP-${Math.floor(100000 + Math.random() * 900000)}`;

  if (isBackendActive() && supabase) {
    try {
      const { data, error } = await supabase
        .from('rental_disputes')
        .insert({
          dispute_number: disputeCode,
          agreement_id: dto.agreementId,
          initiator_id: dto.initiatorId,
          respondent_id: dto.respondentId,
          dispute_type: dto.disputeType,
          disputed_amount: dto.disputedAmount || 0,
          title: dto.title.trim(),
          description: dto.description.trim(),
          evidence_urls: dto.evidenceUrls || [],
          status: 'open',
        })
        .select(`
          *,
          initiator:initiator_id (full_name),
          respondent:respondent_id (full_name)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Dispute filing returned no data.' };
      return { success: true, dispute: mapDbDisputeToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'File dispute failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot file dispute in production.' };
  }

  const newDispute: RentalDispute = {
    id: `dsp-${Date.now()}`,
    disputeNumber: disputeCode,
    agreementId: dto.agreementId,
    initiatorId: dto.initiatorId,
    initiatorName: initiator.name,
    respondentId: dto.respondentId,
    disputeType: dto.disputeType,
    disputedAmount: dto.disputedAmount || 0,
    title: dto.title.trim(),
    description: dto.description.trim(),
    status: 'open',
    evidenceUrls: dto.evidenceUrls || [],
    createdAt: new Date().toISOString(),
  };

  mockDisputes.unshift(newDispute);
  return { success: true, dispute: newDispute, isDemo: true };
}

export async function updateDisputeStatus(
  disputeId: string,
  newStatus: DisputeStatus,
  resolutionSummary?: string
): Promise<{ success: boolean; error?: string; isDemo?: boolean }> {
  if (isBackendActive() && supabase) {
    try {
      const updateData: Record<string, any> = { status: newStatus };
      if (resolutionSummary) updateData.resolution_summary = resolutionSummary;
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('rental_disputes')
        .update(updateData)
        .eq('id', disputeId)
        .select();

      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Dispute record not found or update unauthorized under RLS.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Update dispute failed' };
    }
  }

  if (!isDemoEnvironment()) {
    return { success: false, error: 'Live database connection is unavailable in production. Cannot update dispute in production.' };
  }

  const d = mockDisputes.find(item => item.id === disputeId);
  if (!d) {
    return { success: false, error: 'Dispute record not found.' };
  }
  d.status = newStatus;
  if (resolutionSummary) d.resolutionSummary = resolutionSummary;
  if (newStatus === 'resolved' || newStatus === 'closed') {
    d.resolvedAt = new Date().toISOString();
  }
  return { success: true, isDemo: true };
}

export async function createInspectionInBackend(payload: {
  agreementId: string;
  inspectionType: 'move_in' | 'move_out' | 'routine';
  roomName: string;
  conditionRating: 'pristine' | 'good' | 'fair' | 'poor' | 'damaged';
  damageNotes?: string;
  photoUrls?: string[];
  meterReadings?: {
    electricityKwh?: number;
    waterKl?: number;
    gasUnits?: number;
    recordedAt?: string;
  };
  inventory?: Array<{
    item: string;
    quantity: number;
    condition: string;
    notes?: string;
  }>;
  keyHandoverConfirmed?: boolean;
  depositConfirmed?: boolean;
}): Promise<{ success: boolean; inspection?: any; error?: string }> {
  try {
    const res = await apiClient.post<any>('/inspections', payload);
    return { success: true, inspection: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record inspection';
    return { success: false, error: message };
  }
}

export async function acknowledgeInspectionInBackend(
  inspectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch(`/inspections/${inspectionId}/acknowledge`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to acknowledge inspection';
    return { success: false, error: message };
  }
}

export async function fetchAgreementsFromBackend(): Promise<{
  success: boolean;
  agreements: TenancyAgreement[];
  error?: string;
}> {
  try {
    const res = await apiClient.get<any[]>('/agreements/mine');
    return { success: true, agreements: (res || []).map(mapDbAgreementToApp) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load tenancy agreements';
    return { success: false, agreements: [], error: message };
  }
}

export async function createAgreementInBackend(dto: {
  tenantProfileId: string;
  propertyId: string;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges?: number;
  startDate: string;
  endDate: string;
  noticePeriodDays?: number;
  lockInPeriodMonths?: number;
  termsSummary?: string;
  documentUrl?: string;
}): Promise<{ success: boolean; agreement?: TenancyAgreement; error?: string }> {
  try {
    const res = await apiClient.post<any>('/agreements', dto);
    return { success: true, agreement: mapDbAgreementToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create agreement';
    return { success: false, error: message };
  }
}

export async function updateAgreementStatusInBackend(
  agreementId: string,
  status: 'active' | 'terminated' | 'expired',
  reason?: string
): Promise<{ success: boolean; agreement?: TenancyAgreement; error?: string }> {
  try {
    const res = await apiClient.patch<any>(`/agreements/${agreementId}/status`, { status, reason });
    return { success: true, agreement: mapDbAgreementToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update agreement status';
    return { success: false, error: message };
  }
}

export async function recordPaymentInBackend(
  agreementId: string,
  dto: {
    amount: number;
    paymentCategory: 'rent' | 'security_deposit' | 'maintenance' | 'utility' | 'other';
    paymentDate: string;
    transactionReference?: string;
    receiptUrl?: string;
    notes?: string;
  }
): Promise<{ success: boolean; payment?: RentPaymentRecord; error?: string }> {
  try {
    const res = await apiClient.post<any>(`/agreements/${agreementId}/payments`, dto);
    return { success: true, payment: mapDbPaymentToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record payment';
    return { success: false, error: message };
  }
}

export async function fetchDisputesFromBackend(): Promise<{
  success: boolean;
  disputes: RentalDispute[];
  error?: string;
}> {
  try {
    const res = await apiClient.get<any[]>('/disputes/mine');
    return { success: true, disputes: (res || []).map(mapDbDisputeToApp) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load disputes';
    return { success: false, disputes: [], error: message };
  }
}

export async function createDisputeInBackend(dto: {
  agreementId: string;
  disputeType: 'deposit_deduction' | 'unauthorized_rent_hike' | 'maintenance_negligence' | 'early_termination' | 'amenity_failure' | 'other';
  disputedAmount?: number;
  title: string;
  description: string;
  evidenceUrls?: string[];
}): Promise<{ success: boolean; dispute?: RentalDispute; error?: string }> {
  try {
    const res = await apiClient.post<any>('/disputes', dto);
    return { success: true, dispute: mapDbDisputeToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create dispute';
    return { success: false, error: message };
  }
}

export async function resolveDisputeInBackend(
  disputeId: string,
  dto: {
    status: 'resolved' | 'escalated' | 'dismissed';
    resolutionSummary: string;
  }
): Promise<{ success: boolean; dispute?: RentalDispute; error?: string }> {
  try {
    const res = await apiClient.patch<any>(`/disputes/${disputeId}/resolve`, dto);
    return { success: true, dispute: mapDbDisputeToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve dispute';
    return { success: false, error: message };
  }
}

export async function fetchPropertyReviewsFromBackend(
  propertyId: string
): Promise<{ success: boolean; reviews: TenancyReview[]; error?: string }> {
  try {
    const res = await apiClient.get<any[]>(`/reviews/property/${propertyId}`);
    return { success: true, reviews: (res || []).map(mapDbReviewToApp) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load property reviews';
    return { success: false, reviews: [], error: message };
  }
}

export async function fetchProfileReviewsFromBackend(
  profileId: string
): Promise<{ success: boolean; reviews: TenancyReview[]; error?: string }> {
  try {
    const res = await apiClient.get<any[]>(`/reviews/profile/${profileId}`);
    return { success: true, reviews: (res || []).map(mapDbReviewToApp) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load profile reviews';
    return { success: false, reviews: [], error: message };
  }
}

export async function createReviewInBackend(dto: {
  agreementId: string;
  revieweeId: string;
  communicationRating: number;
  maintenanceRating: number;
  propertyCareRating: number;
  agreementClarityRating: number;
  overallRating: number;
  reviewTitle?: string;
  reviewContent?: string;
  isPublic?: boolean;
}): Promise<{ success: boolean; review?: TenancyReview; error?: string }> {
  try {
    const res = await apiClient.post<any>('/reviews', dto);
    return { success: true, review: mapDbReviewToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit review';
    return { success: false, error: message };
  }
}

export async function moderateReviewInBackend(
  reviewId: string,
  dto: {
    status: 'approved' | 'rejected' | 'flagged';
    reason?: string;
  }
): Promise<{ success: boolean; review?: TenancyReview; error?: string }> {
  try {
    const res = await apiClient.patch<any>(`/reviews/${reviewId}/moderate`, dto);
    return { success: true, review: mapDbReviewToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to moderate review';
    return { success: false, error: message };
  }
}
