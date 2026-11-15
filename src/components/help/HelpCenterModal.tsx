import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { FAQ_ITEMS, FAQ_CATEGORY_LABELS, SAFETY_GUIDELINES } from '../../data/faqData';
import { SupportTicket, TicketCategory, TicketStatus } from '../../types';
import {
  validateTicketSubmission,
  validateTicketAttachment,
  fetchGuestSupportTicketFromSupabase,
} from '../../services/supportService';
import { isLiveBackendConfigured } from '../../services/supabase';
import {
  X,
  Search,
  HelpCircle,
  MessageSquare,
  SearchCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CheckCircle2,
  Copy,
  Clock,
  Send,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react';

interface HelpCenterModalProps {
  onClose: () => void;
  initialTab?: 'faqs' | 'contact' | 'track';
  prefilledListingId?: string;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  onClose,
  initialTab = 'faqs',
  prefilledListingId,
}) => {
  const {
    currentUser,
    supportTickets,
    createSupportTicket,
    addTicketMessage,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'faqs' | 'contact' | 'track'>(initialTab);

  // FAQ state
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-safe-1');

  // Contact Support Form State
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [category, setCategory] = useState<TicketCategory>('finding_flatmates');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [listingId, setListingId] = useState(prefilledListingId || '');
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string; dataUrl?: string }>>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(null);

  // Ticket Tracking State
  const [guestTicketNumber, setGuestTicketNumber] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestLookupError, setGuestLookupError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [guestTicket, setGuestTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter(faq => {
      const matchesCategory = faqCategory === 'all' || faq.category === faqCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (faq.keywords || []).some((k: string) => k.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [faqCategory, searchQuery]);

  // User's tickets (authenticated)
  const myTickets = useMemo(() => {
    if (!currentUser) return [];
    return supportTickets.filter(
      t => t.userId === currentUser.id || t.userEmail.toLowerCase() === currentUser.email.toLowerCase()
    );
  }, [supportTickets, currentUser]);

  // Selected Ticket for details/conversation view
  const activeTicket = useMemo(() => {
    if (selectedTicketId) {
      return supportTickets.find(t => t.id === selectedTicketId || t.ticketNumber === selectedTicketId) || guestTicket;
    }
    if (myTickets.length > 0) {
      return myTickets[0];
    }
    return null;
  }, [selectedTicketId, supportTickets, myTickets, guestTicket]);

  // File Upload Handler with strict size & MIME checks
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 3) {
      setAttachmentError('Maximum 3 attachments allowed per ticket.');
      return;
    }

    const newAttachments: Array<{ name: string; size: number; type: string; dataUrl?: string }> = [];

    Array.from(files).forEach(file => {
      const validation = validateTicketAttachment(file.size, file.type);
      if (!validation.isValid) {
        setAttachmentError(`${file.name}: ${validation.error}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string,
        });
        if (newAttachments.length === files.length) {
          setAttachments(prev => [...prev, ...newAttachments].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  // Submit Support Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const validation = validateTicketSubmission({
      name,
      email,
      phone,
      category,
      subject,
      description,
      attachmentsCount: attachments.length,
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = createSupportTicket(
        {
          userId: currentUser?.id,
          userName: name.trim(),
          userEmail: email.trim().toLowerCase(),
          userPhone: phone.trim() || undefined,
          category,
          subject: subject.trim(),
          description: description.trim(),
          referenceListingId: listingId.trim() || undefined,
          attachments: attachments.map((att, i) => ({
            id: `att-${Date.now()}-${i}`,
            name: att.name,
            size: att.size,
            type: att.type,
            url: att.dataUrl || '#',
            fileName: att.name,
            fileSize: att.size,
            fileType: att.type,
            fileUrl: att.dataUrl || '#',
            uploadedAt: new Date().toISOString(),
          })),
        },
        description.trim()
      );
      const persistedTicket = await ticket;
      setIsSubmitting(false);
      setCreatedTicketNumber(persistedTicket.ticketNumber);
      setSelectedTicketId(persistedTicket.id);
    } catch (err) {
      setIsSubmitting(false);
      setFormErrors([err instanceof Error ? err.message : 'Support ticket submission failed.']);
    }
  };

  // Guest Ticket Lookup
  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestLookupError(null);

    const trimmedNumber = guestTicketNumber.trim().toUpperCase();
    const trimmedEmail = guestEmail.trim().toLowerCase();

    if (!trimmedNumber || !trimmedEmail) {
      setGuestLookupError('Please enter both your Ticket Reference Number and the email used when submitting.');
      return;
    }

    if (isLiveBackendConfigured) {
      const result = await fetchGuestSupportTicketFromSupabase(trimmedNumber, trimmedEmail);
      if (result.success && result.ticket) {
        setGuestTicket(result.ticket);
        setSelectedTicketId(result.ticket.id);
        return;
      }
      setGuestLookupError(result.error || 'No matching ticket found for that Reference Number and Email combination.');
      return;
    }

    const matched = supportTickets.find(
      t => t.ticketNumber.toUpperCase() === trimmedNumber && t.userEmail.toLowerCase() === trimmedEmail
    );

    if (matched) {
      setSelectedTicketId(matched.id);
    } else {
      setGuestLookupError('No matching ticket found for that Reference Number and Email combination.');
    }
  };

  // Add User Reply to Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyMessage.trim()) return;

    if (activeTicket.status === 'closed') {
      showToast('This ticket is closed. Please submit a new ticket for any new inquiries.');
      return;
    }

    const trimmedReply = replyMessage.trim();
    setIsReplying(true);
    try {
      const sent = await addTicketMessage(activeTicket.id, trimmedReply, false, 'user', {
        ticketNumber: activeTicket.ticketNumber,
        userEmail: activeTicket.userEmail,
        senderName: activeTicket.userName,
      });

      if (sent) {
        if (guestTicket && guestTicket.id === activeTicket.id) {
          setGuestTicket(prev =>
            prev
              ? {
                  ...prev,
                  status: prev.status === 'awaiting_user' ? 'in_review' : prev.status,
                  messages: [
                    ...prev.messages,
                    {
                      id: `msg-${Date.now()}`,
                      ticketId: prev.id,
                      senderName: prev.userName,
                      senderRole: 'user',
                      message: trimmedReply,
                      isInternal: false,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : prev
          );
        }
        setReplyMessage('');
      }
    } finally {
      setIsReplying(false);
    }
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">Open</span>;
      case 'in_review':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">In Review</span>;
      case 'awaiting_user':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">Awaiting Your Reply</span>;
      case 'resolved':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">Resolved</span>;
      case 'closed':
        return <span className="bg-charcoal-100 text-charcoal-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">Closed</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-center-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-forest-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center border border-forest-700">
              <HelpCircle className="w-5 h-5 text-sand-300" />
            </div>
            <div>
              <h2 id="help-center-title" className="font-serif text-lg font-bold">
                Aashvo Help Centre & Community Safety
              </h2>
              <p className="text-xs text-forest-200">
                Verified answers, anti-fraud guidelines & transparent support tracking
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-forest-300 hover:text-white rounded-full hover:bg-forest-800 transition-colors"
            aria-label="Close Help Centre"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-ivory-100 px-6 py-2.5 border-b border-charcoal-200/50 flex flex-wrap gap-2 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('faqs');
              setCreatedTicketNumber(null);
            }}
            className={`py-2 px-4 rounded-xl transition-all flex items-center space-x-2 ${
              activeTab === 'faqs'
                ? 'bg-white text-forest-900 shadow-sm font-bold border border-charcoal-200/40'
                : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <SearchCheck className="w-4 h-4 text-forest-700" />
            <span>Search FAQs & Safety</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('contact');
              setCreatedTicketNumber(null);
            }}
            className={`py-2 px-4 rounded-xl transition-all flex items-center space-x-2 ${
              activeTab === 'contact'
                ? 'bg-white text-forest-900 shadow-sm font-bold border border-charcoal-200/40'
                : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-forest-700" />
            <span>Contact Support</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('track');
              setCreatedTicketNumber(null);
            }}
            className={`py-2 px-4 rounded-xl transition-all flex items-center space-x-2 ${
              activeTab === 'track'
                ? 'bg-white text-forest-900 shadow-sm font-bold border border-charcoal-200/40'
                : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <Clock className="w-4 h-4 text-forest-700" />
            <span>
              Track Your Ticket {myTickets.length > 0 && `(${myTickets.length})`}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: FAQs & Safety Guidelines */}
          {activeTab === 'faqs' && (
            <div className="space-y-6">
              {/* Prominent Anti-Scam Banner */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4.5 text-charcoal-800">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-serif font-bold text-sm text-amber-950">
                      Crucial Safety Advisory: Zero Advance Payments Without Visiting
                    </h3>
                    <p className="text-xs text-amber-900/90 leading-relaxed">
                      Never transfer advance booking tokens, gate pass fees or deposit money via UPI before physically visiting the room or verifying the host. Aashvo never asks you to scan a QR code to “receive” refunds or verification. Keep all initial coordination on trusted channels.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-medium text-amber-900">
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Masked contact details until authorized</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Pure vegetarian / diet tags checked</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Realistic human review (No false 24/7 bots)</span>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search questions (e.g. advance deposit, vegetarian kitchen, ID verification, flatmate chat)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-ivory-50 border border-charcoal-200 rounded-xl text-xs text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-400 hover:text-charcoal-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFaqCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    faqCategory === 'all'
                      ? 'bg-forest-900 text-white'
                      : 'bg-ivory-100 text-charcoal-600 hover:bg-ivory-200'
                  }`}
                >
                  All Questions ({FAQ_ITEMS.length})
                </button>
                {Object.entries(FAQ_CATEGORY_LABELS).map(([catKey, label]) => {
                  const count = FAQ_ITEMS.filter(f => f.category === catKey).length;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setFaqCategory(catKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        faqCategory === catKey
                          ? 'bg-forest-900 text-white'
                          : 'bg-ivory-100 text-charcoal-600 hover:bg-ivory-200'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* FAQ Accordion List */}
              <div className="space-y-3">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-10 bg-ivory-50 rounded-2xl border border-charcoal-200/50">
                    <p className="text-sm font-semibold text-charcoal-700">No matching questions found</p>
                    <p className="text-xs text-charcoal-500 mt-1">
                      Try searching with different terms or submit a direct inquiry to our team.
                    </p>
                    <button
                      onClick={() => setActiveTab('contact')}
                      className="mt-4 px-4 py-2 bg-forest-800 text-white text-xs font-bold rounded-xl hover:bg-forest-700"
                    >
                      Submit a Support Ticket
                    </button>
                  </div>
                ) : (
                  filteredFaqs.map(faq => {
                    const isOpen = expandedFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className="border border-charcoal-200/80 rounded-2xl bg-white overflow-hidden transition-all hover:border-forest-300"
                      >
                        <button
                          onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                          className="w-full px-5 py-3.5 text-left flex items-center justify-between gap-4 focus:outline-none"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md">
                              {FAQ_CATEGORY_LABELS[faq.category]}
                            </span>
                            <h4 className="font-serif font-bold text-sm text-charcoal-900 mt-0.5">
                              {faq.question}
                            </h4>
                          </div>
                          <span className="text-charcoal-400 shrink-0">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-4 pt-1 text-xs text-charcoal-700 leading-relaxed border-t border-charcoal-100 bg-ivory-50/50">
                            <p>{faq.answer}</p>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-charcoal-400">
                              <span>Category: {FAQ_CATEGORY_LABELS[faq.category]}</span>
                              <span>Updated Oct 2026</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Safety Rules Reference Footer */}
              <div className="border border-charcoal-200/80 rounded-2xl p-4 bg-white">
                <h4 className="font-serif font-bold text-xs text-charcoal-900 mb-2">
                  Summary of Aashvo Community Trust Principles
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-charcoal-600">
                  {SAFETY_GUIDELINES.map(g => (
                    <div key={g.id} className="p-2.5 rounded-xl bg-ivory-50 border border-charcoal-100">
                      <p className="font-bold text-charcoal-900 text-[11px]">{g.title}</p>
                      <p className="text-[11px] text-charcoal-600 mt-0.5 leading-snug">{g.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Contact Support Form */}
          {activeTab === 'contact' && (
            <div>
              {createdTicketNumber ? (
                /* Ticket Success State */
                <div className="text-center py-10 px-4 bg-emerald-50 border border-emerald-200 rounded-3xl space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-emerald-950">
                      Support Ticket Created Successfully
                    </h3>
                    <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                      Your inquiry has been logged in our queue. Our editorial and support team reviews tickets during standard business hours.
                    </p>
                  </div>

                  <div className="bg-white border border-emerald-300 rounded-2xl p-4 max-w-sm mx-auto shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-charcoal-400">Ticket Reference Code</span>
                      <p className="font-mono text-base font-bold text-forest-900">{createdTicketNumber}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(createdTicketNumber);
                        showToast(`Copied ${createdTicketNumber} to clipboard!`);
                      }}
                      className="p-2 text-forest-800 hover:bg-forest-50 rounded-xl transition-colors"
                      title="Copy ticket code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setActiveTab('track');
                        setCreatedTicketNumber(null);
                      }}
                      className="px-5 py-2.5 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800 shadow-sm"
                    >
                      Track This Ticket Now
                    </button>
                    <button
                      onClick={() => {
                        setCreatedTicketNumber(null);
                        setSubject('');
                        setDescription('');
                        setAttachments([]);
                      }}
                      className="px-4 py-2.5 bg-white border border-charcoal-200 text-charcoal-700 rounded-xl text-xs font-semibold hover:bg-ivory-50"
                    >
                      Submit Another Ticket
                    </button>
                  </div>
                </div>
              ) : (
                /* Contact Form */
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  {/* Notice */}
                  <div className="bg-ivory-100 p-3.5 rounded-xl border border-charcoal-200/60 text-xs text-charcoal-700 flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-forest-800 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Transparent Support Notice: </span>
                      Aashvo is an affordable-living marketplace with human moderation. We review tickets thoroughly and do not operate an automated bot response system or promise unrealistic 24/7 phone SLAs.
                    </div>
                  </div>

                  {/* Errors */}
                  {formErrors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                      <p className="font-bold">Please correct the following errors:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {formErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-800 mb-1">
                        Your Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-800 mb-1">
                        Email Address <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. priya.sharma@example.com"
                        className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-800 mb-1">
                        Phone Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 98112 34567"
                        className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-800 mb-1">
                        Issue Category <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as TicketCategory)}
                        className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                      >
                        {Object.entries(FAQ_CATEGORY_LABELS).map(([catKey, label]) => (
                          <option key={catKey} value={catKey}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Subject / Short Summary <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="e.g. Question regarding refundable deposit on Saket listing"
                      maxLength={120}
                      className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                      required
                    />
                    <div className="flex justify-between text-[10px] text-charcoal-400 mt-1">
                      <span>Be concise and descriptive</span>
                      <span>{subject.length} / 120 chars</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Detailed Description <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe the issue, dates, provider details or questions in detail. Please do NOT include passwords, OTPs, or credit card numbers."
                      maxLength={2000}
                      className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                      required
                    />
                    <div className="flex justify-between text-[10px] text-charcoal-400 mt-1">
                      <span>Never share secret OTPs or bank passwords</span>
                      <span>{description.length} / 2000 chars</span>
                    </div>
                  </div>

                  {/* Relevant Listing Reference (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Relevant Listing ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={listingId}
                      onChange={e => setListingId(e.target.value)}
                      placeholder="e.g. prop-4 (or leave blank if general inquiry)"
                      className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                    />
                  </div>

                  {/* Evidence Attachments Dropzone */}
                  <div>
                    <label className="block text-xs font-bold text-charcoal-800 mb-1">
                      Evidence Attachments (Optional, max 3 files up to 5MB each)
                    </label>

                    <div className="border-2 border-dashed border-charcoal-200 rounded-2xl p-4 text-center bg-ivory-50/50 hover:bg-ivory-50 transition-colors">
                      <input
                        type="file"
                        id="ticket-file-input"
                        multiple
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="ticket-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                      >
                        <Paperclip className="w-5 h-5 text-forest-700" />
                        <span className="text-xs font-semibold text-forest-900">
                          Click to select photos or documents (JPG, PNG, WebP, PDF)
                        </span>
                        <span className="text-[10px] text-charcoal-400">
                          Screenshots of chat, receipts or listing details (max 5MB each)
                        </span>
                      </label>
                    </div>

                    {attachmentError && (
                      <p className="text-xs text-red-600 mt-1.5 font-medium">{attachmentError}</p>
                    )}

                    {/* Attachment Chips */}
                    {attachments.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {attachments.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center space-x-2 bg-white border border-charcoal-200 px-3 py-1.5 rounded-xl text-xs shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-forest-800" />
                            <span className="font-medium text-charcoal-800 max-w-[150px] truncate">{file.name}</span>
                            <span className="text-[10px] text-charcoal-400">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="text-charcoal-400 hover:text-red-600 p-0.5"
                              title="Remove file"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-charcoal-100 flex items-center justify-between">
                    <span className="text-[11px] text-charcoal-400">
                      Unique reference code generated upon submission
                    </span>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Logging Ticket...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Ticket</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: Track Your Ticket */}
          {activeTab === 'track' && (
            <div className="space-y-6">
              {/* Authenticated User Ticket List OR Guest Lookup */}
              {currentUser ? (
                /* Authenticated View */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-serif font-bold text-sm text-charcoal-900">
                        Tickets Submitted by {currentUser.name}
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        {myTickets.length} active or historical ticket(s) linked to {currentUser.email}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab('contact')}
                      className="px-3 py-1.5 bg-forest-900 text-white text-xs font-bold rounded-xl hover:bg-forest-800"
                    >
                      + New Ticket
                    </button>
                  </div>

                  {myTickets.length === 0 ? (
                    <div className="text-center py-8 bg-ivory-50 rounded-2xl border border-charcoal-200/60 space-y-2">
                      <FileText className="w-8 h-8 text-charcoal-400 mx-auto" />
                      <p className="text-sm font-semibold text-charcoal-700">No support tickets found</p>
                      <p className="text-xs text-charcoal-500">
                        You have not submitted any inquiries or tickets yet under this account.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                      {myTickets.map(tkt => {
                        const isSelected = activeTicket?.id === tkt.id;
                        return (
                          <div
                            key={tkt.id}
                            onClick={() => setSelectedTicketId(tkt.id)}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-forest-50/50 border-forest-600 ring-2 ring-forest-600/20'
                                : 'bg-white border-charcoal-200/80 hover:border-forest-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-xs font-bold text-forest-900">
                                {tkt.ticketNumber}
                              </span>
                              {getStatusBadge(tkt.status)}
                            </div>
                            <h4 className="font-bold text-xs text-charcoal-900 truncate">
                              {tkt.subject}
                            </h4>
                            <p className="text-[11px] text-charcoal-500 truncate mt-0.5">
                              {tkt.description}
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-charcoal-100 flex items-center justify-between text-[10px] text-charcoal-400">
                              <span>{FAQ_CATEGORY_LABELS[tkt.category] || tkt.category}</span>
                              <span>{new Date(tkt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Guest Ticket Lookup Form */
                <div className="bg-ivory-50 border border-charcoal-200/80 rounded-2xl p-4.5">
                  <div className="flex items-start space-x-3 mb-3">
                    <Lock className="w-5 h-5 text-forest-800 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-serif font-bold text-sm text-charcoal-900">
                        Track Ticket Without Signing In
                      </h4>
                      <p className="text-xs text-charcoal-600">
                        Enter your Ticket Reference Code and the contact email used when logging the ticket to securely view status and replies.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleGuestLookup} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal-700 mb-1">
                        Ticket Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ASH-TKT-XXXXXX"
                        value={guestTicketNumber}
                        onChange={e => setGuestTicketNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-charcoal-200 rounded-xl text-xs font-mono uppercase"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-charcoal-700 mb-1">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        placeholder="Email used when submitting"
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-charcoal-200 rounded-xl text-xs"
                        required
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors"
                      >
                        Find Ticket
                      </button>
                    </div>
                  </form>

                  {guestLookupError && (
                    <p className="text-xs text-red-600 mt-2 font-medium">{guestLookupError}</p>
                  )}
                </div>
              )}

              {/* Active Ticket Message Thread & Reply Interface */}
              {activeTicket && (
                <div className="border border-charcoal-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                  {/* Ticket Header */}
                  <div className="p-4 bg-charcoal-50 border-b border-charcoal-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-forest-900">
                          {activeTicket.ticketNumber}
                        </span>
                        {getStatusBadge(activeTicket.status)}
                        <span className="text-[10px] bg-charcoal-200 text-charcoal-700 font-semibold px-2 py-0.5 rounded-md">
                          {FAQ_CATEGORY_LABELS[activeTicket.category] || activeTicket.category}
                        </span>
                      </div>
                      <h4 className="font-serif font-bold text-sm text-charcoal-900 mt-1">
                        {activeTicket.subject}
                      </h4>
                      {activeTicket.referenceListingId && (
                        <p className="text-[11px] text-forest-800 mt-0.5 font-medium">
                          Referenced Listing: {activeTicket.referenceListingId}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-charcoal-500">
                      <p>Opened {new Date(activeTicket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-[10px] text-charcoal-400">Assigned: {activeTicket.assignedName || 'Aashvo Support Pool'}</p>
                    </div>
                  </div>

                  {/* Messages Feed (Only public messages for end-users, internal notes strictly excluded!) */}
                  <div className="p-4 space-y-3.5 max-h-80 overflow-y-auto bg-ivory-50/30">
                    {/* Initial Description Card */}
                    <div className="p-3.5 rounded-2xl bg-white border border-charcoal-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="font-bold text-charcoal-900">{activeTicket.userName} (Initial Ticket)</span>
                        <span className="text-charcoal-400">
                          {new Date(activeTicket.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal-800 leading-relaxed whitespace-pre-wrap">
                        {activeTicket.description}
                      </p>

                      {/* Attachments list if any */}
                      {activeTicket.attachments && activeTicket.attachments.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-charcoal-100 flex flex-wrap gap-2">
                          {activeTicket.attachments.map(att => (
                            <span
                              key={att.id}
                              className="inline-flex items-center space-x-1.5 text-[11px] bg-ivory-100 px-2.5 py-1 rounded-lg text-charcoal-700"
                            >
                              <Paperclip className="w-3 h-3 text-forest-700" />
                              <span className="max-w-[140px] truncate">{att.name || att.fileName}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Replies */}
                    {activeTicket.messages
                      .filter(m => !m.isInternal) // Strict client privacy guard
                      .map(msg => {
                        const isSupport = msg.senderRole === 'support' || msg.senderRole === 'admin';
                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-2xl border text-xs leading-relaxed max-w-[85%] ${
                              isSupport
                                ? 'bg-forest-50/70 border-forest-200 ml-auto text-forest-950'
                                : 'bg-white border-charcoal-200/80 mr-auto text-charcoal-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1 text-[10px]">
                              <span className="font-bold flex items-center space-x-1">
                                {isSupport ? (
                                  <>
                                    <span className="text-forest-800">🛡️ Aashvo Support Team</span>
                                  </>
                                ) : (
                                  <span>{msg.senderName}</span>
                                )}
                              </span>
                              <span className="text-charcoal-400">
                                {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        );
                      })}
                  </div>

                  {/* Reply Input Box */}
                  <div className="p-3 bg-white border-t border-charcoal-200">
                    {activeTicket.status === 'closed' ? (
                      <div className="p-2 text-center text-xs text-charcoal-500 bg-charcoal-50 rounded-xl">
                        This ticket is marked as Closed. To discuss a new matter, please create a new support ticket.
                      </div>
                    ) : (
                      <form onSubmit={handleSendReply} className="flex gap-2">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          placeholder="Type your message or follow-up details..."
                          className="flex-1 px-3.5 py-2 bg-ivory-50 border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                        />
                        <button
                          type="submit"
                          disabled={isReplying || !replyMessage.trim()}
                          className="px-4 py-2 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors disabled:opacity-50 flex items-center space-x-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Reply</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
