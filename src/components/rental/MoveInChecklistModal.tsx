import React, { useState } from 'react';
import {
  X,
  ClipboardCheck,
  Key,
  Zap,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Save,
} from 'lucide-react';
import { createInspectionInBackend } from '../../services/rentalTrustService';
import type { TenancyAgreement } from '../../types/rentalTrust';

interface MoveInChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: TenancyAgreement;
  onChecklistSaved?: () => void;
}

export const MoveInChecklistModal: React.FC<MoveInChecklistModalProps> = ({
  isOpen,
  onClose,
  agreement,
  onChecklistSaved,
}) => {
  const [electricityKwh, setElectricityKwh] = useState<string>('');
  const [waterKl, setWaterKl] = useState<string>('');
  const [gasUnits, setGasUnits] = useState<string>('');
  const [keyHandoverConfirmed, setKeyHandoverConfirmed] = useState<boolean>(false);
  const [depositConfirmed, setDepositConfirmed] = useState<boolean>(false);

  const [inventoryItems, setInventoryItems] = useState<
    Array<{ item: string; quantity: number; condition: string }>
  >([
    { item: 'Master Bed & Mattress', quantity: 1, condition: 'Clean & Pristine' },
    { item: 'Air Conditioner & Remote', quantity: 1, condition: 'Working / Serviced' },
    { item: 'Geyser / Water Heater', quantity: 1, condition: 'Functional' },
    { item: 'Wardrobe & Keys', quantity: 1, condition: 'Good Condition' },
    { item: 'Ceiling Fans & LED Lights', quantity: 4, condition: 'All Functional' },
  ]);

  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateItemCondition = (index: number, condition: string) => {
    setInventoryItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, condition } : item)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyHandoverConfirmed) {
      setError('Key handover must be acknowledged before finalizing the move-in checklist.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createInspectionInBackend({
        agreementId: agreement.id,
        inspectionType: 'move_in',
        roomName: 'Complete Property Move-In Audit',
        conditionRating: 'good',
        damageNotes: notes.trim() || undefined,
        meterReadings: {
          electricityKwh: electricityKwh ? Number(electricityKwh) : undefined,
          waterKl: waterKl ? Number(waterKl) : undefined,
          gasUnits: gasUnits ? Number(gasUnits) : undefined,
          recordedAt: new Date().toISOString(),
        },
        inventory: inventoryItems,
        keyHandoverConfirmed: true,
        depositConfirmed,
      });

      if (res.success) {
        setSuccess(true);
        if (onChecklistSaved) {
          onChecklistSaved();
        }
      } else {
        setError(res.error || 'Failed to submit move-in checklist');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movein-checklist-title"
    >
      <div className="bg-[#FBF9F5] rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
              <ClipboardCheck className="w-5 h-5 text-sand-400" />
            </div>
            <div>
              <h2 id="movein-checklist-title" className="font-serif font-bold text-lg text-forest-900">
                Move-In Handover Checklist
              </h2>
              <p className="text-xs text-charcoal-500">
                Two-party digital inventory, meter readings & key handover record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close move-in checklist dialog"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-forest-900">
                  Move-In Checklist Recorded!
                </h3>
                <p className="text-xs text-charcoal-600 mt-1 max-w-sm mx-auto">
                  The handover record, initial meter readings, and inventory baseline have been permanently logged into the Rental Trust Engine.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Agreement Metadata Card */}
              <div className="bg-white p-4 rounded-2xl border border-charcoal-200/60 shadow-xs flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-charcoal-400 uppercase tracking-wider font-bold">
                    Tenancy Agreement
                  </span>
                  <p className="font-bold text-forest-900 text-sm mt-0.5">
                    {agreement.propertyTitle || 'Residential Tenancy'}
                  </p>
                  <p className="text-charcoal-500 mt-0.5">
                    Monthly Rent: ₹{agreement.monthlyRent.toLocaleString('en-IN')} | Security Deposit: ₹
                    {agreement.securityDeposit.toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[11px]">
                  Active Tenancy
                </span>
              </div>

              {/* Meter Readings Section */}
              <div className="bg-white p-4 rounded-2xl border border-charcoal-200/60 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-700 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Baseline Utility Meter Readings (At Handover)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">
                      Electricity Meter (kWh)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 1420.5"
                      value={electricityKwh}
                      onChange={(e) => setElectricityKwh(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">
                      Water Meter (kL)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 85.0"
                      value={waterKl}
                      onChange={(e) => setWaterKl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">
                      Piped Gas (Units / SCM)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 12.0"
                      value={gasUnits}
                      onChange={(e) => setGasUnits(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-900"
                    />
                  </div>
                </div>
              </div>

              {/* Handover Checklist Items */}
              <div className="bg-white p-4 rounded-2xl border border-charcoal-200/60 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                  Inventory & Appliance Checklist
                </h4>
                <div className="divide-y divide-charcoal-100 space-y-2">
                  {inventoryItems.map((item, idx) => (
                    <div key={idx} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-forest-50 text-forest-700 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-charcoal-800">{item.item}</span>
                        <span className="text-[10px] text-charcoal-400 font-medium">
                          (Qty: {item.quantity})
                        </span>
                      </div>
                      <select
                        value={item.condition}
                        onChange={(e) => handleUpdateItemCondition(idx, e.target.value)}
                        className="text-xs px-2.5 py-1 bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-700 font-medium"
                      >
                        <option value="Clean & Pristine">Clean & Pristine</option>
                        <option value="Working / Serviced">Working / Serviced</option>
                        <option value="Functional">Functional</option>
                        <option value="Minor Scratches / Wear">Minor Scratches / Wear</option>
                        <option value="Repair Required">Repair Required</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mandatory Handover Acknowledgements */}
              <div className="bg-sand-50/70 p-4 rounded-2xl border border-sand-200/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-forest-900 flex items-center space-x-1.5">
                  <Key className="w-4 h-4 text-forest-700" />
                  <span>Two-Party Handover Acknowledgement</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyHandoverConfirmed}
                      onChange={(e) => setKeyHandoverConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-700 focus:ring-forest-600 border-charcoal-300"
                    />
                    <span className="font-semibold text-charcoal-800">
                      Physical key handover completed (Main entrance, bedroom, and society access fob/keys).
                    </span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositConfirmed}
                      onChange={(e) => setDepositConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-700 focus:ring-forest-600 border-charcoal-300"
                    />
                    <span className="font-semibold text-charcoal-800">
                      Security deposit receipt acknowledged as per agreed tenancy terms.
                    </span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Additional Handover Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Painting touch-up scheduled for next week; both sets of keys handed over."
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Legal Notice */}
              <div className="p-3 bg-[#F5F3ED] rounded-xl text-[11px] text-charcoal-600 flex items-start space-x-2 border border-charcoal-200/50">
                <ShieldAlert className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> This inspection constitutes an agreed baseline condition report between landlord and tenant. It will be referenced during move-out deposit reconciliation to eliminate arbitrary deductions.
                </p>
              </div>

              {/* Submit CTA */}
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
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Recording...' : 'Finalize Move-In Record'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
