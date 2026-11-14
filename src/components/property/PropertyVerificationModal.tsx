import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { submitPropertyVerification, getPropertyVerification } from '../../services/marketplaceService';
import { useApp } from '../../context/AppContext';
import type { Property } from '../../types';

interface PropertyVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
}

export const PropertyVerificationModal: React.FC<PropertyVerificationModalProps> = ({
  isOpen,
  onClose,
  property,
}) => {
  const { showToast } = useApp();

  const [documentType, setDocumentType] = useState<string>('electricity_bill');
  const [ownershipType, setOwnershipType] = useState<string>('sole_owner');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [verificationData, setVerificationData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && property) {
      loadStatus();
    }
  }, [isOpen, property]);

  const loadStatus = async () => {
    if (!property) return;
    try {
      const res = await getPropertyVerification(property.id);
      if (res.success && res.data) {
        setVerificationData(res.data);
      } else {
        setVerificationData(null);
      }
    } catch {
      setVerificationData(null);
    }
  };

  if (!isOpen || !property) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentUrl.trim()) {
      setErrorMessage('Please provide a valid document link or URL.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await submitPropertyVerification(property.id, {
        documentType,
        documentUrl: documentUrl.trim(),
        ownershipType,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setVerificationData(res.data);
        if (showToast) {
          showToast('Verification documents submitted for review!');
        }
      } else {
        setErrorMessage(res.error || 'Failed to submit verification');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const docTypes = [
    { id: 'electricity_bill', label: 'Electricity Bill (Last 3 Months)' },
    { id: 'property_tax_receipt', label: 'Municipal Property Tax Receipt' },
    { id: 'registered_sale_deed', label: 'Registered Sale Deed / Title Deed' },
    { id: 'registered_lease_agreement', label: 'Registered Master Lease / Sublease Deed' },
    { id: 'society_share_certificate', label: 'Housing Society Share Certificate' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-verification-title"
    >
      <div className="bg-[#FBF9F5] rounded-3xl max-w-lg w-full shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5 text-sand-400" />
            </div>
            <div>
              <h2 id="property-verification-title" className="font-serif font-bold text-lg text-forest-900">
                Property Verification
              </h2>
              <p className="text-xs text-charcoal-500">Earn the Verified Badge to increase student & renter trust</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close property verification dialog"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status Banners */}
          {verificationData && (
            <div>
              {verificationData.status === 'verified' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">Property Verified</h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Verified by AASHVO Compliance. The listing displays the Verified Badge to potential flatmates and renters.
                    </p>
                  </div>
                </div>
              )}

              {verificationData.status === 'pending' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-900">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">Review in Progress</h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Verification documents submitted on {new Date(verificationData.createdAt).toLocaleDateString('en-IN')}. Our compliance team typically completes verification within 24–48 hours.
                    </p>
                  </div>
                </div>
              )}

              {verificationData.status === 'rejected' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider">Verification Resubmission Needed</h4>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {verificationData.rejectionReason || 'Uploaded documentation was unreadable or did not match listing details. Please submit updated proof below.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          {(!verificationData || verificationData.status !== 'verified') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                >
                  {docTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Ownership Capacity
                </label>
                <select
                  value={ownershipType}
                  onChange={(e) => setOwnershipType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                >
                  <option value="sole_owner">Sole Registered Owner</option>
                  <option value="co_owner">Co-Owner / Joint Holder</option>
                  <option value="authorized_representative">Authorized Flatmate / Primary Lessee</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Document URL / Proof Link
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://storage.aashvo.com/docs/bill.pdf"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
                <span className="text-[11px] text-charcoal-400 mt-1 block">
                  Encrypted securely; strictly accessible only to AASHVO compliance officers.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Meter reading number matches electricity board account."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Legal Demarcation */}
              <div className="p-3 bg-[#F5F3ED] rounded-xl text-[11px] text-charcoal-600 flex items-start space-x-2 border border-charcoal-200/50">
                <ShieldAlert className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> Verification indicates that submitted utility or ownership documents match the lister's account. It does not constitute legal title insurance or a state guarantee of ownership.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-charcoal-600 hover:text-charcoal-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{loading ? 'Submitting...' : 'Submit for Verification'}</span>
                </button>
              </div>
            </form>
          )}

          {verificationData && verificationData.status === 'verified' && (
            <div className="pt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-forest-800 text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
