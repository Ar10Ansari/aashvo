import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PropertyCard } from '../property/PropertyCard';
import { PropertyFilters } from '../property/PropertyFilters';
import { FlatmateCard } from '../flatmate/FlatmateCard';
import { Users, UtensilsCrossed, Building2, RotateCcw, HeartHandshake, AlertCircle, Loader2, Sparkles, PlusCircle, Home } from 'lucide-react';
import { FoodHabit, MealsOffered } from '../../types';

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
    openConnectModal,
    setIsListPropertyOpen,
    isLoadingData,
    dataLoadError,
    retryDataLoad,
  } = useApp();

  // Local filter states for Family Stays & Flatmates
  const [selectedMealFilter, setSelectedMealFilter] = useState<MealsOffered | 'all'>('all');
  const [selectedFoodHabit, setSelectedFoodHabit] = useState<FoodHabit | 'all'>('all');
  const [flatmateRoomStatus, setFlatmateRoomStatus] = useState<'all' | 'has_room' | 'needs_room'>('all');

  // Filter properties logic
  const filteredProperties = properties.filter(prop => {
    // Only active listings in public grid
    if (prop.status !== 'active') return false;

    // Filter by Active Tab Category
    if (activeTab === 'family_stays') {
      if (prop.category !== 'family_stays' && !prop.familyLivesOnProperty) {
        return false;
      }
      if (selectedMealFilter !== 'all') {
        if (prop.mealsOffered !== selectedMealFilter) return false;
      }
    } else if (activeTab === 'entire_flats') {
      if (prop.roomType !== 'entire_flat') {
        return false;
      }
    }

    // Search query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        prop.title.toLowerCase().includes(q) ||
        prop.locality.toLowerCase().includes(q) ||
        prop.city.toLowerCase().includes(q) ||
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

    // Room Type (applicable in general or entire flat mode)
    if (activeTab !== 'family_stays' && activeTab !== 'entire_flats' && filters.roomType && filters.roomType !== 'all') {
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

  // Filter flatmates logic
  const filteredFlatmates = flatmates.filter(mate => {
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        mate.name.toLowerCase().includes(q) ||
        mate.occupation.toLowerCase().includes(q) ||
        mate.targetLocalities.some(l => l.toLowerCase().includes(q)) ||
        mate.bio.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedFoodHabit !== 'all' && mate.foodHabit !== selectedFoodHabit) {
      return false;
    }

    if (flatmateRoomStatus === 'has_room' && !mate.hasRoom) return false;
    if (flatmateRoomStatus === 'needs_room' && mate.hasRoom) return false;

    if (mate.budgetMax > filters.maxBudget) {
      return false;
    }

    return true;
  });

  // Category counts
  const familyStayCount = properties.filter(p => p.status === 'active' && (p.category === 'family_stays' || p.familyLivesOnProperty)).length;
  const entireFlatCount = properties.filter(p => p.status === 'active' && p.roomType === 'entire_flat').length;

  return (
    <section id="discovery-section" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
      {/* Section Header & Tab Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 pb-5 border-b border-charcoal-200/40 gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-2.5 py-0.5 rounded-full border border-forest-100 inline-block mb-1.5">
            {activeTab === 'flatmates' && 'Flatmates & Shared Rooms'}
            {activeTab === 'family_stays' && 'Family Stays (with Meals)'}
            {(activeTab === 'entire_flats' || activeTab === 'places') && 'Independent Flats'}
          </span>

          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal-900 tracking-tight">
            {activeTab === 'flatmates' && 'Find compatible flatmates.'}
            {activeTab === 'family_stays' && 'Family stays with home meals.'}
            {(activeTab === 'entire_flats' || activeTab === 'places') && 'Independent flats & apartments.'}
          </h2>

          <p className="text-xs sm:text-sm text-charcoal-500 mt-1 max-w-xl">
            {activeTab === 'flatmates' &&
              'Connect directly with students and professionals seeking shared rooms or looking to team up.'}
            {activeTab === 'family_stays' &&
              'Private and shared rooms in resident family homes with verified hosts and home-cooked meal options.'}
            {(activeTab === 'entire_flats' || activeTab === 'places') &&
              'Independent 1BHK, 2BHK, and studio flats with itemized costs and zero broker markup.'}
          </p>
        </div>

        {/* Tab switch pills - Confirmed Product Hierarchy: Flatmates (A), Family Stays (B), Entire Flats (C) */}
        <div className="flex flex-wrap items-center bg-ivory-300/80 p-1.5 rounded-2xl border border-charcoal-200/60 shadow-sm gap-1 self-start lg:self-end">
          {/* Primary A: Flatmates */}
          <button
            onClick={() => setActiveTab('flatmates')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'flatmates'
                ? 'bg-forest-700 text-white shadow-sm'
                : 'text-charcoal-700 hover:text-charcoal-900 hover:bg-ivory-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Flatmates ({flatmates.length})</span>
          </button>

          {/* Primary B: Family Stays */}
          <button
            onClick={() => setActiveTab('family_stays')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'family_stays'
                ? 'bg-forest-700 text-white shadow-sm'
                : 'text-charcoal-700 hover:text-charcoal-900 hover:bg-ivory-200'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-sand-400" />
            <span>Family Stays ({familyStayCount})</span>
          </button>

          {/* Secondary C: Entire Flats */}
          <button
            onClick={() => setActiveTab('entire_flats')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'entire_flats' || activeTab === 'places'
                ? 'bg-forest-700 text-white shadow-sm font-bold'
                : 'text-charcoal-600 hover:text-charcoal-900 hover:bg-ivory-200'
            }`}
            title="Secondary feature: Independent apartments & flats"
          >
            <Building2 className="w-4 h-4 text-charcoal-400" />
            <span>Entire Flats ({entireFlatCount})</span>
          </button>
        </div>
      </div>

      {/* Category-Specific Sub-filter bars */}
      {activeTab === 'family_stays' && (
        <div className="mb-6 bg-white rounded-2xl p-4 border border-charcoal-200/70 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal-600 flex items-center space-x-1.5 mr-2">
              <UtensilsCrossed className="w-3.5 h-3.5 text-forest-700" />
              <span>Meal Options:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Family Stays' },
                  { id: 'included', label: 'Meals Included in Rent' },
                  { id: 'optional_extra', label: 'Meals Extra (Optional)' },
                  { id: 'none', label: 'Self-Catering Only' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedMealFilter(opt.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                    selectedMealFilter === opt.id
                      ? 'bg-forest-600 text-white shadow-sm'
                      : 'bg-ivory-100 text-charcoal-600 hover:bg-ivory-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-charcoal-500 bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-xl">
            <strong>Resident Family Rule:</strong> Only families living on premise are eligible.
          </div>
        </div>
      )}

      {activeTab === 'flatmates' && (
        <>
          {/* Aashvo Connect Swipe-Deck Feature Banner */}
          <div className="mb-6 bg-gradient-to-r from-forest-800 to-forest-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-forest-700">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-forest-700/80 border border-forest-600 text-sand-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Aashvo Connect</span>
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
                Swipe-Based Flatmate Discovery & Mutual Matching
              </h3>
              <p className="text-xs sm:text-sm text-ivory-200/90 max-w-xl leading-relaxed">
                Compare 5-dimension lifestyle compatibility (diet, sleep, cleanliness, budget, interests) and match before chatting. Direct profile inquiries remain available below.
              </p>
            </div>
            <button
              onClick={() => openConnectModal()}
              className="px-6 py-3 rounded-full bg-sand-400 text-forest-950 font-bold text-xs sm:text-sm hover:bg-sand-300 shadow-md transition-all self-start md:self-center flex items-center space-x-2 flex-shrink-0"
            >
              <Sparkles className="w-4 h-4 text-forest-900" />
              <span>Launch Aashvo Connect</span>
            </button>
          </div>

          <div className="mb-6 bg-white rounded-2xl p-4 border border-charcoal-200/70 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal-600 flex items-center space-x-1.5 mr-1">
              <HeartHandshake className="w-3.5 h-3.5 text-forest-700" />
              <span>Lifestyle Habits:</span>
            </span>
            <select
              value={selectedFoodHabit}
              onChange={e => setSelectedFoodHabit(e.target.value as FoodHabit | 'all')}
              className="bg-ivory-100 text-xs font-medium text-charcoal-800 rounded-xl px-3 py-1.5 border border-charcoal-200 focus:outline-none focus:ring-2 focus:ring-forest-600"
            >
              <option value="all">Any Food Habits</option>
              <option value="Vegetarian">Strict Vegetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Vegan">Vegan</option>
            </select>

            <select
              value={flatmateRoomStatus}
              onChange={e => setFlatmateRoomStatus(e.target.value as 'all' | 'has_room' | 'needs_room')}
              className="bg-ivory-100 text-xs font-medium text-charcoal-800 rounded-xl px-3 py-1.5 border border-charcoal-200 focus:outline-none focus:ring-2 focus:ring-forest-600"
            >
              <option value="all">All Profiles</option>
              <option value="has_room">Has a Vacant Room to Share</option>
              <option value="needs_room">Seeking a Room / Team Up</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSelectedFoodHabit('all');
              setFlatmateRoomStatus('all');
              resetFilters();
            }}
            className="text-xs text-charcoal-500 hover:text-forest-700 flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-ivory-100"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Profile Filters</span>
          </button>
        </div>
        </>
      )}

      {/* Multi-dimensional Property Filter Bar for Family Stays & Entire Flats */}
      {(activeTab === 'family_stays' || activeTab === 'entire_flats' || activeTab === 'places') && <PropertyFilters />}

      {/* Live Backend Error Banner */}
      {dataLoadError && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Unable to load live marketplace inventory</strong>
              <span className="text-rose-700">{dataLoadError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={retryDataLoad}
            className="px-4 py-2 bg-rose-900 text-white rounded-xl font-semibold hover:bg-rose-800 transition-colors self-start sm:self-center shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Content Grid */}
      {isLoadingData ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-charcoal-200/60 max-w-lg mx-auto">
          <Loader2 className="w-8 h-8 text-forest-700 animate-spin mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-charcoal-800">Loading verified inventory...</h3>
          <p className="text-xs text-charcoal-500 mt-1">Connecting to Aashvo marketplace database.</p>
        </div>
      ) : activeTab === 'flatmates' ? (
        filteredFlatmates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredFlatmates.map(flatmate => (
              <FlatmateCard
                key={flatmate.id}
                flatmate={flatmate}
                onSelect={setSelectedFlatmate}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-charcoal-200/60 max-w-lg mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-forest-50 text-forest-700 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mb-2">
              {flatmates.length === 0
                ? 'No flatmate profiles found'
                : filters.locality && filters.locality !== 'All Localities'
                ? `No flatmates in ${filters.locality} yet`
                : 'No matching flatmates found'}
            </h3>
            <p className="text-xs sm:text-sm text-charcoal-500 mb-6 leading-relaxed max-w-md mx-auto">
              {flatmates.length === 0
                ? 'Create your profile to be discovered by compatible flatmates, or compare lifestyle habits with Aashvo Connect.'
                : filters.locality && filters.locality !== 'All Localities'
                ? 'No flatmate profiles active in this exact area yet. Try expanding your search or launch Aashvo Connect.'
                : "We couldn't find flatmate profiles matching your active filters. Try expanding your food preferences or resetting filters."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => openConnectModal()}
                className="bg-forest-700 hover:bg-forest-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sand-300" />
                <span>Launch Aashvo Connect</span>
              </button>
              {(selectedFoodHabit !== 'all' || flatmateRoomStatus !== 'all' || (filters.locality && filters.locality !== 'All Localities')) && (
                <button
                  onClick={() => {
                    setSelectedFoodHabit('all');
                    setFlatmateRoomStatus('all');
                    resetFilters();
                  }}
                  className="bg-ivory-200 hover:bg-ivory-300 text-charcoal-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>
        )
      ) : filteredProperties.length > 0 ? (
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
        <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-charcoal-200/60 max-w-lg mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 text-forest-700 flex items-center justify-center mx-auto mb-4">
            <Home className="w-7 h-7" />
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mb-2">
            {properties.length === 0 || (filters.locality && filters.locality !== 'All Localities')
              ? 'No listings in this area yet'
              : 'No matching listings found'}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal-500 mb-6 leading-relaxed max-w-md mx-auto">
            {properties.length === 0 || (filters.locality && filters.locality !== 'All Localities')
              ? 'Be the first to list your property with 100% zero brokerage and reach verified students and professionals.'
              : `We couldn't find any active ${activeTab === 'family_stays' ? 'Family Stays' : 'flats'} matching your exact budget or meal options. Try adjusting your filters or list a new property.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsListPropertyOpen(true)}
              className="bg-forest-700 hover:bg-forest-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5 text-sand-300" />
              <span>List Your Property (₹0 Fee)</span>
            </button>
            <button
              onClick={() => {
                setSelectedMealFilter('all');
                resetFilters();
              }}
              className="bg-ivory-200 hover:bg-ivory-300 text-charcoal-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
