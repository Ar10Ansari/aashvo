import { Clock, Receipt, UserCheck, CheckCircle2 } from 'lucide-react';

export const TrustFeatures: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white border-y border-[#292D2A]/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-100">
            Radical Transparency
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-charcoal mt-4 mb-3">
            No broker surprises. No phantom listings.
          </h2>
          <p className="text-charcoal-500 text-base sm:text-lg">
            We built Aashvo to dismantle the shady practices of Delhi NCR rentals. Here is how we protect your time and money.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1: Complete Cost Breakdown */}
          <div className="p-8 rounded-3xl bg-[#F5F3ED]/60 border border-charcoal-200/40 hover:bg-[#F5F3ED] transition-all hover:shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-forest-600 text-sand-300 flex items-center justify-center mb-6 shadow-sm">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-charcoal-800 mb-2">
              Itemized Cost Breakdown
            </h3>
            <p className="text-sm text-charcoal-500 leading-relaxed mb-4">
              See the exact monthly rent, security deposit terms, society maintenance charges, and electricity per-unit cost upfront. Never sign a lease with hidden surprise fees.
            </p>
            <div className="pt-3 border-t border-charcoal-200/30 flex items-center space-x-2 text-xs font-semibold text-forest-800">
              <CheckCircle2 className="w-4 h-4 text-forest-600" />
              <span>Full deposit refund timelines disclosed</span>
            </div>
          </div>

          {/* Feature 2: Availability Freshness Guarantee */}
          <div className="p-8 rounded-3xl bg-[#F5F3ED]/60 border border-charcoal-200/40 hover:bg-[#F5F3ED] transition-all hover:shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-forest-600 text-sand-300 flex items-center justify-center mb-6 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-charcoal-800 mb-2">
              Verified Freshness Badges
            </h3>
            <p className="text-sm text-charcoal-500 leading-relaxed mb-4">
              Every listing shows when the landlord or flatmate last re-confirmed availability. Listings inactive for over 14 days are demoted and paused automatically.
            </p>
            <div className="pt-3 border-t border-charcoal-200/30 flex items-center space-x-2 text-xs font-semibold text-forest-800">
              <CheckCircle2 className="w-4 h-4 text-forest-600" />
              <span>Zero calls for &quot;Sorry, that was rented last month&quot;</span>
            </div>
          </div>

          {/* Feature 3: Clear Owner vs Broker Identity */}
          <div className="p-8 rounded-3xl bg-[#F5F3ED]/60 border border-charcoal-200/40 hover:bg-[#F5F3ED] transition-all hover:shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-forest-600 text-sand-300 flex items-center justify-center mb-6 shadow-sm">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-charcoal-800 mb-2">
              Unambiguous Provider Identity
            </h3>
            <p className="text-sm text-charcoal-500 leading-relaxed mb-4">
              Direct property owners are verified and marked with ₹0 brokerage. Flatmates seeking room-sharers are identified. If a broker lists, their commission is capped and stated.
            </p>
            <div className="pt-3 border-t border-charcoal-200/30 flex items-center space-x-2 text-xs font-semibold text-forest-800">
              <CheckCircle2 className="w-4 h-4 text-forest-600" />
              <span>No pushy telecallers spamming your phone</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
