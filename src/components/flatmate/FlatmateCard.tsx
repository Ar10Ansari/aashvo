import React from 'react';
import { Flatmate } from '../../types';
import { formatINR } from '../../utils/formatters';
import { MapPin, MessageCircle, CheckCircle2 } from 'lucide-react';

interface FlatmateCardProps {
  flatmate: Flatmate;
  onSelect: (flatmate: Flatmate) => void;
}

export const FlatmateCard: React.FC<FlatmateCardProps> = ({ flatmate, onSelect }) => {
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

        {/* Has Room vs Seeking Room Pill */}
        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-sm ${
            flatmate.hasRoom
              ? 'bg-forest-50 text-forest-700 border-forest-200'
              : 'bg-sand-100 text-charcoal-800 border-sand-300'
          }`}
        >
          {flatmate.hasRoom ? 'Has Room' : 'Looking to Team Up'}
        </span>
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
