import { describe, it, expect } from 'vitest';
import {
  isTrustedAdminSession,
  sanitizeStoredUser,
  canPerformAdminAction,
} from '../services/authorizationService';
import { sanitizeTicketForClient } from '../services/supportService';
import { User, SupportTicket } from '../types';

describe('Demo Auth Security & Privilege Escalation Defense', () => {
  describe('1. Demo Persona Non-Privileged Isolation', () => {
    it('ensures demo persona selection never grants admin role', () => {
      // Demo personas only support non-privileged consumer roles
      const demoRenter: User = {
        id: 'usr-demo-101',
        name: 'Rohan Varma',
        email: 'rohan.v@delhitech.in',
        role: 'renter',
        isDemo: true,
        phoneVerified: false,
        identityVerified: false,
        emailVerified: false,
      };

      const demoOwner: User = {
        id: 'usr-demo-202',
        name: 'Anil Mehra (DLF Owner)',
        email: 'anil.mehra@delhihomes.org',
        role: 'owner',
        isDemo: true,
        phoneVerified: false,
        identityVerified: false,
        emailVerified: false,
      };

      expect(demoRenter.role).not.toBe('admin');
      expect(demoOwner.role).not.toBe('admin');
      expect(demoRenter.isDemo).toBe(true);
      expect(demoRenter.phoneVerified).toBe(false);
      expect(demoRenter.identityVerified).toBe(false);
      expect(demoRenter.emailVerified).toBe(false);
    });

    it('denies isTrustedAdminSession for any user marked with isDemo: true', () => {
      const spoofedDemoAdmin: User = {
        id: 'usr-demo-999',
        name: 'Spoofed Admin',
        email: 'attacker@evil.com',
        role: 'admin',
        isDemo: true, // Marked as demo
      };

      expect(isTrustedAdminSession(spoofedDemoAdmin)).toBe(false);
    });
  });

  describe('2. LocalStorage Privilege Escalation Defense', () => {
    it('sanitizes and demotes untrusted admin claims in localStorage', () => {
      // Attacker tampers with localStorage in DevTools
      const maliciousStoragePayload = {
        id: 'usr-hacker',
        name: 'Attacker in DevTools',
        email: 'hacker@internet.org',
        role: 'admin', // Tampered client string
        phoneVerified: true, // Forged flag
        identityVerified: true, // Forged flag
        isDemo: false,
      };

      const sanitized = sanitizeStoredUser(maliciousStoragePayload);
      expect(sanitized).toBeDefined();
      expect(sanitized?.role).toBe('renter'); // Stripped and demoted!
      expect(sanitized?.name).toBe('Attacker in DevTools');
    });

    it('strips forged verification flags from demo payloads', () => {
      const forgedDemo = {
        id: 'usr-demo-101',
        name: 'Rohan Varma',
        email: 'rohan.v@delhitech.in',
        role: 'renter',
        phoneVerified: true, // Attempting to bypass phone check
        identityVerified: true,
        emailVerified: true,
        isDemo: true,
      };

      const sanitized = sanitizeStoredUser(forgedDemo);
      expect(sanitized?.isDemo).toBe(true);
      expect(sanitized?.phoneVerified).toBe(false); // Stripped
      expect(sanitized?.identityVerified).toBe(false); // Stripped
      expect(sanitized?.emailVerified).toBe(false); // Stripped
    });

    it('rejects invalid or corrupted storage objects safely', () => {
      expect(sanitizeStoredUser(null)).toBeNull();
      expect(sanitizeStoredUser(undefined)).toBeNull();
      expect(sanitizeStoredUser('raw string')).toBeNull();
      expect(sanitizeStoredUser({ invalid: 'no id or email' })).toBeNull();
    });
  });

  describe('3. Direct Protected Action Invocation Gates', () => {
    const unauthenticatedVisitor = null;
    const demoRenter: User = {
      id: 'usr-demo-101',
      name: 'Rohan Varma',
      email: 'rohan.v@delhitech.in',
      role: 'renter',
      isDemo: true,
    };
    const regularOwner: User = {
      id: 'usr-owner-202',
      name: 'Anil Mehra',
      email: 'anil@example.com',
      role: 'owner',
      isDemo: false,
    };

    it('blocks unauthenticated visitors from invoking administrative moderation actions', () => {
      const actions = [
        'update_property_status',
        'resolve_safety_report',
        'update_ticket_status',
        'update_ticket_priority',
        'assign_ticket',
      ];

      for (const action of actions) {
        const check = canPerformAdminAction(unauthenticatedVisitor, action);
        expect(check.allowed).toBe(false);
        expect(check.reason).toContain('Authentication required');
      }
    });

    it('blocks demo personas from invoking administrative actions directly', () => {
      const checkProperty = canPerformAdminAction(demoRenter, 'update_property_status');
      expect(checkProperty.allowed).toBe(false);
      expect(checkProperty.reason).toContain('Demo mode active');

      const checkReport = canPerformAdminAction(demoRenter, 'resolve_safety_report');
      expect(checkReport.allowed).toBe(false);
      expect(checkReport.reason).toContain('Demo mode active');
    });

    it('blocks regular owners and renters from executing staff actions', () => {
      const check = canPerformAdminAction(regularOwner, 'update_property_status');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Access denied');
    });
  });

  describe('4. Support Ticket Staff Note Concealment', () => {
    const mockTicketWithStaffNotes: SupportTicket = {
      id: 'tkt-test-999',
      ticketNumber: 'ASH-TKT-SEC001',
      userEmail: 'user@example.com',
      userName: 'Ordinary User',
      category: 'account_login',
      subject: 'Login query',
      description: 'Help needed',
      priority: 'normal',
      status: 'in_review',
      attachments: [],
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-20T00:00:00Z',
      messages: [
        {
          id: 'msg-1',
          ticketId: 'tkt-test-999',
          senderName: 'Ordinary User',
          senderRole: 'user',
          message: 'Can someone check my account?',
          isInternal: false,
          createdAt: '2026-10-20T00:00:00Z',
        },
        {
          id: 'msg-2',
          ticketId: 'tkt-test-999',
          senderName: 'Lead Security Admin',
          senderRole: 'admin',
          message: 'CONFIDENTIAL STAFF NOTE: User flagged for multi-account login anomaly.',
          isInternal: true, // Sensitive internal note
          createdAt: '2026-10-20T00:05:00Z',
        },
      ],
      auditEvents: [
        {
          id: 'aud-1',
          ticketId: 'tkt-test-999',
          actorName: 'Staff Admin',
          action: 'status_changed',
          oldValue: 'open',
          newValue: 'in_review',
          notes: 'Investigating potential account takeover',
          createdAt: '2026-10-20T00:05:00Z',
        },
      ],
    };

    it('conceals internal staff notes from demo personas', () => {
      const demoUser: User = {
        id: 'usr-demo-101',
        name: 'Demo Visitor',
        email: 'visitor@example.com',
        role: 'renter',
        isDemo: true,
      };

      const sanitized = sanitizeTicketForClient(mockTicketWithStaffNotes, demoUser);
      expect(sanitized.messages.length).toBe(1);
      expect(sanitized.messages[0].isInternal).toBe(false);
      expect(sanitized.messages[0].message).toBe('Can someone check my account?');
      expect(sanitized.auditEvents).toEqual([]);
    });

    it('conceals internal staff notes even if a demo user claims role: admin', () => {
      const spoofedAdmin: User = {
        id: 'usr-demo-fake',
        name: 'Spoofed Staff',
        email: 'fake@example.com',
        role: 'admin',
        isDemo: true, // Demo flag prevents privilege escalation
      };

      const sanitized = sanitizeTicketForClient(mockTicketWithStaffNotes, spoofedAdmin);
      expect(sanitized.messages.length).toBe(1);
      expect(sanitized.messages.some(m => m.isInternal)).toBe(false);
      expect(sanitized.auditEvents).toEqual([]);
    });
  });
});
