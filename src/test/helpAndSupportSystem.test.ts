import { describe, it, expect } from 'vitest';
import {
  generateTicketNumber,
  validateTicketSubmission,
  validateTicketAttachment,
  determineTicketPriority,
  canTransitionTicketStatus,
  getReportPriorityAndLabel,
  isDuplicateReport,
  sanitizeTicketForClient,
  VALID_STATUS_TRANSITIONS,
  MAX_ATTACHMENTS_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_ATTACHMENT_MIME_TYPES,
} from '../services/supportService';
import { FAQ_ITEMS, FAQ_CATEGORY_LABELS, SAFETY_GUIDELINES } from '../data/faqData';
import { SupportTicket, SafetyReport, User } from '../types';

describe('Aashvo Help & Support System — Architecture & Security Tests', () => {
  /* -------------------------------------------------------------------------
   * 1. Ticket Number Generation & Formatting
   * ------------------------------------------------------------------------- */
  describe('Ticket Number Generation', () => {
    it('generates unique references with ASH-TKT prefix and 6 alphanumeric characters', () => {
      const ticketNum = generateTicketNumber();
      expect(ticketNum).toMatch(/^ASH-TKT-[A-Z0-9]{6}$/);
    });

    it('generates statistically unique identifiers across 100 consecutive generations', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 100; i++) {
        generated.add(generateTicketNumber());
      }
      expect(generated.size).toBe(100);
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Ticket Submission & Input Validation
   * ------------------------------------------------------------------------- */
  describe('Ticket Form Input Validation', () => {
    it('rejects submissions with missing or invalid email addresses', () => {
      const res1 = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: '',
        subject: 'Valid Subject Line',
        description: 'Valid issue description with enough characters.',
        category: 'finding_flatmates',
      });
      expect(res1.isValid).toBe(false);
      expect(res1.errors).toContain('A valid contact email is required.');

      const res2 = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'not-an-email',
        subject: 'Valid Subject Line',
        description: 'Valid issue description with enough characters.',
        category: 'finding_flatmates',
      });
      expect(res2.isValid).toBe(false);
      expect(res2.errors).toContain('Please enter a valid email address.');
    });

    it('validates subject length constraints (5 to 120 characters)', () => {
      const shortSubject = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'rohan@test.com',
        subject: 'Hi',
        description: 'Valid issue description with enough characters.',
        category: 'finding_flatmates',
      });
      expect(shortSubject.isValid).toBe(false);
      expect(shortSubject.errors).toContain('Subject must be at least 5 characters long.');

      const longSubject = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'rohan@test.com',
        subject: 'A'.repeat(121),
        description: 'Valid issue description with enough characters.',
        category: 'finding_flatmates',
      });
      expect(longSubject.isValid).toBe(false);
      expect(longSubject.errors).toContain('Subject cannot exceed 120 characters.');
    });

    it('validates description length constraints (10 to 2000 characters)', () => {
      const shortDesc = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'rohan@test.com',
        subject: 'Valid Subject',
        description: 'Short',
        category: 'finding_flatmates',
      });
      expect(shortDesc.isValid).toBe(false);
      expect(shortDesc.errors).toContain('Please describe your issue in at least 10 characters.');
    });

    it('rejects invalid or arbitrary categories', () => {
      const invalidCat = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'rohan@test.com',
        subject: 'Valid Subject',
        description: 'Valid description of the issue occurring.',
        // @ts-expect-error Testing invalid category runtime rejection
        category: 'hacked_bypass_category',
      });
      expect(invalidCat.isValid).toBe(false);
      expect(invalidCat.errors).toContain('Please select a valid issue category.');
    });

    it('accepts fully valid submissions without errors', () => {
      const valid = validateTicketSubmission({
        userName: 'Rohan Varma',
        userEmail: 'rohan@delhitech.in',
        subject: 'Inquiry regarding pure vegetarian kitchen rule',
        description: 'Host Col. Rao mentions vegetarian only. I want to confirm if eggs are allowed in the pantry.',
        category: 'family_stays_meals',
      });
      expect(valid.isValid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Attachment Security & Restrictions
   * ------------------------------------------------------------------------- */
  describe('Attachment Security Policies', () => {
    it('strictly enforces max 3 attachments limit', () => {
      const validation = validateTicketSubmission(
        {
          userName: 'Rohan Varma',
          userEmail: 'rohan@delhitech.in',
          subject: 'Valid Subject',
          description: 'Valid issue description text.',
          category: 'technical_issues',
          attachmentsCount: 4,
        },
        [
          { id: '1', name: 'p1.jpg', size: 1000, type: 'image/jpeg' },
          { id: '2', name: 'p2.jpg', size: 1000, type: 'image/jpeg' },
          { id: '3', name: 'p3.jpg', size: 1000, type: 'image/jpeg' },
          { id: '4', name: 'p4.jpg', size: 1000, type: 'image/jpeg' },
        ]
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(`Maximum ${MAX_ATTACHMENTS_COUNT} evidence attachments allowed.`);
    });

    it('rejects individual files exceeding 5MB size limit', () => {
      const over5MB = MAX_ATTACHMENT_SIZE_BYTES + 1024;
      const res = validateTicketAttachment(over5MB, 'image/jpeg');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('5MB');
    });

    it('enforces MIME type whitelisting and rejects executable / unsafe files', () => {
      const exeCheck = validateTicketAttachment(1024 * 50, 'application/x-msdownload');
      expect(exeCheck.isValid).toBe(false);

      const jsCheck = validateTicketAttachment(1024 * 10, 'application/javascript');
      expect(jsCheck.isValid).toBe(false);

      const htmlCheck = validateTicketAttachment(1024 * 10, 'text/html');
      expect(htmlCheck.isValid).toBe(false);

      // Permitted formats
      for (const mime of ALLOWED_ATTACHMENT_MIME_TYPES) {
        expect(validateTicketAttachment(1024 * 200, mime).isValid).toBe(true);
      }
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Automatic Priority Assignment
   * ------------------------------------------------------------------------- */
  describe('Ticket Priority Determination', () => {
    it('automatically marks scam, fraud, threat or harassment as urgent priority', () => {
      expect(determineTicketPriority('privacy_safety', 'General question', 'Need help')).toBe('urgent');
      expect(determineTicketPriority('finding_flatmates', 'Suspicious UPI', 'Host asked for scam deposit')).toBe('urgent');
      expect(determineTicketPriority('rooms_listings', 'Harassment reported', 'Prospective flatmate was abusive')).toBe('urgent');
    });

    it('marks deposit discrepancies and verification issues as high priority', () => {
      expect(determineTicketPriority('rooms_listings', 'Deposit mismatch', 'Host demanded extra advance')).toBe('high');
      expect(determineTicketPriority('verification', 'ID verification pending', 'Awaiting document check')).toBe('high');
    });

    it('defaults standard inquiries to normal priority', () => {
      expect(determineTicketPriority('family_stays_meals', 'Meal timing inquiry', 'What time is dinner served?')).toBe('normal');
    });
  });

  /* -------------------------------------------------------------------------
   * 5. Status Transition State Machine
   * ------------------------------------------------------------------------- */
  describe('Ticket Status State Machine', () => {
    it('allows valid forward and review transitions', () => {
      expect(canTransitionTicketStatus('open', 'in_review')).toBe(true);
      expect(canTransitionTicketStatus('in_review', 'awaiting_user')).toBe(true);
      expect(canTransitionTicketStatus('awaiting_user', 'in_review')).toBe(true);
      expect(canTransitionTicketStatus('in_review', 'resolved')).toBe(true);
      expect(canTransitionTicketStatus('resolved', 'closed')).toBe(true);
    });

    it('forbids invalid backward transitions like closed to open', () => {
      expect(canTransitionTicketStatus('closed', 'open')).toBe(false);
      expect(canTransitionTicketStatus('closed', 'in_review')).toBe(false);
      expect(canTransitionTicketStatus('closed', 'resolved')).toBe(false);
    });

    it('verifies valid transition lookup matrix integrity', () => {
      expect(VALID_STATUS_TRANSITIONS.closed).toHaveLength(0);
      expect(VALID_STATUS_TRANSITIONS.open).toContain('in_review');
      expect(VALID_STATUS_TRANSITIONS.open).toContain('closed');
    });
  });

  /* -------------------------------------------------------------------------
   * 6. Privacy & Internal Staff Notes Isolation
   * ------------------------------------------------------------------------- */
  describe('Privacy & Confidential Internal Staff Notes Isolation', () => {
    const mockTicket: SupportTicket = {
      id: 'tkt-test-1',
      ticketNumber: 'ASH-TKT-SECURE',
      userId: 'usr-101',
      userEmail: 'rohan@delhitech.in',
      userName: 'Rohan Varma',
      category: 'privacy_safety',
      subject: 'Advance money demand suspicion',
      description: 'Host demanded 10k advance token without viewing.',
      priority: 'urgent',
      status: 'in_review',
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 'msg-1',
          ticketId: 'tkt-test-1',
          senderName: 'Rohan Varma',
          senderRole: 'user',
          message: 'Host demanded token advance.',
          isInternal: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          ticketId: 'tkt-test-1',
          senderName: 'Aashvo Admin',
          senderRole: 'admin',
          message: 'Confidential staff note: Checked host phone in Truecaller; matches previously banned broker.',
          isInternal: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-3',
          ticketId: 'tkt-test-1',
          senderName: 'Aashvo Support',
          senderRole: 'support',
          message: 'Hi Rohan, we are actively investigating this host.',
          isInternal: false,
          createdAt: new Date().toISOString(),
        },
      ],
      auditEvents: [
        {
          id: 'aud-1',
          ticketId: 'tkt-test-1',
          actorName: 'Admin',
          action: 'status_changed',
          oldValue: 'open',
          newValue: 'in_review',
          notes: 'High priority fraud queue',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    it('strips all internal notes and audit events when serving ticket to an end-user / renter', () => {
      const renterUser: User = {
        id: 'usr-101',
        name: 'Rohan Varma',
        email: 'rohan@delhitech.in',
        role: 'renter',
      };

      const sanitized = sanitizeTicketForClient(mockTicket, renterUser);
      expect(sanitized.messages).toHaveLength(2);
      expect(sanitized.messages.some(m => m.isInternal)).toBe(false);
      expect(sanitized.messages.some(m => m.message.includes('Confidential staff note'))).toBe(false);
      expect(sanitized.auditEvents).toEqual([]);
    });

    it('strips internal notes when serving ticket to unauthenticated guest visitors', () => {
      const sanitized = sanitizeTicketForClient(mockTicket, null);
      expect(sanitized.messages).toHaveLength(2);
      expect(sanitized.messages.some(m => m.isInternal)).toBe(false);
      expect(sanitized.auditEvents).toEqual([]);
    });

    it('preserves internal notes and audit trail when accessed by an authorized admin', () => {
      const adminUser: User = {
        id: 'usr-001',
        name: 'Aashvo Safety Admin',
        email: 'moderation@aashvo.com',
        role: 'admin',
      };

      const adminView = sanitizeTicketForClient(mockTicket, adminUser);
      expect(adminView.messages).toHaveLength(3);
      expect(adminView.messages.some(m => m.isInternal)).toBe(true);
      expect(adminView.auditEvents).toHaveLength(1);
    });
  });

  /* -------------------------------------------------------------------------
   * 7. Safety Reports & Anti-Duplicate Protection
   * ------------------------------------------------------------------------- */
  describe('Safety Reports & Anti-Spam Duplicate Safeguards', () => {
    const existingReports: SafetyReport[] = [
      {
        id: 'srep-1',
        reporterId: 'usr-101',
        reporterName: 'Rohan Varma',
        reporterEmail: 'rohan@delhitech.in',
        targetType: 'listing',
        targetId: 'prop-4',
        targetTitle: 'Studio in Saket',
        reasonCode: 'misleading_charges',
        reasonLabel: 'Misleading Charges',
        details: 'Electricity tariff discrepancy.',
        priority: 'high',
        status: 'pending',
        createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(), // 2 hours ago
      },
      {
        id: 'srep-2',
        reporterId: 'usr-202',
        reporterName: 'Anil Mehra',
        reporterEmail: 'anil@delhihomes.org',
        targetType: 'listing',
        targetId: 'prop-5',
        targetTitle: 'DLF Phase 2 Stay',
        reasonCode: 'unavailable_listing',
        reasonLabel: 'Unavailable Listing',
        details: 'Already rented out 3 days ago.',
        priority: 'normal',
        status: 'dismissed',
        createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      },
    ];

    it('detects and blocks duplicate report from the same reporter for the same listing within 24 hours', () => {
      const isDupe = isDuplicateReport(existingReports, 'usr-101', 'prop-4', 24);
      expect(isDupe).toBe(true);

      const isDupeByEmail = isDuplicateReport(existingReports, 'rohan@delhitech.in', 'prop-4', 24);
      expect(isDupeByEmail).toBe(true);
    });

    it('permits reporting a different listing or reporting from a different user', () => {
      // Different listing
      expect(isDuplicateReport(existingReports, 'usr-101', 'prop-6', 24)).toBe(false);
      // Different user on prop-4
      expect(isDuplicateReport(existingReports, 'usr-999', 'prop-4', 24)).toBe(false);
    });

    it('permits re-reporting if previous report was dismissed', () => {
      // Anil reported prop-5, but it was marked dismissed
      expect(isDuplicateReport(existingReports, 'usr-202', 'prop-5', 24)).toBe(false);
    });

    it('assigns urgent priority to scam_fraud and harassment report categories', () => {
      expect(getReportPriorityAndLabel('scam_fraud').priority).toBe('urgent');
      expect(getReportPriorityAndLabel('harassment').priority).toBe('urgent');
      expect(getReportPriorityAndLabel('misleading_charges').priority).toBe('high');
      expect(getReportPriorityAndLabel('unavailable_listing').priority).toBe('normal');
    });
  });

  /* -------------------------------------------------------------------------
   * 8. Knowledge Base & FAQ Integrity
   * ------------------------------------------------------------------------- */
  describe('Help Centre Knowledge Base & Safety Guidelines', () => {
    it('provides FAQs across all 8 mandatory categories', () => {
      const requiredCategories = [
        'account_login',
        'finding_flatmates',
        'rooms_listings',
        'family_stays_meals',
        'location',
        'verification',
        'privacy_safety',
        'technical_issues',
      ];

      for (const cat of requiredCategories) {
        const matching = FAQ_ITEMS.filter(f => f.category === cat);
        expect(matching.length).toBeGreaterThan(0);
        // @ts-expect-error verifying valid keys
        expect(FAQ_CATEGORY_LABELS[cat]).toBeDefined();
      }
    });

    it('includes zero-advance payment and OTP confidentiality in safety guidelines', () => {
      const advanceGuideline = SAFETY_GUIDELINES.find(g =>
        g.title.toLowerCase().includes('zero advance')
      );
      expect(advanceGuideline).toBeDefined();
      expect(advanceGuideline?.severity).toBe('critical');

      const otpGuideline = SAFETY_GUIDELINES.find(g =>
        g.title.toLowerCase().includes('otp') || g.title.toLowerCase().includes('password')
      );
      expect(otpGuideline).toBeDefined();
    });

    it('does not advertise false 24/7 telephonic SLAs in FAQ answers', () => {
      for (const faq of FAQ_ITEMS) {
        expect(faq.answer.toLowerCase()).not.toContain('24/7 call center');
        expect(faq.answer.toLowerCase()).not.toContain('guaranteed 5-minute resolution');
      }
    });
  });
});
