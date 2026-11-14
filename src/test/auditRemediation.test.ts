import { describe, it, expect, vi, afterEach } from 'vitest';
import * as supabaseModule from '../services/supabase';
import {
  createSafetyReportInSupabase,
  createSupportTicketInSupabase,
  addTicketMessageInSupabase,
  updateTicketStatusInSupabase,
  updateTicketPriorityInSupabase,
  assignTicketInSupabase,
  fetchAllSupportTicketsForAdminFromSupabase,
  fetchSafetyReportsForAdminFromSupabase,
  resolveSafetyReportInSupabase,
} from '../services/supportService';
import {
  fetchAllPropertiesForAdminFromSupabase,
  fetchMyFlatmateProfileFromSupabase,
} from '../services/marketplaceService';
import { createSignedStorageUrl } from '../services/storageService';

describe('Audit Remediation — Live Supabase Contract, RLS Alignment & Error Handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockLiveSupabase(mockClient: any) {
    vi.spyOn(supabaseModule, 'isLiveBackendConfigured', 'get' as any);
    Object.defineProperty(supabaseModule, 'isLiveBackendConfigured', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(supabaseModule, 'supabase', {
      value: mockClient,
      configurable: true,
    });
  }

  function restoreMockSupabase() {
    Object.defineProperty(supabaseModule, 'isLiveBackendConfigured', {
      value: false,
      configurable: true,
    });
    Object.defineProperty(supabaseModule, 'supabase', {
      value: null,
      configurable: true,
    });
  }

  it('submits safety reports without invoking SELECT RETURNING under admin-only SELECT RLS', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

    mockLiveSupabase({ from: fromMock });

    const res = await createSafetyReportInSupabase({
      reporterId: 'usr-renter-1',
      reporterEmail: 'renter@example.com',
      targetType: 'listing',
      targetId: 'prop-123',
      targetTitle: 'Suspicious Listing',
      reasonCode: 'scam_fraud',
      details: 'Requested advance UPI payment before property visit.',
    });

    restoreMockSupabase();

    expect(fromMock).toHaveBeenCalledWith('safety_reports');
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedPayload = insertMock.mock.calls[0][0];
    expect(insertedPayload.reported_property_id).toBe('prop-123');
    expect(insertedPayload.priority).toBe('urgent');
    expect(res.success).toBe(true);
    expect(res.reportId).toBeTruthy();
  });

  it('surfaces error when safety_reports insert fails instead of faking success', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: 'RLS policy rejected insert' } });
    mockLiveSupabase({ from: vi.fn().mockReturnValue({ insert: insertMock }) });

    const res = await createSafetyReportInSupabase({
      reporterEmail: 'guest@example.com',
      targetType: 'user',
      targetId: 'usr-99',
      targetTitle: 'Reported Account',
      reasonCode: 'harassment',
      details: 'Abusive messages sent during room inquiry.',
    });

    restoreMockSupabase();

    expect(res.success).toBe(false);
    expect(res.error).toContain('RLS policy rejected insert');
  });

  it('routes guest support ticket creation through create_guest_support_ticket RPC', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'tkt-guest-uuid',
          ticket_number: 'ASH-TKT-GUE5T1',
          status: 'open',
          priority: 'normal',
          created_at: '2026-11-12T10:00:00Z',
          updated_at: '2026-11-12T10:00:00Z',
        },
      ],
      error: null,
    });

    mockLiveSupabase({ rpc: rpcMock });

    const res = await createSupportTicketInSupabase(
      {
        category: 'account_login',
        subject: 'Cannot confirm email link',
        description: 'Verification email expired before I clicked it.',
        userEmail: 'guest@example.com',
        userName: 'Guest User',
      },
      'Please help resend confirmation.'
    );

    restoreMockSupabase();

    expect(rpcMock).toHaveBeenCalledWith(
      'create_guest_support_ticket',
      expect.objectContaining({
        p_user_email: 'guest@example.com',
        p_user_name: 'Guest User',
        p_initial_message: 'Please help resend confirmation.',
      })
    );
    expect(res.success).toBe(true);
    expect(res.ticket?.id).toBe('tkt-guest-uuid');
    expect(res.ticket?.messages).toHaveLength(1);
  });

  it('routes unauthenticated guest ticket replies through add_guest_ticket_reply RPC', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'msg-guest-1',
          ticket_id: 'tkt-guest-uuid',
          sender_name: 'Guest User',
          sender_role: 'user',
          message: 'Follow-up details added.',
          created_at: '2026-11-12T10:05:00Z',
        },
      ],
      error: null,
    });

    mockLiveSupabase({ rpc: rpcMock });

    const res = await addTicketMessageInSupabase({
      ticketId: 'tkt-guest-uuid',
      ticketNumber: 'ASH-TKT-GUE5T1',
      userEmail: 'guest@example.com',
      senderName: 'Guest User',
      senderRole: 'user',
      message: 'Follow-up details added.',
      isInternal: false,
    });

    restoreMockSupabase();

    expect(rpcMock).toHaveBeenCalledWith('add_guest_ticket_reply', {
      p_ticket_number: 'ASH-TKT-GUE5T1',
      p_user_email: 'guest@example.com',
      p_sender_name: 'Guest User',
      p_message: 'Follow-up details added.',
    });
    expect(res.success).toBe(true);
    expect(res.message?.id).toBe('msg-guest-1');
  });

  it('persists admin ticket status updates and records audit trail, failing when RLS returns 0 rows', async () => {
    const eqMockDenied = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const updateMockDenied = vi.fn().mockReturnValue({ eq: eqMockDenied });

    mockLiveSupabase({ from: vi.fn().mockReturnValue({ update: updateMockDenied }) });

    const deniedRes = await updateTicketStatusInSupabase({
      ticketId: 'tkt-1',
      oldStatus: 'open',
      newStatus: 'in_review',
      actorId: 'usr-not-admin',
      actorName: 'Regular User',
    });

    restoreMockSupabase();
    expect(deniedRes.success).toBe(false);
    expect(deniedRes.error).toContain('unauthorized');

    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const eqMockOk = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'tkt-1' }], error: null }),
    });
    const updateMockOk = vi.fn().mockReturnValue({ eq: eqMockOk });
    const fromMock = vi.fn((table: string) => {
      if (table === 'support_tickets') return { update: updateMockOk };
      if (table === 'ticket_audit_events') return { insert: auditInsertMock };
      return {};
    });

    mockLiveSupabase({ from: fromMock });

    const okRes = await updateTicketStatusInSupabase({
      ticketId: 'tkt-1',
      oldStatus: 'open',
      newStatus: 'resolved',
      actorId: 'usr-admin-uuid',
      actorName: 'Aashvo Admin',
      notes: 'Resolved cleanly',
    });

    restoreMockSupabase();
    expect(okRes.success).toBe(true);
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_id: 'tkt-1',
        action: 'status_changed',
        old_value: 'open',
        new_value: 'resolved',
      })
    );
  });

  it('persists ticket priority, assignment, and safety report resolution via Supabase', async () => {
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
    const makeUpdateChain = () => ({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'rec-1' }], error: null }),
      }),
    });

    mockLiveSupabase({
      from: vi.fn((table: string) => {
        if (table === 'ticket_audit_events') return { insert: auditInsertMock };
        return { update: vi.fn().mockReturnValue(makeUpdateChain()) };
      }),
    });

    const priRes = await updateTicketPriorityInSupabase({
      ticketId: 'tkt-1',
      oldPriority: 'normal',
      newPriority: 'urgent',
      actorId: 'admin-1',
      actorName: 'Admin',
    });
    const assignRes = await assignTicketInSupabase({
      ticketId: 'tkt-1',
      assigneeId: 'admin-1',
      assigneeName: 'Admin',
      actorId: 'admin-1',
      actorName: 'Admin',
    });
    const repRes = await resolveSafetyReportInSupabase({
      reportId: 'srep-1',
      status: 'resolved',
      adminNotes: 'Listing paused after verification',
      reviewerId: 'admin-1',
    });

    restoreMockSupabase();

    expect(priRes.success).toBe(true);
    expect(assignRes.success).toBe(true);
    expect(repRes.success).toBe(true);
    expect(auditInsertMock).toHaveBeenCalledTimes(2);
  });

  it('fetches admin properties (with photos), admin tickets, admin safety reports, and flatmate city mapping', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'prop-pending-1',
                  title: 'Pending DLF Room',
                  status: 'pending_review',
                  rent_amount: 18000,
                  deposit_amount: 18000,
                  locality: 'DLF Phase 2',
                  city: 'Gurugram',
                  profiles: { full_name: 'Host Anita' },
                  property_photos: [
                    { photo_url: 'https://cdn.example.com/2.jpg', sort_order: 1 },
                    { photo_url: 'https://cdn.example.com/1.jpg', sort_order: 0 },
                  ],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'support_tickets') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'tkt-admin-1',
                  ticket_number: 'ASH-TKT-ADM001',
                  user_email: 'user@example.com',
                  user_name: 'User One',
                  category: 'verification',
                  subject: 'Verification help',
                  description: 'Need phone verification support.',
                  status: 'open',
                  priority: 'high',
                  created_at: '2026-11-12T08:00:00Z',
                  updated_at: '2026-11-12T08:00:00Z',
                  ticket_messages: [],
                  ticket_audit_events: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'safety_reports') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'srep-admin-1',
                  target_type: 'listing',
                  reported_property_id: 'prop-pending-1',
                  target_title: 'Pending DLF Room',
                  reason_code: 'scam_fraud',
                  details: 'Demanded deposit before visit.',
                  priority: 'urgent',
                  status: 'pending',
                  created_at: '2026-11-12T09:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'flatmate_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'flt-1',
                  occupation: 'Analyst',
                  age: 24,
                  gender: 'female',
                  city: 'Bengaluru',
                  target_localities: ['Indiranagar'],
                  budget_max: 20000,
                  profiles: { full_name: 'Neha Rao' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockLiveSupabase({ from: fromMock });

    const adminProps = await fetchAllPropertiesForAdminFromSupabase();
    const adminTickets = await fetchAllSupportTicketsForAdminFromSupabase();
    const adminReports = await fetchSafetyReportsForAdminFromSupabase();
    const myFlatmate = await fetchMyFlatmateProfileFromSupabase('usr-123');

    restoreMockSupabase();

    expect(adminProps.success).toBe(true);
    expect(adminProps.properties?.[0].status).toBe('pending_review');
    expect(adminProps.properties?.[0].images).toEqual([
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
    ]);

    expect(adminTickets.success).toBe(true);
    expect(adminTickets.tickets?.[0].ticketNumber).toBe('ASH-TKT-ADM001');

    expect(adminReports.success).toBe(true);
    expect(adminReports.reports?.[0].reasonLabel).toContain('Scam');

    expect(myFlatmate.success).toBe(true);
    expect(myFlatmate.flatmate?.city).toBe('Bengaluru');

    const mappedFlatmateInsert = supabaseModule.mapAppFlatmateToSupabaseInsert(
      { occupation: 'Engineer', city: 'Pune', targetLocalities: ['Baner'], budgetMax: 18000 },
      'usr-123'
    );
    expect(mappedFlatmateInsert.city).toBe('Pune');
    expect(mappedFlatmateInsert.verified).toBe(false);
  });

  it('generates private storage signed URLs and rejects empty paths', async () => {
    const emptyRes = await createSignedStorageUrl('rental-documents', '');
    expect(emptyRes.success).toBe(false);

    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/rental-documents/ag-1/doc.pdf?token=abc' },
      error: null,
    });
    mockLiveSupabase({
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl: createSignedUrlMock }) },
    });

    const signedRes = await createSignedStorageUrl('rental-documents', 'ag-1/doc.pdf', 300);
    restoreMockSupabase();

    expect(signedRes.success).toBe(true);
    expect(signedRes.signedUrl).toContain('object/sign/rental-documents');
  });
});

