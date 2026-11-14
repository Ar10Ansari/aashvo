import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatINR, getFreshnessInfo } from '../../utils/formatters';
import { FAQ_CATEGORY_LABELS } from '../../data/faqData';
import { TicketStatus, TicketPriority } from '../../types';
import { canTransitionTicketStatus } from '../../services/supportService';
import { isTrustedAdminSession } from '../../services/authorizationService';
import { reviewPropertyVerification } from '../../services/marketplaceService';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Headphones,
  Send,
  History,
  UserCheck,
  Award,
} from 'lucide-react';

interface AdminModerationModalProps {
  onClose: () => void;
}

export const AdminModerationModal: React.FC<AdminModerationModalProps> = ({ onClose }) => {
  const {
    currentUser,
    properties,
    updatePropertyStatus,
    safetyReports,
    resolveSafetyReport,
    supportTickets,
    addTicketMessage,
    updateTicketStatus,
    updateTicketPriority,
    assignTicket,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'listings' | 'reports' | 'tickets'>('tickets');

  // Support Ticket Filters
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Admin Reply State
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');

  // Unauthorized Access Check: Database / RLS authorization guard
  // Demo personas and unauthenticated localStorage modifications are rejected unconditionally
  const isAdmin = isTrustedAdminSession(currentUser);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return supportTickets.filter(t => {
      const matchesStatus = ticketStatusFilter === 'all' || t.status === ticketStatusFilter;
      const matchesPriority = ticketPriorityFilter === 'all' || t.priority === ticketPriorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [supportTickets, ticketStatusFilter, ticketPriorityFilter]);

  // Selected Active Ticket
  const activeTicket = useMemo(() => {
    if (selectedTicketId) {
      return supportTickets.find(t => t.id === selectedTicketId) || null;
    }
    if (filteredTickets.length > 0) {
      return filteredTickets[0];
    }
    return null;
  }, [selectedTicketId, supportTickets, filteredTickets]);

  const handleApprove = (id: string) => {
    if (!isAdmin) {
      showToast('Action blocked: Verified staff credentials required.');
      return;
    }
    updatePropertyStatus(id, 'active');
  };

  const handlePause = (id: string) => {
    if (!isAdmin) {
      showToast('Action blocked: Verified staff credentials required.');
      return;
    }
    updatePropertyStatus(id, 'paused');
  };

  const handleMarkRented = (id: string) => {
    if (!isAdmin) {
      showToast('Action blocked: Verified staff credentials required.');
      return;
    }
    updatePropertyStatus(id, 'rented');
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Action blocked: Verified staff credentials required.');
      return;
    }
    if (!activeTicket || !adminReplyText.trim()) return;

    const ok = await addTicketMessage(
      activeTicket.id,
      adminReplyText.trim(),
      isInternalNote,
      isInternalNote ? 'admin' : 'support'
    );

    if (ok) {
      setAdminReplyText('');
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!isAdmin) {
      showToast('Action blocked: Verified staff credentials required.');
      return;
    }
    if (!activeTicket) return;
    if (!canTransitionTicketStatus(activeTicket.status, newStatus)) {
      showToast(`Cannot transition ticket from ${activeTicket.status.toUpperCase()} to ${newStatus.toUpperCase()}`);
      return;
    }

    const ok = await updateTicketStatus(activeTicket.id, newStatus, transitionNotes.trim() || undefined);
    if (ok) {
      setTransitionNotes('');
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Open</span>;
      case 'in_review':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">In Review</span>;
      case 'awaiting_user':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Awaiting User</span>;
      case 'resolved':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Resolved</span>;
      case 'closed':
        return <span className="bg-charcoal-100 text-charcoal-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Closed</span>;
    }
  };

  const handleVerifyProperty = async (propertyId: string) => {
    try {
      const res = await reviewPropertyVerification(propertyId, {
        status: 'verified',
        reviewNotes: 'Verified by compliance officer',
      });
      if (res.success && showToast) {
        showToast('Property verified and badge granted!');
      }
    } catch {
      if (showToast) showToast('Verification update failed');
    }
  };

  // Priority Badge Helper
  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Urgent</span>;
      case 'high':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">High</span>;
      case 'normal':
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded uppercase">Normal</span>;
      case 'low':
        return <span className="bg-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded uppercase">Low</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-admin-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-900 text-white">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-sand-300" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="modal-admin-title" className="font-serif text-base sm:text-lg font-bold">
                  Aashvo Trust, Safety & Support Operations Console
                </h2>
                <span className="text-[10px] bg-forest-700 text-sand-200 px-2 py-0.5 rounded-full font-semibold uppercase">
                  Staff Only
                </span>
              </div>
              <p className="text-[11px] text-charcoal-400">
                Logged in as: {currentUser?.name || 'Anonymous'} ({currentUser?.role || 'Guest'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-charcoal-400 hover:text-white rounded-full hover:bg-charcoal-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Authorization Gate: Non-admin users cannot inspect admin data or internal notes */}
        {!isAdmin ? (
          <div className="p-8 sm:p-12 text-center space-y-4 max-w-md mx-auto my-auto">
            <div className="w-14 h-14 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal-900">
                Unauthorized Admin Access Attempt
              </h3>
              <p className="text-xs text-charcoal-600 mt-2 leading-relaxed">
                You are currently signed in as <strong>{currentUser?.role || 'Guest'}</strong>. In accordance with Aashvo security architecture and PostgreSQL Row Level Security policies, the admin console, safety queues, and confidential staff notes are restricted to verified staff identities.
              </p>
            </div>

            <div className="p-3 bg-ivory-100 rounded-xl border border-charcoal-200 text-[11px] text-charcoal-600 text-left">
              <span className="font-bold text-charcoal-900">Security Rule: </span>
              Ordinary users cannot grant themselves administrative privileges or bypass backend RLS filters.
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors"
            >
              Return to Public Portal
            </button>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div className="bg-ivory-100 px-6 py-2.5 border-b border-charcoal-200/50 flex flex-wrap gap-2 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('tickets')}
                className={`py-2 px-3.5 rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'tickets'
                    ? 'bg-white text-forest-900 shadow-sm font-bold border border-charcoal-200/40'
                    : 'text-charcoal-500 hover:text-charcoal-800'
                }`}
              >
                <Headphones className="w-4 h-4 text-forest-700" />
                <span>Support Tickets ({supportTickets.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-3.5 rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'reports'
                    ? 'bg-white text-red-700 shadow-sm font-bold border border-charcoal-200/40'
                    : 'text-charcoal-500 hover:text-charcoal-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Safety Reports Queue ({safetyReports.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('listings')}
                className={`py-2 px-3.5 rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'listings'
                    ? 'bg-white text-forest-900 shadow-sm font-bold border border-charcoal-200/40'
                    : 'text-charcoal-500 hover:text-charcoal-800'
                }`}
              >
                <span>Inventory Moderation ({properties.length})</span>
              </button>
            </div>

            {/* Scrollable Moderation Area */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* TAB 1: SUPPORT TICKETS CONSOLE */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  {/* Filter Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-ivory-50 border border-charcoal-200/60 rounded-2xl">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-charcoal-700">Filter Status:</span>
                      <select
                        value={ticketStatusFilter}
                        onChange={e => setTicketStatusFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-charcoal-200 rounded-lg text-xs"
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="awaiting_user">Awaiting User</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-charcoal-700">Filter Priority:</span>
                      <select
                        value={ticketPriorityFilter}
                        onChange={e => setTicketPriorityFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-charcoal-200 rounded-lg text-xs"
                      >
                        <option value="all">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div className="text-xs text-charcoal-500 font-medium">
                      Showing {filteredTickets.length} of {supportTickets.length} ticket(s)
                    </div>
                  </div>

                  {/* 2-Column Layout: Ticket List & Ticket Inspector */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    {/* Left Column: Tickets Queue (4 cols) */}
                    <div className="md:col-span-5 space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                      {filteredTickets.length === 0 ? (
                        <div className="p-8 text-center bg-ivory-50 rounded-2xl border border-charcoal-200/60 text-xs text-charcoal-400">
                          No tickets match the selected filters.
                        </div>
                      ) : (
                        filteredTickets.map(tkt => {
                          const isSelected = activeTicket?.id === tkt.id;
                          return (
                            <div
                              key={tkt.id}
                              onClick={() => setSelectedTicketId(tkt.id)}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-forest-50/60 border-forest-600 ring-2 ring-forest-600/20'
                                  : 'bg-white border-charcoal-200/80 hover:border-forest-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-xs font-bold text-forest-900">
                                  {tkt.ticketNumber}
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  {getPriorityBadge(tkt.priority)}
                                  {getStatusBadge(tkt.status)}
                                </div>
                              </div>

                              <h4 className="font-serif font-bold text-xs text-charcoal-900 truncate">
                                {tkt.subject}
                              </h4>
                              <p className="text-[11px] text-charcoal-500 truncate mt-0.5">
                                From: {tkt.userName} ({tkt.userEmail})
                              </p>

                              <div className="mt-2 pt-2 border-t border-charcoal-100 flex items-center justify-between text-[10px] text-charcoal-400">
                                <span>{FAQ_CATEGORY_LABELS[tkt.category] || tkt.category}</span>
                                <span>{new Date(tkt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Right Column: Ticket Inspector, Actions, Messages & Internal Notes (7 cols) */}
                    <div className="md:col-span-7 border border-charcoal-200 rounded-2xl bg-white overflow-hidden flex flex-col max-h-[520px]">
                      {activeTicket ? (
                        <>
                          {/* Ticket Header & Metadata */}
                          <div className="p-4 bg-charcoal-50 border-b border-charcoal-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-mono text-xs font-bold text-forest-900">
                                  {activeTicket.ticketNumber}
                                </span>
                                <h3 className="font-serif font-bold text-sm text-charcoal-900">
                                  {activeTicket.subject}
                                </h3>
                                <p className="text-xs text-charcoal-600">
                                  Reporter: <strong>{activeTicket.userName}</strong> ({activeTicket.userEmail})
                                  {activeTicket.userPhone && ` • ${activeTicket.userPhone}`}
                                </p>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                {getPriorityBadge(activeTicket.priority)}
                                {getStatusBadge(activeTicket.status)}
                              </div>
                            </div>

                            {/* Control Strip: Change Status & Assignee */}
                            <div className="pt-2 border-t border-charcoal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-bold text-charcoal-700">Transition Status:</span>
                                <select
                                  value={activeTicket.status}
                                  onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                                  disabled={activeTicket.status === 'closed'}
                                  className="px-2 py-1 bg-white border border-charcoal-200 rounded-lg text-xs font-semibold disabled:opacity-50"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_review">In Review</option>
                                  <option value="awaiting_user">Awaiting User</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="closed">Closed (Terminal)</option>
                                </select>
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-bold text-charcoal-700">Priority:</span>
                                <select
                                  value={activeTicket.priority}
                                  onChange={e => updateTicketPriority(activeTicket.id, e.target.value as TicketPriority)}
                                  className="px-2 py-1 bg-white border border-charcoal-200 rounded-lg text-xs"
                                >
                                  <option value="urgent">Urgent</option>
                                  <option value="high">High</option>
                                  <option value="normal">Normal</option>
                                  <option value="low">Low</option>
                                </select>
                              </div>

                              <button
                                onClick={() => assignTicket(activeTicket.id, currentUser?.id || 'usr-001', currentUser?.name || 'Staff')}
                                className="px-2 py-1 bg-ivory-100 border border-charcoal-200 rounded-lg text-[11px] font-semibold text-charcoal-700 hover:bg-ivory-200 flex items-center space-x-1"
                              >
                                <UserCheck className="w-3 h-3 text-forest-700" />
                                <span>Assign to Me</span>
                              </button>
                            </div>
                          </div>

                          {/* Message and Audit History Scrollable Feed */}
                          <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-ivory-50/30">
                            {/* Description */}
                            <div className="p-3 rounded-xl bg-white border border-charcoal-200 text-xs">
                              <span className="font-bold text-charcoal-800">Initial Description:</span>
                              <p className="mt-1 text-charcoal-700 leading-relaxed whitespace-pre-wrap">{activeTicket.description}</p>
                            </div>

                            {/* Thread Messages */}
                            {activeTicket.messages.map(msg => (
                              <div
                                key={msg.id}
                                className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                                  msg.isInternal
                                    ? 'bg-amber-50 border-amber-300 text-amber-950 ring-1 ring-amber-300/50'
                                    : msg.senderRole === 'support' || msg.senderRole === 'admin'
                                    ? 'bg-forest-50 border-forest-200 text-forest-950 ml-6'
                                    : 'bg-white border-charcoal-200 mr-6 text-charcoal-900'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1 text-[10px]">
                                  <div className="flex items-center space-x-1.5 font-bold">
                                    {msg.isInternal ? (
                                      <>
                                        <Lock className="w-3 h-3 text-amber-700" />
                                        <span className="text-amber-800 uppercase">Internal Staff Note (Confidential)</span>
                                      </>
                                    ) : (
                                      <span>{msg.senderName} ({msg.senderRole})</span>
                                    )}
                                  </div>
                                  <span className="text-charcoal-400">
                                    {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap">{msg.message}</p>
                              </div>
                            ))}

                            {/* Audit Trail Timeline */}
                            {activeTicket.auditEvents && activeTicket.auditEvents.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-charcoal-200">
                                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-charcoal-600 mb-2">
                                  <History className="w-3.5 h-3.5" />
                                  <span>Auditable Action Log ({activeTicket.auditEvents.length})</span>
                                </div>
                                <div className="space-y-1.5">
                                  {activeTicket.auditEvents.map(evt => (
                                    <div key={evt.id} className="text-[10px] text-charcoal-500 bg-white p-2 rounded-lg border border-charcoal-100 flex items-center justify-between">
                                      <span>
                                        <strong>{evt.actorName || 'Staff'}</strong> performed{' '}
                                        <code className="bg-ivory-100 px-1 py-0.5 rounded text-charcoal-700">{evt.action}</code>
                                        {evt.notes && ` (${evt.notes})`}
                                      </span>
                                      <span className="text-charcoal-400 shrink-0">
                                        {new Date(evt.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Admin Reply Composer with Toggle for Internal Note */}
                          <div className="p-3 bg-white border-t border-charcoal-200">
                            {activeTicket.status === 'closed' ? (
                              <div className="p-2 text-center text-xs text-charcoal-500 bg-charcoal-50 rounded-xl">
                                Ticket is Closed. Status must be reopened before adding further replies.
                              </div>
                            ) : (
                              <form onSubmit={handleSendAdminReply} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <label className="flex items-center space-x-1.5 text-xs font-semibold cursor-pointer">
                                      <input
                                        type="radio"
                                        name="noteType"
                                        checked={!isInternalNote}
                                        onChange={() => setIsInternalNote(false)}
                                        className="text-forest-800"
                                      />
                                      <span className="text-charcoal-700">Public Reply to User</span>
                                    </label>

                                    <label className="flex items-center space-x-1.5 text-xs font-semibold cursor-pointer">
                                      <input
                                        type="radio"
                                        name="noteType"
                                        checked={isInternalNote}
                                        onChange={() => setIsInternalNote(true)}
                                        className="text-amber-600"
                                      />
                                      <span className="text-amber-800 flex items-center space-x-1">
                                        <Lock className="w-3 h-3" />
                                        <span>Internal Staff Note</span>
                                      </span>
                                    </label>
                                  </div>

                                  <span className="text-[10px] text-charcoal-400">
                                    {isInternalNote ? 'Strictly hidden from users' : 'Sent to user’s tracker & email'}
                                  </span>
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={adminReplyText}
                                    onChange={e => setAdminReplyText(e.target.value)}
                                    placeholder={
                                      isInternalNote
                                        ? 'Add private internal staff observation or investigation note...'
                                        : 'Type response to user...'
                                    }
                                    className={`flex-1 px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 ${
                                      isInternalNote
                                        ? 'bg-amber-50/50 border-amber-300 focus:ring-amber-500'
                                        : 'bg-white border-charcoal-200 focus:ring-forest-600'
                                    }`}
                                  />
                                  <button
                                    type="submit"
                                    disabled={!adminReplyText.trim()}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 flex items-center space-x-1 ${
                                      isInternalNote
                                        ? 'bg-amber-700 hover:bg-amber-800'
                                        : 'bg-forest-900 hover:bg-forest-800'
                                    }`}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isInternalNote ? 'Save Note' : 'Send'}</span>
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="p-8 text-center text-charcoal-400 text-xs my-auto">
                          Select a ticket from the left queue to view details and respond.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SAFETY REPORTS QUEUE */}
              {activeTab === 'reports' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-center justify-between">
                    <span>
                      High-priority safety and fraud reports are automatically highlighted for expedited editorial review.
                    </span>
                    <span className="font-bold">Total Reports: {safetyReports.length}</span>
                  </div>

                  {safetyReports.length === 0 ? (
                    <div className="p-8 text-center text-charcoal-400 text-xs">
                      Zero pending safety reports. Safety queue is pristine.
                    </div>
                  ) : (
                    safetyReports.map(rep => (
                      <div
                        key={rep.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          rep.status === 'resolved' || rep.status === 'dismissed'
                            ? 'border-emerald-200 bg-emerald-50/30 opacity-80'
                            : rep.priority === 'urgent'
                            ? 'border-red-300 bg-red-50/60'
                            : 'border-amber-200 bg-amber-50/30'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-charcoal-900">{rep.reasonLabel}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                rep.priority === 'urgent'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rep.priority} Priority
                            </span>
                            <span className="text-[10px] bg-charcoal-100 text-charcoal-700 px-2 py-0.5 rounded-full uppercase font-semibold">
                              {rep.status}
                            </span>
                          </div>

                          <p className="text-xs text-charcoal-700 font-medium">
                            Flagged Record: <strong>{rep.targetTitle}</strong> ({rep.targetType} • ID: {rep.targetId})
                          </p>

                          <p className="text-xs text-charcoal-600 italic bg-white/70 p-2 rounded-xl border border-charcoal-200/50 mt-1">
                            &quot;{rep.details}&quot;
                          </p>

                          <div className="text-[10px] text-charcoal-400 flex items-center space-x-3 pt-1">
                            <span>Reporter: {rep.reporterName} ({rep.reporterEmail})</span>
                            <span>Date: {new Date(rep.createdAt).toLocaleString()}</span>
                            {rep.reviewedBy && <span>Reviewed by: {rep.reviewedBy}</span>}
                          </div>
                        </div>

                        {rep.status === 'pending' || rep.status === 'investigating' ? (
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => resolveSafetyReport(rep.id, 'resolved', 'Verified and addressed')}
                              className="px-3 py-1.5 bg-forest-900 text-white rounded-xl text-xs font-semibold hover:bg-forest-800 transition-colors"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => resolveSafetyReport(rep.id, 'dismissed', 'Insufficient evidence or resolved')}
                              className="px-3 py-1.5 bg-white border border-charcoal-200 text-charcoal-700 rounded-xl text-xs font-semibold hover:bg-charcoal-50 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 px-3 py-1.5 rounded-xl shrink-0">
                            ✓ {rep.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: INVENTORY MODERATION */}
              {activeTab === 'listings' && (
                <div className="space-y-3">
                  {properties.map(p => {
                    const fresh = getFreshnessInfo(p.lastVerifiedDate);
                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-2xl border border-charcoal-200/80 bg-white hover:border-forest-400 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3.5">
                          <img src={p.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover bg-ivory-300" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-serif font-bold text-sm text-charcoal-900">{p.title}</h4>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  p.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'rented'
                                    ? 'bg-charcoal-100 text-charcoal-600'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {p.status}
                              </span>
                            </div>
                            <p className="text-xs text-charcoal-500 mt-0.5">
                              {p.locality} • Rent: {formatINR(p.rent)} • Deposit: {formatINR(p.deposit)} • Provider: {p.providerName} ({p.providerType})
                            </p>
                            <span className="text-[10px] text-charcoal-400 mt-0.5 block">
                              Last Freshness Check: {fresh.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          {p.status !== 'active' && (
                            <button
                              onClick={() => handleApprove(p.id)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              Approve / Active
                            </button>
                          )}

                          {p.status === 'active' && (
                            <button
                              onClick={() => handlePause(p.id)}
                              className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-200 transition-colors"
                            >
                              Pause for Review
                            </button>
                          )}

                          {p.status !== 'rented' && (
                            <button
                              onClick={() => handleMarkRented(p.id)}
                              className="px-3 py-1.5 bg-charcoal-100 text-charcoal-700 rounded-xl text-xs font-semibold hover:bg-charcoal-200 transition-colors"
                            >
                              Mark Rented
                            </button>
                          )}

                          <button
                            onClick={() => handleVerifyProperty(p.id)}
                            className="px-3 py-1.5 bg-forest-800 text-white rounded-xl text-xs font-semibold hover:bg-forest-900 transition-colors flex items-center space-x-1"
                            title="Verify property ownership proof"
                          >
                            <Award className="w-3.5 h-3.5 text-sand-300" />
                            <span>Verify Docs</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
