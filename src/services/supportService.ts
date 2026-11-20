import {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketAttachment,
  TicketMessage,
  TicketAuditEvent,
  SafetyReport,
  ReportReasonCode,
  ReportPriority,
  User,
} from '../types';
import { apiClient } from './apiClient';
import {
  supabase,
  isLiveBackendConfigured,
  mapSupabaseTicketToApp,
  mapSupabaseReportToApp,
} from './supabase';
import { isTrustedAdminSession } from './authorizationService';
import { uploadSupportAttachment } from './storageService';

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
  const isTrustedAdmin = isTrustedAdminSession(requestingUser);

  if (isTrustedAdmin) {
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

  // Provider delivery is intentionally not reported as successful until a
  // server-side Resend/SMTP/WhatsApp integration is configured.
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Intentionally avoid logging sensitive OTPs or private contents
    console.debug(`[Aashvo Support Notification] ${event} for ${payload.ticketNumber} -> ${payload.recipientEmail}`);
  }

  return {
    dispatched: false,
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
    attachments?: TicketAttachment[];
  },
  initialMessage?: string
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  const ticketNumber = generateTicketNumber();
  const priority = ticketData.priority || determineTicketPriority(ticketData.category, ticketData.subject, ticketData.description);
  const now = new Date().toISOString();

  if (isLiveBackendConfigured && supabase) {
    try {
      const storedAttachments: TicketAttachment[] = [];
      if (ticketData.attachments && ticketData.attachments.length > 0) {
        if (!ticketData.userId) {
          return { success: false, error: 'Please sign in before uploading support evidence.' };
        }

        for (const attachment of ticketData.attachments) {
          if (!attachment.url || !attachment.url.startsWith('data:')) {
            return { success: false, error: `Attachment "${attachment.name}" is missing upload data.` };
          }

          const response = await fetch(attachment.url);
          const blob = await response.blob();
          const uploaded = await uploadSupportAttachment(blob, ticketData.userId, attachment.name, attachment.type);
          if (!uploaded.success || !uploaded.path) {
            return { success: false, error: uploaded.error || `Failed to upload ${attachment.name}.` };
          }

          storedAttachments.push({
            id: attachment.id,
            name: attachment.name,
            size: attachment.size,
            type: attachment.type,
            url: uploaded.path,
          });
        }
      }

      if (!ticketData.userId) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_guest_support_ticket', {
          p_ticket_number: ticketNumber,
          p_user_email: ticketData.userEmail.trim().toLowerCase(),
          p_user_name: ticketData.userName.trim(),
          p_user_phone: ticketData.userPhone || null,
          p_category: ticketData.category,
          p_subject: ticketData.subject.trim(),
          p_description: ticketData.description.trim(),
          p_reference_listing_id: ticketData.referenceListingId || null,
          p_reference_user_id: ticketData.referenceUserId || null,
          p_priority: priority,
          p_initial_message: initialMessage?.trim() || null,
        });

        if (rpcError) {
          return { success: false, error: rpcError.message };
        }

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!row) {
          return { success: false, error: 'Guest support ticket creation returned no confirmation.' };
        }

        const ticket: SupportTicket = {
          id: row.id,
          ticketNumber: row.ticket_number || ticketNumber,
          userEmail: ticketData.userEmail.trim().toLowerCase(),
          userName: ticketData.userName.trim(),
          userPhone: ticketData.userPhone,
          category: ticketData.category,
          subject: ticketData.subject.trim(),
          description: ticketData.description.trim(),
          referenceListingId: ticketData.referenceListingId,
          referenceUserId: ticketData.referenceUserId,
          priority: (row.priority as TicketPriority) || priority,
          status: (row.status as TicketStatus) || 'open',
          attachments: [],
          createdAt: row.created_at || now,
          updatedAt: row.updated_at || now,
          messages: initialMessage?.trim()
            ? [
                {
                  id: `msg-${Date.now()}`,
                  ticketId: row.id,
                  senderName: ticketData.userName.trim(),
                  senderRole: 'user',
                  message: initialMessage.trim(),
                  isInternal: false,
                  createdAt: row.created_at || now,
                },
              ]
            : [],
          auditEvents: [],
        };

        dispatchSupportNotification('ticket_created', {
          ticketNumber: ticket.ticketNumber,
          recipientEmail: ticket.userEmail,
          subject: ticket.subject,
        });

        return { success: true, ticket };
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          category: ticketData.category,
          subject: ticketData.subject.trim(),
          description: ticketData.description.trim(),
          user_email: ticketData.userEmail.trim().toLowerCase(),
          user_name: ticketData.userName.trim(),
          user_id: ticketData.userId,
          user_phone: ticketData.userPhone || null,
          reference_listing_id: ticketData.referenceListingId || null,
          reference_user_id: ticketData.referenceUserId || null,
          priority,
          attachments: storedAttachments,
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
          const { data: msgData, error: msgError } = await supabase
            .from('ticket_messages')
            .insert({
              ticket_id: data.id,
              sender_id: ticketData.userId,
              sender_name: ticketData.userName.trim(),
              sender_role: 'user',
              message: initialMessage.trim(),
              is_internal: false,
              created_at: now,
            })
            .select()
            .single();

          if (msgError) {
            return { success: false, error: `Ticket created (${ticket.ticketNumber}), but initial message failed: ${msgError.message}` };
          }

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
  if (import.meta.env.PROD) {
    return { success: false, error: 'Live database is unconfigured. Cannot submit support ticket in production.' };
  }

  const mockTicket: SupportTicket = {
    id: `tkt-${Date.now()}`,
    ticketNumber,
    ...ticketData,
    priority,
    status: 'open',
    attachments: ticketData.attachments || [],
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

/** Secure guest lookup backed by the database RPC requiring ticket + email. */
export async function fetchGuestSupportTicketFromSupabase(
  ticketNumber: string,
  userEmail: string
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase.rpc('lookup_support_ticket', {
      p_ticket_number: ticketNumber.trim().toUpperCase(),
      p_user_email: userEmail.trim().toLowerCase(),
    });

    if (error) return { success: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { success: false, error: 'No matching support ticket found.' };

    const ticket = mapSupabaseTicketToApp(row);
    ticket.messages = Array.isArray(row.messages)
      ? row.messages.map((message: any) => ({
          id: message.id,
          ticketId: message.ticket_id,
          senderId: message.sender_id,
          senderName: message.sender_name,
          senderRole: message.sender_role,
          message: message.message,
          isInternal: false,
          createdAt: message.created_at,
        }))
      : [];
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Support ticket lookup failed' };
  }
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
 * Creates and persists a safety report in Supabase.
 * Intentionally avoids .select() after insert because safety_reports SELECT is restricted to admins under RLS.
 */
export async function createSafetyReportInSupabase(
  reportData: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  const { priority } = getReportPriorityAndLabel(reportData.reasonCode);
  const now = new Date().toISOString();

  if (isLiveBackendConfigured && supabase) {
    try {
      const generatedId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : undefined;

      const { error } = await supabase
        .from('safety_reports')
        .insert({
          ...(generatedId ? { id: generatedId } : {}),
          reporter_id: reportData.reporterId || null,
          reporter_email: reportData.reporterEmail || null,
          target_type: reportData.targetType,
          reported_property_id: reportData.targetType === 'listing' ? reportData.targetId : null,
          reported_flatmate_id: reportData.targetType === 'flatmate' ? reportData.targetId : null,
          reported_user_id: reportData.targetType === 'user' ? reportData.targetId : null,
          target_title: reportData.targetTitle,
          reason_code: reportData.reasonCode,
          details: reportData.details.trim(),
          evidence_url: reportData.evidenceUrl || null,
          priority,
          status: 'pending',
          created_at: now,
        });

      if (error) return { success: false, error: error.message };
      return { success: true, reportId: generatedId || `srep-${Date.now()}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Report creation failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Live database is unconfigured. Cannot submit safety report in production.' };
  }

  return { success: true, reportId: `srep-${Date.now()}` };
}

/**
 * Persists a public reply or internal staff note to ticket_messages (or guest reply RPC).
 */
export async function addTicketMessageInSupabase(params: {
  ticketId: string;
  ticketNumber?: string;
  userEmail?: string;
  senderId?: string;
  senderName: string;
  senderRole: 'user' | 'support' | 'admin';
  message: string;
  isInternal: boolean;
  currentTicketStatus?: TicketStatus;
}): Promise<{ success: boolean; message?: TicketMessage; auditEvent?: TicketAuditEvent; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  const trimmed = params.message.trim();
  if (!trimmed) {
    return { success: false, error: 'Message cannot be empty.' };
  }

  try {
    // Unauthenticated guest reply path (uses security-checked RPC)
    if (!params.senderId && params.ticketNumber && params.userEmail) {
      if (params.isInternal || params.senderRole !== 'user') {
        return { success: false, error: 'Authentication required for staff replies.' };
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('add_guest_ticket_reply', {
        p_ticket_number: params.ticketNumber.trim().toUpperCase(),
        p_user_email: params.userEmail.trim().toLowerCase(),
        p_sender_name: params.senderName.trim(),
        p_message: trimmed,
      });

      if (rpcError) return { success: false, error: rpcError.message };
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!row) return { success: false, error: 'Reply failed to persist.' };

      return {
        success: true,
        message: {
          id: row.id,
          ticketId: row.ticket_id,
          senderName: row.sender_name,
          senderRole: row.sender_role,
          message: row.message,
          isInternal: false,
          createdAt: row.created_at,
        },
      };
    }

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: params.ticketId,
        sender_id: params.senderId || null,
        sender_name: params.senderName,
        sender_role: params.senderRole,
        message: trimmed,
        is_internal: params.isInternal,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    let auditEvent: TicketAuditEvent | undefined;
    if (params.isInternal) {
      const { data: auditData } = await supabase
        .from('ticket_audit_events')
        .insert({
          ticket_id: params.ticketId,
          actor_id: params.senderId || null,
          actor_name: params.senderName,
          action: 'internal_note_added',
          notes: trimmed.slice(0, 100),
        })
        .select()
        .single();

      if (auditData) {
        auditEvent = {
          id: auditData.id,
          ticketId: auditData.ticket_id,
          actorId: auditData.actor_id,
          actorName: auditData.actor_name,
          action: auditData.action,
          oldValue: auditData.old_value,
          newValue: auditData.new_value,
          notes: auditData.notes,
          createdAt: auditData.created_at,
        };
      }
    }

    // Touch parent ticket updated_at (and transition awaiting_user -> in_review for user reply)
    if (params.senderRole === 'user' && params.currentTicketStatus === 'awaiting_user') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_review', updated_at: new Date().toISOString() })
        .eq('id', params.ticketId);
    }

    return {
      success: true,
      message: {
        id: data.id,
        ticketId: data.ticket_id,
        senderId: data.sender_id,
        senderName: data.sender_name,
        senderRole: data.sender_role,
        message: data.message,
        isInternal: Boolean(data.is_internal),
        createdAt: data.created_at,
      },
      auditEvent,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save ticket reply' };
  }
}

/**
 * Updates support ticket status in Supabase and records an immutable audit event.
 */
export async function updateTicketStatusInSupabase(params: {
  ticketId: string;
  oldStatus: TicketStatus;
  newStatus: TicketStatus;
  actorId: string;
  actorName: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        status: params.newStatus,
        updated_at: now,
        resolved_at: params.newStatus === 'resolved' ? now : undefined,
        resolved_by: params.newStatus === 'resolved' ? params.actorId : undefined,
      })
      .eq('id', params.ticketId)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: 'Ticket not found or update unauthorized under RLS.' };
    }

    await supabase.from('ticket_audit_events').insert({
      ticket_id: params.ticketId,
      actor_id: params.actorId,
      actor_name: params.actorName,
      action: 'status_changed',
      old_value: params.oldStatus,
      new_value: params.newStatus,
      notes: params.notes || `Status updated to ${params.newStatus}`,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update ticket status' };
  }
}

/**
 * Updates support ticket priority in Supabase and logs an audit event.
 */
export async function updateTicketPriorityInSupabase(params: {
  ticketId: string;
  oldPriority: TicketPriority;
  newPriority: TicketPriority;
  actorId: string;
  actorName: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        priority: params.newPriority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.ticketId)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: 'Ticket not found or update unauthorized under RLS.' };
    }

    await supabase.from('ticket_audit_events').insert({
      ticket_id: params.ticketId,
      actor_id: params.actorId,
      actor_name: params.actorName,
      action: 'priority_changed',
      old_value: params.oldPriority,
      new_value: params.newPriority,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update priority' };
  }
}

/**
 * Assigns a support ticket to an administrator in Supabase and logs an audit event.
 */
export async function assignTicketInSupabase(params: {
  ticketId: string;
  oldAssigneeName?: string;
  assigneeId: string;
  assigneeName: string;
  actorId: string;
  actorName: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        assigned_to: params.assigneeId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.ticketId)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: 'Ticket not found or assignment unauthorized under RLS.' };
    }

    await supabase.from('ticket_audit_events').insert({
      ticket_id: params.ticketId,
      actor_id: params.actorId,
      actor_name: params.actorName,
      action: 'assigned',
      old_value: params.oldAssigneeName || null,
      new_value: params.assigneeName,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to assign ticket' };
  }
}

/**
 * Fetches all support tickets (with internal messages & audit events) for verified staff admins.
 */
export async function fetchAllSupportTicketsForAdminFromSupabase(): Promise<{
  success: boolean;
  tickets?: SupportTicket[];
  error?: string;
}> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, ticket_messages(*), ticket_audit_events(*)')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    const tickets: SupportTicket[] = (data || []).map((row: any) => {
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
      ticket.auditEvents = Array.isArray(row.ticket_audit_events)
        ? row.ticket_audit_events.map((a: any) => ({
            id: a.id,
            ticketId: a.ticket_id,
            actorId: a.actor_id,
            actorName: a.actor_name,
            action: a.action,
            oldValue: a.old_value,
            newValue: a.new_value,
            notes: a.notes,
            createdAt: a.created_at,
          }))
        : [];
      return ticket;
    });

    return { success: true, tickets };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch admin support tickets' };
  }
}

/**
 * Fetches all safety reports for verified staff admins under RLS.
 */
export async function fetchSafetyReportsForAdminFromSupabase(): Promise<{
  success: boolean;
  reports?: SafetyReport[];
  error?: string;
}> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    const reports = (data || []).map((row: any) => {
      const mapped = mapSupabaseReportToApp(row);
      const { label } = getReportPriorityAndLabel(mapped.reasonCode);
      mapped.reasonLabel = label;
      return mapped;
    });

    return { success: true, reports };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch safety reports' };
  }
}

/**
 * Resolves or dismisses a safety report in Supabase (admin-only under RLS).
 */
export async function resolveSafetyReportInSupabase(params: {
  reportId: string;
  status: 'resolved' | 'dismissed';
  adminNotes?: string;
  reviewerId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('safety_reports')
      .update({
        status: params.status,
        admin_notes: params.adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: params.reviewerId,
      })
      .eq('id', params.reportId)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: 'Safety report not found or update unauthorized under RLS.' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resolve safety report' };
  }
}

// ====================================================================
// Real NestJS Support Methods
// ====================================================================

export function mapBackendTicketToApp(row: any): SupportTicket {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber || row.ticket_number || '',
    userId: row.userId || row.user_id,
    userEmail: row.userEmail || row.user_email || row.guestEmail || '',
    userName: row.userName || row.user_name || row.guestName || '',
    userPhone: row.userPhone || row.user_phone || row.guestPhone,
    category: row.category,
    subject: row.subject,
    description: row.description,
    referenceListingId: row.referenceListingId || row.reference_listing_id,
    referenceUserId: row.referenceUserId || row.reference_user_id,
    priority: row.priority || 'normal',
    status: row.status || 'open',
    assignedTo: row.assignedTo || row.assigned_to,
    assignedName: row.assignedName || row.assigned_name,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    messages: Array.isArray(row.messages)
      ? row.messages.map((m: any) => ({
          id: m.id,
          ticketId: m.ticketId || m.ticket_id,
          senderId: m.senderId || m.sender_id,
          senderRole: m.senderRole || m.sender_role || 'user',
          senderName: m.senderName || m.sender_name || 'User',
          message: m.message,
          createdAt: m.createdAt || m.created_at,
        }))
      : [],
    auditEvents: [],
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
    resolvedAt: row.resolvedAt || row.resolved_at,
    resolvedBy: row.resolvedBy || row.resolved_by,
  };
}

export async function createSupportTicketInBackend(dto: {
  category: TicketCategory;
  subject: string;
  description: string;
  referenceListingId?: string;
  referenceUserId?: string;
  priority?: TicketPriority;
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const res = await apiClient.post<any>('/support/tickets', dto);
    return { success: true, ticket: mapBackendTicketToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit support ticket';
    return { success: false, error: message };
  }
}

export async function createGuestSupportTicketInBackend(dto: {
  guestEmail: string;
  guestName: string;
  guestPhone?: string;
  category: TicketCategory;
  subject: string;
  description: string;
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const res = await apiClient.post<any>('/support/tickets/guest', dto);
    return { success: true, ticket: mapBackendTicketToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit guest support ticket';
    return { success: false, error: message };
  }
}

export async function fetchMySupportTicketsFromBackend(): Promise<{
  success: boolean;
  tickets: SupportTicket[];
  error?: string;
}> {
  try {
    const res = await apiClient.get<any[]>('/support/tickets/mine');
    return { success: true, tickets: (res || []).map(mapBackendTicketToApp) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tickets';
    return { success: false, tickets: [], error: message };
  }
}

export async function getSupportTicketByIdFromBackend(
  ticketId: string
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const res = await apiClient.get<any>(`/support/tickets/${ticketId}`);
    return { success: true, ticket: mapBackendTicketToApp(res) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get ticket details';
    return { success: false, error: message };
  }
}

export async function addTicketMessageInBackend(
  ticketId: string,
  message: string
): Promise<{ success: boolean; message?: TicketMessage; error?: string }> {
  try {
    const res = await apiClient.post<any>(`/support/tickets/${ticketId}/messages`, { message });
    return { success: true, message: res };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to post ticket message';
    return { success: false, error: msg };
  }
}

export async function updateTicketStatusInBackend(
  ticketId: string,
  status: TicketStatus,
  assignedTo?: string
): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const res = await apiClient.patch<any>(`/support/tickets/${ticketId}/status`, { status, assignedTo });
    return { success: true, ticket: mapBackendTicketToApp(res) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update ticket status';
    return { success: false, error: msg };
  }
}

export async function submitSafetyReportToBackend(reportData: {
  targetType: 'listing' | 'flatmate' | 'user';
  targetId: string;
  targetTitle?: string;
  reasonCode: string;
  details: string;
  reporterEmail?: string;
  reporterName?: string;
}): Promise<{ success: boolean; reportId?: string; error?: string }> {
  try {
    const res = await apiClient.post<{ success: boolean; id: string; message: string }>(
      '/support/tickets/reports',
      reportData,
    );
    return { success: true, reportId: res.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit safety report';
    return { success: false, error: message };
  }
}
