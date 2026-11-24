import React, { useState, useEffect } from 'react';
import { Property } from '../../types';
import { formatINR, getFreshnessInfo, getProviderBadge, formatRoomType } from '../../utils/formatters';
import { MapPin, ArrowUpRight, Bookmark } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { savedService } from '../../services/savedService';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSelect }) => {
  const { currentUser, showToast } = useApp();
  const [isSaved, setIsSaved] = useState(false);
  const freshness = getFreshnessInfo(property.lastVerifiedDate);
  const provider = getProviderBadge(property.providerType, property.brokerageFee);

  useEffect(() => {
    if (currentUser) {
      const type = property.category === 'family_stays' ? 'family_stay' : 'property';
      savedService
        .checkSaved(type, property.id)
        .then((res) => setIsSaved(res.isSaved))
        .catch(() => {});
    }
  }, [currentUser, property.id, property.category]);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (showToast) showToast('Please sign in to save listings.');
      return;
    }
    const targetType = property.category === 'family_stays' ? 'family_stay' : 'property';
    try {
      if (isSaved) {
        await savedService.unsaveItem(targetType, property.id);
        setIsSaved(false);
        if (showToast) showToast('Removed from saved.');
      } else {
        await savedService.saveItem(targetType, property.id);
        setIsSaved(true);
        if (showToast) showToast('Saved to shortlist!');
      }
    } catch (err: unknown) {
      if (showToast) {
        showToast(err instanceof Error ? err.message : 'Failed to update saved status.');
      }
    }
  };

  return (
    <article
      onClick={() => onSelect(property)}
      className="editorial-card rounded-3xl overflow-hidden cursor-pointer flex flex-col h-full group focus-within:ring-2 focus-within:ring-forest-600 focus:outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(property);
        }
      }}
      aria-label={`View details for ${property.title}`}
    >
      {/* Property Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ivory-300">
        <img
          src={property.images[0]}
          alt={property.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.src = 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Top Floating Badges */}
        <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2 pointer-events-none">
          {/* Freshness Badge */}
          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md shadow-sm ${freshness.badgeColor}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{freshness.label}</span>
          </span>

          <div className="flex items-center space-x-1.5 pointer-events-auto">
            {/* Provider Tag or Family Stay Tag */}
            {property.category === 'family_stays' ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sand-200/90 text-forest-900 border border-sand-400 backdrop-blur-md shadow-sm">
                Resident Family
              </span>
            ) : (
              <span className={`px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-md shadow-sm ${provider.badgeStyle}`}>
                {provider.label}
              </span>
            )}

            {/* Bookmark button */}
            <button
              onClick={handleToggleSave}
              className={`p-1.5 rounded-full backdrop-blur-md border shadow-sm transition-all ${
                isSaved
                  ? 'bg-forest-800 text-sand-300 border-forest-700'
                  : 'bg-white/85 hover:bg-white text-charcoal-700 border-white/60'
              }`}
              title={isSaved ? 'Remove from saved' : 'Save listing'}
              aria-label={isSaved ? 'Remove from saved' : 'Save listing'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Floating Pills: Room Type & Meal Status */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="bg-charcoal-900/80 backdrop-blur-md text-ivory-50 text-xs font-medium px-3 py-1 rounded-full">
            {formatRoomType(property.roomType)}
          </span>

          {property.category === 'family_stays' && property.mealsOffered && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm border ${
              property.mealsOffered === 'included'
                ? 'bg-emerald-900/85 text-emerald-100 border-emerald-700/60'
                : property.mealsOffered === 'optional_extra'
                ? 'bg-amber-950/85 text-amber-200 border-amber-700/60'
                : 'bg-charcoal-900/85 text-charcoal-200 border-charcoal-700/60'
            }`}>
              {property.mealsOffered === 'included'
                ? 'Meals Included'
                : property.mealsOffered === 'optional_extra'
                ? `Meals (+${formatINR(property.optionalMealCost || 3000)})`
                : 'Self-Catering'}
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Locality & Address */}
          <div className="flex items-center space-x-1.5 text-xs text-charcoal-500 font-medium mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-forest-600 flex-shrink-0" />
            <span className="truncate">{property.locality}, {property.city}</span>
          </div>

          {/* Title */}
          <h3 className="font-serif text-lg font-semibold text-charcoal-900 line-clamp-1 group-hover:text-forest-700 transition-colors">
            {property.title}
          </h3>

          <p className="text-xs text-charcoal-500 line-clamp-2 mt-1 mb-4">
            {property.description}
          </p>

          {/* Key Amenities preview */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {property.amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="text-[11px] bg-ivory-200 text-charcoal-700 px-2 py-0.5 rounded-md font-medium"
              >
                {amenity}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-[11px] text-charcoal-400 font-medium px-1">
                +{property.amenities.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Financial Transparency Section */}
        <div className="pt-4 border-t border-charcoal-100 flex items-end justify-between">
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="font-serif text-2xl font-bold text-forest-800">
                {formatINR(property.rent)}
              </span>
              <span className="text-xs text-charcoal-500 font-medium">/ month</span>
            </div>

            {/* Clear Deposit & Maintenance */}
            <div className="flex items-center space-x-3 text-[11px] text-charcoal-500 mt-0.5">
              <span>Deposit: <strong className="text-charcoal-700 font-semibold">{formatINR(property.deposit)}</strong></span>
              <span>•</span>
              <span>Maint: <strong className="text-charcoal-700 font-semibold">{formatINR(property.maintenance)}</strong></span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(property);
            }}
            className="w-10 h-10 rounded-full bg-forest-50 text-forest-800 hover:bg-forest-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
            aria-label="View transparent cost breakdown"
          >
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </article>
  );
};
