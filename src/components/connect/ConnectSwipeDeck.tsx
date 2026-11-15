import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ConnectCandidateView,
  ConnectSwipeResponse,
  FlatmateIntention,
  MarketplaceProfileView,
  ProfileCompletionBreakdown,
} from '@aashvo/contracts';
import type { User } from '../../types';
import { ConnectProfileCard } from './ConnectProfileCard';
import {
  X,
  Heart,
  RotateCcw,
  Sparkles,
  RefreshCw,
  UserCheck,
  FileText,
  Lock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface ConnectSwipeDeckProps {
  candidates: ConnectCandidateView[];
  onSwipe: (targetUserId: string, action: 'like' | 'pass') => Promise<ConnectSwipeResponse>;
  onUndo: () => Promise<void>;
  canUndo: boolean;
  onRefresh: () => void;
  isLoading?: boolean;
  selectedIntention?: FlatmateIntention | 'all';
  onSelectIntention?: (intention: FlatmateIntention | 'all') => void;
  currentUser?: User | null;
  marketplaceProfiles?: MarketplaceProfileView[];
  profileCompletion?: ProfileCompletionBreakdown | null;
  onOpenOnboarding?: (step?: number) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export const ConnectSwipeDeck: React.FC<ConnectSwipeDeckProps> = ({
  candidates,
  onSwipe,
  onUndo,
  canUndo,
  onRefresh,
  isLoading = false,
  selectedIntention = 'all',
  onSelectIntention,
  currentUser,
  marketplaceProfiles,
  profileCompletion,
  onOpenOnboarding,
  onOpenAuth,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const startXRef = useRef(0);
  const deckRef = useRef<HTMLDivElement>(null);

  // Reset index when candidate list changes (e.g. filter switch)
  useEffect(() => {
    setCurrentIndex(0);
    setDragOffset(0);
  }, [candidates]);

  const topCandidate = candidates[currentIndex];
  const nextCandidate = candidates[currentIndex + 1];

  // Perform programmatic or gesture-triggered swipe
  const handleTriggerSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (!topCandidate || isSwiping) return;
      setIsSwiping(true);
      setSwipeDirection(direction);

      const action = direction === 'right' ? 'like' : 'pass';
      try {
        await onSwipe(topCandidate.userId, action);
        // Advance index after animation
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setDragOffset(0);
          setIsSwiping(false);
          setSwipeDirection(null);
        }, 220);
      } catch (err) {
        setIsSwiping(false);
        setSwipeDirection(null);
        setDragOffset(0);
      }
    },
    [topCandidate, isSwiping, onSwipe],
  );

  // Undo previous swipe
  const handleTriggerUndo = async () => {
    if (!canUndo || isSwiping) return;
    try {
      await onUndo();
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setDragOffset(0);
    } catch {
      // Ignored
    }
  };

  // Touch / Mouse drag gesture handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSwiping) return;
    setIsDragging(true);
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startXRef.current;
    setDragOffset(diff);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    const threshold = 100;
    if (dragOffset > threshold) {
      handleTriggerSwipe('right');
    } else if (dragOffset < -threshold) {
      handleTriggerSwipe('left');
    } else {
      // Snap back
      setDragOffset(0);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleTriggerSwipe('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTriggerSwipe('left');
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleTriggerUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTriggerSwipe, canUndo]);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[580px] p-8 text-center bg-white/60 rounded-3xl border border-charcoal-200/60">
        <RefreshCw className="w-8 h-8 text-forest-700 animate-spin mb-4" />
        <p className="text-sm font-semibold text-charcoal-800">
          Finding compatible flatmates for you...
        </p>
        <p className="text-xs text-charcoal-500 mt-1 max-w-xs">
          Computing 5-dimension lifestyle alignment across food, sleep, cleanliness, budget and interests.
        </p>
      </div>
    );
  }

  // Persona & Profile Gating Checks
  const isAuthGated = currentUser !== undefined && currentUser === null;
  const hasProfilesData = marketplaceProfiles !== undefined;
  const flatmateProfile = marketplaceProfiles?.find(
    (p) => p.profileType === 'flatmate_seeker'
  );
  const hasFlatmateProfile = !!flatmateProfile;
  const isProfilePublished = flatmateProfile
    ? flatmateProfile.status === 'active' || (profileCompletion?.isPublished === true)
    : false;

  // 1. Prompt unauthenticated users to sign in
  if (isAuthGated) {
    return (
      <div className="flex flex-col items-center justify-center h-[580px] p-8 text-center bg-white rounded-3xl border border-charcoal-200 shadow-md">
        <div className="w-16 h-16 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-sand-500" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-sand-600 bg-sand-50 px-3 py-1 rounded-full mb-2">
          Member Sign-in Required
        </span>
        <h3 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
          Sign In to Access Connect
        </h3>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-md mb-6 leading-relaxed">
          AASHVO Connect pairs verified college students and working professionals based on 5 lifestyle dimensions: food habits, sleep routines, cleanliness standards, budget, and shared interests.
        </p>
        <button
          onClick={() => onOpenAuth?.('signin')}
          className="px-6 py-3 rounded-full bg-forest-700 text-white text-xs sm:text-sm font-semibold hover:bg-forest-800 shadow-sm flex items-center space-x-2 transition-all hover:scale-105 active:scale-95"
        >
          <span>Sign In / Register</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 2. Prompt users without a flatmate profile to create one (Zero fake profile injection)
  if (currentUser && hasProfilesData && !hasFlatmateProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[580px] p-8 text-center bg-white rounded-3xl border border-charcoal-200 shadow-md">
        <div className="w-16 h-16 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-forest-700" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full mb-2 border border-forest-100">
          Setup Required • 5-Step Flow
        </span>
        <h3 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
          Create Your Flatmate Profile
        </h3>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-md mb-5 leading-relaxed">
          You need an active flatmate profile to discover candidates and match with compatible roommates. Set up your lifestyle habits, budget, and preferences in under 2 minutes.
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-sm w-full mb-6 text-left">
          <div className="p-2.5 bg-ivory-100 rounded-xl border border-charcoal-100 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-forest-600 flex-shrink-0" />
            <span className="text-[11px] font-medium text-charcoal-700">5-dimension compatibility</span>
          </div>
          <div className="p-2.5 bg-ivory-100 rounded-xl border border-charcoal-100 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-forest-600 flex-shrink-0" />
            <span className="text-[11px] font-medium text-charcoal-700">Zero fake profiles</span>
          </div>
          <div className="p-2.5 bg-ivory-100 rounded-xl border border-charcoal-100 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-forest-600 flex-shrink-0" />
            <span className="text-[11px] font-medium text-charcoal-700">Mutual match chat</span>
          </div>
          <div className="p-2.5 bg-ivory-100 rounded-xl border border-charcoal-100 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-forest-600 flex-shrink-0" />
            <span className="text-[11px] font-medium text-charcoal-700">Instant privacy controls</span>
          </div>
        </div>
        <button
          onClick={() => onOpenOnboarding?.(1)}
          className="px-6 py-3 rounded-full bg-forest-700 text-white text-xs sm:text-sm font-semibold hover:bg-forest-800 shadow-sm flex items-center space-x-2 transition-all hover:scale-105 active:scale-95"
        >
          <span>Create My Flatmate Profile</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 3. Prompt users with draft flatmate profiles to complete and publish
  if (currentUser && hasProfilesData && hasFlatmateProfile && !isProfilePublished) {
    const pct = profileCompletion?.totalPercent ?? (flatmateProfile?.completionPercent ?? 40);
    const missing = profileCompletion?.missingFields || [];
    return (
      <div className="flex flex-col items-center justify-center h-[580px] p-8 text-center bg-white rounded-3xl border border-charcoal-200 shadow-md">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-amber-600" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full mb-2 border border-amber-200">
          Profile in Draft • {pct}% Complete
        </span>
        <h3 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
          Publish Profile to Start Matching
        </h3>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-md mb-4 leading-relaxed">
          Your flatmate profile is currently hidden from other members. Complete your profile details and publish to start discovering and receiving match requests.
        </p>

        {/* Completion Progress Bar */}
        <div className="w-full max-w-xs mb-4">
          <div className="w-full bg-charcoal-100 rounded-full h-2 overflow-hidden mb-2">
            <div
              className="bg-amber-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {missing.length > 0 && (
            <p className="text-[11px] text-charcoal-500">
              Missing: {missing.slice(0, 3).join(', ')}
              {missing.length > 3 ? ` +${missing.length - 3} more` : ''}
            </p>
          )}
        </div>

        <button
          onClick={() => onOpenOnboarding?.(1)}
          className="px-6 py-3 rounded-full bg-forest-700 text-white text-xs sm:text-sm font-semibold hover:bg-forest-800 shadow-sm flex items-center space-x-2 transition-all hover:scale-105 active:scale-95"
        >
          <span>Complete & Publish Profile</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Empty State: All candidates swiped
  if (!topCandidate || currentIndex >= candidates.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[580px] p-8 text-center bg-white rounded-3xl border border-charcoal-200 shadow-md">
        <div className="w-16 h-16 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-sand-500" />
        </div>
        <h3 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
          You're all caught up!
        </h3>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-md mb-6 leading-relaxed">
          You have reviewed all available flatmate candidates in your active discovery radius.
          New verified profiles are added continuously, or you can undo your previous choice.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {canUndo && (
            <button
              onClick={handleTriggerUndo}
              className="px-4 py-2.5 rounded-full border border-charcoal-300 text-xs font-semibold text-charcoal-700 hover:bg-ivory-200 flex items-center space-x-2 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-charcoal-600" />
              <span>Undo Last Swipe</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            className="px-5 py-2.5 rounded-full bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm flex items-center space-x-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Discovery</span>
          </button>
        </div>
      </div>
    );
  }

  // Calculate top card transform style
  let transformStyle = '';
  let transitionStyle = 'none';

  if (isSwiping) {
    const exitX = swipeDirection === 'right' ? 600 : -600;
    const rotate = swipeDirection === 'right' ? 20 : -20;
    transformStyle = `translate3d(${exitX}px, 0, 0) rotate(${rotate}deg)`;
    transitionStyle = 'transform 0.22s ease-out, opacity 0.22s ease-out';
  } else if (isDragging) {
    const rotate = dragOffset * 0.08;
    transformStyle = `translate3d(${dragOffset}px, 0, 0) rotate(${rotate}deg)`;
  } else {
    transformStyle = 'translate3d(0, 0, 0) rotate(0deg)';
    transitionStyle = 'transform 0.15s ease-out';
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto select-none" ref={deckRef}>
      {/* Intentions Filter Chips Bar */}
      {onSelectIntention && (
        <div className="flex items-center justify-center space-x-1.5 w-full mb-3 px-1 overflow-x-auto">
          {[
            { id: 'all', label: 'All Intentions' },
            { id: 'has_room', label: 'Has Room' },
            { id: 'needs_room', label: 'Needs Room' },
            { id: 'team_up', label: 'Rent Together' },
          ].map((chip) => {
            const active = (selectedIntention || 'all') === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => onSelectIntention(chip.id as any)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-forest-700 text-white border-forest-800 shadow-sm'
                    : 'bg-white/90 text-charcoal-600 border-charcoal-200/80 hover:bg-ivory-100'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Visual Keyboard Hints on Desktop */}
      <div className="hidden sm:flex items-center justify-between w-full px-4 mb-2 text-[11px] text-charcoal-500 font-medium">
        <span className="flex items-center space-x-1">
          <kbd className="px-1.5 py-0.5 bg-ivory-200 border border-charcoal-200 rounded text-[10px]">←</kbd>
          <span>Pass</span>
        </span>
        <span className="flex items-center space-x-1">
          <kbd className="px-1.5 py-0.5 bg-ivory-200 border border-charcoal-200 rounded text-[10px]">Z</kbd>
          <span>Undo</span>
        </span>
        <span className="flex items-center space-x-1">
          <span>Interested</span>
          <kbd className="px-1.5 py-0.5 bg-ivory-200 border border-charcoal-200 rounded text-[10px]">→</kbd>
        </span>
      </div>

      {/* Card Stack Deck */}
      <div className="relative w-full h-[580px] sm:h-[620px]">
        {/* Next Card in Stack (Layer 2) */}
        {nextCandidate && (
          <div
            className="absolute inset-0 pointer-events-none transform scale-[0.96] translate-y-3 opacity-80 transition-all duration-200 z-0"
            aria-hidden="true"
          >
            <ConnectProfileCard candidate={nextCandidate} />
          </div>
        )}

        {/* Top Active Card (Layer 1) */}
        <div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing touch-pan-y"
          style={{
            transform: transformStyle,
            transition: transitionStyle,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <ConnectProfileCard
            candidate={topCandidate}
            dragOffset={dragOffset}
            isTop={true}
          />
        </div>
      </div>

      {/* Action Control Buttons Bar */}
      <div className="flex items-center justify-center space-x-5 mt-6 mb-2">
        {/* Undo Button */}
        <button
          onClick={handleTriggerUndo}
          disabled={!canUndo || isSwiping}
          title="Undo last swipe action (Z)"
          aria-label="Undo last swipe"
          className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-all ${
            canUndo
              ? 'bg-white border-charcoal-200 text-charcoal-700 hover:bg-ivory-200 hover:scale-105 active:scale-95'
              : 'bg-white/50 border-charcoal-200/50 text-charcoal-300 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Pass Button */}
        <button
          onClick={() => handleTriggerSwipe('left')}
          disabled={isSwiping}
          title="Pass profile (Left Arrow)"
          aria-label="Pass on this flatmate"
          className="w-16 h-16 rounded-full bg-white border-2 border-charcoal-300 text-charcoal-700 hover:text-red-700 hover:border-red-400 hover:bg-red-50/50 shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <X className="w-8 h-8 stroke-[2.5]" />
        </button>

        {/* Interested / Like Button */}
        <button
          onClick={() => handleTriggerSwipe('right')}
          disabled={isSwiping}
          title="Interested in teaming up (Right Arrow)"
          aria-label="Interested in teaming up with this flatmate"
          className="w-16 h-16 rounded-full bg-forest-700 text-white hover:bg-forest-800 shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 border-2 border-forest-600"
        >
          <Heart className="w-8 h-8 fill-sand-300 text-white" />
        </button>
      </div>
    </div>
  );
};
