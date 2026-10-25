import React from 'react';
import { Clock, Receipt, UserCheck, CheckCircle2, ShieldCheck, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TrustFeatures: React.FC = () => {
  const { setIsRentalTrustOpen } = useApp();

  return (
    <section className="py-12 sm:py-16 bg-white border-y border-charcoal-200/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-100">
            Trust & Transparency
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-charcoal-900 mt-2.5 mb-2 tracking-tight">
            No broker markups. No phantom listings.
          </h2>
          <p className="text-xs sm:text-sm text-charcoal-500 leading-relaxed font-sans">
            Every listing on Aashvo includes itemized costs, confirmed availability, and direct contact options.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: Complete Cost Breakdown */}
          <div className="p-6 rounded-2xl bg-ivory-50/80 border border-charcoal-200/40 hover:border-forest-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-forest-700 text-sand-300 flex items-center justify-center mb-4 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-1.5">
              Itemized Cost Breakdown
            </h3>
            <p className="text-xs text-charcoal-600 leading-relaxed mb-3">
              See the exact monthly rent, security deposit, society maintenance, and electricity per-unit cost upfront.
            </p>
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-forest-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest-600" />
              <span>Full deposit refund terms disclosed</span>
            </div>
          </div>

          {/* Feature 2: Availability Freshness */}
          <div className="p-6 rounded-2xl bg-ivory-50/80 border border-charcoal-200/40 hover:border-forest-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-forest-700 text-sand-300 flex items-center justify-center mb-4 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-1.5">
              Verified Freshness Badges
            </h3>
            <p className="text-xs text-charcoal-600 leading-relaxed mb-3">
              Every listing displays when availability was last re-confirmed. Inactive listings are paused automatically.
            </p>
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-forest-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest-600" />
              <span>No calls for already-rented places</span>
            </div>
          </div>

          {/* Feature 3: Clear Provider Identity */}
          <div className="p-6 rounded-2xl bg-ivory-50/80 border border-charcoal-200/40 hover:border-forest-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-forest-700 text-sand-300 flex items-center justify-center mb-4 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-1.5">
              Direct Provider Identity
            </h3>
            <p className="text-xs text-charcoal-600 leading-relaxed mb-3">
              Direct home owners and room-seeking flatmates are marked with ₹0 brokerage fees.
            </p>
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-forest-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest-600" />
              <span>Zero pushy telecallers or broker spam</span>
            </div>
          </div>
        </div>

        {/* Feature 4: Full-width Rental Trust & Protection Portal Banner */}
        <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-forest-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-md border border-forest-800">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 text-sand-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Rental Trust Infrastructure</span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
              Auditable Tenancy Agreements & Move-in Condition Logs
            </h3>
            <p className="text-xs sm:text-sm text-forest-100 leading-relaxed font-sans">
              Protect your deposit and stay. Access mutual digital leases, rent payment ledgers, room-by-room condition logs, verified two-sided reviews, and community dispute resolution.
            </p>
          </div>
          <button
            onClick={() => setIsRentalTrustOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-sand-300 hover:bg-sand-400 text-forest-950 rounded-xl font-semibold text-sm shadow-sm transition-all shrink-0"
          >
            <span>Open Rental Trust Portal</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
