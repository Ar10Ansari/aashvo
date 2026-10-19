import React from 'react';
import { useApp } from '../../context/AppContext';
import { POPULAR_LOCALITIES } from '../../data/seedData';
import { RotateCcw, Search } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export const PropertyFilters: React.FC = () => {
  const { filters, setFilters, resetFilters } = useApp();

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-charcoal-100 shadow-sm mb-8">
      {/* Top Search bar inside filters */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 text-charcoal-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
          placeholder="Search by keywords, amenities, or street name (e.g. 'Galleria', 'Terrace', 'Balcony')..."
          className="w-full pl-11 pr-4 py-3 bg-ivory-100/80 rounded-2xl border border-charcoal-200/50 text-sm text-charcoal-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Locality Filter */}
        <div>
          <label htmlFor="filter-locality-select" className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1.5">
            Locality / City
          </label>
          <select
            id="filter-locality-select"
            value={filters.locality}
            onChange={e => setFilters(prev => ({ ...prev, locality: e.target.value }))}
            className="w-full bg-ivory-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal-800 border border-charcoal-200/50 focus:outline-none focus:ring-2 focus:ring-forest-600 cursor-pointer"
          >
            {POPULAR_LOCALITIES.map(loc => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Room Type */}
        <div>
          <label htmlFor="filter-room-type-select" className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1.5">
            Room Type
          </label>
          <select
            id="filter-room-type-select"
            value={filters.roomType}
            onChange={e => setFilters(prev => ({ ...prev, roomType: e.target.value }))}
            className="w-full bg-ivory-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal-800 border border-charcoal-200/50 focus:outline-none focus:ring-2 focus:ring-forest-600 cursor-pointer"
          >
            <option value="all">All Room Types</option>
            <option value="private_room">Private Room</option>
            <option value="shared_room">Shared Room</option>
            <option value="entire_flat">Entire Flat</option>
          </select>
        </div>

        {/* Provider Type (Owner vs Broker) */}
        <div>
          <label htmlFor="filter-provider-type-select" className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1.5">
            Provider Type
          </label>
          <select
            id="filter-provider-type-select"
            value={filters.providerType}
            onChange={e => setFilters(prev => ({ ...prev, providerType: e.target.value }))}
            className="w-full bg-ivory-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal-800 border border-charcoal-200/50 focus:outline-none focus:ring-2 focus:ring-forest-600 cursor-pointer"
          >
            <option value="all">All Verified Providers</option>
            <option value="owner">Direct Owner Only (₹0 Brokerage)</option>
            <option value="tenant_flatmate">Current Flatmates</option>
            <option value="verified_manager">Verified Property Managers</option>
          </select>
        </div>

        {/* Furnishing */}
        <div>
          <label htmlFor="filter-furnishing-select" className="block text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1.5">
            Furnishing
          </label>
          <select
            id="filter-furnishing-select"
            value={filters.furnishing}
            onChange={e => setFilters(prev => ({ ...prev, furnishing: e.target.value }))}
            className="w-full bg-ivory-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal-800 border border-charcoal-200/50 focus:outline-none focus:ring-2 focus:ring-forest-600 cursor-pointer"
          >
            <option value="all">Any Furnishing</option>
            <option value="fully_furnished">Fully Furnished</option>
            <option value="semi_furnished">Semi Furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </div>
      </div>

      {/* Budget Slider Row & Reset Button */}
      <div className="mt-5 pt-4 border-t border-charcoal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between text-xs font-semibold text-charcoal-700 mb-1">
            <span>Budget Ceiling:</span>
            <span className="font-serif text-sm font-bold text-forest-800">{formatINR(filters.maxBudget)} / mo</span>
          </div>
          <input
            type="range"
            min="10000"
            max="60000"
            step="2000"
            value={filters.maxBudget}
            onChange={e => setFilters(prev => ({ ...prev, maxBudget: Number(e.target.value) }))}
            className="w-full accent-forest-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-charcoal-400 mt-1">
            <span>₹10,000</span>
            <span>₹35,000</span>
            <span>₹60,000+</span>
          </div>
        </div>

        <button
          onClick={resetFilters}
          className="text-xs text-charcoal-500 hover:text-forest-700 flex items-center space-x-1 px-3 py-2 rounded-xl hover:bg-ivory-200 transition-all self-end sm:self-center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    </div>
  );
};
