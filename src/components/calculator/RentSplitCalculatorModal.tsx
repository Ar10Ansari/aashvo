import React, { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  Users,
  Percent,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Share2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  calculateRentSplit,
  exportBreakdownText,
  serializeCalculatorState,
} from '../../services/rentCalculatorService';
import type { CalculateRentSplitInput, FlatmateRoomConfig } from '@aashvo/contracts';

interface RentSplitCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRent?: number;
  initialDeposit?: number;
}

export const RentSplitCalculatorModal: React.FC<RentSplitCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialRent = 30000,
  initialDeposit = 60000,
}) => {
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom' | 'percentage'>('equal');
  const [totalMonthlyRent, setTotalMonthlyRent] = useState<number>(initialRent);
  const [totalDeposit, setTotalDeposit] = useState<number>(initialDeposit);

  // Utilities
  const [showUtilities, setShowUtilities] = useState<boolean>(true);
  const [electricity, setElectricity] = useState<number>(2500);
  const [water, setWater] = useState<number>(500);
  const [wifi, setWifi] = useState<number>(1000);
  const [maintenance, setMaintenance] = useState<number>(2000);
  const [housekeeping, setHousekeeping] = useState<number>(0);
  const [other, setOther] = useState<number>(0);

  // Flatmates
  const [flatmates, setFlatmates] = useState<FlatmateRoomConfig[]>([
    { flatmateName: 'You (Room 1)', customRentAmount: 16000, percentageShare: 50 },
    { flatmateName: 'Flatmate 2 (Room 2)', customRentAmount: 14000, percentageShare: 50 },
  ]);

  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute breakdown
  const input: CalculateRentSplitInput = useMemo(
    () => ({
      splitMethod,
      totalMonthlyRent: Number(totalMonthlyRent) || 0,
      totalDeposit: Number(totalDeposit) || 0,
      utilities: showUtilities
        ? {
            electricity: Number(electricity) || 0,
            water: Number(water) || 0,
            wifi: Number(wifi) || 0,
            maintenance: Number(maintenance) || 0,
            housekeeping: Number(housekeeping) || 0,
            other: Number(other) || 0,
          }
        : {},
      flatmates,
    }),
    [
      splitMethod,
      totalMonthlyRent,
      totalDeposit,
      showUtilities,
      electricity,
      water,
      wifi,
      maintenance,
      housekeeping,
      other,
      flatmates,
    ],
  );

  const summary = useMemo(() => calculateRentSplit(input), [input]);

  if (!isOpen) return null;

  const handleAddFlatmate = () => {
    const nextIdx = flatmates.length + 1;
    setFlatmates((prev) => [
      ...prev,
      {
        flatmateName: `Flatmate ${nextIdx}`,
        customRentAmount: 0,
        percentageShare: 0,
      },
    ]);
  };

  const handleRemoveFlatmate = (index: number) => {
    if (flatmates.length <= 1) return;
    setFlatmates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFlatmate = (index: number, updates: Partial<FlatmateRoomConfig>) => {
    setFlatmates((prev) =>
      prev.map((fm, i) => (i === index ? { ...fm, ...updates } : fm)),
    );
  };

  const handleCopyText = async () => {
    const text = exportBreakdownText(summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyShareLink = async () => {
    const token = serializeCalculatorState(input);
    const url = `${window.location.origin}?split=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const currency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rent-split-title"
    >
      <div className="bg-[#FBF9F5] rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
              <Calculator className="w-5 h-5 text-sand-400" />
            </div>
            <div>
              <h2 id="rent-split-title" className="font-serif font-bold text-xl text-forest-900">
                AASHVO Rent & Expense Split Calculator
              </h2>
              <p className="text-xs text-charcoal-500">
                Fair, transparent co-living allocations for rooms, utilities & deposits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close rent split calculator"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Split Mode Selector */}
          <div className="grid grid-cols-3 gap-2 bg-charcoal-100/80 p-1.5 rounded-2xl">
            <button
              onClick={() => setSplitMethod('equal')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
                splitMethod === 'equal'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Users className="w-4 h-4 text-forest-700" />
              <span>Equal Split</span>
            </button>
            <button
              onClick={() => setSplitMethod('custom')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
                splitMethod === 'custom'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Sliders className="w-4 h-4 text-forest-700" />
              <span>Room Tiers</span>
            </button>
            <button
              onClick={() => setSplitMethod('percentage')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${
                splitMethod === 'percentage'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Percent className="w-4 h-4 text-forest-700" />
              <span>Percentage %</span>
            </button>
          </div>

          {/* Primary Financial Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-charcoal-200/60 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">
                Total Monthly Flat Rent (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-charcoal-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={totalMonthlyRent}
                  onChange={(e) => setTotalMonthlyRent(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 bg-charcoal-50/50 rounded-xl border border-charcoal-200 text-charcoal-900 font-semibold focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-charcoal-200/60 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">
                Total Security Deposit (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-charcoal-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={totalDeposit}
                  onChange={(e) => setTotalDeposit(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 bg-charcoal-50/50 rounded-xl border border-charcoal-200 text-charcoal-900 font-semibold focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
              </div>
            </div>
          </div>

          {/* Utilities Accordion */}
          <div className="bg-white rounded-2xl border border-charcoal-200/60 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                  Recurring Monthly Utilities
                </span>
                <span className="text-xs font-extrabold text-forest-800 bg-forest-50 px-2 py-0.5 rounded-full">
                  {currency(summary.totalMonthlyUtilities)}/mo
                </span>
              </div>
              <button
                onClick={() => setShowUtilities(!showUtilities)}
                className="text-xs font-semibold text-forest-700 hover:text-forest-900"
              >
                {showUtilities ? 'Hide Breakdown' : 'Customize Utilities'}
              </button>
            </div>

            {showUtilities && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Electricity</label>
                  <input
                    type="number"
                    min="0"
                    value={electricity}
                    onChange={(e) => setElectricity(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Wi-Fi Broadband</label>
                  <input
                    type="number"
                    min="0"
                    value={wifi}
                    onChange={(e) => setWifi(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Water Bill</label>
                  <input
                    type="number"
                    min="0"
                    value={water}
                    onChange={(e) => setWater(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Maintenance</label>
                  <input
                    type="number"
                    min="0"
                    value={maintenance}
                    onChange={(e) => setMaintenance(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Housekeeping</label>
                  <input
                    type="number"
                    min="0"
                    value={housekeeping}
                    onChange={(e) => setHousekeeping(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal-500 mb-1">Other / Piped Gas</label>
                  <input
                    type="number"
                    min="0"
                    value={other}
                    onChange={(e) => setOther(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-charcoal-50 rounded-lg border border-charcoal-200 text-charcoal-800 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flatmates Configuration List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                Flatmates & Room Allocations ({flatmates.length})
              </h3>
              <button
                onClick={handleAddFlatmate}
                className="text-xs font-semibold text-forest-800 hover:text-forest-900 flex items-center space-x-1 px-3 py-1 bg-forest-50 rounded-lg hover:bg-forest-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Flatmate</span>
              </button>
            </div>

            <div className="space-y-2">
              {flatmates.map((fm, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3.5 rounded-2xl border border-charcoal-200/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      type="text"
                      value={fm.flatmateName}
                      onChange={(e) => handleUpdateFlatmate(idx, { flatmateName: e.target.value })}
                      placeholder={`Flatmate ${idx + 1}`}
                      className="w-full px-3 py-1.5 text-xs font-semibold text-charcoal-800 bg-charcoal-50/50 rounded-lg border border-charcoal-200 focus:outline-none"
                    />
                  </div>

                  {splitMethod === 'custom' && (
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <span className="text-xs text-charcoal-500 font-medium">Room Rent:</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-charcoal-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={fm.customRentAmount || 0}
                          onChange={(e) =>
                            handleUpdateFlatmate(idx, { customRentAmount: Number(e.target.value) || 0 })
                          }
                          className="w-32 pl-6 pr-2.5 py-1 text-xs font-bold text-charcoal-900 bg-charcoal-50 rounded-lg border border-charcoal-200"
                        />
                      </div>
                    </div>
                  )}

                  {splitMethod === 'percentage' && (
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <span className="text-xs text-charcoal-500 font-medium">Share:</span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={fm.percentageShare || 0}
                          onChange={(e) =>
                            handleUpdateFlatmate(idx, { percentageShare: Number(e.target.value) || 0 })
                          }
                          className="w-20 pl-2.5 pr-6 py-1 text-xs font-bold text-charcoal-900 bg-charcoal-50 rounded-lg border border-charcoal-200"
                        />
                        <span className="absolute right-2 top-1.5 text-xs text-charcoal-400">%</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleRemoveFlatmate(idx)}
                    disabled={flatmates.length <= 1}
                    className="p-1.5 text-charcoal-400 hover:text-rose-600 disabled:opacity-30 transition-colors"
                    title="Remove flatmate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Validation Banner */}
            {!summary.isValidAllocation && summary.validationMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{summary.validationMessage}</span>
              </div>
            )}
          </div>

          {/* Allocation Breakdown Results */}
          <div className="bg-[#244737] text-white p-5 rounded-3xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-sand-300 font-semibold">
                  Flat Monthly Total Commitment
                </span>
                <p className="font-serif text-2xl font-bold text-white">
                  {currency(summary.totalMonthlyCommitment)}/month
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[11px] uppercase tracking-wider text-sand-300 font-semibold">
                  Total Flat Deposit
                </span>
                <p className="text-lg font-bold text-sand-200">{currency(summary.totalDeposit)}</p>
              </div>
            </div>

            {/* Per-Flatmate Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {summary.allocations.map((alloc, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-sand-200 truncate">{alloc.flatmateName}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                      {alloc.sharePercentage}%
                    </span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 border-t border-white/10 text-white/80">
                    <div className="flex justify-between">
                      <span>Room Rent:</span>
                      <span className="font-semibold text-white">{currency(alloc.rentShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Utilities Share:</span>
                      <span className="font-semibold text-white">{currency(alloc.utilitiesShare)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sand-300 pt-1 border-t border-white/10">
                      <span>Monthly Total:</span>
                      <span>{currency(alloc.totalMonthlyPayment)}</span>
                    </div>
                    <div className="flex justify-between text-white/70 pt-0.5">
                      <span>Deposit Share:</span>
                      <span className="font-medium text-white">{currency(alloc.depositShare)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Demarcation Notice */}
          <div className="p-3 bg-charcoal-100/60 rounded-xl text-[11px] text-charcoal-600 flex items-start space-x-2 border border-charcoal-200/50">
            <ShieldAlert className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Notice:</strong> This calculation is for mutual informational alignment only. AASHVO does not process financial transactions, act as an escrow agent, or collect rent payments. Flatmates coordinate rent disbursement directly with property landlords.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-[#F5F3ED] border-t border-charcoal-200/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleCopyText}
              className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-ivory-100 text-forest-900 border border-charcoal-200 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all"
            >
              {copiedText ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-forest-700" />
                  <span>Copy WhatsApp Breakdown</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyShareLink}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-ivory-100 text-charcoal-700 border border-charcoal-200 text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all"
              title="Copy shareable link"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Share2 className="w-4 h-4 text-charcoal-600" />
              )}
              <span>Share</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
