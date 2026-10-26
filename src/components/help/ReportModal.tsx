import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ReportReasonCode } from '../../types';
import { validateSafetyReport } from '../../services/supportService';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Send,
  Info,
} from 'lucide-react';

interface ReportModalProps {
  target: {
    type: 'listing' | 'flatmate' | 'user';
    id: string;
    title: string;
  };
  onClose: () => void;
}

const REPORT_REASONS: Array<{ code: ReportReasonCode; label: string; description: string; highPriority?: boolean }> = [
  {
    code: 'scam_fraud',
    label: 'Suspected Scam, Fraud or Advance Token Demands',
    description: 'Demanded advance money prior to viewing, suspicious payment QR codes, or bank fraud.',
    highPriority: true,
  },
  {
    code: 'misleading_charges',
    label: 'Misleading Price, Hidden Charges or Deposit Mismatch',
    description: 'Advertised rent or deposit does not match what the host demanded in chat/visit.',
  },
  {
    code: 'unavailable_listing',
    label: 'Listing Unavailable or Already Rented Out',
    description: 'Room is occupied, contact is inactive, or property is no longer open for rent.',
  },
  {
    code: 'duplicate_fake',
    label: 'Duplicate or Fake Listing / Photos',
    description: 'Images copied from other websites, fabricated address, or duplicate post.',
  },
  {
    code: 'inappropriate_conduct',
    label: 'Inappropriate Conduct or Rule Violation',
    description: 'Unprofessional, rude, or discriminatory behavior in flatmate conversations or visits.',
  },
  {
    code: 'harassment',
    label: 'Harassment, Safety Threat or Hate Speech',
    description: 'Intimidation, abusive language, stalking, or immediate safety concern.',
    highPriority: true,
  },
  {
    code: 'other',
    label: 'Other Community Guideline Violation',
    description: 'Any other issue not covered above.',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose }) => {
  const { currentUser, submitSafetyReport } = useApp();

  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('scam_fraud');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState(currentUser?.email || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateSafetyReport({
      reasonCode,
      details,
      reporterEmail,
    });

    if (!validation.isValid) {
      setFormError(validation.error || 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitSafetyReport({
        reporterId: currentUser?.id,
        reporterName: currentUser?.name || 'Anonymous Community Member',
        reporterEmail: reporterEmail.trim().toLowerCase(),
        targetType: target.type,
        targetId: target.id,
        targetTitle: target.title,
        reasonCode,
        details: details.trim(),
      });

      if (result.success) {
        setIsSubmitted(true);
        setSubmissionFeedback(result.message);
      } else {
        setFormError(result.message);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Report submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-900 text-white">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 id="report-modal-title" className="font-serif text-base font-bold">
              Report this {target.type === 'listing' ? 'Listing' : target.type === 'flatmate' ? 'Flatmate Profile' : 'User'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-charcoal-400 hover:text-white rounded-full hover:bg-charcoal-800 transition-colors"
            aria-label="Close report dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isSubmitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-charcoal-900">
                  Report Received for Editorial Review
                </h3>
                <p className="text-xs text-charcoal-600 mt-1.5 leading-relaxed max-w-sm mx-auto">
                  {submissionFeedback}
                </p>
              </div>

              <div className="bg-ivory-50 border border-charcoal-200/80 rounded-2xl p-3.5 text-[11px] text-charcoal-600 text-left space-y-1">
                <p className="font-bold text-charcoal-900">What happens next?</p>
                <p>• Our trust & safety team investigates listing freshness, verified ownership, and chat logs.</p>
                <p>• The reported party is never informed who filed this report.</p>
                <p>• Severe violations (fraud, advance scams) are escalated to immediate inventory pause.</p>
              </div>

              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-forest-900 text-white rounded-xl text-xs font-bold hover:bg-forest-800"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Context Target Info */}
              <div className="p-3 bg-ivory-100 rounded-2xl border border-charcoal-200/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-charcoal-500">
                    Flagging {target.type}
                  </span>
                  <p className="font-serif font-bold text-charcoal-900 truncate max-w-[280px]">
                    {target.title}
                  </p>
                  <span className="text-[10px] text-charcoal-400 font-mono">ID: {target.id}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-charcoal-200 text-charcoal-500">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
              </div>

              {/* Legal / Policy Disclaimer */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-snug flex items-start space-x-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Editorial Moderation Policy: </span>
                  Submitting a report flags this record for confidential safety evaluation. It does not automatically delete or condemn the listing without human review.
                </div>
              </div>

              {/* Form Error */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}

              {/* Select Reason */}
              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-2">
                  Select Reason for Flagging <span className="text-red-600">*</span>
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {REPORT_REASONS.map(r => {
                    const isSelected = reasonCode === r.code;
                    return (
                      <label
                        key={r.code}
                        className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-forest-50 border-forest-600 ring-1 ring-forest-600/30'
                            : 'bg-white border-charcoal-200 hover:border-forest-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={r.code}
                          checked={isSelected}
                          onChange={() => setReasonCode(r.code)}
                          className="mt-0.5 text-forest-800 focus:ring-forest-600"
                        />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-charcoal-900">{r.label}</span>
                            {r.highPriority && (
                              <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded uppercase">
                                High Priority Queue
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-charcoal-500 leading-snug">{r.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Explanation */}
              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Additional Details & Evidence Summary <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Provide concise, objective details (e.g. Host asked for Rs 5,000 via Google Pay before showing the flat, or listing claims 2BHK but actually 1RK)..."
                  maxLength={1000}
                  className="w-full px-3 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                  required
                />
                <div className="flex justify-between text-[10px] text-charcoal-400 mt-0.5">
                  <span>Minimum 10 characters</span>
                  <span>{details.length} / 1000</span>
                </div>
              </div>

              {/* Reporter Contact Email */}
              {!currentUser && (
                <div>
                  <label className="block text-xs font-bold text-charcoal-800 mb-1">
                    Your Contact Email (Kept confidential from reported party) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={e => setReporterEmail(e.target.value)}
                    placeholder="e.g. yourname@domain.com"
                    className="w-full px-3 py-2 bg-white border border-charcoal-200 rounded-xl text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                    required
                  />
                </div>
              )}

              {/* Privacy Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-charcoal-100 text-[11px] text-charcoal-500">
                <span className="flex items-center space-x-1 text-charcoal-500">
                  <Lock className="w-3.5 h-3.5 text-forest-700" />
                  <span>Reporter identity is strictly confidential</span>
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-red-800 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Confidential Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
