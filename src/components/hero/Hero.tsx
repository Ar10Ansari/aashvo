import React from 'react';
import { useApp } from '../../context/AppContext';
import { Search, MapPin, IndianRupee, Home, Users } from 'lucide-react';
import { ArchitecturalLandscape } from './ArchitecturalLandscape';
import { POPULAR_LOCALITIES } from '../../data/seedData';

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
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 bg-white/80 border border-charcoal-200/60 px-3.5 py-1.5 rounded-2xl sm:rounded-full shadow-sm mb-6 sm:mb-8 max-w-full">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide uppercase text-forest-800">
              Made for moving, anywhere in India
            </span>
          </div>
          <span className="hidden sm:inline text-charcoal-300">|</span>
          <span className="text-xs text-charcoal-500 font-medium">100% Zero-Brokerage for Owners</span>
        </div>

        {/* Centered Hero Headline */}
        <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-semibold text-charcoal tracking-tight leading-[1.08] mb-4">
          Affordable living <br />
          <span className="italic font-normal text-forest-700">starts with the right people.</span>
        </h1>

        {/* Supporting Copy & Brand Tagline */}
        <p className="text-base sm:text-lg text-charcoal-600 max-w-xl mx-auto font-normal leading-relaxed mb-1.5">
          Find your flatmate, your room, or a family stay.
        </p>
        <p className="text-xs sm:text-sm font-medium text-forest-800 tracking-wide mb-6">
          Find your place. Find your people.
        </p>

        {/* Priority Primary Actions: Flatmates vs Family Stays */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-2.5">
          <button
            onClick={() => {
              setActiveTab('flatmates');
              handleSearchClick();
            }}
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs ${
              activeTab === 'flatmates'
                ? 'bg-forest-600 text-white shadow-sm'
                : 'bg-white hover:bg-forest-50/70 text-charcoal-800 border border-charcoal-200/70'
            }`}
          >
            <Users className="w-4 h-4 text-sand-400" />
            <span>Find Flatmates</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('family_stays');
              handleSearchClick();
            }}
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs ${
              activeTab === 'family_stays'
                ? 'bg-forest-600 text-white shadow-sm'
                : 'bg-white hover:bg-forest-50/70 text-charcoal-800 border border-charcoal-200/70'
            }`}
          >
            <Home className="w-4 h-4 text-sand-400" />
            <span>Explore Family Stays</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-sand-200/80 text-forest-900 px-1.5 py-0.5 rounded-full ml-1">
              Meals
            </span>
          </button>
        </div>

        {/* Subtle Secondary Option for Entire Flats */}
        <div className="mb-6">
          <button
            onClick={() => {
              setActiveTab('entire_flats');
              handleSearchClick();
            }}
            className="text-xs text-charcoal-500 hover:text-forest-700 underline underline-offset-4 font-medium transition-colors"
          >
            Browse Entire Flats →
          </button>
        </div>

        {/* Functional Search Bar Panel */}
        <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-xl border border-charcoal-100/80 max-w-4xl mx-auto transition-all hover:shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Locality Input */}
            <div className="sm:col-span-4 text-left px-3 py-2 border-b sm:border-b-0 sm:border-r border-charcoal-100">
              <label htmlFor="hero-locality-select" className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-1 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-forest-600" />
                <span>Locality / City</span>
              </label>
              <select
                id="hero-locality-select"
                value={filters.locality}
                onChange={e => setFilters(prev => ({ ...prev, locality: e.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-charcoal-800 focus:outline-none cursor-pointer truncate"
              >
                {POPULAR_LOCALITIES.map(loc => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Accommodation Category */}
            <div className="sm:col-span-3 text-left px-3 py-2 border-b sm:border-b-0 sm:border-r border-charcoal-100">
              <label htmlFor="hero-room-type-select" className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-1 flex items-center space-x-1">
                <Home className="w-3 h-3 text-forest-600" />
                <span>Living Category</span>
              </label>
              <select
                id="hero-room-type-select"
                value={filters.roomType}
                onChange={e => {
                  const val = e.target.value;
                  setFilters(prev => ({ ...prev, roomType: val }));
                  if (val === 'family_stay') {
                    setActiveTab('family_stays');
                  } else if (val === 'entire_flat') {
                    setActiveTab('entire_flats');
                  } else {
                    setActiveTab('flatmates');
                  }
                }}
                className="w-full bg-transparent text-sm font-semibold text-charcoal-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Living Options</option>
                <option value="private_room">Flatmates & Shared Rooms</option>
                <option value="family_stay">Family Stays (Resident Hosts)</option>
                <option value="entire_flat">Entire Flats (1BHK/2BHK)</option>
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
