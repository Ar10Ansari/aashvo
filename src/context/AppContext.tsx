import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Property,
  Flatmate,
  PropertyFilterState,
  User,
  ListingReport,
  ConnectRequest,
  ListingStatus,
  DiscoveryTab,
  SupportTicket,
  SafetyReport,
  TicketStatus,
  TicketPriority,
} from '../types';
import { SEED_PROPERTIES, SEED_FLATMATES } from '../data/seedData';
import {
  generateTicketNumber,
  determineTicketPriority,
  canTransitionTicketStatus,
  getReportPriorityAndLabel,
  isDuplicateReport,
  dispatchSupportNotification,
  createSupportTicketInSupabase,
  createSafetyReportInSupabase,
} from '../services/supportService';
import { supabase, isLiveBackendConfigured } from '../services/supabase';
import {
  fetchPropertiesFromSupabase,
  createPropertyInSupabase,
  submitInquiryInSupabase,
} from '../services/marketplaceService';

interface AppContextType {
  properties: Property[];
  flatmates: Flatmate[];
  filters: PropertyFilterState;
  setFilters: React.Dispatch<React.SetStateAction<PropertyFilterState>>;
  resetFilters: () => void;
  activeTab: DiscoveryTab;
  setActiveTab: (tab: DiscoveryTab) => void;
  selectedProperty: Property | null;
  setSelectedProperty: (prop: Property | null) => void;
  selectedFlatmate: Flatmate | null;
  setSelectedFlatmate: (flatmate: Flatmate | null) => void;
  isListPropertyOpen: boolean;
  setIsListPropertyOpen: (open: boolean) => void;
  isAdminOpen: boolean;
  setIsAdminOpen: (open: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  reportingTarget: { type: 'listing' | 'flatmate' | 'user'; id: string; title: string } | null;
  setReportingTarget: (target: { type: 'listing' | 'flatmate' | 'user'; id: string; title: string } | null) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  loginAs: (role: 'renter' | 'owner' | 'broker' | 'admin', name?: string) => void;
  logout: () => void;
  reports: ListingReport[];
  submitReport: (listingId: string, listingTitle: string, reason: string, notes: string) => void;
  resolveReport: (reportId: string) => void;
  // Enhanced Safety Reports
  safetyReports: SafetyReport[];
  submitSafetyReport: (report: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>) => {
    success: boolean;
    message: string;
    reportId?: string;
  };
  resolveSafetyReport: (reportId: string, action: 'resolved' | 'dismissed', adminNotes?: string) => void;
  // Support Tickets System
  supportTickets: SupportTicket[];
  createSupportTicket: (
    ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages' | 'auditEvents' | 'status' | 'priority'> & {
      priority?: TicketPriority;
    },
    initialMessage?: string
  ) => SupportTicket;
  addTicketMessage: (
    ticketId: string,
    message: string,
    isInternal?: boolean,
    senderRole?: 'user' | 'support' | 'admin'
  ) => void;
  updateTicketStatus: (ticketId: string, newStatus: TicketStatus, adminNotes?: string) => boolean;
  updateTicketPriority: (ticketId: string, newPriority: TicketPriority) => void;
  assignTicket: (ticketId: string, adminId: string, adminName: string) => void;
  updatePropertyStatus: (id: string, status: ListingStatus) => void;
  addProperty: (property: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>) => void;
  connectRequests: ConnectRequest[];
  submitConnectRequest: (req: Omit<ConnectRequest, 'id' | 'createdAt'>) => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const defaultFilters: PropertyFilterState = {
  searchQuery: '',
  locality: 'All Localities',
  city: 'All Cities',
  roomType: 'all',
  maxBudget: 60000,
  furnishing: 'all',
  providerType: 'all',
  genderPreference: 'all',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved state or default
  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = localStorage.getItem('aashvo_properties');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= SEED_PROPERTIES.length) {
          return parsed;
        }
      } catch {
        // Fallback to fresh seed
      }
    }
    return SEED_PROPERTIES;
  });

  const [flatmates] = useState<Flatmate[]>(() => {
    const saved = localStorage.getItem('aashvo_flatmates');
    return saved ? JSON.parse(saved) : SEED_FLATMATES;
  });

  const [reports, setReports] = useState<ListingReport[]>(() => {
    const saved = localStorage.getItem('aashvo_reports');
    return saved ? JSON.parse(saved) : [
      {
        id: 'rep-1',
        listingId: 'prop-4',
        listingTitle: 'Studio Room with Attached Pantry in Saket',
        reason: 'Price clarification requested',
        notes: 'User inquired whether electricity rate includes AC power backup.',
        createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
        status: 'pending',
      }
    ];
  });

  const [connectRequests, setConnectRequests] = useState<ConnectRequest[]>(() => {
    const saved = localStorage.getItem('aashvo_connect_requests');
    return saved ? JSON.parse(saved) : [];
  });
  const [filters, setFilters] = useState<PropertyFilterState>(defaultFilters);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('flatmates');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedFlatmate, setSelectedFlatmate] = useState<Flatmate | null>(null);
  const [isListPropertyOpen, setIsListPropertyOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportingTarget, setReportingTarget] = useState<{
    type: 'listing' | 'flatmate' | 'user';
    id: string;
    title: string;
  } | null>(null);

  // 1. Support Tickets State (persisted to localStorage)
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    const saved = localStorage.getItem('aashvo_support_tickets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback to seeds
      }
    }
    return [
      {
        id: 'tkt-seed-1',
        ticketNumber: 'ASH-TKT-7G4P1K',
        userId: 'usr-101',
        userEmail: 'rohan.v@delhitech.in',
        userName: 'Rohan Varma',
        userPhone: '+91 98112 34567',
        category: 'family_stays_meals',
        subject: 'Query on vegetarian meal kitchen separation in DLF Phase 2',
        description: 'I am looking at the DLF Phase 2 Family Stay listing and wanted to confirm if the daily meals are prepared in a strictly vegetarian kitchen setup.',
        referenceListingId: 'prop-5',
        priority: 'normal',
        status: 'resolved',
        assignedTo: 'usr-001',
        assignedName: 'Aashvo Support Admin',
        attachments: [],
        createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
        updatedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        resolvedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        resolvedBy: 'usr-001',
        messages: [
          {
            id: 'msg-1',
            ticketId: 'tkt-seed-1',
            senderId: 'usr-101',
            senderName: 'Rohan Varma',
            senderRole: 'user',
            message: 'I am looking at the DLF Phase 2 Family Stay listing and wanted to confirm if the daily meals are prepared in a strictly vegetarian kitchen setup.',
            isInternal: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
          },
          {
            id: 'msg-2',
            ticketId: 'tkt-seed-1',
            senderId: 'usr-001',
            senderName: 'Aashvo Support Team',
            senderRole: 'support',
            message: 'Hi Rohan! We confirmed with Col. S.K. Rao that their household maintains a 100% pure vegetarian kitchen. You can safely proceed with booking a home visit.',
            isInternal: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
          },
          {
            id: 'msg-3',
            ticketId: 'tkt-seed-1',
            senderId: 'usr-001',
            senderName: 'Aashvo Support Team',
            senderRole: 'admin',
            message: 'Verified via WhatsApp with Col. Rao. Confirmed pure veg kitchen policy.',
            isInternal: true,
            createdAt: new Date(Date.now() - 3600 * 1000 * 27).toISOString(),
          },
        ],
        auditEvents: [
          {
            id: 'aud-1',
            ticketId: 'tkt-seed-1',
            actorId: 'usr-001',
            actorName: 'Aashvo Support Admin',
            action: 'status_changed',
            oldValue: 'in_review',
            newValue: 'resolved',
            notes: 'Host confirmed kitchen details',
            createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          },
        ],
      },
      {
        id: 'tkt-seed-2',
        ticketNumber: 'ASH-TKT-9M2X4F',
        userId: 'usr-101',
        userEmail: 'rohan.v@delhitech.in',
        userName: 'Rohan Varma',
        userPhone: '+91 98112 34567',
        category: 'rooms_listings',
        subject: 'Deposit clarification for Saket studio private room',
        description: 'The listing mentions 1 month refundable security deposit of Rs 18,500. I wanted to confirm if there is any separate move-in fee charged by the resident society.',
        referenceListingId: 'prop-4',
        priority: 'normal',
        status: 'in_review',
        assignedTo: 'usr-001',
        assignedName: 'Aashvo Support Admin',
        attachments: [],
        createdAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
        updatedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        messages: [
          {
            id: 'msg-4',
            ticketId: 'tkt-seed-2',
            senderId: 'usr-101',
            senderName: 'Rohan Varma',
            senderRole: 'user',
            message: 'The listing mentions 1 month refundable security deposit of Rs 18,500. I wanted to confirm if there is any separate move-in fee charged by the resident society.',
            isInternal: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
          },
          {
            id: 'msg-5',
            ticketId: 'tkt-seed-2',
            senderId: 'usr-001',
            senderName: 'Aashvo Trust Team',
            senderRole: 'support',
            message: 'Hello Rohan, our editorial team is reaching out to the host Deepa Saxena to cross-verify society RWA move-in rules. We will update you shortly.',
            isInternal: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
          },
        ],
        auditEvents: [
          {
            id: 'aud-2',
            ticketId: 'tkt-seed-2',
            actorId: 'usr-001',
            actorName: 'Aashvo Trust Admin',
            action: 'status_changed',
            oldValue: 'open',
            newValue: 'in_review',
            notes: 'Contacted host for RWA fee clarity',
            createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
          },
        ],
      },
    ];
  });

  // 2. Safety Reports State
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>(() => {
    const saved = localStorage.getItem('aashvo_safety_reports');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return [
      {
        id: 'srep-1',
        reporterId: 'usr-101',
        reporterName: 'Rohan Varma',
        reporterEmail: 'rohan.v@delhitech.in',
        targetType: 'listing',
        targetId: 'prop-4',
        targetTitle: 'Studio Room with Attached Pantry in Saket',
        reasonCode: 'misleading_charges',
        reasonLabel: 'Misleading Price, Deposit or Hidden Charges',
        details: 'Provider stated in chat that electricity rate is Rs 12 per unit, whereas the listing advertises Rs 8 per unit.',
        priority: 'high',
        status: 'pending',
        createdAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
      },
      {
        id: 'srep-2',
        reporterId: 'usr-202',
        reporterName: 'Anil Mehra',
        reporterEmail: 'anil.mehra@delhihomes.org',
        targetType: 'flatmate',
        targetId: 'flt-3',
        targetTitle: 'Vikram Malhotra',
        reasonCode: 'inappropriate_conduct',
        reasonLabel: 'Inappropriate Conduct or Rule Violation',
        details: 'Prospective flatmate was verbally abusive when informed about strictly non-smoking house guidelines.',
        priority: 'high',
        status: 'investigating',
        createdAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
        adminNotes: 'Contacted reporter Anil Mehra. Reviewing chat logs.',
      },
    ];
  });

  // Synchronize support and safety states to localStorage
  useEffect(() => {
    localStorage.setItem('aashvo_support_tickets', JSON.stringify(supportTickets));
  }, [supportTickets]);

  useEffect(() => {
    localStorage.setItem('aashvo_safety_reports', JSON.stringify(safetyReports));
  }, [safetyReports]);

  // Support Ticket Handlers
  const createSupportTicket = (
    ticketData: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages' | 'auditEvents' | 'status' | 'priority'> & {
      priority?: TicketPriority;
    },
    initialMessage?: string
  ): SupportTicket => {
    const ticketNumber = generateTicketNumber();
    const now = new Date().toISOString();
    const priority = ticketData.priority || determineTicketPriority(ticketData.category, ticketData.subject, ticketData.description);

    const initialThreadMessage = initialMessage
      ? [
          {
            id: `msg-${Date.now()}`,
            ticketId: `tkt-${Date.now()}`,
            senderId: ticketData.userId,
            senderName: ticketData.userName,
            senderRole: 'user' as const,
            message: initialMessage,
            isInternal: false,
            createdAt: now,
          },
        ]
      : [];

    const newTicket: SupportTicket = {
      ...ticketData,
      id: `tkt-${Date.now()}`,
      ticketNumber,
      priority,
      status: 'open',
      attachments: [],
      createdAt: now,
      updatedAt: now,
      messages: initialThreadMessage,
      auditEvents: [
        {
          id: `aud-${Date.now()}`,
          ticketId: `tkt-${Date.now()}`,
          actorId: ticketData.userId,
          actorName: ticketData.userName,
          action: 'ticket_created',
          notes: `Created via Help Centre (${ticketData.category})`,
          createdAt: now,
        },
      ],
    };

    setSupportTickets(prev => [newTicket, ...prev]);

    if (isLiveBackendConfigured && supabase) {
      createSupportTicketInSupabase(ticketData, initialMessage).catch(err => {
        console.warn('[Supabase Support Sync Notice]', err);
      });
    }

    dispatchSupportNotification('ticket_created', {
      ticketNumber,
      recipientEmail: ticketData.userEmail,
      subject: ticketData.subject,
    });

    showToast(`Support ticket ${ticketNumber} created! Our team will respond shortly.`);
    return newTicket;
  };

  const addTicketMessage = (
    ticketId: string,
    message: string,
    isInternal: boolean = false,
    senderRole: 'user' | 'support' | 'admin' = 'user'
  ) => {
    const now = new Date().toISOString();
    const senderName = currentUser?.name || (senderRole === 'admin' ? 'Aashvo Admin' : 'User');
    const senderId = currentUser?.id;

    setSupportTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== ticketId) return ticket;

        const newMessage = {
          id: `msg-${Date.now()}`,
          ticketId,
          senderId,
          senderName,
          senderRole,
          message,
          isInternal,
          createdAt: now,
        };

        const newAudit = isInternal
          ? [
              {
                id: `aud-${Date.now()}`,
                ticketId,
                actorId: senderId,
                actorName: senderName,
                action: 'internal_note_added',
                notes: message.slice(0, 100),
                createdAt: now,
              },
            ]
          : [];

        // If user replies while awaiting_user, transition to in_review
        let nextStatus = ticket.status;
        if (senderRole === 'user' && ticket.status === 'awaiting_user') {
          nextStatus = 'in_review';
        }

        return {
          ...ticket,
          status: nextStatus,
          updatedAt: now,
          messages: [...ticket.messages, newMessage],
          auditEvents: [...(ticket.auditEvents || []), ...newAudit],
        };
      })
    );

    showToast(isInternal ? 'Internal note added to ticket history.' : 'Reply sent successfully.');
  };

  const updateTicketStatus = (ticketId: string, newStatus: TicketStatus, adminNotes?: string): boolean => {
    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return false;

    if (!canTransitionTicketStatus(ticket.status, newStatus)) {
      showToast(`Invalid status transition from ${ticket.status.toUpperCase()} to ${newStatus.toUpperCase()}`);
      return false;
    }

    const now = new Date().toISOString();
    const adminName = currentUser?.name || 'Aashvo Safety Admin';
    const adminId = currentUser?.id;

    setSupportTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t;

        const auditEvent = {
          id: `aud-${Date.now()}`,
          ticketId,
          actorId: adminId,
          actorName: adminName,
          action: 'status_changed',
          oldValue: t.status,
          newValue: newStatus,
          notes: adminNotes || `Status updated to ${newStatus}`,
          createdAt: now,
        };

        return {
          ...t,
          status: newStatus,
          updatedAt: now,
          resolvedAt: newStatus === 'resolved' ? now : t.resolvedAt,
          resolvedBy: newStatus === 'resolved' ? adminId : t.resolvedBy,
          auditEvents: [...(t.auditEvents || []), auditEvent],
        };
      })
    );

    dispatchSupportNotification('status_changed', {
      ticketNumber: ticket.ticketNumber,
      recipientEmail: ticket.userEmail,
      newStatus,
    });

    showToast(`Ticket status updated to ${newStatus.toUpperCase()}`);
    return true;
  };

  const updateTicketPriority = (ticketId: string, newPriority: TicketPriority) => {
    const now = new Date().toISOString();
    setSupportTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t;
        const auditEvent = {
          id: `aud-${Date.now()}`,
          ticketId,
          actorId: currentUser?.id,
          actorName: currentUser?.name || 'Admin',
          action: 'priority_changed',
          oldValue: t.priority,
          newValue: newPriority,
          createdAt: now,
        };
        return {
          ...t,
          priority: newPriority,
          updatedAt: now,
          auditEvents: [...(t.auditEvents || []), auditEvent],
        };
      })
    );
    showToast(`Ticket priority changed to ${newPriority.toUpperCase()}`);
  };

  const assignTicket = (ticketId: string, adminId: string, adminName: string) => {
    const now = new Date().toISOString();
    setSupportTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t;
        const auditEvent = {
          id: `aud-${Date.now()}`,
          ticketId,
          actorId: currentUser?.id,
          actorName: currentUser?.name || 'Admin',
          action: 'assigned',
          oldValue: t.assignedName,
          newValue: adminName,
          createdAt: now,
        };
        return {
          ...t,
          assignedTo: adminId,
          assignedName: adminName,
          updatedAt: now,
          auditEvents: [...(t.auditEvents || []), auditEvent],
        };
      })
    );
    showToast(`Ticket assigned to ${adminName}`);
  };

  // Safety Reports Handlers
  const submitSafetyReport = (
    reportData: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>
  ): { success: boolean; message: string; reportId?: string } => {
    const reporterIdentifier = reportData.reporterId || reportData.reporterEmail || '';

    // Check duplicate submissions within 24h
    if (isDuplicateReport(safetyReports, reporterIdentifier, reportData.targetId)) {
      return {
        success: false,
        message: 'A report for this listing/user was already submitted recently. Our moderation team is actively reviewing it.',
      };
    }

    const { priority, label } = getReportPriorityAndLabel(reportData.reasonCode);
    const reportId = `srep-${Date.now()}`;

    const newReport: SafetyReport = {
      ...reportData,
      id: reportId,
      reasonLabel: label,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setSafetyReports(prev => [newReport, ...prev]);

    if (isLiveBackendConfigured && supabase) {
      createSafetyReportInSupabase(reportData).catch(err => {
        console.warn('[Supabase Safety Report Sync Notice]', err);
      });
    }

    // Also maintain legacy reports for backward compatibility
    if (reportData.targetType === 'listing') {
      submitReport(reportData.targetId, reportData.targetTitle, label, reportData.details);
    }

    showToast('Report submitted for confidential safety review. Thank you for protecting Aashvo.');
    return {
      success: true,
      message: 'Report received. Our safety team will review this in accordance with community guidelines.',
      reportId,
    };
  };

  const resolveSafetyReport = (reportId: string, action: 'resolved' | 'dismissed', adminNotes?: string) => {
    const now = new Date().toISOString();
    setSafetyReports(prev =>
      prev.map(r =>
        r.id === reportId
          ? {
              ...r,
              status: action,
              adminNotes: adminNotes || r.adminNotes,
              reviewedAt: now,
              reviewedBy: currentUser?.name || 'Admin',
            }
          : r
      )
    );
    showToast(`Report marked as ${action.toUpperCase()}`);
  };

  // Authenticated user simulation (starts logged in as Rohan, persists across session changes)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aashvo_current_user');
    return saved ? JSON.parse(saved) : {
      id: 'usr-101',
      name: 'Rohan Varma',
      email: 'rohan.v@delhitech.in',
      role: 'renter',
      phone: '+91 98112 34567',
    };
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('aashvo_properties', JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem('aashvo_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('aashvo_connect_requests', JSON.stringify(connectRequests));
  }, [connectRequests]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('aashvo_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('aashvo_current_user');
    }
  }, [currentUser]);

  // Hydrate live database properties if Supabase is connected
  useEffect(() => {
    if (isLiveBackendConfigured && supabase) {
      fetchPropertiesFromSupabase().then(res => {
        if (res.success && res.properties && res.properties.length > 0) {
          setProperties(res.properties);
        }
      }).catch(err => {
        console.warn('[Supabase Property Hydration Notice]', err);
      });
    }
  }, []);

  // Listen for Supabase session and auth changes
  useEffect(() => {
    if (!isLiveBackendConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        setCurrentUser({
          id: session.user.id,
          name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Aashvo Member',
          email: session.user.email || '',
          role: (meta.role as any) || 'renter',
          phone: session.user.phone || meta.phone,
          avatar: meta.avatar_url,
          emailVerified: Boolean(session.user.email_confirmed_at),
          phoneVerified: Boolean(session.user.phone_confirmed_at),
          authProvider: session.user.app_metadata?.provider === 'google' ? 'google' : 'email',
        });
      }
    }).catch(err => {
      console.warn('[Supabase Session Check Notice]', err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        setCurrentUser({
          id: session.user.id,
          name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Aashvo Member',
          email: session.user.email || '',
          role: (meta.role as any) || 'renter',
          phone: session.user.phone || meta.phone,
          avatar: meta.avatar_url,
          emailVerified: Boolean(session.user.email_confirmed_at),
          phoneVerified: Boolean(session.user.phone_confirmed_at),
          authProvider: session.user.app_metadata?.provider === 'google' ? 'google' : 'email',
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    showToast('Filters reset to default');
  };

  const loginAs = (role: 'renter' | 'owner' | 'broker' | 'admin', name?: string) => {
    const userMap: Record<string, User> = {
      renter: {
        id: 'usr-101',
        name: name || 'Rohan Varma',
        email: 'rohan.v@delhitech.in',
        role: 'renter',
        phone: '+91 98112 34567',
      },
      owner: {
        id: 'usr-202',
        name: name || 'Anil Mehra (DLF Owner)',
        email: 'anil.mehra@delhihomes.org',
        role: 'owner',
        phone: '+91 98101 22334',
      },
      broker: {
        id: 'usr-303',
        name: name || 'Rajesh Kumar (Verified Manager)',
        email: 'rajesh@urbanstay.in',
        role: 'broker',
        phone: '+91 97112 99887',
      },
      admin: {
        id: 'usr-001',
        name: 'Aashvo Trust & Safety Team',
        email: 'moderation@aashvo.com',
        role: 'admin',
      },
    };

    setCurrentUser(userMap[role]);
    setIsAuthOpen(false);
    showToast(`Signed in as ${userMap[role].name} (${role.toUpperCase()})`);
  };

  const logout = () => {
    if (isLiveBackendConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    showToast('Signed out successfully');
  };

  const submitReport = (listingId: string, listingTitle: string, reason: string, notes: string) => {
    const newReport: ListingReport = {
      id: `rep-${Date.now()}`,
      listingId,
      listingTitle,
      reason,
      notes,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setReports(prev => [newReport, ...prev]);
    showToast('Report submitted for editorial review. Thank you for keeping Aashvo safe.');
  };

  const resolveReport = (reportId: string) => {
    setReports(prev =>
      prev.map(r => (r.id === reportId ? { ...r, status: 'resolved' as const } : r))
    );
    showToast('Report marked as resolved by safety team.');
  };

  const updatePropertyStatus = (id: string, status: ListingStatus) => {
    setProperties(prev =>
      prev.map(p => (p.id === id ? { ...p, status, lastVerifiedDate: new Date().toISOString() } : p))
    );
    showToast(`Listing status updated to ${status.toUpperCase()}`);
  };

  const addProperty = (newPropData: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>) => {
    const newProp: Property = {
      ...newPropData,
      id: `prop-${Date.now()}`,
      status: 'active', // Automatically active or pending
      lastVerifiedDate: new Date().toISOString(),
    };
    setProperties(prev => [newProp, ...prev]);
    setIsListPropertyOpen(false);

    if (isLiveBackendConfigured && supabase && currentUser) {
      createPropertyInSupabase(newPropData, currentUser).then(res => {
        if (res.success && res.property) {
          // Update local property with persisted database ID and fields
          setProperties(prev => prev.map(p => (p.id === newProp.id ? res.property! : p)));
        }
      }).catch(err => {
        console.warn('[Supabase Listing Creation Notice]', err);
      });
    }

    showToast('🎉 Property listed successfully with transparent pricing!');
  };

  const submitConnectRequest = (reqData: Omit<ConnectRequest, 'id' | 'createdAt'>) => {
    const newReq: ConnectRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setConnectRequests(prev => [newReq, ...prev]);

    if (isLiveBackendConfigured && supabase) {
      submitInquiryInSupabase({
        listingId: reqData.targetId,
        senderId: currentUser?.id || 'guest',
        senderName: reqData.senderName,
        senderEmail: reqData.senderEmail,
        senderPhone: reqData.senderPhone,
        message: reqData.message,
        moveInDate: reqData.moveInDate,
      }).catch(err => {
        console.warn('[Supabase Inquiry Submission Notice]', err);
      });
    }

    showToast('Direct inquiry sent! The provider has been notified via WhatsApp & Email.');
  };

  return (
    <AppContext.Provider
      value={{
        properties,
        flatmates,
        filters,
        setFilters,
        resetFilters,
        activeTab,
        setActiveTab,
        selectedProperty,
        setSelectedProperty,
        selectedFlatmate,
        setSelectedFlatmate,
        isListPropertyOpen,
        setIsListPropertyOpen,
        isAdminOpen,
        setIsAdminOpen,
        isAuthOpen,
        setIsAuthOpen,
        isHelpOpen,
        setIsHelpOpen,
        reportingTarget,
        setReportingTarget,
        currentUser,
        setCurrentUser,
        loginAs,
        logout,
        reports,
        submitReport,
        resolveReport,
        safetyReports,
        submitSafetyReport,
        resolveSafetyReport,
        supportTickets,
        createSupportTicket,
        addTicketMessage,
        updateTicketStatus,
        updateTicketPriority,
        assignTicket,
        updatePropertyStatus,
        addProperty,
        connectRequests,
        submitConnectRequest,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
