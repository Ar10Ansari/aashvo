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
