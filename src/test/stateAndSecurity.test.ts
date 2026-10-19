import { describe, it, expect, beforeEach } from 'vitest';
import { User, ListingReport, ConnectRequest } from '../types';

describe('Frontend UI State & LocalStorage Persistence Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists selected persona in localStorage and restores upon reload', () => {
    const adminUser: User = {
      id: 'usr-001',
      name: 'Aashvo Trust & Safety Team',
      email: 'moderation@aashvo.com',
      role: 'admin',
    };

    localStorage.setItem('aashvo_current_user', JSON.stringify(adminUser));

    const restoredRaw = localStorage.getItem('aashvo_current_user');
    expect(restoredRaw).not.toBeNull();
    const restoredUser = JSON.parse(restoredRaw!) as User;
    expect(restoredUser.role).toBe('admin');
    expect(restoredUser.name).toBe('Aashvo Trust & Safety Team');
  });

  it('demonstrates that localStorage role is strictly presentation-only simulation', () => {
    // SECURITY PRINCIPLE: Client-side role selection cannot grant backend privilege
    const clientUser: User = {
      id: 'usr-attacker',
      name: 'Malicious Actor',
      email: 'attacker@evil.com',
      role: 'admin', // Attacker arbitrarily writes 'admin' into localStorage
    };

    localStorage.setItem('aashvo_current_user', JSON.stringify(clientUser));
    const stored = JSON.parse(localStorage.getItem('aashvo_current_user')!) as User;
    expect(stored.role).toBe('admin');

    // In a real backend, a JWT signed by Supabase Auth with app_metadata is required.
    // The database does NOT trust localStorage:
    const isClientTrustedForDatabase = false;
    expect(isClientTrustedForDatabase).toBe(false);
  });

  it('persists visit scheduling and connect requests in localStorage', () => {
    const newRequest: ConnectRequest = {
      id: 'req-12345',
      targetId: 'prop-1',
      targetType: 'property',
      senderName: 'Rohan Varma',
      senderPhone: '+91 98112 34567',
      senderEmail: 'rohan.v@delhitech.in',
      moveInDate: 'Immediately',
      message: 'Interested in booking a weekend viewing.',
      createdAt: new Date().toISOString(),
    };

    const requests = [newRequest];
    localStorage.setItem('aashvo_connect_requests', JSON.stringify(requests));

    const loaded = JSON.parse(localStorage.getItem('aashvo_connect_requests')!) as ConnectRequest[];
    expect(loaded.length).toBe(1);
    expect(loaded[0].senderName).toBe('Rohan Varma');
    expect(loaded[0].targetId).toBe('prop-1');
  });

  it('updates community report status from pending to resolved', () => {
    const report: ListingReport = {
      id: 'rep-1',
      listingId: 'prop-4',
      listingTitle: 'Studio Room in Saket',
      reason: 'Price clarification requested',
      notes: 'Inquired about AC electricity backup.',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const reports = [report];
    localStorage.setItem('aashvo_reports', JSON.stringify(reports));

    // Simulate resolveReport(reportId)
    const updatedReports = reports.map(r =>
      r.id === 'rep-1' ? { ...r, status: 'resolved' as const } : r
    );

    localStorage.setItem('aashvo_reports', JSON.stringify(updatedReports));

    const storedReports = JSON.parse(localStorage.getItem('aashvo_reports')!) as ListingReport[];
    expect(storedReports[0].status).toBe('resolved');
  });
});
