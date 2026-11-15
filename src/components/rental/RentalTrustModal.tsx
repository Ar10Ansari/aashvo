import React, { useState, useEffect } from 'react';
import {
  FileText,
  CreditCard,
  ShieldCheck,
  Star,
  AlertTriangle,
  X,
  CheckCircle,
  Clock,
  Plus,
  Camera,
  Info,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { MoveInChecklistModal } from './MoveInChecklistModal';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import {
  TenancyAgreement,
  RentPaymentRecord,
  PropertyInspection,
  TenancyReview,
  RentalDispute,
  PaymentCategory,
  ConditionRating,
  DisputeType,
} from '../../types/rentalTrust';
import {
  fetchAgreementsForUser,
  fetchPaymentsForAgreement,
  recordRentPayment,
  confirmPaymentByLandlord,
  fetchInspectionsForAgreement,
  recordPropertyInspection,
  acknowledgeInspection,
  fetchReviewsForAgreement,
  submitTenancyReview,
  fetchDisputesForAgreement,
  fileRentalDispute,
} from '../../services/rentalTrustService';
import { formatINR } from '../../utils/formatters';

interface RentalTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

type TabType = 'agreements' | 'payments' | 'inspections' | 'reviews' | 'disputes';

export const RentalTrustModal: React.FC<RentalTrustModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { openAuthModal } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('agreements');
  const [agreements, setAgreements] = useState<TenancyAgreement[]>([]);
  const [selectedAgreement, setSelectedAgreement] = useState<TenancyAgreement | null>(null);

  // Sub-data for selected agreement
  const [payments, setPayments] = useState<RentPaymentRecord[]>([]);
  const [inspections, setInspections] = useState<PropertyInspection[]>([]);
  const [reviews, setReviews] = useState<TenancyReview[]>([]);
  const [disputes, setDisputes] = useState<RentalDispute[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [showMoveInChecklist, setShowMoveInChecklist] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('rent');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [inspRoom, setInspRoom] = useState('');
  const [inspRating, setInspRating] = useState<ConditionRating>('good');
  const [inspNotes, setInspNotes] = useState('');

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [revComm, setRevComm] = useState(5);
  const [revMaint, setRevMaint] = useState(5);
  const [revCare, setRevCare] = useState(5);
  const [revClarity, setRevClarity] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revContent, setRevContent] = useState('');

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [dispType, setDispType] = useState<DisputeType>('security_deposit');
  const [dispAmount, setDispAmount] = useState<number>(0);
  const [dispTitle, setDispTitle] = useState('');
  const [dispDesc, setDispDesc] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    loadAgreements();
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!selectedAgreement) return;
    loadAgreementSubData(selectedAgreement.id);
  }, [selectedAgreement]);

  const loadAgreements = async () => {
    setIsLoading(true);
    setLoadError(null);
    if (!currentUser) {
      setAgreements([]);
      setSelectedAgreement(null);
      setIsLoading(false);
      return;
    }
    const res = await fetchAgreementsForUser(currentUser.id);
    if (res.success) {
      setAgreements(res.agreements);
      if (res.agreements.length > 0) {
        setSelectedAgreement(res.agreements[0]);
      } else {
        setSelectedAgreement(null);
      }
    } else {
      setLoadError(res.error || 'Failed to connect to backend.');
      setAgreements([]);
      setSelectedAgreement(null);
    }
    setIsLoading(false);
  };

  const loadAgreementSubData = async (agreementId: string) => {
    const [pRes, iRes, rRes, dRes] = await Promise.all([
      fetchPaymentsForAgreement(agreementId),
      fetchInspectionsForAgreement(agreementId),
      fetchReviewsForAgreement(agreementId),
      fetchDisputesForAgreement(agreementId),
    ]);

    if (pRes.success) setPayments(pRes.payments);
    if (iRes.success) setInspections(iRes.inspections);
    if (rRes.success) setReviews(rRes.reviews);
    if (dRes.success) setDisputes(dRes.disputes);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreement || !currentUser) return;

    const res = await recordRentPayment(
      {
        agreementId: selectedAgreement.id,
        payerId: currentUser.id,
        recipientId: selectedAgreement.landlordId,
        amount: Number(paymentAmount),
        paymentCategory,
        transactionReference: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      },
      currentUser
    );

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Payment record submitted for landlord confirmation.' });
      setShowPaymentForm(false);
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
      loadAgreementSubData(selectedAgreement.id);
    } else {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to submit payment.' });
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    if (!currentUser || !selectedAgreement) return;
    const res = await confirmPaymentByLandlord(paymentId, currentUser);
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Payment receipt confirmed.' });
      loadAgreementSubData(selectedAgreement.id);
    } else {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to confirm payment.' });
    }
  };

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreement || !currentUser) return;

    const res = await recordPropertyInspection(
      {
        agreementId: selectedAgreement.id,
        inspectionType: 'move_in',
        conductedBy: currentUser.id,
        roomName: inspRoom.trim(),
        conditionRating: inspRating,
        damageNotes: inspNotes.trim() || undefined,
        photoUrls: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'],
      },
      currentUser
    );

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Condition inspection entry logged.' });
      setShowInspectionForm(false);
      setInspRoom('');
      setInspNotes('');
      loadAgreementSubData(selectedAgreement.id);
    } else {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to log inspection.' });
    }
  };

  const handleAcknowledgeInspection = async (inspId: string) => {
    const res = await acknowledgeInspection(inspId);
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Inspection condition mutually acknowledged.' });
      if (selectedAgreement) loadAgreementSubData(selectedAgreement.id);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreement || !currentUser) return;

    const isLandlord = currentUser.id === selectedAgreement.landlordId;
    const revieweeId = isLandlord ? selectedAgreement.tenantId : selectedAgreement.landlordId;

    const res = await submitTenancyReview(
      {
        agreementId: selectedAgreement.id,
        reviewerId: currentUser.id,
        revieweeId,
        reviewerRole: isLandlord ? 'landlord' : 'tenant',
        communicationRating: revComm,
        maintenanceRating: revMaint,
        propertyCareRating: revCare,
        agreementClarityRating: revClarity,
        reviewTitle: revTitle.trim(),
        reviewContent: revContent.trim(),
      },
      currentUser
    );

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Verified tenancy review published.' });
      setShowReviewForm(false);
      setRevTitle('');
      setRevContent('');
      loadAgreementSubData(selectedAgreement.id);
    } else {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to submit review.' });
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreement || !currentUser) return;

    const isLandlord = currentUser.id === selectedAgreement.landlordId;
    const respondentId = isLandlord ? selectedAgreement.tenantId : selectedAgreement.landlordId;

    const res = await fileRentalDispute(
      {
        agreementId: selectedAgreement.id,
        initiatorId: currentUser.id,
        respondentId,
        disputeType: dispType,
        disputedAmount: Number(dispAmount),
        title: dispTitle.trim(),
        description: dispDesc.trim(),
        evidenceUrls: [],
      },
      currentUser
    );

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: `Dispute ${res.dispute?.disputeNumber} filed for mediation review.` });
      setShowDisputeForm(false);
      setDispTitle('');
      setDispDesc('');
      setDispAmount(0);
      loadAgreementSubData(selectedAgreement.id);
    } else {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to file dispute.' });
    }
  };

  if (!isOpen) return null;

  const isCurrentLandlord = currentUser?.id === selectedAgreement?.landlordId;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-trust-modal-title"
    >
      <div className="bg-[#FAF9F6] border border-sand-300 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-charcoal-800">

        {/* Top Header */}
        <div className="bg-forest-900 text-white p-5 sm:p-6 flex items-start justify-between relative">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-sand-300" />
              <span className="text-xs uppercase tracking-widest font-semibold text-sand-300">
                Aashvo Rental Trust & Protection
              </span>
            </div>
            <h2 id="rental-trust-modal-title" className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Rental Trust Portal
            </h2>
            <p className="text-sm text-forest-100 max-w-xl mt-1">
              Documented tenancy agreements, transparent payment ledgers, verified condition logging, and mutual dispute resolution.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Rental Trust modal"
            className="p-2 text-forest-200 hover:text-white hover:bg-forest-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Legal Disclaimer Ribbon */}
        <div className="bg-sand-100 border-b border-sand-200 px-5 py-2.5 flex items-center gap-2 text-xs text-charcoal-600">
          <Info className="w-4 h-4 text-forest-700 shrink-0" />
          <span>
            <strong>Legal Notice:</strong> Aashvo provides an auditable digital trust ledger for landlords and tenants. Aashvo is not an escrow depository, banking financial intermediary, insurer, or judicial court.
          </span>
        </div>

        {/* Maharashtra Section 55 Leave and License Advisory */}
        {(selectedAgreement?.propertyLocality?.toLowerCase().includes('mumbai') ||
          selectedAgreement?.propertyLocality?.toLowerCase().includes('pune') ||
          selectedAgreement?.propertyLocality?.toLowerCase().includes('maharashtra') ||
          selectedAgreement?.termsSummary?.toLowerCase().includes('maharashtra')) && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Maharashtra Statutory Notice (Section 55, Maharashtra Rent Control Act 1999):</strong>
              <p className="mt-0.5 text-amber-900 leading-relaxed font-sans">
                Registration of all Leave and License agreements is compulsory under state law. Aashvo digital drafts serve as standardized negotiation records and must be formally executed and registered via Maharashtra&apos;s official e-filing portal (igrmaharashtra.gov.in) or Competent Authority.
              </p>
            </div>
          </div>
        )}

        {/* Load Error Alert */}
        {loadError && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold">Backend Connection Notice</h4>
              <p className="text-xs text-rose-700 mt-0.5">{loadError}</p>
              <button
                onClick={loadAgreements}
                className="mt-2 text-xs font-semibold px-3 py-1 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors text-rose-900"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Global Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center justify-between text-sm ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs underline hover:no-underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tenancy Selector & Tabs Bar */}
        <div className="bg-white border-b border-sand-200 px-5 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Agreement Switcher */}
          {agreements.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-charcoal-500 uppercase">Lease:</span>
              <select
                value={selectedAgreement?.id}
                onChange={e => {
                  const match = agreements.find(a => a.id === e.target.value);
                  if (match) setSelectedAgreement(match);
                }}
                className="text-sm font-medium border border-sand-300 rounded-lg px-3 py-1.5 bg-sand-50 focus:outline-none focus:ring-2 focus:ring-forest-600"
              >
                {agreements.map(ag => (
                  <option key={ag.id} value={ag.id}>
                    {ag.propertyTitle} ({ag.agreementStatus.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto" role="tablist">
            {[
              { id: 'agreements', label: 'Agreements', icon: FileText },
              { id: 'payments', label: 'Payment Ledger', icon: CreditCard },
              { id: 'inspections', label: 'Inspections', icon: Camera },
              { id: 'reviews', label: 'Reputation', icon: Star },
              { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(tab.id as TabType);
                    setFeedbackMsg(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-forest-800 text-forest-900 bg-sand-50/50'
                      : 'border-transparent text-charcoal-500 hover:text-charcoal-800 hover:border-sand-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-[#FAF9F6]">
          {!currentUser ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-sand-300 p-8 max-w-md mx-auto">
              <ShieldCheck className="w-12 h-12 text-forest-700 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-charcoal-800">Sign in to view Rental Trust</h3>
              <p className="text-xs text-charcoal-500 mt-1 mb-6 leading-relaxed">
                Tenancy agreements, verified payment receipts, inspection checklists, and deposit dispute resolution are tied to your verified account.
              </p>
              <button
                onClick={() => {
                  onClose();
                  openAuthModal('signin');
                }}
                className="px-6 py-2.5 bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                Sign In or Register
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <Clock className="w-8 h-8 text-forest-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-charcoal-500">Loading verified tenancy records...</p>
            </div>
          ) : !selectedAgreement ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-sand-300 p-8">
              <FileText className="w-12 h-12 text-sand-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-charcoal-800">No Active Tenancy Agreements</h3>
              <p className="text-sm text-charcoal-500 max-w-md mx-auto mt-1 mb-4">
                Tenancy agreements are established when an inquiry is approved between a verified host and tenant.
              </p>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* TAB 1: AGREEMENTS (FEATURE D) */}
              {/* ========================================================= */}
              {activeTab === 'agreements' && (
                <div className="space-y-6">
                  <div className="bg-white border border-sand-200 rounded-xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-sand-100 pb-4 mb-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {selectedAgreement.agreementStatus.toUpperCase()} LEASE
                        </span>
                        <h3 className="text-xl font-serif font-bold text-charcoal-900 mt-2">
                          {selectedAgreement.propertyTitle}
                        </h3>
                        <p className="text-xs text-charcoal-500">{selectedAgreement.propertyLocality}</p>
                      </div>
                      {selectedAgreement.documentUrl && (
                        <a
                          href={selectedAgreement.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-sand-100 hover:bg-sand-200 text-forest-900 rounded-xl text-xs font-semibold border border-sand-300 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-forest-700" />
                          View Draft Agreement PDF
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                      <div className="p-3 bg-sand-50 rounded-xl">
                        <span className="text-xs text-charcoal-500 block">Monthly Rent</span>
                        <span className="font-serif text-lg font-bold text-forest-900">
                          {formatINR(selectedAgreement.monthlyRent)}/mo
                        </span>
                      </div>
                      <div className="p-3 bg-sand-50 rounded-xl">
                        <span className="text-xs text-charcoal-500 block">Security Deposit</span>
                        <span className="font-serif text-lg font-bold text-charcoal-800">
                          {formatINR(selectedAgreement.securityDeposit)}
                        </span>
                      </div>
                      <div className="p-3 bg-sand-50 rounded-xl">
                        <span className="text-xs text-charcoal-500 block">Commencement</span>
                        <span className="text-sm font-semibold text-charcoal-800">{selectedAgreement.startDate}</span>
                      </div>
                      <div className="p-3 bg-sand-50 rounded-xl">
                        <span className="text-xs text-charcoal-500 block">Expiration</span>
                        <span className="text-sm font-semibold text-charcoal-800">{selectedAgreement.endDate}</span>
                      </div>
                    </div>

                    <div className="border-t border-sand-100 pt-4">
                      <h4 className="text-xs uppercase font-bold text-charcoal-500 mb-2">Parties to Tenancy</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-white border border-sand-200 rounded-xl">
                          <span className="text-xs text-forest-700 font-semibold block">Landlord / Owner</span>
                          <p className="font-bold text-charcoal-800">{selectedAgreement.landlordName}</p>
                          <p className="text-xs text-charcoal-500">{selectedAgreement.landlordEmail || 'Verified Host'}</p>
                        </div>
                        <div className="p-3 bg-white border border-sand-200 rounded-xl">
                          <span className="text-xs text-forest-700 font-semibold block">Resident Tenant</span>
                          <p className="font-bold text-charcoal-800">{selectedAgreement.tenantName}</p>
                          <p className="text-xs text-charcoal-500">{selectedAgreement.tenantEmail || 'Verified Tenant'}</p>
                        </div>
                      </div>
                    </div>

                    {selectedAgreement.termsSummary && (
                      <div className="mt-4 p-3 bg-sand-50 rounded-xl text-xs text-charcoal-700">
                        <strong className="block text-charcoal-900 mb-1">Key Contractual Terms:</strong>
                        {selectedAgreement.termsSummary}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: PAYMENT LEDGER & DEPOSIT (FEATURES A & C) */}
              {/* ========================================================= */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-sand-200 rounded-xl p-4">
                      <span className="text-xs text-charcoal-500 block">Total Confirmed Rent Paid</span>
                      <span className="font-serif text-2xl font-bold text-forest-900">
                        {formatINR(
                          payments
                            .filter(p => p.paymentCategory === 'rent' && p.verificationStatus === 'confirmed_by_landlord')
                            .reduce((sum, p) => sum + p.amount, 0)
                        )}
                      </span>
                    </div>
                    <div className="bg-white border border-sand-200 rounded-xl p-4">
                      <span className="text-xs text-charcoal-500 block">Agreed Security Deposit Held</span>
                      <span className="font-serif text-2xl font-bold text-charcoal-800">
                        {formatINR(selectedAgreement.securityDeposit)}
                      </span>
                      <span className="text-[10px] text-charcoal-500 block mt-1">Directly held by owner</span>
                    </div>
                    <div className="bg-white border border-sand-200 rounded-xl p-4">
                      <span className="text-xs text-charcoal-500 block">Pending Confirmations</span>
                      <span className="font-serif text-2xl font-bold text-amber-700">
                        {payments.filter(p => p.verificationStatus === 'pending_confirmation').length} records
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-lg text-charcoal-800">Payment History</h3>
                    <button
                      onClick={() => setShowPaymentForm(!showPaymentForm)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Record Payment Proof
                    </button>
                  </div>

                  {/* Record Payment Form Modal / Drawer */}
                  {showPaymentForm && (
                    <form onSubmit={handleRecordPayment} className="bg-white border border-forest-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                        <h4 className="font-bold text-sm text-forest-900">Record Rent or Deposit Payment</h4>
                        <button type="button" onClick={() => setShowPaymentForm(false)} className="text-charcoal-400 hover:text-charcoal-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={paymentAmount || ''}
                            onChange={e => setPaymentAmount(Number(e.target.value))}
                            placeholder="e.g. 22000"
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Category</label>
                          <select
                            value={paymentCategory}
                            onChange={e => setPaymentCategory(e.target.value as PaymentCategory)}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            <option value="rent">Monthly Rent</option>
                            <option value="security_deposit">Security Deposit</option>
                            <option value="utility">Utilities (Electricity/Water)</option>
                            <option value="maintenance">Maintenance Charge</option>
                            <option value="move_out_settlement">Move-out Settlement</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Reference / UTR</label>
                          <input
                            type="text"
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            placeholder="UPI / IMPS reference"
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Notes / Context</label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={e => setPaymentNotes(e.target.value)}
                          placeholder="e.g. Paid via GooglePay for August 2026 rent"
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowPaymentForm(false)}
                          className="px-4 py-2 border border-sand-300 rounded-lg text-xs font-semibold text-charcoal-600 hover:bg-sand-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-lg text-xs font-semibold"
                        >
                          Submit for Confirmation
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Payment Table */}
                  <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
                    {payments.length === 0 ? (
                      <div className="p-8 text-center text-sm text-charcoal-500">
                        No payments recorded yet for this tenancy.
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-sand-50 border-b border-sand-200 text-xs uppercase font-semibold text-charcoal-600">
                          <tr>
                            <th className="p-3.5">Date</th>
                            <th className="p-3.5">Category</th>
                            <th className="p-3.5">Amount</th>
                            <th className="p-3.5">Reference</th>
                            <th className="p-3.5">Verification</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sand-100">
                          {payments.map(p => (
                            <tr key={p.id} className="hover:bg-sand-50/50">
                              <td className="p-3.5 text-xs text-charcoal-600">{p.paymentDate}</td>
                              <td className="p-3.5">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sand-100 text-charcoal-800">
                                  {p.paymentCategory.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3.5 font-bold font-serif text-forest-900">
                                {formatINR(p.amount)}
                              </td>
                              <td className="p-3.5 text-xs font-mono text-charcoal-500">
                                {p.transactionReference || 'N/A'}
                              </td>
                              <td className="p-3.5">
                                {p.verificationStatus === 'confirmed_by_landlord' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    Confirmed by Owner
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Pending Confirmation
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                {isCurrentLandlord && p.verificationStatus === 'pending_confirmation' ? (
                                  <button
                                    onClick={() => handleConfirmPayment(p.id)}
                                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm"
                                  >
                                    Confirm Receipt
                                  </button>
                                ) : (
                                  <span className="text-xs text-charcoal-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: CONDITION INSPECTIONS (FEATURE E) */}
              {/* ========================================================= */}
              {activeTab === 'inspections' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-charcoal-800">
                        Property Condition Inspection Logs
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        Timestamped room-by-room condition logs preventing deposit disputes at move-out.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAgreement && (
                        <button
                          onClick={() => setShowMoveInChecklist(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sand-200 hover:bg-sand-300 text-forest-900 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                        >
                          <ClipboardCheck className="w-4 h-4 text-forest-800" />
                          Move-In Checklist
                        </button>
                      )}
                      <button
                        onClick={() => setShowInspectionForm(!showInspectionForm)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Log Condition
                      </button>
                    </div>
                  </div>

                  {showInspectionForm && (
                    <form onSubmit={handleRecordInspection} className="bg-white border border-forest-200 rounded-xl p-5 shadow-sm space-y-4">
                      <h4 className="font-bold text-sm text-forest-900 border-b border-sand-200 pb-2">
                        Log Move-In / Move-Out Room Condition
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Room or Area</label>
                          <input
                            type="text"
                            required
                            value={inspRoom}
                            onChange={e => setInspRoom(e.target.value)}
                            placeholder="e.g. Master Bedroom, Modular Kitchen"
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Condition Rating</label>
                          <select
                            value={inspRating}
                            onChange={e => setInspRating(e.target.value as ConditionRating)}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            <option value="pristine">Pristine (Flawless, New)</option>
                            <option value="good">Good (Clean, Normal Wear)</option>
                            <option value="fair">Fair (Minor Scuffs/Marks)</option>
                            <option value="damaged">Damaged (Requires Repair)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Notes & Existing Defects</label>
                        <textarea
                          rows={2}
                          value={inspNotes}
                          onChange={e => setInspNotes(e.target.value)}
                          placeholder="Note any pre-existing scratches, paint marks, or appliance states..."
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowInspectionForm(false)}
                          className="px-4 py-2 border border-sand-300 rounded-lg text-xs font-semibold text-charcoal-600 hover:bg-sand-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-lg text-xs font-semibold"
                        >
                          Save Inspection Entry
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inspections.length === 0 ? (
                      <div className="col-span-2 p-8 text-center bg-white rounded-xl border border-sand-200 text-sm text-charcoal-500">
                        No property condition inspections logged yet.
                      </div>
                    ) : (
                      inspections.map(item => (
                        <div key={item.id} className="bg-white border border-sand-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs uppercase font-semibold text-forest-700">
                                {item.inspectionType.replace('_', ' ').toUpperCase()}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  item.conditionRating === 'pristine'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.conditionRating === 'good'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.conditionRating === 'fair'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.conditionRating.toUpperCase()}
                              </span>
                            </div>
                            <h4 className="font-serif font-bold text-base text-charcoal-900">{item.roomName}</h4>
                            <p className="text-xs text-charcoal-500 mb-2">Logged on {item.inspectionDate} by {item.conductedByName}</p>
                            {item.damageNotes && (
                              <p className="text-xs text-charcoal-700 bg-sand-50 p-2.5 rounded-lg border border-sand-100 mb-3">
                                {item.damageNotes}
                              </p>
                            )}
                            {item.photoUrls.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {item.photoUrls.map((url, i) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt={`Inspection of ${item.roomName}`}
                                    className="w-16 h-16 object-cover rounded-lg border border-sand-300"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="border-t border-sand-100 pt-3 mt-3 flex items-center justify-between text-xs">
                            {item.acknowledgedByCounterparty ? (
                              <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                Mutually Acknowledged
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcknowledgeInspection(item.id)}
                                className="px-3 py-1 bg-sand-200 hover:bg-sand-300 text-charcoal-800 font-semibold rounded-lg text-xs transition-colors"
                              >
                                Acknowledge Log
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 4: VERIFIED REVIEWS (FEATURE B) */}
              {/* ========================================================= */}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-charcoal-800">
                        Two-Sided Verified Tenancy Reviews
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        Reviews can only be submitted by counterparties following genuine tenancy agreements.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Star className="w-4 h-4 text-sand-300" />
                      Write Tenancy Review
                    </button>
                  </div>

                  {showReviewForm && (
                    <form onSubmit={handleSubmitReview} className="bg-white border border-forest-200 rounded-xl p-5 shadow-sm space-y-4">
                      <h4 className="font-bold text-sm text-forest-900 border-b border-sand-200 pb-2">
                        Write Verified Tenancy Review for {isCurrentLandlord ? selectedAgreement.tenantName : selectedAgreement.landlordName}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Communication</label>
                          <select
                            value={revComm}
                            onChange={e => setRevComm(Number(e.target.value))}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            {[5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>{n} Stars</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Maintenance / Care</label>
                          <select
                            value={revMaint}
                            onChange={e => setRevMaint(Number(e.target.value))}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            {[5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>{n} Stars</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Property Care</label>
                          <select
                            value={revCare}
                            onChange={e => setRevCare(Number(e.target.value))}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            {[5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>{n} Stars</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Terms Clarity</label>
                          <select
                            value={revClarity}
                            onChange={e => setRevClarity(Number(e.target.value))}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            {[5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>{n} Stars</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Headline</label>
                        <input
                          type="text"
                          required
                          value={revTitle}
                          onChange={e => setRevTitle(e.target.value)}
                          placeholder="e.g. Transparent and respectful landlord experience"
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Detailed Review</label>
                        <textarea
                          rows={3}
                          required
                          value={revContent}
                          onChange={e => setRevContent(e.target.value)}
                          placeholder="Describe the tenancy experience, promptness of maintenance, and deposit settlement clarity..."
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReviewForm(false)}
                          className="px-4 py-2 border border-sand-300 rounded-lg text-xs font-semibold text-charcoal-600 hover:bg-sand-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-lg text-xs font-semibold"
                        >
                          Publish Verified Review
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-4">
                    {reviews.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-xl border border-sand-200 text-sm text-charcoal-500">
                        No reviews published yet for this tenancy.
                      </div>
                    ) : (
                      reviews.map(r => (
                        <div key={r.id} className="bg-white border border-sand-200 rounded-xl p-5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-bold text-forest-900 font-serif text-lg">{r.overallRating.toFixed(1)}</span>
                                <div className="flex text-amber-500">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${i < Math.round(r.overallRating) ? 'fill-current' : 'text-sand-300'}`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sand-100 text-charcoal-700 ml-2">
                                  By {r.reviewerRole.toUpperCase()}
                                </span>
                              </div>
                              <h4 className="font-bold text-charcoal-900 text-base">{r.reviewTitle}</h4>
                              <p className="text-xs text-charcoal-500">
                                Verified review by {r.reviewerName} on {new Date(r.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-charcoal-700 mt-3 bg-sand-50/50 p-3 rounded-lg border border-sand-100">
                            {r.reviewContent}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-charcoal-600 mt-3 pt-3 border-t border-sand-100">
                            <span>Communication: <strong>{r.communicationRating}/5</strong></span>
                            <span>Maintenance: <strong>{r.maintenanceRating}/5</strong></span>
                            <span>Property Care: <strong>{r.propertyCareRating}/5</strong></span>
                            <span>Agreement Clarity: <strong>{r.agreementClarityRating}/5</strong></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 5: DISPUTE MEDIATION (FEATURE F) */}
              {/* ========================================================= */}
              {activeTab === 'disputes' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-charcoal-800">
                        Rental Dispute Mediation
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        Structured mediation for deposit deductions, repairs, and agreement disagreements.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDisputeForm(!showDisputeForm)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      File Dispute
                    </button>
                  </div>

                  {showDisputeForm && (
                    <form onSubmit={handleFileDispute} className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm space-y-4">
                      <h4 className="font-bold text-sm text-rose-900 border-b border-sand-200 pb-2">
                        Initiate Community Mediation Case
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Dispute Category</label>
                          <select
                            value={dispType}
                            onChange={e => setDispType(e.target.value as DisputeType)}
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          >
                            <option value="security_deposit">Security Deposit Withholding</option>
                            <option value="unauthorized_deduction">Unauthorized Repair Deductions</option>
                            <option value="repair_maintenance">Unresolved Critical Repairs</option>
                            <option value="agreement_terms">Disagreement on Notice / Agreement Terms</option>
                            <option value="property_damage">Alleged Property Damage</option>
                            <option value="privacy_unauthorized_entry">Unauthorized Landlord Entry / Privacy</option>
                            <option value="misrepresentation">Listing Misrepresentation</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-charcoal-700 block mb-1">Disputed Amount (₹ if applicable)</label>
                          <input
                            type="number"
                            min="0"
                            value={dispAmount || ''}
                            onChange={e => setDispAmount(Number(e.target.value))}
                            placeholder="e.g. 15000"
                            className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Dispute Title</label>
                        <input
                          type="text"
                          required
                          value={dispTitle}
                          onChange={e => setDispTitle(e.target.value)}
                          placeholder="e.g. Full deposit not refunded after move-out"
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-charcoal-700 block mb-1">Statement of Facts & Evidence</label>
                        <textarea
                          rows={4}
                          required
                          value={dispDesc}
                          onChange={e => setDispDesc(e.target.value)}
                          placeholder="Detail the timeline, prior communication, and references to move-in/out inspection logs..."
                          className="w-full text-sm border border-sand-300 rounded-lg p-2 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowDisputeForm(false)}
                          className="px-4 py-2 border border-sand-300 rounded-lg text-xs font-semibold text-charcoal-600 hover:bg-sand-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Submit Dispute for Mediation
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-4">
                    {disputes.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-xl border border-sand-200 text-sm text-charcoal-500">
                        No active or resolved disputes on record for this tenancy.
                      </div>
                    ) : (
                      disputes.map(d => (
                        <div key={d.id} className="bg-white border border-sand-200 rounded-xl p-5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  {d.disputeNumber}
                                </span>
                                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-sand-100 text-charcoal-700">
                                  {d.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                              <h4 className="font-bold text-charcoal-900 text-base">{d.title}</h4>
                              <p className="text-xs text-charcoal-500">
                                Filed by {d.initiatorName} on {new Date(d.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {d.disputedAmount > 0 && (
                              <div className="text-right">
                                <span className="text-xs text-charcoal-400 block">Disputed Sum</span>
                                <span className="font-serif font-bold text-lg text-rose-700">
                                  {formatINR(d.disputedAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-charcoal-700 mt-3 bg-sand-50 p-3 rounded-lg border border-sand-100">
                            {d.description}
                          </p>
                          {d.resolutionSummary && (
                            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                              <strong>Mediation Outcome:</strong> {d.resolutionSummary}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-sand-200 p-4 px-6 flex items-center justify-between text-xs text-charcoal-500">
          <span>Protected by Aashvo Row Level Security & Encryption</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-sand-200 hover:bg-sand-300 text-charcoal-800 rounded-xl font-semibold transition-colors"
          >
            Close Portal
          </button>
        </div>

        {showMoveInChecklist && selectedAgreement && (
          <MoveInChecklistModal
            isOpen={showMoveInChecklist}
            onClose={() => setShowMoveInChecklist(false)}
            agreement={selectedAgreement}
            onChecklistSaved={() => {
              setShowMoveInChecklist(false);
              loadAgreementSubData(selectedAgreement.id);
            }}
          />
        )}
      </div>
    </div>
  );
};
