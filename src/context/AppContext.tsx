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
import {
  generateTicketNumber,
  determineTicketPriority,
  canTransitionTicketStatus,
  getReportPriorityAndLabel,
  isDuplicateReport,
  dispatchSupportNotification,
  createSupportTicketInSupabase,
  createSafetyReportInSupabase,
  fetchSupportTicketsFromSupabase,
  addTicketMessageInSupabase,
  updateTicketStatusInSupabase,
  updateTicketPriorityInSupabase,
  assignTicketInSupabase,
  fetchAllSupportTicketsForAdminFromSupabase,
  fetchSafetyReportsForAdminFromSupabase,
  resolveSafetyReportInSupabase,
} from '../services/supportService';
import {
  supabase,
  isLiveBackendConfigured,
  mapSupabasePropertyToApp,
  mapSupabaseFlatmateToApp,
} from '../services/supabase';
import { apiClient } from '../services/apiClient';
import {
  fetchPropertiesFromSupabase,
  fetchAllPropertiesForAdminFromSupabase,
  fetchFlatmatesFromSupabase,
  createPropertyInSupabase,
  updateListingStatusInSupabase,
  submitInquiryInSupabase,
} from '../services/marketplaceService';
import {
  sanitizeStoredUser,
  canPerformAdminAction,
  isTrustedAdminSession,
} from '../services/authorizationService';
import {
  ensureUserProfileExists,
  parseOAuthErrorFromUrl,
} from '../services/authService';
import { marketplaceProfileService } from '../services/marketplaceProfileService';
import type {
  MarketplaceProfileType,
  MarketplaceProfileView,
  ProfileCompletionBreakdown,
} from '@aashvo/contracts';

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
  authModalMode: 'signin' | 'signup' | 'forgot' | 'recovery';
  setAuthModalMode: (mode: 'signin' | 'signup' | 'forgot' | 'recovery') => void;
  openAuthModal: (mode?: 'signin' | 'signup' | 'forgot' | 'recovery') => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  isRentalTrustOpen: boolean;
  setIsRentalTrustOpen: (open: boolean) => void;
  isConnectOpen: boolean;
  setIsConnectOpen: (open: boolean) => void;
  connectInitialTab: 'discover' | 'matches' | 'chat' | 'settings';
  openConnectModal: (tab?: 'discover' | 'matches' | 'chat' | 'settings') => void;
  isMyActivityOpen: boolean;
  setIsMyActivityOpen: (open: boolean) => void;
  myActivityInitialTab: 'visits' | 'agreements' | 'checklists' | 'verifications';
  openMyActivityModal: (tab?: 'visits' | 'agreements' | 'checklists' | 'verifications') => void;
  isCalculatorOpen: boolean;
  setIsCalculatorOpen: (open: boolean) => void;
  isSavedOpen: boolean;
  setIsSavedOpen: (open: boolean) => void;
  // Marketplace Profiles & Progressive Onboarding
  marketplaceProfiles: MarketplaceProfileView[];
  activeMarketplaceProfile: MarketplaceProfileView | null;
  switchMarketplaceProfile: (type: MarketplaceProfileType) => Promise<MarketplaceProfileView>;
  refreshMarketplaceProfiles: () => Promise<void>;
  isMyProfileOpen: boolean;
  setIsMyProfileOpen: (open: boolean) => void;
  openMyProfileModal: () => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  openOnboardingModal: (initialStep?: number) => void;
  onboardingInitialStep: number;
  profileCompletion: ProfileCompletionBreakdown | null;
  refreshProfileCompletion: () => Promise<void>;
  reportingTarget: { type: 'listing' | 'flatmate' | 'user'; id: string; title: string } | null;
  setReportingTarget: (target: { type: 'listing' | 'flatmate' | 'user'; id: string; title: string } | null) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  loginAs: (role: 'renter' | 'owner' | 'broker', name?: string) => void;
  logout: () => void;
  reports: ListingReport[];
  submitReport: (listingId: string, listingTitle: string, reason: string, notes: string) => void;
  resolveReport: (reportId: string) => void;
  // Enhanced Safety Reports
  safetyReports: SafetyReport[];
  submitSafetyReport: (report: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>) => Promise<{
    success: boolean;
    message: string;
    reportId?: string;
  }>;
  resolveSafetyReport: (reportId: string, action: 'resolved' | 'dismissed', adminNotes?: string) => Promise<boolean>;
  // Support Tickets System
  supportTickets: SupportTicket[];
  createSupportTicket: (
    ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages' | 'auditEvents' | 'status' | 'priority'> & {
      priority?: TicketPriority;
    },
    initialMessage?: string
  ) => Promise<SupportTicket>;
  addTicketMessage: (
    ticketId: string,
    message: string,
    isInternal?: boolean,
    senderRole?: 'user' | 'support' | 'admin',
    guestContext?: { ticketNumber?: string; userEmail?: string; senderName?: string }
  ) => Promise<boolean>;
  updateTicketStatus: (ticketId: string, newStatus: TicketStatus, adminNotes?: string) => Promise<boolean>;
  updateTicketPriority: (ticketId: string, newPriority: TicketPriority) => Promise<boolean>;
  assignTicket: (ticketId: string, adminId: string, adminName: string) => Promise<boolean>;
  updatePropertyStatus: (id: string, status: ListingStatus) => void;
  addProperty: (property: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>) => Promise<boolean>;
  connectRequests: ConnectRequest[];
  submitConnectRequest: (req: Omit<ConnectRequest, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  isLoadingData: boolean;
  dataLoadError: string | null;
  retryDataLoad: () => void;
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
  const [properties, setProperties] = useState<Property[]>([]);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [connectRequests, setConnectRequests] = useState<ConnectRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(isLiveBackendConfigured);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PropertyFilterState>(defaultFilters);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('flatmates');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedFlatmate, setSelectedFlatmate] = useState<Flatmate | null>(null);
  const [isListPropertyOpen, setIsListPropertyOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot' | 'recovery'>('signin');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isRentalTrustOpen, setIsRentalTrustOpen] = useState<boolean>(false);
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [connectInitialTab, setConnectInitialTab] = useState<'discover' | 'matches' | 'chat' | 'settings'>('discover');
  const [isMyActivityOpen, setIsMyActivityOpen] = useState<boolean>(false);
  const [myActivityInitialTab, setMyActivityInitialTab] = useState<'visits' | 'agreements' | 'checklists' | 'verifications'>('visits');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [isSavedOpen, setIsSavedOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Marketplace Profiles & Onboarding State
  const [marketplaceProfiles, setMarketplaceProfiles] = useState<MarketplaceProfileView[]>([]);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<number>(1);
  const [profileCompletion, setProfileCompletion] = useState<ProfileCompletionBreakdown | null>(null);

  const activeMarketplaceProfile =
    marketplaceProfiles.find((p) => p.isCurrentActive) || marketplaceProfiles[0] || null;

  const refreshMarketplaceProfiles = async () => {
    try {
      const profiles = await marketplaceProfileService.getMyMarketplaceProfiles();
      setMarketplaceProfiles(profiles);
      const comp = await marketplaceProfileService.getProfileCompletion();
      setProfileCompletion(comp);
    } catch {
      // Ignored
    }
  };

  const refreshProfileCompletion = async () => {
    try {
      const comp = await marketplaceProfileService.getProfileCompletion();
      setProfileCompletion(comp);
    } catch {
      // Ignored
    }
  };

  const switchMarketplaceProfile = async (type: MarketplaceProfileType): Promise<MarketplaceProfileView> => {
    const updated = await marketplaceProfileService.switchMarketplaceProfile(type);
    await refreshMarketplaceProfiles();
    return updated;
  };

  const openMyProfileModal = () => {
    setIsMyProfileOpen(true);
  };

  const openOnboardingModal = (initialStep?: number) => {
    if (initialStep !== undefined) {
      setOnboardingInitialStep(initialStep);
    }
    setIsOnboardingOpen(true);
  };

  const [reportingTarget, setReportingTarget] = useState<{
    type: 'listing' | 'flatmate' | 'user';
    id: string;
    title: string;
  } | null>(null);

  // 1. Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  // 2. Safety Reports State
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);

  // Synchronize support and safety states to localStorage
  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_support_tickets', JSON.stringify(supportTickets));
  }, [supportTickets]);

  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_safety_reports', JSON.stringify(safetyReports));
  }, [safetyReports]);

  // Support Ticket Handlers
  const createSupportTicket = async (
    ticketData: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages' | 'auditEvents' | 'status' | 'priority'> & {
      priority?: TicketPriority;
    },
    initialMessage?: string
  ): Promise<SupportTicket> => {
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
      attachments: ticketData.attachments || [],
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

    if (isLiveBackendConfigured && supabase && !currentUser?.isDemo) {
      const result = await createSupportTicketInSupabase({ ...ticketData, priority }, initialMessage);
      if (!result.success || !result.ticket) {
        throw new Error(result.error || 'Support ticket could not be persisted.');
      }
      setSupportTickets(prev => [result.ticket!, ...prev]);
      dispatchSupportNotification('ticket_created', {
        ticketNumber: result.ticket.ticketNumber,
        recipientEmail: result.ticket.userEmail,
        subject: result.ticket.subject,
      });
      showToast(`Support ticket ${result.ticket.ticketNumber} created! Our team will respond shortly.`);
      return result.ticket;
    }

    setSupportTickets(prev => [newTicket, ...prev]);

    dispatchSupportNotification('ticket_created', {
      ticketNumber,
      recipientEmail: ticketData.userEmail,
      subject: ticketData.subject,
    });

    showToast(`Support ticket ${ticketNumber} created! Our team will respond shortly.`);
    return newTicket;
  };

  const addTicketMessage = async (
    ticketId: string,
    message: string,
    isInternal: boolean = false,
    senderRole: 'user' | 'support' | 'admin' = 'user',
    guestContext?: { ticketNumber?: string; userEmail?: string; senderName?: string }
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const senderName = guestContext?.senderName || currentUser?.name || (senderRole === 'admin' ? 'Aashvo Admin' : 'User');
    const senderId = currentUser?.isDemo ? undefined : currentUser?.id;
    const targetTicket = supportTickets.find(t => t.id === ticketId);

    if (isLiveBackendConfigured && supabase && !currentUser?.isDemo) {
      const res = await addTicketMessageInSupabase({
        ticketId,
        ticketNumber: guestContext?.ticketNumber || targetTicket?.ticketNumber,
        userEmail: guestContext?.userEmail || targetTicket?.userEmail,
        senderId,
        senderName,
        senderRole,
        message,
        isInternal,
        currentTicketStatus: targetTicket?.status,
      });

      if (!res.success || !res.message) {
        showToast(`Failed to send reply: ${res.error || 'Please try again.'}`);
        return false;
      }

      setSupportTickets(prev =>
        prev.map(ticket => {
          if (ticket.id !== ticketId) return ticket;
          const nextStatus = senderRole === 'user' && ticket.status === 'awaiting_user' ? 'in_review' : ticket.status;
          return {
            ...ticket,
            status: nextStatus,
            updatedAt: now,
            messages: [...ticket.messages, res.message!],
            auditEvents: res.auditEvent
              ? [...(ticket.auditEvents || []), res.auditEvent]
              : ticket.auditEvents,
          };
        })
      );

      showToast(isInternal ? 'Internal note saved.' : 'Reply sent successfully.');
      return true;
    }

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
    return true;
  };

  const updateTicketStatus = async (
    ticketId: string,
    newStatus: TicketStatus,
    adminNotes?: string
  ): Promise<boolean> => {
    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return false;

    // Staff transitions require trusted admin session
    if (newStatus === 'in_review' || newStatus === 'resolved' || newStatus === 'closed') {
      const authCheck = canPerformAdminAction(currentUser, 'update_ticket_status');
      if (!authCheck.allowed) {
        showToast(`Unauthorized: ${authCheck.reason}`);
        return false;
      }
    }

    if (!canTransitionTicketStatus(ticket.status, newStatus)) {
      showToast(`Invalid status transition from ${ticket.status.toUpperCase()} to ${newStatus.toUpperCase()}`);
      return false;
    }

    const now = new Date().toISOString();
    const adminName = currentUser?.name || 'Aashvo Safety Admin';
    const adminId = currentUser?.id;

    if (isLiveBackendConfigured && supabase) {
      if (!adminId) {
        showToast('Authentication required to update ticket status.');
        return false;
      }
      const res = await updateTicketStatusInSupabase({
        ticketId,
        oldStatus: ticket.status,
        newStatus,
        actorId: adminId,
        actorName: adminName,
        notes: adminNotes,
      });
      if (!res.success) {
        showToast(`Ticket status update failed: ${res.error || 'Server rejected change'}`);
        return false;
      }
    }

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

  const updateTicketPriority = async (ticketId: string, newPriority: TicketPriority): Promise<boolean> => {
    const authCheck = canPerformAdminAction(currentUser, 'update_ticket_priority');
    if (!authCheck.allowed) {
      showToast(`Unauthorized: ${authCheck.reason}`);
      return false;
    }

    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return false;

    const now = new Date().toISOString();
    if (isLiveBackendConfigured && supabase && currentUser) {
      const res = await updateTicketPriorityInSupabase({
        ticketId,
        oldPriority: ticket.priority,
        newPriority,
        actorId: currentUser.id,
        actorName: currentUser.name,
      });
      if (!res.success) {
        showToast(`Priority update failed: ${res.error || 'Server rejected change'}`);
        return false;
      }
    }

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
    return true;
  };

  const assignTicket = async (ticketId: string, adminId: string, adminName: string): Promise<boolean> => {
    const authCheck = canPerformAdminAction(currentUser, 'assign_ticket');
    if (!authCheck.allowed) {
      showToast(`Unauthorized: ${authCheck.reason}`);
      return false;
    }

    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return false;

    const now = new Date().toISOString();
    if (isLiveBackendConfigured && supabase && currentUser) {
      const res = await assignTicketInSupabase({
        ticketId,
        oldAssigneeName: ticket.assignedName,
        assigneeId: adminId,
        assigneeName: adminName,
        actorId: currentUser.id,
        actorName: currentUser.name,
      });
      if (!res.success) {
        showToast(`Ticket assignment failed: ${res.error || 'Server rejected change'}`);
        return false;
      }
    }

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
    return true;
  };

  // Safety Reports Handlers
  const submitSafetyReport = async (
    reportData: Omit<SafetyReport, 'id' | 'createdAt' | 'status' | 'reasonLabel' | 'priority'>
  ): Promise<{ success: boolean; message: string; reportId?: string }> => {
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

    if (isLiveBackendConfigured && supabase && !currentUser?.isDemo) {
      const result = await createSafetyReportInSupabase(reportData);
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Report could not be persisted. Please try again.',
        };
      }

      const persistedReport = { ...newReport, id: result.reportId || reportId };
      setSafetyReports(prev => [persistedReport, ...prev]);
      if (reportData.targetType === 'listing') {
        submitReport(reportData.targetId, reportData.targetTitle, label, reportData.details);
      }
      showToast('Report submitted for confidential safety review. Thank you for protecting Aashvo.');
      return {
        success: true,
        message: 'Report received. Our safety team will review this in accordance with community guidelines.',
        reportId: persistedReport.id,
      };
    }

    setSafetyReports(prev => [newReport, ...prev]);

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

  const resolveSafetyReport = async (
    reportId: string,
    action: 'resolved' | 'dismissed',
    adminNotes?: string
  ): Promise<boolean> => {
    const authCheck = canPerformAdminAction(currentUser, 'resolve_safety_report');
    if (!authCheck.allowed) {
      showToast(`Unauthorized: ${authCheck.reason}`);
      return false;
    }

    const now = new Date().toISOString();
    if (isLiveBackendConfigured && supabase && currentUser) {
      const res = await resolveSafetyReportInSupabase({
        reportId,
        status: action,
        adminNotes,
        reviewerId: currentUser.id,
      });
      if (!res.success) {
        showToast(`Failed to update report: ${res.error || 'Server rejected update'}`);
        return false;
      }
    }

    setSafetyReports(prev =>
      prev.map(r =>
        r.id === reportId
          ? {
              ...r,
              status: action,
              adminNotes: adminNotes || r.adminNotes,
              reviewedAt: now,
              reviewedBy: currentUser?.name || 'Staff',
            }
          : r
      )
    );

    showToast(`Report marked as ${action.toUpperCase()}`);
    return true;
  };

  // Authenticated user state (defaults to null for unauthenticated visitors)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (isLiveBackendConfigured) return null;
    const saved = localStorage.getItem('aashvo_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeStoredUser(parsed);
        if (sanitized) return sanitized;
      } catch {
        // Fallback to null
      }
    }
    // Strict Guest Default: Unauthenticated visitors must NEVER be silently logged in
    return null;
  });

  // Sync state to localStorage
  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_properties', JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_connect_requests', JSON.stringify(connectRequests));
  }, [connectRequests]);

  useEffect(() => {
    if (isLiveBackendConfigured) return;
    localStorage.setItem('aashvo_flatmates', JSON.stringify(flatmates));
  }, [flatmates]);

  useEffect(() => {
    if (isLiveBackendConfigured) return;
    if (currentUser) {
      localStorage.setItem('aashvo_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('aashvo_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshMarketplaceProfiles();
    }
  }, [currentUser]);

  const loadPublicMarketplaceData = async () => {
    setIsLoadingData(true);
    setDataLoadError(null);

    try {
      if (isLiveBackendConfigured && supabase) {
        const [propRes, flatmateRes] = await Promise.all([
          fetchPropertiesFromSupabase(),
          fetchFlatmatesFromSupabase(),
        ]);

        const errors: string[] = [];
        if (propRes.success) {
          setProperties(propRes.properties || []);
        } else {
          setProperties([]);
          errors.push(propRes.error || 'Could not load property listings.');
        }

        if (flatmateRes.success) {
          setFlatmates(flatmateRes.flatmates || []);
        } else {
          setFlatmates([]);
          errors.push(flatmateRes.error || 'Could not load flatmate profiles.');
        }

        if (errors.length > 0) {
          setDataLoadError(errors.join(' '));
        }
      } else {
        // Query Render REST API when Supabase client is not directly configured
        try {
          const [propRes, flatmateRes] = await Promise.all([
            apiClient.get<{ items: any[] }>('/properties').catch(() => ({ items: [] })),
            apiClient.get<{ items: any[] }>('/flatmates').catch(() => ({ items: [] })),
          ]);
          setProperties(Array.isArray(propRes?.items) ? propRes.items.map(mapSupabasePropertyToApp) : []);
          setFlatmates(Array.isArray(flatmateRes?.items) ? flatmateRes.items.map(mapSupabaseFlatmateToApp) : []);
          setDataLoadError(null);
        } catch {
          setProperties([]);
          setFlatmates([]);
        }
      }
    } catch (err) {
      setProperties([]);
      setFlatmates([]);
      setDataLoadError(err instanceof Error ? err.message : 'Unable to connect to marketplace services.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const retryDataLoad = () => {
    loadPublicMarketplaceData();
  };

  // Hydrate live database properties and flatmate profiles if Supabase is connected
  useEffect(() => {
    loadPublicMarketplaceData();
  }, []);

  // Hydrate user support tickets, or full admin moderation queues when verified staff signs in
  useEffect(() => {
    if (!isLiveBackendConfigured || !supabase || !currentUser || currentUser.isDemo) return;

    if (isTrustedAdminSession(currentUser)) {
      Promise.all([
        fetchAllSupportTicketsForAdminFromSupabase(),
        fetchSafetyReportsForAdminFromSupabase(),
        fetchAllPropertiesForAdminFromSupabase(),
      ])
        .then(([ticketsRes, reportsRes, adminPropsRes]) => {
          if (ticketsRes.success) setSupportTickets(ticketsRes.tickets || []);
          if (reportsRes.success) setSafetyReports(reportsRes.reports || []);
          if (adminPropsRes.success) setProperties(adminPropsRes.properties || []);
        })
        .catch(err => {
          console.warn('[Supabase Admin Hydration Notice]', err);
        });
      return;
    }

    fetchSupportTicketsFromSupabase(currentUser.email, currentUser.id)
      .then(res => {
        if (res.success) setSupportTickets(res.tickets || []);
      })
      .catch(err => {
        console.warn('[Supabase Support Hydration Notice]', err);
      });
  }, [currentUser]);

  // Check for URL OAuth callbacks/errors and password recovery hashes on mount
  useEffect(() => {
    const oauthError = parseOAuthErrorFromUrl(window.location.search) || parseOAuthErrorFromUrl(window.location.hash);
    if (oauthError.hasError) {
      showToast(oauthError.errorDescription || 'Authentication was cancelled or failed.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (window.location.hash.includes('type=recovery')) {
      setAuthModalMode('recovery');
      setIsAuthOpen(true);
      showToast('Password recovery token detected. Please set your new password.');
    }
  }, []);

  // Listen for Supabase session and auth changes
  useEffect(() => {
    if (!isLiveBackendConfigured || !supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await ensureUserProfileExists(session.user);
        setCurrentUser(user);
      }
    }).catch(err => {
      console.warn('[Supabase Session Check Notice]', err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalMode('recovery');
        setIsAuthOpen(true);
        showToast('Password recovery link confirmed. Please enter your new password.');
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('aashvo_current_user');
      } else if (session?.user) {
        const user = await ensureUserProfileExists(session.user);
        setCurrentUser(user);
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

  const loginAs = (_role: 'renter' | 'owner' | 'broker', _name?: string) => {
    // Demo persona logins decommissioned for production release
    console.warn('[Security Notice] Demo persona logins are decommissioned in production.');
  };

  const logout = () => {
    if (isLiveBackendConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem('aashvo_current_user');
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
    const authCheck = canPerformAdminAction(currentUser, 'resolve_report');
    if (!authCheck.allowed) {
      showToast(`Unauthorized: ${authCheck.reason}`);
      return;
    }

    setReports(prev =>
      prev.map(r => (r.id === reportId ? { ...r, status: 'resolved' as const } : r))
    );
    showToast('Report marked as resolved by safety team.');
  };

  const updatePropertyStatus = (id: string, status: ListingStatus) => {
    const authCheck = canPerformAdminAction(currentUser, 'update_property_status');
    if (!authCheck.allowed) {
      showToast(`Unauthorized: ${authCheck.reason}`);
      return;
    }

    const previousProperty = properties.find(p => p.id === id);
    const previousStatus = previousProperty?.status;

    setProperties(prev =>
      prev.map(p => (p.id === id ? { ...p, status, lastVerifiedDate: new Date().toISOString() } : p))
    );

    if (isLiveBackendConfigured && supabase) {
      updateListingStatusInSupabase(id, status).then(res => {
        if (res.success) {
          showToast(`Listing status updated to ${status.toUpperCase()}`);
        } else {
          // Revert optimistic update on failure
          if (previousStatus) {
            setProperties(prev =>
              prev.map(p => (p.id === id ? { ...p, status: previousStatus } : p))
            );
          }
          showToast(`Status update failed: ${res.error || 'Server authorization rejected change'}`);
        }
      }).catch(err => {
        console.warn('[Supabase Listing Status Update Notice]', err);
        if (previousStatus) {
          setProperties(prev =>
            prev.map(p => (p.id === id ? { ...p, status: previousStatus } : p))
          );
        }
        showToast('Network error updating listing status.');
      });
    } else {
      showToast(`Listing status updated to ${status.toUpperCase()} (Preview mode)`);
    }
  };

  const addProperty = async (newPropData: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>): Promise<boolean> => {
    const newProp: Property = {
      ...newPropData,
      id: `prop-${Date.now()}`,
      status: 'pending_review', // Default to pending review for safety
      lastVerifiedDate: new Date().toISOString(),
    };
    if (isLiveBackendConfigured && supabase) {
      if (!currentUser || currentUser.isDemo) {
        showToast('Please sign in with a verified account to publish a listing.');
        return false;
      }
      const res = await createPropertyInSupabase(newPropData, currentUser);
      if (!res.success || !res.property) {
        showToast(`Listing submission failed: ${res.errors?.join(' ') || 'Please try again.'}`);
        return false;
      }
      setProperties(prev => [res.property!, ...prev]);
      setIsListPropertyOpen(false);
      showToast('🎉 Property submitted to moderation queue for verification!');
      return true;
    }

    setProperties(prev => [newProp, ...prev]);
    setIsListPropertyOpen(false);
    showToast('Listing saved to local draft preview (Cloud synchronization offline in prototype mode).');
    return true;
  };

  const submitConnectRequest = async (reqData: Omit<ConnectRequest, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string }> => {
    const newReq: ConnectRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (isLiveBackendConfigured && supabase && !currentUser?.isDemo) {
      if (!currentUser) {
        const error = 'Please sign in before sending an inquiry.';
        showToast(error);
        return { success: false, error };
      }
      const isFlatmate = reqData.targetType === 'flatmate';
      const res = await submitInquiryInSupabase({
        listingId: isFlatmate ? undefined : reqData.targetId,
        targetFlatmateId: isFlatmate ? reqData.targetId : undefined,
        senderId: currentUser.id,
        senderName: reqData.senderName,
        senderEmail: reqData.senderEmail,
        senderPhone: reqData.senderPhone,
        message: reqData.message,
        moveInDate: reqData.moveInDate,
      });
      if (!res.success) {
        const error = res.error || 'Please complete verification before sending inquiries.';
        showToast(`Inquiry dispatch failed: ${error}`);
        return { success: false, error };
      }
      setConnectRequests(prev => [newReq, ...prev]);
      showToast(isFlatmate ? 'Direct connection request dispatched to flatmate!' : 'Direct inquiry dispatched to host!');
      return { success: true };
    }

    setConnectRequests(prev => [newReq, ...prev]);
    showToast('Direct inquiry recorded in local preview (Live notifications activate upon Supabase configuration).');
    return { success: true };
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
        authModalMode,
        setAuthModalMode,
        openAuthModal: (mode: 'signin' | 'signup' | 'forgot' | 'recovery' = 'signin') => {
          setAuthModalMode(mode);
          setIsAuthOpen(true);
        },
        isHelpOpen,
        setIsHelpOpen,
        isRentalTrustOpen,
        setIsRentalTrustOpen,
        isConnectOpen,
        setIsConnectOpen,
        connectInitialTab,
        openConnectModal: (tab?: 'discover' | 'matches' | 'chat' | 'settings') => {
          if (tab) setConnectInitialTab(tab);
          setIsConnectOpen(true);
        },
        isMyActivityOpen,
        setIsMyActivityOpen,
        myActivityInitialTab,
        openMyActivityModal: (tab?: 'visits' | 'agreements' | 'checklists' | 'verifications') => {
          if (tab) setMyActivityInitialTab(tab);
          setIsMyActivityOpen(true);
        },
        isCalculatorOpen,
        setIsCalculatorOpen,
        isSavedOpen,
        setIsSavedOpen,
        marketplaceProfiles,
        activeMarketplaceProfile,
        switchMarketplaceProfile,
        refreshMarketplaceProfiles,
        isMyProfileOpen,
        setIsMyProfileOpen,
        openMyProfileModal,
        isOnboardingOpen,
        setIsOnboardingOpen,
        openOnboardingModal,
        onboardingInitialStep,
        profileCompletion,
        refreshProfileCompletion,
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
        isLoadingData,
        dataLoadError,
        retryDataLoad,
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
