import React, { useState } from 'react';
import type { FlatmateIntention } from '@aashvo/contracts';
import { connectService } from '../../services/connectService';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  HeartHandshake,
  Check,
  User,
  Home,
  Users,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ConnectProfileSettingsProps {
  discoveryHidden: boolean;
  onToggleVisibility: (hidden: boolean) => Promise<void>;
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
  } | null;
  initialIntentions?: FlatmateIntention[];
  onIntentionsChange?: (intentions: FlatmateIntention[]) => void;
}

export const ConnectProfileSettings: React.FC<ConnectProfileSettingsProps> = ({
  discoveryHidden,
  onToggleVisibility,
  currentUser,
  initialIntentions = ['has_room', 'needs_room', 'team_up'],
  onIntentionsChange,
}) => {
  const [isHidden, setIsHidden] = useState(discoveryHidden);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedIntentions, setSelectedIntentions] = useState<FlatmateIntention[]>(initialIntentions);
  const [isUpdatingIntentions, setIsUpdatingIntentions] = useState(false);
  const [intentionsMsg, setIntentionsMsg] = useState('');

  const handleToggle = async (newVal: boolean) => {
    setIsUpdating(true);
    try {
      await onToggleVisibility(newVal);
      setIsHidden(newVal);
      setSuccessMsg(
        newVal
          ? 'Your profile is now hidden from new discovery.'
          : 'Your profile is now visible in Aashvo Connect discovery!',
      );
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleIntention = async (intention: FlatmateIntention) => {
    let next: FlatmateIntention[];
    if (selectedIntentions.includes(intention)) {
      if (selectedIntentions.length === 1) {
        setIntentionsMsg('You must keep at least one active flatmate intention.');
        setTimeout(() => setIntentionsMsg(''), 3000);
        return;
      }
      next = selectedIntentions.filter((i) => i !== intention);
    } else {
      next = [...selectedIntentions, intention];
    }

    setSelectedIntentions(next);
    setIsUpdatingIntentions(true);
    try {
      await connectService.updateIntentions(next);
      onIntentionsChange?.(next);
      setIntentionsMsg('Flatmate intentions saved.');
      setTimeout(() => setIntentionsMsg(''), 3000);
    } catch {
      setIntentionsMsg('Failed to update intentions. Please try again.');
    } finally {
      setIsUpdatingIntentions(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Current User Profile Banner */}
      {currentUser && (
        <div className="bg-white rounded-3xl p-4 border border-charcoal-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-sm">
            {currentUser.name ? currentUser.name.charAt(0) : <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-charcoal-900 truncate">{currentUser.name}</div>
            <div className="text-[11px] text-charcoal-500 truncate">{currentUser.email}</div>
          </div>
        </div>
      )}

      {/* Intentions Selector Card */}
      <div className="bg-white rounded-3xl p-6 border border-charcoal-200 shadow-sm space-y-4">
        <div>
          <h4 className="font-serif text-lg font-bold text-charcoal-900">
            My Flatmate Intentions
          </h4>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Select one or more intentions. You can change these anytime to match your current housing search.
          </p>
        </div>

        <div className="space-y-2.5">
          {/* Intention 1: has_room */}
          <div
            onClick={() => !isUpdatingIntentions && handleToggleIntention('has_room')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
              selectedIntentions.includes('has_room')
                ? 'bg-forest-50/70 border-forest-600/50 shadow-sm'
                : 'bg-ivory-100/60 border-charcoal-200/60 hover:bg-ivory-100'
            }`}
          >
            <div className="mt-0.5 text-forest-700">
              {selectedIntentions.includes('has_room') ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-charcoal-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Home className="w-4 h-4 text-forest-700" />
                <span className="text-xs font-bold text-charcoal-900">
                  Has a room and needs a flatmate
                </span>
              </div>
              <p className="text-[11px] text-charcoal-600 mt-1">
                You currently have an available room in your flat and are looking for a compatible flatmate to move in.
              </p>
            </div>
          </div>

          {/* Intention 2: needs_room */}
          <div
            onClick={() => !isUpdatingIntentions && handleToggleIntention('needs_room')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
              selectedIntentions.includes('needs_room')
                ? 'bg-sand-500/10 border-sand-500/50 shadow-sm'
                : 'bg-ivory-100/60 border-charcoal-200/60 hover:bg-ivory-100'
            }`}
          >
            <div className="mt-0.5 text-sand-700">
              {selectedIntentions.includes('needs_room') ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-charcoal-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-sand-700" />
                <span className="text-xs font-bold text-charcoal-900">
                  Needs a room and wants a compatible flatmate
                </span>
              </div>
              <p className="text-[11px] text-charcoal-600 mt-1">
                You are looking for a private room in an existing flat with roommates whose habits align with yours.
              </p>
            </div>
          </div>

          {/* Intention 3: team_up */}
          <div
            onClick={() => !isUpdatingIntentions && handleToggleIntention('team_up')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
              selectedIntentions.includes('team_up')
                ? 'bg-teal-500/10 border-teal-600/50 shadow-sm'
                : 'bg-ivory-100/60 border-charcoal-200/60 hover:bg-ivory-100'
            }`}
          >
            <div className="mt-0.5 text-teal-700">
              {selectedIntentions.includes('team_up') ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-charcoal-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-charcoal-900">
                  Find compatible people to rent an entire flat together
                </span>
              </div>
              <p className="text-[11px] text-charcoal-600 mt-1">
                Team up with compatible flatmates first, then lease a fresh 2BHK/3BHK together on AASHVO.
              </p>
            </div>
          </div>
        </div>

        {intentionsMsg && (
          <div className="p-2.5 rounded-xl bg-forest-50 border border-forest-200 flex items-center space-x-2 text-xs text-forest-800 font-semibold">
            <Check className="w-4 h-4 text-forest-600" />
            <span>{intentionsMsg}</span>
          </div>
        )}
      </div>

      {/* Visibility Control Card */}
      <div className="bg-white rounded-3xl p-6 border border-charcoal-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isHidden ? 'bg-amber-50 text-amber-700' : 'bg-forest-50 text-forest-700'
            }`}
          >
            {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-serif text-lg font-bold text-charcoal-900">
              Discovery Visibility
            </h4>
            <p className="text-xs text-charcoal-500">
              Control whether your card appears in the Aashvo Connect swipe deck.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 bg-ivory-100 rounded-2xl border border-charcoal-100">
          <div>
            <div className="text-xs font-bold text-charcoal-800">
              {isHidden ? 'Discovery Paused (Hidden)' : 'Actively Discoverable'}
            </div>
            <p className="text-[11px] text-charcoal-600 mt-0.5 max-w-xs">
              {isHidden
                ? 'Other flatmates cannot see your card in their deck. Existing matches remain active.'
                : 'Your profile is visible to other verified members seeking flatmates.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={!isHidden}
            disabled={isUpdating}
            onClick={() => handleToggle(!isHidden)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              !isHidden ? 'bg-forest-700' : 'bg-charcoal-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                !isHidden ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {successMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-forest-50 border border-forest-200 flex items-center space-x-2 text-xs text-forest-800 font-semibold">
            <Check className="w-4 h-4 text-forest-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Community Standards & Safety Box */}
      <div className="bg-white rounded-3xl p-6 border border-charcoal-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <HeartHandshake className="w-5 h-5 text-forest-700" />
          <h4 className="font-serif text-lg font-bold text-charcoal-900">
            Aashvo Connect Standards
          </h4>
        </div>

        <ul className="space-y-2.5 text-xs text-charcoal-600">
          <li className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-forest-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Co-Living Only:</strong> Aashvo Connect is designed exclusively for flatmate teaming
              and shared living. Romantic or dating solicitations are strictly prohibited and result in permanent suspension.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-forest-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Mutual Consent:</strong> Direct messaging is unlocked only when both parties indicate
              mutual interest, protecting your inbox from spam.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-forest-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>In-Person Visits:</strong> Never transfer token or advance deposits before meeting prospective
              flatmates and physically inspecting the property.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
