import { describe, it, expect } from 'vitest';
import {
  mapDbAgreementToApp,
  mapDbPaymentToApp,
  mapDbInspectionToApp,
  mapDbReviewToApp,
  mapDbDisputeToApp,
  createTenancyAgreement,
  recordRentPayment,
  recordPropertyInspection,
  submitTenancyReview,
  fileRentalDispute,
} from '../services/rentalTrustService';
import { User } from '../types';

describe('Aashvo Rental Trust Unit & Domain Logic Suite', () => {
  const dummyLandlord: User = {
    id: 'usr-landlord-1',
    email: 'landlord@aashvo.in',
    name: 'Suresh Kumar',
    role: 'owner',
    emailVerified: true,
    phoneVerified: true,
  };

  const dummyTenant: User = {
    id: 'usr-tenant-1',
    email: 'tenant@aashvo.in',
    name: 'Priya Nair',
    role: 'renter',
    emailVerified: true,
    phoneVerified: true,
  };

  // ==========================================
  // 1. DATA MAPPERS INTEGRITY
  // ==========================================

  it('1. Correctly maps database agreement row to application model', () => {
    const dbRow = {
      id: 'ag-123',
      property_id: 'prop-456',
      landlord_id: 'usr-landlord-1',
      tenant_id: 'usr-tenant-1',
      monthly_rent: '25000.00',
      security_deposit: '25000.00',
      start_date: '2026-07-01',
      end_date: '2027-06-30',
      agreement_status: 'active',
      document_url: 'https://storage/agreements/sample.pdf',
      terms_summary: '11-month residential lease',
      created_at: '2026-06-25T10:00:00Z',
      updated_at: '2026-06-25T10:00:00Z',
      properties: { title: 'Modern 2BHK', locality: 'Sector 43, Gurugram' },
      landlord: { full_name: 'Suresh Kumar', email: 'landlord@aashvo.in' },
      tenant: { full_name: 'Priya Nair', email: 'tenant@aashvo.in' },
    };

    const appModel = mapDbAgreementToApp(dbRow);
    expect(appModel.id).toBe('ag-123');
    expect(appModel.monthlyRent).toBe(25000);
    expect(appModel.securityDeposit).toBe(25000);
    expect(appModel.landlordName).toBe('Suresh Kumar');
    expect(appModel.tenantName).toBe('Priya Nair');
    expect(appModel.propertyTitle).toBe('Modern 2BHK');
    expect(appModel.propertyLocality).toBe('Sector 43, Gurugram');
    expect(appModel.agreementStatus).toBe('active');
  });

  it('2. Correctly maps payment record row with number coercion', () => {
    const dbRow = {
      id: 'pay-789',
      agreement_id: 'ag-123',
      payer_id: 'usr-tenant-1',
      recipient_id: 'usr-landlord-1',
      amount: '25000.50',
      payment_category: 'rent',
      payment_date: '2026-07-05',
      transaction_reference: 'UPI-984019283',
      verification_status: 'confirmed_by_landlord',
      notes: 'July 2026 rent',
      created_at: '2026-07-05T12:00:00Z',
      payer: { full_name: 'Priya Nair' },
      recipient: { full_name: 'Suresh Kumar' },
    };

    const payment = mapDbPaymentToApp(dbRow);
    expect(payment.id).toBe('pay-789');
    expect(payment.amount).toBe(25000.5);
    expect(payment.verificationStatus).toBe('confirmed_by_landlord');
    expect(payment.payerName).toBe('Priya Nair');
    expect(payment.recipientName).toBe('Suresh Kumar');
  });

  it('3. Correctly maps inspection and review models', () => {
    const inspRow = {
      id: 'insp-1',
      agreement_id: 'ag-123',
      inspection_type: 'move_in',
      conducted_by: 'usr-landlord-1',
      inspection_date: '2026-07-01',
      room_name: 'Master Bedroom',
      condition_rating: 'pristine',
      damage_notes: 'Repainted walls',
      photo_urls: ['https://photo1.jpg'],
      acknowledged_by_counterparty: true,
      conductor: { full_name: 'Suresh Kumar' },
    };

    const insp = mapDbInspectionToApp(inspRow);
    expect(insp.roomName).toBe('Master Bedroom');
    expect(insp.conditionRating).toBe('pristine');
    expect(insp.acknowledgedByCounterparty).toBe(true);

    const revRow = {
      id: 'rev-1',
      agreement_id: 'ag-123',
      reviewer_id: 'usr-tenant-1',
      reviewee_id: 'usr-landlord-1',
      reviewer_role: 'tenant',
      communication_rating: 5,
      maintenance_rating: 4,
      property_care_rating: 5,
      agreement_clarity_rating: 4,
      overall_rating: 4.5,
      review_title: 'Great experience',
      review_content: 'Very accommodating host.',
      is_public: true,
      moderation_status: 'published',
      created_at: '2026-08-01T00:00:00Z',
    };

    const rev = mapDbReviewToApp(revRow);
    expect(rev.overallRating).toBe(4.5);
    expect(rev.reviewerRole).toBe('tenant');

    const dispRow = {
      id: 'dsp-1',
      dispute_number: 'ASH-DSP-001',
      agreement_id: 'ag-123',
      initiator_id: 'usr-tenant-1',
      respondent_id: 'usr-landlord-1',
      dispute_type: 'security_deposit',
      disputed_amount: '12000.00',
      title: 'Deposit deduction',
      description: 'Disputed deduction',
      status: 'open',
      evidence_urls: [],
      created_at: '2026-08-01T00:00:00Z',
    };

    const disp = mapDbDisputeToApp(dispRow);
    expect(disp.disputeNumber).toBe('ASH-DSP-001');
    expect(disp.disputedAmount).toBe(12000);
  });

  // ==========================================
  // 2. VALIDATION & BOUNDARY DEFENSES
  // ==========================================

  it('4. Rejects tenancy agreements with matching landlord and tenant', async () => {
    const res = await createTenancyAgreement(
      {
        landlordId: 'usr-same-1',
        tenantId: 'usr-same-1',
        monthlyRent: 20000,
        securityDeposit: 20000,
        startDate: '2026-07-01',
        endDate: '2027-06-30',
      },
      dummyLandlord
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('distinct user accounts');
  });

  it('5. Rejects tenancy agreements with non-positive rent or invalid date ranges', async () => {
    const resZeroRent = await createTenancyAgreement(
      {
        landlordId: dummyLandlord.id,
        tenantId: dummyTenant.id,
        monthlyRent: 0,
        securityDeposit: 20000,
        startDate: '2026-07-01',
        endDate: '2027-06-30',
      },
      dummyLandlord
    );
    expect(resZeroRent.success).toBe(false);
    expect(resZeroRent.error).toContain('positive amount');

    const resReversedDates = await createTenancyAgreement(
      {
        landlordId: dummyLandlord.id,
        tenantId: dummyTenant.id,
        monthlyRent: 20000,
        securityDeposit: 20000,
        startDate: '2027-07-01',
        endDate: '2026-07-01', // End before start
      },
      dummyLandlord
    );
    expect(resReversedDates.success).toBe(false);
    expect(resReversedDates.error).toContain('strictly after start date');
  });

  it('6. Rejects rent payments with non-positive amounts', async () => {
    const res = await recordRentPayment(
      {
        agreementId: 'ag-demo-001',
        payerId: dummyTenant.id,
        recipientId: dummyLandlord.id,
        amount: -500,
        paymentCategory: 'rent',
      },
      dummyTenant
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('greater than zero');
  });

  it('7. Rejects inspections without room name', async () => {
    const res = await recordPropertyInspection(
      {
        agreementId: 'ag-demo-001',
        inspectionType: 'move_in',
        conductedBy: dummyLandlord.id,
        roomName: '   ',
        conditionRating: 'good',
      },
      dummyLandlord
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('Room or area name is required');
  });

  it('8. Rejects self-reviews and computes mathematical overall rating average', async () => {
    const resSelf = await submitTenancyReview(
      {
        agreementId: 'ag-demo-001',
        reviewerId: dummyTenant.id,
        revieweeId: dummyTenant.id, // Same user
        reviewerRole: 'tenant',
        communicationRating: 5,
        maintenanceRating: 5,
        propertyCareRating: 5,
        agreementClarityRating: 5,
        reviewTitle: 'Self review',
        reviewContent: 'I am great',
      },
      dummyTenant
    );

    expect(resSelf.success).toBe(false);
    expect(resSelf.error).toContain('Self-reviews are not permitted');

    const resValid = await submitTenancyReview(
      {
        agreementId: 'ag-demo-001',
        reviewerId: dummyTenant.id,
        revieweeId: dummyLandlord.id,
        reviewerRole: 'tenant',
        communicationRating: 5,
        maintenanceRating: 4,
        propertyCareRating: 4,
        agreementClarityRating: 3,
        reviewTitle: 'Authentic Tenancy Review',
        reviewContent: 'Smooth lease experience and prompt communication.',
      },
      dummyTenant
    );

    expect(resValid.success).toBe(true);
    // (5 + 4 + 4 + 3) / 4 = 16 / 4 = 4.0
    expect(resValid.review?.overallRating).toBe(4.0);
  });

  it('9. Rejects disputes without title or description and generates dispute number', async () => {
    const resBlank = await fileRentalDispute(
      {
        agreementId: 'ag-demo-001',
        initiatorId: dummyTenant.id,
        respondentId: dummyLandlord.id,
        disputeType: 'security_deposit',
        disputedAmount: 15000,
        title: '',
        description: '',
      },
      dummyTenant
    );

    expect(resBlank.success).toBe(false);
    expect(resBlank.error).toContain('required');

    const resValid = await fileRentalDispute(
      {
        agreementId: 'ag-demo-001',
        initiatorId: dummyTenant.id,
        respondentId: dummyLandlord.id,
        disputeType: 'security_deposit',
        disputedAmount: 15000,
        title: 'Unreturned Security Deposit after Move-Out',
        description: 'Tenancy completed on 31 May. Clean condition confirmed during inspection but deposit not returned.',
      },
      dummyTenant
    );

    expect(resValid.success).toBe(true);
    expect(resValid.dispute?.disputeNumber).toMatch(/^ASH-DSP-\d+$/);
    expect(resValid.dispute?.status).toBe('open');
  });
});
