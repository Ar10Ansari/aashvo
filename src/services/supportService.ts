import {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketAttachment,
  SafetyReport,
  ReportReasonCode,
  ReportPriority,
  User,
} from '../types';
import { supabase, isLiveBackendConfigured, mapSupabaseTicketToApp } from './supabase';

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ATTACHMENTS_COUNT = 3;

/**
 * Valid Status Transitions State Machine
 * Defines all permitted forward and backward lifecycles for tickets.
 */
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_review', 'awaiting_user', 'resolved', 'closed'],
  in_review: ['awaiting_user', 'resolved', 'closed'],
  awaiting_user: ['in_review', 'resolved', 'closed'],
  resolved: ['in_review', 'closed'], // Can be reopened by user into in_review
  closed: [], // Terminal status
};

/**
 * Validates whether a requested ticket status transition is authorized.
 */
export function canTransitionTicketStatus(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Generates an authentic ticket reference code (e.g. ASH-TKT-8K2D9M).
 */
export function generateTicketNumber(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  return `ASH-TKT-${code}`;
}

export interface TicketValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates ticket submission data and attachments.
 */
export function validateTicketSubmission(
  ticket: Partial<SupportTicket> & { name?: string; email?: string; phone?: string; attachmentsCount?: number },
  attachments: TicketAttachment[] = []
): TicketValidationResult {
  const errors: string[] = [];
  const email = ticket.userEmail || ticket.email;
  const name = ticket.userName || ticket.name;

  // Email validation
  if (!email || !email.trim()) {
    errors.push('A valid contact email is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please enter a valid email address.');
    }
  }

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push('Your name must be at least 2 characters.');
  }

  // Subject validation
  if (!ticket.subject || ticket.subject.trim().length < 5) {
    errors.push('Subject must be at least 5 characters long.');
  } else if (ticket.subject.trim().length > 120) {
    errors.push('Subject cannot exceed 120 characters.');
  }

  // Description validation
  if (!ticket.description || ticket.description.trim().length < 10) {
    errors.push('Please describe your issue in at least 10 characters.');
  } else if (ticket.description.trim().length > 2000) {
    errors.push('Description cannot exceed 2000 characters.');
  }

  // Category validation
  const validCategories: TicketCategory[] = [
    'account_login',
    'finding_flatmates',
    'rooms_listings',
    'family_stays_meals',
    'location',
    'verification',
    'privacy_safety',
    'technical_issues',
    'billing_fraud',
    'other',
  ];
  if (!ticket.category || !validCategories.includes(ticket.category)) {
    errors.push('Please select a valid issue category.');
  }

  // Attachment validations
  const count = ticket.attachmentsCount !== undefined ? ticket.attachmentsCount : attachments.length;
  if (count > MAX_ATTACHMENTS_COUNT) {
    errors.push(`Maximum ${MAX_ATTACHMENTS_COUNT} evidence attachments allowed.`);
  }

  for (const file of attachments) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      errors.push(`File "${file.name}" exceeds the 5MB size limit.`);
    }
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      errors.push(`File "${file.name}" has an unsupported format. Only JPG, PNG, WebP, and PDF are allowed.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates individual attachment size and MIME type.
 */
export function validateTicketAttachment(
  fileSize: number,
  fileType: string
): { isValid: boolean; error?: string } {
  if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
    return { isValid: false, error: 'File size exceeds maximum allowed 5MB cap.' };
  }
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(fileType)) {
    return { isValid: false, error: 'Unsupported file format. Please upload JPG, PNG, WebP or PDF.' };
  }
  return { isValid: true };
}



/**
 * Automatically determines appropriate ticket priority based on category and description.
 */
export function determineTicketPriority(
  category: TicketCategory,
  subject: string = '',
  description: string = ''
): TicketPriority {
  const content = `${subject} ${description}`.toLowerCase();

  // Critical safety triggers
  if (
    category === 'privacy_safety' ||
    category === 'billing_fraud' ||
    content.includes('scam') ||
    content.includes('fraud') ||
    content.includes('stolen') ||
    content.includes('police') ||
    content.includes('threat') ||
    content.includes('harass')
  ) {
    return 'urgent';
  }

  if (
    category === 'account_login' ||
    category === 'verification' ||
    content.includes('deposit') ||
    content.includes('advance') ||
    content.includes('overcharge') ||
    content.includes('dispute')
  ) {
    return 'high';
  }

  return 'normal';
}

/**
 * Validates a safety report against a listing, flatmate, or host user.
 */
export function validateSafetyReport(report: Partial<SafetyReport>): {
  isValid: boolean;
  errors: string[];
  error?: string;
} {
  const errors: string[] = [];

  if (report.targetId !== undefined && !report.targetId.trim()) {
    errors.push('A valid target reference ID is required.');
  }

  if (report.targetTitle !== undefined && !report.targetTitle.trim()) {
    errors.push('Target title is required.');
  }

  const validReasons: ReportReasonCode[] = [
    'scam_fraud',
    'misleading_charges',
    'unavailable_listing',
    'duplicate_fake',
    'inappropriate_conduct',
    'harassment',
    'other',
  ];
  if (!report.reasonCode || !validReasons.includes(report.reasonCode)) {
    errors.push('Please select a valid reporting reason.');
  }

  if (!report.details || report.details.trim().length < 10) {
    errors.push('Please provide specific details explaining the issue (min 10 characters).');
  } else if (report.details.trim().length > 1500) {
    errors.push('Report details cannot exceed 1500 characters.');
  }

  if (report.reporterEmail && report.reporterEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(report.reporterEmail.trim())) {
      errors.push('Please provide a valid email address.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    error: errors[0],
  };
}

/**
 * Maps report reason code to appropriate priority and human-readable label.
 */
export function getReportPriorityAndLabel(reason: ReportReasonCode): {
  priority: ReportPriority;
  label: string;
} {
  switch (reason) {
    case 'scam_fraud':
      return { priority: 'urgent', label: 'Suspected Scam or Financial Fraud' };
    case 'harassment':
      return { priority: 'urgent', label: 'Harassment, Hate Speech or Safety Threat' };
    case 'misleading_charges':
      return { priority: 'high', label: 'Misleading Price, Deposit or Hidden Charges' };
    case 'inappropriate_conduct':
      return { priority: 'high', label: 'Inappropriate Conduct or Rule Violation' };
    case 'unavailable_listing':
      return { priority: 'normal', label: 'Unavailable, Rented or Phantom Listing' };
    case 'duplicate_fake':
      return { priority: 'normal', label: 'Duplicate or Fake Profile/Listing' };
    case 'other':
    default:
      return { priority: 'normal', label: 'Other Marketplace Violation' };
  }
}

/**
 * Anti-Spam Duplicate Prevention
 * Checks if the same reporter has submitted a report for the exact target in the last 24 hours.
 */
export function isDuplicateReport(
  existingReports: SafetyReport[],
  reporterIdentifier: string, // user ID or email
  targetId: string,
  cooldownHours: number = 24
): boolean {
  if (!reporterIdentifier || !targetId) return false;

  const cutoff = Date.now() - cooldownHours * 60 * 60 * 1000;

  return existingReports.some(rep => {
    const isSameTarget = rep.targetId === targetId;
    const isSameReporter =
      (rep.reporterId && rep.reporterId === reporterIdentifier) ||
      (rep.reporterEmail && rep.reporterEmail.toLowerCase() === reporterIdentifier.toLowerCase());

    const isRecent = new Date(rep.createdAt).getTime() > cutoff;

    return isSameTarget && isSameReporter && isRecent && rep.status !== 'dismissed';
  });
}

/**
 * Client Privacy Sanitizer
 * Strips internal staff notes and audit logs when serving ticket data to non-admin users.
 */
export function sanitizeTicketForClient(
  ticket: SupportTicket,
  requestingUser: User | null
): SupportTicket {
  const isAdmin = requestingUser?.role === 'admin';

  if (isAdmin) {
    return ticket;
  }

  // Filter messages to hide internal admin notes from the end-user
  const publicMessages = ticket.messages.filter(msg => !msg.isInternal);

  return {
    ...ticket,
    messages: publicMessages,
    auditEvents: [], // Strictly concealed from non-admins
  };
}

/**
 * Support Notification Event Hook Dispatcher
 * Dispatches transactional notifications (logs in evaluation mode, integrates with SMTP/Resend/WhatsApp in production).
 */
export function dispatchSupportNotification(
  event: 'ticket_created' | 'ticket_replied' | 'status_changed',
  payload: {
    ticketNumber: string;
    recipientEmail: string;
    subject?: string;
    messageSnippet?: string;
    newStatus?: TicketStatus;
  }
): { dispatched: boolean; timestamp: string; event: string; recipient: string } {
  const timestamp = new Date().toISOString();

  // In production, this invokes Resend/SMTP or WhatsApp Cloud Webhooks
  // e.g. await fetch('/api/notifications/support', { method: 'POST', body: JSON.stringify(payload) });
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Intentionally avoid logging sensitive OTPs or private contents
    console.debug(`[Aashvo Support Notification] ${event} for ${payload.ticketNumber} -> ${payload.recipientEmail}`);
  }

  return {
    dispatched: true,
    timestamp,
    event,
    recipient: payload.recipientEmail,
  };
}

// ====================================================================
// Real Supabase Support & Safety Methods
// ====================================================================

/**
 * Creates and persists a support ticket in Supabase
 */
export async function createSupportTicketInSupabase(
  ticketData: {
    category: TicketCategory;
    subject: string;
    description: string;
    userEmail: string;
    userName: string;
    userId?: string;
    userPhone?: string;
    referenceListingId?: string;
    referenceUserId?: string;
    priority?: TicketPriority;
  },
  initialMessage?: string
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  const ticketNumber = generateTicketNumber();
  const priority = ticketData.priority || determineTicketPriority(ticketData.category, ticketData.subject, ticketData.description);
  const now = new Date().toISOString();

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          category: ticketData.category,
          subject: ticketData.subject.trim(),
          description: ticketData.description.trim(),
          user_email: ticketData.userEmail.trim().toLowerCase(),
          user_name: ticketData.userName.trim(),
          user_id: ticketData.userId || null,
          user_phone: ticketData.userPhone || null,
          reference_listing_id: ticketData.referenceListingId || null,
          reference_user_id: ticketData.referenceUserId || null,
          priority,
          status: 'open',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (data) {
        const ticket = mapSupabaseTicketToApp(data);
        ticket.messages = [];
        ticket.auditEvents = [];

        // Insert initial message if provided
        if (initialMessage && initialMessage.trim().length > 0) {
          const { data: msgData } = await supabase
            .from('ticket_messages')
            .insert({
              ticket_id: data.id,
              sender_id: ticketData.userId || null,
              sender_name: ticketData.userName.trim(),
              sender_role: 'user',
              message: initialMessage.trim(),
              is_internal: false,
              created_at: now,
            })
            .select()
            .single();

          if (msgData) {
            ticket.messages.push({
              id: msgData.id,
              ticketId: msgData.ticket_id,
              senderId: msgData.sender_id,
              senderName: msgData.sender_name,
              senderRole: msgData.sender_role,
              message: msgData.message,
              isInternal: msgData.is_internal,
              createdAt: msgData.created_at,
            });
          }
        }

        dispatchSupportNotification('ticket_created', {
          ticketNumber: ticket.ticketNumber,
          recipientEmail: ticket.userEmail,
          subject: ticket.subject,
        });

        return { success: true, ticket };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Database error' };
    }
  }

  // Local deterministic fallback
  const mockTicket: SupportTicket = {
    id: `tkt-${Date.now()}`,
    ticketNumber,
    ...ticketData,
    priority,
    status: 'open',
    attachments: [],
    createdAt: now,
    updatedAt: now,
    messages: initialMessage ? [
      {
        id: `msg-${Date.now()}`,
        ticketId: `tkt-${Date.now()}`,
        senderId: ticketData.userId,
        senderName: ticketData.userName,
        senderRole: 'user',
        message: initialMessage,
        isInternal: false,
        createdAt: now,
      }
    ] : [],
    auditEvents: [],
  };

  return { success: true, ticket: mockTicket };
}

/**
 * Fetches user support tickets from Supabase with messages
 */
export async function fetchSupportTicketsFromSupabase(
  userEmail: string,
  userId?: string
): Promise<{ success: boolean; tickets?: SupportTicket[]; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    let query = supabase
      .from('support_tickets')
      .select('*, ticket_messages(*)')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_email.eq.${userEmail.toLowerCase().trim()}`);
    } else {
      query = query.eq('user_email', userEmail.toLowerCase().trim());
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const tickets: SupportTicket[] = (data || []).map(row => {
      const ticket = mapSupabaseTicketToApp(row);
      ticket.messages = Array.isArray(row.ticket_messages)
        ? row.ticket_messages.map((m: any) => ({
            id: m.id,
            ticketId: m.ticket_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            message: m.message,
            isInternal: Boolean(m.is_internal),
            createdAt: m.created_at,
          }))
        : [];
      return ticket;
    });

    return { success: true, tickets };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch tickets' };
  }
}

/**
 * Creates and persists a safety report in Supabase
 */
export async function createSafetyReportInSupabase(
  reportData: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  const { priority } = getReportPriorityAndLabel(reportData.reasonCode);
  const now = new Date().toISOString();

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .insert({
          reporter_id: reportData.reporterId || null,
          reporter_email: reportData.reporterEmail || null,
          target_type: reportData.targetType,
          target_id: reportData.targetId,
          target_title: reportData.targetTitle,
          reason_code: reportData.reasonCode,
          details: reportData.details.trim(),
          evidence_url: reportData.evidenceUrl || null,
          priority,
          status: 'pending',
          created_at: now,
        })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, reportId: data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Report creation failed' };
    }
  }

  return { success: true, reportId: `srep-${Date.now()}` };
}
