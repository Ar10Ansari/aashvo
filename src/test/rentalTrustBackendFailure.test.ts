import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setDemoModeOverride,
  setBackendAvailableOverrideForTesting,
  fetchAgreementsForUser,
  createTenancyAgreement,
  recordRentPayment,
  confirmPaymentByLandlord,
  recordPropertyInspection,
  submitTenancyReview,
  fileRentalDispute,
} from '../services/rentalTrustService';
import { User } from '../types';

describe('Rental Trust Backend Failure & Demo-Fallback Regression Suite', () => {
  const landlord: User = {
    id: 'user-landlord-fail-1',
    name: 'Verified Landlord',
    email: 'landlord.fail@aashvo.in',
    role: 'owner',
    phoneVerified: true,
    emailVerified: true,
  };

  const tenant: User = {
    id: 'user-tenant-fail-1',
    name: 'Verified Tenant',
    email: 'tenant.fail@aashvo.in',
    role: 'renter',
    phoneVerified: true,
    emailVerified: true,
  };

  beforeEach(() => {
    setBackendAvailableOverrideForTesting(false);
    setDemoModeOverride(false); // Prohibit demo fallback (simulate production)
  });

  afterEach(() => {
    setBackendAvailableOverrideForTesting(null);
    setDemoModeOverride(null);
  });

  // ==========================================
  // 1. PRODUCTION FALLBACK HARDENING
  // ==========================================

  it('1. Rejects silent mock agreement reads when running in simulated production without backend', async () => {
    const res = await fetchAgreementsForUser('any-user-id');
    expect(res.success).toBe(false);
    expect(res.agreements).toEqual([]);
    expect(res.error).toContain('unavailable in production');
  });

  it('2. Strictly rejects agreement creation writes when running in production without database', async () => {
    const res = await createTenancyAgreement(
      {
        landlordId: landlord.id,
        tenantId: tenant.id,
        monthlyRent: 20000,
        securityDeposit: 20000,
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      },
      landlord
    );

    expect(res.success).toBe(false);
    expect(res.agreement).toBeUndefined();
    expect(res.error).toContain('unavailable in production');
  });

  it('3. Strictly rejects rent payment recording in production without database', async () => {
    const res = await recordRentPayment(
      {
        agreementId: 'ag-fake-1',
        payerId: tenant.id,
        recipientId: landlord.id,
        amount: 20000,
        paymentCategory: 'rent',
      },
      tenant
    );

    expect(res.success).toBe(false);
    expect(res.payment).toBeUndefined();
    expect(res.error).toContain('unavailable in production');
  });

  it('4. Strictly rejects payment confirmation in production without database', async () => {
    const res = await confirmPaymentByLandlord('pay-001', landlord);
    expect(res.success).toBe(false);
    expect(res.error).toContain('unavailable in production');
  });

  it('5. Strictly rejects property inspection recording in production without database', async () => {
    const res = await recordPropertyInspection(
      {
        agreementId: 'ag-fake-1',
        inspectionType: 'move_in',
        conductedBy: landlord.id,
        roomName: 'Living Room',
        conditionRating: 'pristine',
      },
      landlord
    );

    expect(res.success).toBe(false);
    expect(res.inspection).toBeUndefined();
    expect(res.error).toContain('unavailable in production');
  });

  it('6. Strictly rejects review submission in production without database', async () => {
    const res = await submitTenancyReview(
      {
        agreementId: 'ag-fake-1',
        reviewerId: tenant.id,
        revieweeId: landlord.id,
        reviewerRole: 'tenant',
        communicationRating: 5,
        maintenanceRating: 5,
        propertyCareRating: 5,
        agreementClarityRating: 5,
        reviewTitle: 'Great Host',
        reviewContent: 'Transparent and responsive.',
      },
      tenant
    );

    expect(res.success).toBe(false);
    expect(res.review).toBeUndefined();
    expect(res.error).toContain('unavailable in production');
  });

  it('7. Strictly rejects dispute filing in production without database', async () => {
    const res = await fileRentalDispute(
      {
        agreementId: 'ag-fake-1',
        initiatorId: tenant.id,
        respondentId: landlord.id,
        disputeType: 'security_deposit',
        disputedAmount: 5000,
        title: 'Unexplained deduction',
        description: 'Landlord deducted 5000 with no invoice.',
      },
      tenant
    );

    expect(res.success).toBe(false);
    expect(res.dispute).toBeUndefined();
    expect(res.error).toContain('unavailable in production');
  });

  // ==========================================
  // 2. EXPLICIT DEMO ISOLATION & INTEGRITY
  // ==========================================

  it('8. Development demo mode explicitly marks records with isDemo flag', async () => {
    // Explicitly allow demo mode
    setDemoModeOverride(true);
    const res = await fetchAgreementsForUser(landlord.id);
    expect(res.success).toBe(true);
    expect(res.isDemo).toBe(true);
  });

  it('9. Demo mode blocks non-recipient from confirming rent payments', async () => {
    setDemoModeOverride(true);
    // Non-recipient (tenant) attempts to confirm payment received
    const res = await confirmPaymentByLandlord('pay-001', tenant);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Only the recipient landlord');
  });

  it('10. Client validation prevents identical landlord and tenant accounts', async () => {
    setDemoModeOverride(true);
    const res = await createTenancyAgreement(
      {
        landlordId: landlord.id,
        tenantId: landlord.id, // Violation
        monthlyRent: 20000,
        securityDeposit: 20000,
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      },
      landlord
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('distinct');
  });

  it('11. Client validation prevents non-positive rent amounts', async () => {
    setDemoModeOverride(true);
    const res = await createTenancyAgreement(
      {
        landlordId: landlord.id,
        tenantId: tenant.id,
        monthlyRent: -500, // Violation
        securityDeposit: 20000,
        startDate: '2026-09-01',
        endDate: '2027-08-31',
      },
      landlord
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('positive');
  });

  it('12. Client validation prevents inverted agreement dates', async () => {
    setDemoModeOverride(true);
    const res = await createTenancyAgreement(
      {
        landlordId: landlord.id,
        tenantId: tenant.id,
        monthlyRent: 20000,
        securityDeposit: 20000,
        startDate: '2027-09-01',
        endDate: '2026-09-01', // Violation
      },
      landlord
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('strictly after');
  });
});
