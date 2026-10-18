import React from 'react';
import { useApp } from '../../context/AppContext';
import { PropertyCard } from '../property/PropertyCard';
import { PropertyFilters } from '../property/PropertyFilters';
import { FlatmateCard } from '../flatmate/FlatmateCard';
import { Home, Users, RotateCcw } from 'lucide-react';

export const DiscoverySection: React.FC = () => {
  const {
    properties,
    flatmates,
    filters,
    activeTab,
    setActiveTab,
    setSelectedProperty,
    setSelectedFlatmate,
    resetFilters,
  } = useApp();

  // Filter properties logic
  const filteredProperties = properties.filter(prop => {
    // Only active listings in public grid
    if (prop.status !== 'active') return false;

    // Search query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        prop.title.toLowerCase().includes(q) ||
        prop.locality.toLowerCase().includes(q) ||
        prop.description.toLowerCase().includes(q) ||
        prop.amenities.some(a => a.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Locality
    if (filters.locality && filters.locality !== 'All Localities') {
      const cleanLoc = filters.locality.split(',')[0].trim();
      if (!prop.locality.toLowerCase().includes(cleanLoc.toLowerCase())) {
        return false;
      }
    }

    // Room Type
    if (filters.roomType && filters.roomType !== 'all') {
      if (prop.roomType !== filters.roomType) return false;
    }

    // Furnishing
    if (filters.furnishing && filters.furnishing !== 'all') {
      if (prop.furnishing !== filters.furnishing) return false;
    }

    // Provider Type
    if (filters.providerType && filters.providerType !== 'all') {
      if (prop.providerType !== filters.providerType) return false;
    }

    // Max Budget
    if (prop.rent > filters.maxBudget) {
      return false;
    }

    return true;
  });

  return (
    <section id="discovery-section" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
      {/* Section Header & Tab Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-charcoal-200/50 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-100">
            {activeTab === 'places' ? 'Verified Homes' : 'Community Matchmaker'}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-charcoal mt-3">
            {activeTab === 'places' ? 'Explore Rooms & Flats in Delhi NCR' : 'Meet Verified Flatmates'}
          </h2>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            {activeTab === 'places'
              ? `Showing ${filteredProperties.length} homes with 100% itemized costs & verified freshness`
              : `Showing ${flatmates.length} people seeking shared homes or flatmates in your area`}
          </p>
        </div>

        {/* Tab switch pills */}
        <div className="flex items-center space-x-2 bg-ivory-300/80 p-1 rounded-2xl border border-charcoal-200/40">
          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'places'
                ? 'bg-forest-600 text-white shadow-sm'
                : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Places ({filteredProperties.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('flatmates')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'flatmates'
                ? 'bg-forest-600 text-white shadow-sm'
                : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Flatmates ({flatmates.length})</span>
          </button>
        </div>
      </div>

      {/* When in Places tab: Display interactive multi-dimensional filter bar */}
      {activeTab === 'places' && <PropertyFilters />}

      {/* Content Grid */}
      {activeTab === 'places' ? (
        filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProperties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                onSelect={setSelectedProperty}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-charcoal-200/60 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-ivory-200 text-charcoal-400 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-charcoal-800 mb-2">
              No matching listings found
            </h3>
            <p className="text-xs text-charcoal-500 mb-6">
              We couldn&apos;t find any active listings matching your exact filters in Delhi NCR. Try adjusting your budget slider or clearing the locality filter.
            </p>
            <button
              onClick={resetFilters}
              className="bg-forest-600 hover:bg-forest-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              Reset All Filters
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {flatmates.map(flatmate => (
            <FlatmateCard
              key={flatmate.id}
              flatmate={flatmate}
              onSelect={setSelectedFlatmate}
            />
          ))}
        </div>
      )}
    </section>
  );
};
