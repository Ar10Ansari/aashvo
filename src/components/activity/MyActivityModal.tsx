import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  Award,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { visitService } from '../../services/visitService';
import { fetchAgreementsForUser } from '../../services/rentalTrustService';
import type { PropertyVisitItem } from '@aashvo/contracts';
import type { TenancyAgreement } from '../../types/rentalTrust';

export interface MyActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'visits' | 'agreements' | 'checklists' | 'verifications';
}

export const MyActivityModal: React.FC<MyActivityModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'visits',
}) => {
  const { currentUser, showToast, setIsRentalTrustOpen } = useApp();

  const [activeTab, setActiveTab] = useState<'visits' | 'agreements' | 'checklists' | 'verifications'>(initialTab);
  const [visits, setVisits] = useState<PropertyVisitItem[]>([]);
  const [agreements, setAgreements] = useState<TenancyAgreement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedVisitForReschedule, setSelectedVisitForReschedule] = useState<PropertyVisitItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('14:00');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'visits') {
        const data = await visitService.getMyVisits().catch(() => []);
        const visitList = Array.isArray(data) ? data : (data as any)?.items || [];
        setVisits(visitList);
      } else if (activeTab === 'agreements' || activeTab === 'checklists') {
        if (currentUser?.id) {
          const res = await fetchAgreementsForUser(currentUser.id).catch(() => ({ success: false, agreements: [] }));
          setAgreements(res.agreements || []);
        } else {
          setAgreements([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatIST = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleCancelVisit = async (visitId: string) => {
    try {
      await visitService.updateStatus(visitId, 'cancel', 'Cancelled by visitor');
      showToast('Viewing appointment cancelled.');
      setVisits((prev) =>
        prev.map((v) => (v.id === visitId ? { ...v, status: 'cancelled' } : v)),
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to cancel viewing');
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedVisitForReschedule || !rescheduleDate) return;
    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}:00+05:30`).toISOString();
      await visitService.rescheduleVisit(selectedVisitForReschedule.id, newDateTime, 'Rescheduled by visitor');
      showToast('Viewing request rescheduled.');
      setSelectedVisitForReschedule(null);
      loadData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to reschedule viewing');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-modal-title"
        className="bg-[#FBF9F5] rounded-3xl max-w-4xl w-full h-[90vh] max-h-[820px] shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-700/10 flex items-center justify-center text-forest-800">
              <Calendar className="w-5 h-5 text-forest-800" />
            </div>
            <div>
              <h2 id="activity-modal-title" className="text-xl font-bold text-forest-900 tracking-tight font-serif flex items-center space-x-2">
                <span>My Activity & Tenancy Center</span>
              </h2>
              <p className="text-xs text-charcoal-500 font-medium">
                Track viewing visits, digital agreements, move-in checklists & verifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-300 transition-colors"
            aria-label="Close activity center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-charcoal-200/60 bg-white flex space-x-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('visits')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'visits'
                ? 'border-forest-700 text-forest-900 font-bold'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <Clock className="w-4 h-4 text-forest-700" />
            <span>Scheduled Visits</span>
            <span className="text-xs bg-forest-100 text-forest-800 px-2 py-0.5 rounded-full font-bold">
              {visits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('agreements')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'agreements'
                ? 'border-forest-700 text-forest-900 font-bold'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <FileText className="w-4 h-4 text-forest-700" />
            <span>Tenancy Agreements</span>
          </button>

          <button
            onClick={() => setActiveTab('checklists')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'checklists'
                ? 'border-forest-700 text-forest-900 font-bold'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-forest-700" />
            <span>Move-In Checklists</span>
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'verifications'
                ? 'border-forest-700 text-forest-900 font-bold'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <Award className="w-4 h-4 text-forest-700" />
            <span>Property Verifications</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FBF9F5]">
          {/* TAB 1: VISITS */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-forest-900">Property Viewing Requests</h3>
                  <p className="text-xs text-charcoal-500">
                    Never confirmed until host approval. Timings strictly displayed in Indian Standard Time (IST).
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="text-xs text-forest-700 hover:text-forest-900 flex items-center space-x-1 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoading ? (
                <div className="py-16 text-center text-charcoal-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-forest-600" />
                  <p className="text-sm font-medium">Loading visit schedule...</p>
                </div>
              ) : visits.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-charcoal-200/60 p-8">
                  <Calendar className="w-12 h-12 text-charcoal-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-charcoal-800">No viewing visits requested</h4>
                  <p className="text-xs text-charcoal-500 mt-1 max-w-sm mx-auto">
                    When you explore properties and tap "Schedule Viewing", your viewing requests and status will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visits.map((visit) => {
                    const isConfirmed = visit.status === 'confirmed';
                    const isPending = visit.status === 'pending';
                    const isCancelled = visit.status === 'cancelled';

                    return (
                      <div
                        key={visit.id}
                        className="bg-white rounded-2xl p-5 border border-charcoal-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-charcoal-900 text-sm line-clamp-1">
                              {visit.propertyTitle || 'Accommodation Viewing'}
                            </h4>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                                isConfirmed
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : isPending
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : isCancelled
                                      ? 'bg-charcoal-100 text-charcoal-600 border border-charcoal-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {visit.status}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs text-charcoal-600">
                            <div className="flex items-center space-x-1.5">
                              <Calendar className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                              <span className="font-medium">{formatIST(visit.scheduledAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <MapPin className="w-3.5 h-3.5 text-sand-600 shrink-0" />
                              <span>{visit.propertyLocality ? `${visit.propertyLocality}, ${visit.propertyCity}` : 'Gurugram, Haryana'}</span>
                            </div>
                            {visit.visitorMessage && (
                              <p className="text-[11px] bg-ivory-100 p-2 rounded-lg text-charcoal-600 mt-2 italic">
                                Note: "{visit.visitorMessage}"
                              </p>
                            )}
                            {visit.hostNotes && (
                              <p className="text-[11px] bg-forest-50 p-2 rounded-lg text-forest-800 mt-2 font-medium">
                                Host: "{visit.hostNotes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-charcoal-100 flex items-center justify-between text-xs">
                          {isPending || isConfirmed ? (
                            <div className="flex items-center space-x-2 w-full justify-end">
                              <button
                                onClick={() => {
                                  setSelectedVisitForReschedule(visit);
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  setRescheduleDate(tomorrow.toISOString().split('T')[0]);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-ivory-200 font-semibold"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelVisit(visit.id)}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-charcoal-400 italic">No further actions available</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reschedule Modal Overlay */}
              {selectedVisitForReschedule && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-2xs">
                  <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-charcoal-200">
                    <h4 className="text-base font-bold text-forest-900">Reschedule Viewing</h4>
                    <p className="text-xs text-charcoal-500 mt-1">Select an alternative date and time slot (IST).</p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-700 mb-1">New Date</label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-charcoal-200 bg-ivory-50 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-700 mb-1">Time Slot (IST)</label>
                        <select
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-charcoal-200 bg-ivory-50 font-medium"
                        >
                          <option value="10:00">10:00 AM (Morning)</option>
                          <option value="11:30">11:30 AM (Late Morning)</option>
                          <option value="14:00">02:00 PM (Afternoon)</option>
                          <option value="16:00">04:00 PM (Late Afternoon)</option>
                          <option value="17:30">05:30 PM (Evening)</option>
                          <option value="19:00">07:00 PM (Night)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-2 justify-end">
                      <button
                        onClick={() => setSelectedVisitForReschedule(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal-600 hover:bg-charcoal-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmReschedule}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-forest-700 hover:bg-forest-800"
                      >
                        Confirm Reschedule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AGREEMENTS */}
          {activeTab === 'agreements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-forest-900">Rental Agreements & Protection</h3>
                  <p className="text-xs text-charcoal-500">
                    Transparent security deposit custody and dispute protection backed by the AASHVO Rental Trust Engine.
                  </p>
                </div>
                <button
                  onClick={() => setIsRentalTrustOpen(true)}
                  className="text-xs bg-forest-700 hover:bg-forest-800 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Open Trust Ledger</span>
                </button>
              </div>

              {agreements.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-charcoal-200/60 p-8">
                  <FileText className="w-12 h-12 text-charcoal-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-charcoal-800">No active tenancy agreements</h4>
                  <p className="text-xs text-charcoal-500 mt-1 max-w-sm mx-auto">
                    When you book a verified room or flatmate space, your digital tenancy agreement and deposit custody records are established here.
                  </p>
                  <button
                    onClick={() => setIsRentalTrustOpen(true)}
                    className="mt-4 px-4 py-2 bg-ivory-200 text-forest-800 rounded-xl text-xs font-bold hover:bg-ivory-300 transition-colors"
                  >
                    View Rental Trust Engine Details
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {agreements.map((agr) => (
                    <div
                      key={agr.id}
                      className="bg-white p-5 rounded-2xl border border-charcoal-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-forest-900">Agreement #{agr.id.slice(0, 8)}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">
                            {agr.agreementStatus}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal-600 mt-1">
                          Rent: <strong>₹{agr.monthlyRent.toLocaleString('en-IN')}/mo</strong> • Security Deposit: <strong>₹{agr.securityDeposit.toLocaleString('en-IN')}</strong>
                        </p>
                        <p className="text-[11px] text-charcoal-400 mt-1">
                          Tenancy Period: {new Date(agr.startDate).toLocaleDateString('en-IN')} – {agr.endDate ? new Date(agr.endDate).toLocaleDateString('en-IN') : 'Ongoing'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIsRentalTrustOpen(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-forest-50 text-forest-800 hover:bg-forest-100 border border-forest-200/70"
                        >
                          View Protection Ledger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MOVE-IN CHECKLISTS */}
          {activeTab === 'checklists' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-forest-900">Move-In & Move-Out Checklists</h3>
                <p className="text-xs text-charcoal-500">
                  Digital joint inventory, meter readings, and condition sign-off to eliminate deposit deduction disputes.
                </p>
              </div>

              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer:</strong> Digital move-in checklists provide objective factual evidence of property condition and utility readings at handover. Digital acknowledgement is not automatically a court-registered tenancy agreement under the Indian Registration Act.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-charcoal-200/80 text-center py-12">
                <ClipboardCheck className="w-12 h-12 text-forest-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-charcoal-800">Move-In Inspection Workflow Ready</h4>
                <p className="text-xs text-charcoal-500 mt-1 max-w-md mx-auto">
                  Move-in inspections are created automatically when a Tenancy Agreement is confirmed by landlord and tenant.
                </p>
                <button
                  onClick={() => setIsRentalTrustOpen(true)}
                  className="mt-4 px-4 py-2 bg-forest-700 text-white rounded-xl text-xs font-bold hover:bg-forest-800"
                >
                  Manage via Rental Trust Ledger
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PROPERTY VERIFICATIONS */}
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-forest-900">Host Property Verification Submissions</h3>
                <p className="text-xs text-charcoal-500">
                  Submit electricity bills, municipal tax receipts, or society possession letters to earn verified badges.
                </p>
              </div>

              <div className="bg-forest-50/80 border border-forest-200/80 rounded-2xl p-4 text-xs text-forest-900 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-forest-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Compliance Note:</strong> AASHVO's verification workflow validates that utility bills and ownership papers correlate with the host's identity. Document verification does not guarantee absolute legal title or structural building safety.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-charcoal-200/80 text-center py-12">
                <Award className="w-12 h-12 text-forest-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-charcoal-800">Earn the Verified Host Badge</h4>
                <p className="text-xs text-charcoal-500 mt-1 max-w-md mx-auto">
                  To verify your property, open your listing details and click "Verify Ownership Documents". Verified listings receive 3x more viewing requests.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
