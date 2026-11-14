import React, { useState } from 'react';
import type { ConnectCandidateView } from '@aashvo/contracts';
import {
  ShieldCheck,
  MapPin,
  Briefcase,
  Utensils,
  Moon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Home,
  User,
} from 'lucide-react';

interface ConnectProfileCardProps {
  candidate: ConnectCandidateView;
  dragOffset?: number; // positive = right (like), negative = left (pass)
  isTop?: boolean;
}

export const ConnectProfileCard: React.FC<ConnectProfileCardProps> = ({
  candidate,
  dragOffset = 0,
  isTop = false,
}) => {
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);

  // Calculate stamp opacity based on dragOffset
  const likeOpacity = Math.min(1, Math.max(0, dragOffset / 120));
  const passOpacity = Math.min(1, Math.max(0, -dragOffset / 120));

  const { compatibility } = candidate;

  // Format dietary label
  const formatHabit = (val: string) => {
    return val
      .replace('_', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="relative w-full h-[580px] sm:h-[620px] rounded-3xl overflow-hidden bg-white shadow-xl border border-charcoal-200/70 select-none flex flex-col">
      {/* Swipe Feedback Stamp Overlays */}
      {isTop && (
        <>
          <div
            className="absolute top-8 right-8 z-30 pointer-events-none transform rotate-12 border-4 border-forest-600 rounded-2xl px-5 py-2 text-forest-700 font-extrabold text-2xl sm:text-3xl tracking-wider uppercase bg-white/90 shadow-lg transition-opacity duration-75"
            style={{ opacity: likeOpacity }}
          >
            INTERESTED
          </div>
          <div
            className="absolute top-8 left-8 z-30 pointer-events-none transform -rotate-12 border-4 border-charcoal-700 rounded-2xl px-5 py-2 text-charcoal-800 font-extrabold text-2xl sm:text-3xl tracking-wider uppercase bg-white/90 shadow-lg transition-opacity duration-75"
            style={{ opacity: passOpacity }}
          >
            PASS
          </div>
        </>
      )}

      {/* Top Media / Avatar Section (50% height) */}
      <div className="relative h-[280px] sm:h-[300px] w-full bg-charcoal-100 overflow-hidden flex-shrink-0">
        {candidate.avatarUrl ? (
          <img
            src={candidate.avatarUrl}
            alt={candidate.displayName}
            className="w-full h-full object-cover object-center pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-forest-50 text-forest-700">
            <User className="w-24 h-24 stroke-1 opacity-50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/80 via-transparent to-black/20" />

        {/* Flatmate Intentions Badges */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5 max-w-[220px]">
          {(!candidate.intentions || candidate.intentions.length === 0) ? (
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm ${
                candidate.hasRoom
                  ? 'bg-forest-700/90 text-white border border-forest-500/40'
                  : 'bg-sand-500/90 text-forest-950 border border-sand-300/40'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{candidate.hasRoom ? 'Has a Room' : 'Seeking Flatmate'}</span>
            </span>
          ) : (
            candidate.intentions.map((intent) => {
              if (intent === 'has_room') {
                return (
                  <span
                    key="has_room"
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm bg-forest-700/90 text-white border border-forest-500/40"
                  >
                    <Home className="w-3 h-3" />
                    <span>Has a Room</span>
                  </span>
                );
              }
              if (intent === 'needs_room') {
                return (
                  <span
                    key="needs_room"
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm bg-sand-500/90 text-forest-950 border border-sand-300/40"
                  >
                    <User className="w-3 h-3" />
                    <span>Needs a Room</span>
                  </span>
                );
              }
              if (intent === 'team_up') {
                return (
                  <span
                    key="team_up"
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm bg-teal-800/90 text-white border border-teal-500/40"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Rent Together</span>
                  </span>
                );
              }
              return null;
            })
          )}
        </div>

        {/* Deterministic Compatibility Score Badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-lg border border-forest-100 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-forest-600" />
            <div className="flex flex-col text-right">
              <span className="text-xs font-extrabold text-forest-800 leading-none">
                {compatibility.overallScore}%
              </span>
              <span className="text-[9px] font-medium text-charcoal-500 tracking-tight leading-none mt-0.5">
                Alignment
              </span>
            </div>
          </div>
        </div>

        {/* Card Name, Age & Verified Badge */}
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center space-x-2">
            <h3 className="font-serif text-2xl font-bold tracking-tight text-white drop-shadow-sm">
              {candidate.displayName}, {candidate.age}
            </h3>
            {candidate.verified && (
              <span title="ID & Workplace Verified" className="inline-flex">
                <ShieldCheck className="w-5 h-5 text-sand-300 fill-sand-300/20" />
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-ivory-200 mt-1 font-medium drop-shadow">
            <Briefcase className="w-3.5 h-3.5 text-sand-300" />
            <span className="truncate">{candidate.occupation}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-ivory-200 mt-0.5 font-medium drop-shadow">
            <MapPin className="w-3.5 h-3.5 text-sand-300" />
            <span>
              {candidate.targetLocalities && candidate.targetLocalities.length > 0
                ? candidate.targetLocalities.slice(0, 2).join(', ')
                : candidate.city}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Content Section (Scrollable on small screens) */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 text-charcoal-700">
        {/* Budget & Room info banner */}
        <div className="flex items-center justify-between bg-ivory-100/90 p-2.5 rounded-xl border border-charcoal-100">
          <div className="text-xs">
            <span className="text-charcoal-500 font-medium">Budget: </span>
            <span className="font-bold text-forest-800">
              Up to ₹{candidate.budgetMax.toLocaleString('en-IN')}/mo
            </span>
          </div>
          {candidate.roomDetails && (
            <div className="text-[11px] text-charcoal-600 truncate max-w-[170px]" title={candidate.roomDetails}>
              {candidate.roomDetails}
            </div>
          )}
        </div>

        {/* 5-Dimension Compatibility Pill Summary */}
        <div className="bg-forest-50/70 border border-forest-100 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-forest-900 mb-2">
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest-600" />
              <span>Lifestyle Compatibility</span>
            </span>
            <button
              onClick={() => setShowFullBreakdown(!showFullBreakdown)}
              className="text-[11px] text-forest-700 hover:text-forest-900 font-bold flex items-center space-x-0.5 focus:outline-none"
            >
              <span>{showFullBreakdown ? 'Hide Breakdown' : 'View Scores'}</span>
              {showFullBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Lifestyle Badges */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white/80 rounded-lg p-1.5 border border-forest-100/60">
              <Utensils className="w-3.5 h-3.5 mx-auto text-forest-600 mb-0.5" />
              <div className="text-[10px] text-charcoal-500 font-medium">Food</div>
              <div className="text-[11px] font-bold text-charcoal-800 truncate">
                {formatHabit(candidate.foodHabit)}
              </div>
            </div>

            <div className="bg-white/80 rounded-lg p-1.5 border border-forest-100/60">
              <Moon className="w-3.5 h-3.5 mx-auto text-forest-600 mb-0.5" />
              <div className="text-[10px] text-charcoal-500 font-medium">Sleep</div>
              <div className="text-[11px] font-bold text-charcoal-800 truncate">
                {formatHabit(candidate.sleepRoutine)}
              </div>
            </div>

            <div className="bg-white/80 rounded-lg p-1.5 border border-forest-100/60">
              <Sparkles className="w-3.5 h-3.5 mx-auto text-forest-600 mb-0.5" />
              <div className="text-[10px] text-charcoal-500 font-medium">Cleanliness</div>
              <div className="text-[11px] font-bold text-charcoal-800 truncate">
                {formatHabit(candidate.cleanliness)}
              </div>
            </div>
          </div>

          {/* Expanded 5-Dimension Breakdown Accordion */}
          {showFullBreakdown && (
            <div className="mt-3 pt-2.5 border-t border-forest-100/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-charcoal-600">
                <span>Food Habits (25% weight)</span>
                <span className="font-bold text-forest-800">{compatibility.foodScore} / 25 pts</span>
              </div>
              <div className="w-full bg-forest-200/50 rounded-full h-1.5">
                <div
                  className="bg-forest-600 h-1.5 rounded-full"
                  style={{ width: `${Math.round((compatibility.foodScore / 25) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-charcoal-600">
                <span>Sleep Schedule (20% weight)</span>
                <span className="font-bold text-forest-800">{compatibility.sleepScore} / 20 pts</span>
              </div>
              <div className="w-full bg-forest-200/50 rounded-full h-1.5">
                <div
                  className="bg-forest-600 h-1.5 rounded-full"
                  style={{ width: `${Math.round((compatibility.sleepScore / 20) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-charcoal-600">
                <span>Cleanliness Standards (20% weight)</span>
                <span className="font-bold text-forest-800">{compatibility.cleanlinessScore} / 20 pts</span>
              </div>
              <div className="w-full bg-forest-200/50 rounded-full h-1.5">
                <div
                  className="bg-forest-600 h-1.5 rounded-full"
                  style={{ width: `${Math.round((compatibility.cleanlinessScore / 20) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-charcoal-600">
                <span>Budget Alignment (20% weight)</span>
                <span className="font-bold text-forest-800">{compatibility.budgetScore} / 20 pts</span>
              </div>
              <div className="w-full bg-forest-200/50 rounded-full h-1.5">
                <div
                  className="bg-forest-600 h-1.5 rounded-full"
                  style={{ width: `${Math.round((compatibility.budgetScore / 20) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-charcoal-600">
                <span>Mutual Interests (15% weight)</span>
                <span className="font-bold text-forest-800">{compatibility.interestsScore} / 15 pts</span>
              </div>
              <div className="w-full bg-forest-200/50 rounded-full h-1.5">
                <div
                  className="bg-forest-600 h-1.5 rounded-full"
                  style={{ width: `${Math.round((compatibility.interestsScore / 15) * 100)}%` }}
                />
              </div>

              {compatibility.sharedInterests.length > 0 && (
                <div className="pt-1 text-[11px] text-forest-900 font-medium">
                  Shared: {compatibility.sharedInterests.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bio / Living Style */}
        <div>
          <h4 className="text-xs font-bold text-charcoal-800 uppercase tracking-wide mb-1">About Me</h4>
          <p className="text-xs text-charcoal-600 leading-relaxed line-clamp-3">
            {candidate.bio}
          </p>
        </div>

        {/* Interests Tags */}
        {candidate.interests && candidate.interests.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {candidate.interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="text-[11px] bg-ivory-200/80 text-charcoal-700 px-2.5 py-0.5 rounded-full border border-charcoal-200/40 font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
