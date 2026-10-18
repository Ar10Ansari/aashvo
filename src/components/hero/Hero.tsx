import React from 'react';
import { useApp } from '../../context/AppContext';
import { Search, MapPin, IndianRupee, Home, Users } from 'lucide-react';
import { ArchitecturalLandscape } from './ArchitecturalLandscape';
import { DELHI_NCR_LOCALITIES } from '../../data/seedData';

export const Hero: React.FC = () => {
  const { filters, setFilters, activeTab, setActiveTab } = useApp();

  const handleSearchClick = () => {
    const el = document.getElementById('discovery-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const setLocality = (loc: string) => {
    setFilters(prev => ({ ...prev, locality: loc }));
    handleSearchClick();
  };

  return (
    <section className="relative pt-12 sm:pt-16 lg:pt-20 bg-[#F5F3ED] overflow-hidden">
      {/* Decorative background atmospheric glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-sand-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-20">
        {/* Subtle Pill Eyebrow */}
        <div className="inline-flex items-center space-x-2 bg-white/80 border border-charcoal-200/60 px-3.5 py-1.5 rounded-full shadow-sm mb-6 sm:mb-8">
          <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide uppercase text-forest-800">
            Delhi NCR Pilot • Gurugram & South Delhi
          </span>
          <span className="text-charcoal-300">|</span>
          <span className="text-xs text-charcoal-500 font-medium">100% Zero-Brokerage for Owners</span>
        </div>

        {/* Centered Hero Headline */}
        <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-semibold text-charcoal tracking-tight leading-[1.08] mb-6">
          A better way <br />
          <span className="italic font-normal text-forest-700">to call a place home.</span>
        </h1>

        {/* Supporting Copy */}
        <p className="text-lg sm:text-xl text-charcoal-500 max-w-2xl mx-auto font-normal leading-relaxed mb-3">
          Find rooms, flats and flatmates that fit your life and your budget.
        </p>
        <p className="text-sm sm:text-base font-medium text-forest-800/90 tracking-wide mb-10">
          Simple. Safe. Built for real people.
        </p>

        {/* Tab switcher: Find a Place vs Find a Flatmate */}
        <div className="inline-flex p-1 bg-charcoal-100/70 rounded-2xl mb-4 border border-charcoal-200/40 shadow-inner">
          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'places'
                ? 'bg-white text-forest-800 shadow-sm'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <Home className="w-4 h-4 text-forest-600" />
            <span>Find a Place</span>
          </button>

          <button
            onClick={() => setActiveTab('flatmates')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'flatmates'
                ? 'bg-white text-forest-800 shadow-sm'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <Users className="w-4 h-4 text-forest-600" />
            <span>Find a Flatmate</span>
          </button>
        </div>

        {/* Functional Search Bar Panel */}
        <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-xl border border-charcoal-100/80 max-w-4xl mx-auto transition-all hover:shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Locality Input */}
            <div className="sm:col-span-4 text-left px-3 py-2 border-b sm:border-b-0 sm:border-r border-charcoal-100">
              <label htmlFor="hero-locality-select" className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-1 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-forest-600" />
                <span>Locality / Area</span>
              </label>
              <select
                id="hero-locality-select"
                value={filters.locality}
                onChange={e => setFilters(prev => ({ ...prev, locality: e.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-charcoal-800 focus:outline-none cursor-pointer truncate"
              >
                {DELHI_NCR_LOCALITIES.map(loc => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Type */}
            <div className="sm:col-span-3 text-left px-3 py-2 border-b sm:border-b-0 sm:border-r border-charcoal-100">
              <label htmlFor="hero-room-type-select" className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-1 flex items-center space-x-1">
                <Home className="w-3 h-3 text-forest-600" />
                <span>Accommodation</span>
              </label>
              <select
                id="hero-room-type-select"
                value={filters.roomType}
                onChange={e => setFilters(prev => ({ ...prev, roomType: e.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-charcoal-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Any Room Type</option>
                <option value="private_room">Private Room</option>
                <option value="shared_room">Shared Room</option>
                <option value="entire_flat">Entire Flat / 1BHK</option>
              </select>
            </div>

            {/* Max Budget */}
            <div className="sm:col-span-3 text-left px-3 py-2">
              <label htmlFor="hero-budget-select" className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-1 flex items-center space-x-1">
                <IndianRupee className="w-3 h-3 text-forest-600" />
                <span>Max Budget</span>
              </label>
              <select
                id="hero-budget-select"
                value={filters.maxBudget}
                onChange={e => setFilters(prev => ({ ...prev, maxBudget: Number(e.target.value) }))}
                className="w-full bg-transparent text-sm font-semibold text-charcoal-800 focus:outline-none cursor-pointer"
              >
                <option value="15000">Up to ₹15,000 / mo</option>
                <option value="25000">Up to ₹25,000 / mo</option>
                <option value="35000">Up to ₹35,000 / mo</option>
                <option value="60000">Up to ₹60,000 / mo</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="sm:col-span-2">
              <button
                onClick={handleSearchClick}
                className="w-full bg-forest-600 hover:bg-forest-700 active:bg-forest-800 text-white font-medium py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
              >
                <Search className="w-4 h-4 text-sand-300" />
                <span className="text-sm font-semibold">Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Locality Chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-charcoal-500">
          <span className="font-medium text-charcoal-400">Popular hubs:</span>
          {['DLF Phase 4, Gurugram', 'Hauz Khas, Delhi', 'Saket, Delhi', 'Sector 54 (Golf Course Rd), Gurugram'].map(hub => (
            <button
              key={hub}
              onClick={() => setLocality(hub)}
              className="bg-white/70 hover:bg-white text-charcoal-700 px-3 py-1 rounded-full border border-charcoal-200/50 hover:border-forest-400 transition-all text-xs"
            >
              {hub.split(',')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Architectural Landscape Illustration Anchored at Bottom of Hero */}
      <ArchitecturalLandscape />
    </section>
  );
};
