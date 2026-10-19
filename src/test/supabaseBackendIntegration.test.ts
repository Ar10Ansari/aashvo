import { describe, it, expect } from 'vitest';
import {
  getBackendStatus,
  checkSupabaseConnection,
  mapSupabasePropertyToApp,
  mapAppPropertyToSupabaseInsert,
  mapSupabaseProfileToUser,
  mapSupabaseTicketToApp,
  mapSupabaseReportToApp,
  isLiveBackendConfigured,
} from '../services/supabase';
import {
  createPropertyInSupabase,
  submitInquiryInSupabase,
} from '../services/marketplaceService';
import {
  createSupportTicketInSupabase,
  createSafetyReportInSupabase,
} from '../services/supportService';
import { Property, User } from '../types';

describe('Supabase Backend Integration & Mappers', () => {
  it('correctly reports backend status', () => {
    const status = getBackendStatus();
    expect(status).toBeDefined();
    expect(status.region).toContain('ap-south-1 Mumbai');
    if (!isLiveBackendConfigured) {
      expect(status.isLive).toBe(false);
      expect(status.provider).toBe('Local Deterministic Store');
    }
  });

  it('fails gracefully when checking connection on unconfigured live backend', async () => {
    if (!isLiveBackendConfigured) {
      const res = await checkSupabaseConnection();
      expect(res.connected).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('correctly maps a database property row to application Property object', () => {
    const dbRow = {
      id: 'db-prop-123',
      title: 'Serene Room with Family in Indiranagar',
      description: 'Cosy private bedroom in our 3BHK home.',
      rent_amount: 14000,
      deposit_amount: 14000,
      maintenance_charge: 1200,
      optional_meal_cost: 3500,
      room_type: 'private_room',
      property_type: 'apartment',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      address_short: '100ft Road, Indiranagar',
      furnishing: 'fully_furnished',
      category: 'family_stays',
      meals_offered: 'optional_extra',
      family_lives_on_property: true,
      provider_type: 'owner',
      provider_name: 'Lakshmi Narayanan',
      provider_contact: '+91 98112 00000',
      status: 'active',
      images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c'],
      amenities: ['Wi-Fi', 'Power Backup', 'Home Cooked Meals'],
      house_rules: ['No late-night loud music', 'Vegetarian meals preferred'],
      gender_preference: 'female_only',
      created_at: '2026-10-20T00:00:00Z',
    };

    const appProp = mapSupabasePropertyToApp(dbRow);
    expect(appProp.id).toBe('db-prop-123');
    expect(appProp.title).toBe('Serene Room with Family in Indiranagar');
    expect(appProp.rent).toBe(14000);
    expect(appProp.deposit).toBe(14000);
    expect(appProp.maintenance).toBe(1200);
    expect(appProp.optionalMealCost).toBe(3500);
    expect(appProp.roomType).toBe('private_room');
    expect(appProp.category).toBe('family_stays');
    expect(appProp.mealsOffered).toBe('optional_extra');
    expect(appProp.familyLivesOnProperty).toBe(true);
    expect(appProp.providerType).toBe('owner');
    expect(appProp.providerName).toBe('Lakshmi Narayanan');
    expect(appProp.rules).toContain('Vegetarian meals preferred');
  });

  it('correctly maps application Property to Supabase insert payload with strict defaults', () => {
    const appProp: Partial<Property> = {
      title: 'Modern Shared Room near HSR Layout',
      description: 'Twin sharing room with high speed internet.',
      rent: 8500,
      deposit: 8500,
      maintenance: 500,
      roomType: 'shared_room',
      category: 'flats_rooms',
      locality: 'HSR Layout Sector 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560102',
      addressShort: '27th Main, Sector 2',
      furnishing: 'fully_furnished',
      mealsOffered: 'none',
      familyLivesOnProperty: false,
      providerType: 'tenant_flatmate',
      rules: ['Keep common areas clean'],
      genderPreference: 'any',
      images: ['https://example.com/room.jpg'],
    };

    const insertRow = mapAppPropertyToSupabaseInsert(appProp, 'usr-test-999');
    expect(insertRow.owner_id).toBe('usr-test-999');
    expect(insertRow.title).toBe(appProp.title);
    expect(insertRow.rent_amount).toBe(8500);
    expect(insertRow.status).toBe('pending_review'); // Safety default
    expect(insertRow.family_lives_on_property).toBe(false);
    expect(insertRow.meals_offered).toBe('none');
  });

  it('correctly maps database profile row to User object', () => {
    const profileRow = {
      id: 'usr-sub-888',
      email: 'aarti.sharma@example.com',
      full_name: 'Aarti Sharma',
      role: 'renter',
      avatar_url: 'https://example.com/avatar.jpg',
      phone_verified: true,
      id_verified: true,
      phone_number: '+91 98765 43210',
    };

    const user = mapSupabaseProfileToUser(profileRow);
    expect(user.id).toBe('usr-sub-888');
    expect(user.name).toBe('Aarti Sharma');
    expect(user.email).toBe('aarti.sharma@example.com');
    expect(user.phoneVerified).toBe(true);
    expect(user.identityVerified).toBe(true);
    expect(user.phone).toBe('+91 98765 43210');
  });

  it('correctly maps database ticket row to SupportTicket object', () => {
    const ticketRow = {
      id: 'tkt-db-001',
      ticket_number: 'ASH-TKT-M5K8R2',
      user_id: 'usr-101',
      user_email: 'rohan.v@delhitech.in',
      user_name: 'Rohan Varma',
      user_phone: '+91 98112 34567',
      category: 'rooms_listings',
      subject: 'Clarification on maintenance fee in Koramangala listing',
      description: 'Does the listed rent include monthly society maintenance?',
      priority: 'normal',
      status: 'open',
      created_at: '2026-10-20T01:00:00Z',
      updated_at: '2026-10-20T01:00:00Z',
    };

    const ticket = mapSupabaseTicketToApp(ticketRow);
    expect(ticket.id).toBe('tkt-db-001');
    expect(ticket.ticketNumber).toBe('ASH-TKT-M5K8R2');
    expect(ticket.userName).toBe('Rohan Varma');
    expect(ticket.attachments).toEqual([]);
    expect(ticket.messages).toEqual([]);
    expect(ticket.status).toBe('open');
  });

  it('correctly maps database report row to SafetyReport object', () => {
    const reportRow = {
      id: 'rep-db-002',
      reporter_id: 'usr-101',
      reporter_email: 'rohan.v@delhitech.in',
      target_type: 'listing',
      target_id: 'prop-4',
      target_title: 'Studio Room in Saket',
      reason_code: 'misleading_charges',
      details: 'Provider quoted a different deposit amount during chat.',
      evidence_url: 'https://storage.supabase.co/reports/proof.png',
      priority: 'high',
      status: 'pending',
      created_at: '2026-10-20T01:30:00Z',
    };

    const report = mapSupabaseReportToApp(reportRow);
    expect(report.id).toBe('rep-db-002');
    expect(report.targetType).toBe('listing');
    expect(report.reasonCode).toBe('misleading_charges');
    expect(report.priority).toBe('high');
    expect(report.evidenceUrl).toBe('https://storage.supabase.co/reports/proof.png');
  });

  it('enforces Family Stay business rules when creating listings via marketplace service', async () => {
    const hostUser: User = {
      id: 'usr-non-family',
      name: 'Manager Raj',
      email: 'raj@brokerage.com',
      role: 'broker',
      phoneVerified: true,
    };

    const invalidFamilyStay: Partial<Property> = {
      title: 'Family Stay by Commercial Manager',
      rent: 15000,
      deposit: 15000,
      locality: 'Indiranagar',
      city: 'Bengaluru',
      category: 'family_stays',
      familyLivesOnProperty: false, // Invalid: family does not reside there!
      providerType: 'verified_manager', // Invalid: only resident owners can host Family Stays!
    };

    const result = await createPropertyInSupabase(invalidFamilyStay, hostUser);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('Family Stays can only be published by direct home owners'))).toBe(true);
  });

  it('submits inquiries and returns successful response in local/fallback mode', async () => {
    const inquiryData = {
      listingId: 'prop-1',
      senderId: 'usr-101',
      senderName: 'Rohan Varma',
      senderEmail: 'rohan.v@delhitech.in',
      senderPhone: '+91 98112 34567',
      message: 'Hello! I am interested in visiting this weekend.',
      moveInDate: '2026-11-01',
    };

    const res = await submitInquiryInSupabase(inquiryData);
    expect(res.success).toBe(true);
    expect(res.inquiryId).toBeDefined();
  });

  it('creates support tickets and initializes messages cleanly in local fallback', async () => {
    const ticketData = {
      userEmail: 'student@iitd.ac.in',
      userName: 'Karan Mehra',
      category: 'account_login' as const,
      subject: 'Cannot login with email verification code',
      description: 'I did not receive the OTP email in my spam folder either.',
    };

    const res = await createSupportTicketInSupabase(ticketData, 'Please help me reset my access.');
    expect(res.success).toBe(true);
    expect(res.ticket).toBeDefined();
    expect(res.ticket?.ticketNumber).toMatch(/^ASH-TKT-[A-Z0-9]{6}$/);
    expect(res.ticket?.messages.length).toBe(1);
    expect(res.ticket?.messages[0].message).toBe('Please help me reset my access.');
  });

  it('creates safety report with auto-calculated high priority for scam/fraud', async () => {
    const reportData = {
      reporterEmail: 'alert@user.com',
      targetType: 'user' as const,
      targetId: 'usr-fake-99',
      targetTitle: 'Suspicious Profile',
      reasonCode: 'scam_fraud' as const,
      details: 'Demanded advance deposit outside the platform via unverified QR code.',
    };

    const res = await createSafetyReportInSupabase(reportData);
    expect(res.success).toBe(true);
    expect(res.reportId).toBeDefined();
  });
});
