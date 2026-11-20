import React, { useState, useEffect, useMemo } from 'react';
import { Flatmate } from '../../types';
import { formatINR } from '../../utils/formatters';
import { calculateFlatmateCompatibility } from '../../services/marketplaceService';
import { MapPin, MessageCircle, CheckCircle2, Sparkles, Bookmark } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { savedService } from '../../services/savedService';

interface FlatmateCardProps {
  flatmate: Flatmate;
  onSelect: (flatmate: Flatmate) => void;
}

export const FlatmateCard: React.FC<FlatmateCardProps> = ({ flatmate, onSelect }) => {
  const { currentUser, showToast } = useApp();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (currentUser) {
      savedService
        .checkSaved('flatmate_profile', flatmate.id)
        .then((res) => setIsSaved(res.isSaved))
        .catch(() => {});
    }
  }, [currentUser, flatmate.id]);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (showToast) showToast('Please sign in to save flatmates.');
      return;
    }
    try {
      if (isSaved) {
        await savedService.unsaveItem('flatmate_profile', flatmate.id);
        setIsSaved(false);
        if (showToast) showToast('Removed from saved.');
      } else {
        await savedService.saveItem('flatmate_profile', flatmate.id);
        setIsSaved(true);
        if (showToast) showToast('Saved flatmate to shortlist!');
      }
    } catch {
      setIsSaved(!isSaved);
    }
  };
  const userPreferences: Partial<Flatmate> = useMemo(() => {
    const saved = localStorage.getItem('aashvo_flatmate_preferences');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      foodHabit: 'Vegetarian',
      sleepRoutine: 'Flexible',
      cleanliness: 'Spotless',
      petFriendly: true,
      smoking: 'No',
    };
  }, []);

  const compatibility = useMemo(() => {
    return calculateFlatmateCompatibility(userPreferences, flatmate);
  }, [userPreferences, flatmate]);
  return (
    <article
      onClick={() => onSelect(flatmate)}
      className="editorial-card rounded-3xl overflow-hidden cursor-pointer flex flex-col h-full group focus-within:ring-2 focus-within:ring-forest-600 focus:outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(flatmate);
        }
      }}
      aria-label={`View flatmate profile of ${flatmate.name}`}
    >
      {/* Top Banner & Avatar Header */}
      <div className="p-6 pb-4 bg-gradient-to-br from-ivory-100 to-ivory-200 border-b border-charcoal-100 flex items-start justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <img
              src={flatmate.avatar}
              alt={flatmate.name}
              loading="lazy"
              decoding="async"
              width={64}
              height={64}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-105 transition-transform"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
              }}
            />
            {flatmate.verified && (
              <span
                className="absolute -bottom-1 -right-1 bg-forest-600 text-white p-0.5 rounded-full border-2 border-white shadow-sm"
                title="Verified Student/Professional Profile"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-serif text-lg font-bold text-charcoal-900 group-hover:text-forest-700 transition-colors">
                {flatmate.name}, {flatmate.age}
              </h3>
            </div>
            <p className="text-xs text-charcoal-500 font-medium line-clamp-1">{flatmate.occupation}</p>
          </div>
        </div>

        {/* Badges: Has Room + Compatibility Score + Bookmark */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center space-x-1.5">
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-xs ${
                flatmate.hasRoom
                  ? 'bg-forest-50 text-forest-700 border-forest-200'
                  : 'bg-sand-100 text-charcoal-800 border-sand-300'
              }`}
            >
              {flatmate.hasRoom ? 'Has Room' : 'Looking to Team Up'}
            </span>
            <button
              onClick={handleToggleSave}
              className={`p-1 rounded-full border shadow-xs transition-all ${
                isSaved
                  ? 'bg-forest-800 text-sand-300 border-forest-700'
                  : 'bg-white text-charcoal-600 hover:text-charcoal-900 border-charcoal-200'
              }`}
              title={isSaved ? 'Remove from saved' : 'Save flatmate'}
              aria-label={isSaved ? 'Remove from saved' : 'Save flatmate'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest-100/80 text-forest-800 border border-forest-200 shadow-xs">
            <Sparkles className="w-2.5 h-2.5 text-forest-600" />
            <span>{compatibility.score}% Match</span>
          </span>
        </div>
      </div>

      {/* Profile Body */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Target Localities */}
          <div className="flex items-center space-x-1 text-xs text-charcoal-600 mb-3">
            <MapPin className="w-3.5 h-3.5 text-forest-600 flex-shrink-0" />
            <span className="truncate">{flatmate.targetLocalities.join(', ')}</span>
          </div>

          {/* Bio snippet */}
          <p className="text-xs text-charcoal-600 line-clamp-2 leading-relaxed mb-4">
            {flatmate.bio}
          </p>

          {/* Lifestyle Tags */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            <span className="text-[11px] bg-ivory-200 text-charcoal-700 px-2.5 py-0.5 rounded-md font-medium">
              🥗 {flatmate.foodHabit}
            </span>
            <span className="text-[11px] bg-ivory-200 text-charcoal-700 px-2.5 py-0.5 rounded-md font-medium">
              ⏰ {flatmate.sleepRoutine}
            </span>
            <span className="text-[11px] bg-ivory-200 text-charcoal-700 px-2.5 py-0.5 rounded-md font-medium">
              ✨ {flatmate.cleanliness}
            </span>
            {flatmate.petFriendly && (
              <span className="text-[11px] bg-ivory-200 text-charcoal-700 px-2.5 py-0.5 rounded-md font-medium">
                🐾 Pet Friendly
              </span>
            )}
          </div>
        </div>

        {/* Footer Budget & Connect Button */}
        <div className="pt-4 border-t border-charcoal-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-charcoal-400 font-semibold uppercase tracking-wider block">Target Budget</span>
            <span className="font-serif text-lg font-bold text-forest-800">Up to {formatINR(flatmate.budgetMax)}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(flatmate);
            }}
            className="px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5 text-sand-300" />
            <span>Connect</span>
          </button>
        </div>
      </div>
    </article>
  );
};
