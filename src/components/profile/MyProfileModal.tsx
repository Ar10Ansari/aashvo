import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { marketplaceProfileService } from '../../services/marketplaceProfileService';
import type {
  MarketplaceProfileType,
  MarketplaceProfileView,
  ProfileCompletionBreakdown,
} from '@aashvo/contracts';
import {
  X,
  User,
  Sparkles,
  Home,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit3,
  PlusCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface MyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding: (step?: number) => void;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenOnboarding,
}) => {
  const { currentUser, showToast, refreshMarketplaceProfiles } = useApp();

  const [completion, setCompletion] = useState<ProfileCompletionBreakdown | null>(null);
  const [profiles, setProfiles] = useState<MarketplaceProfileView[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'personas' | 'preview'>('overview');
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [newPersonaType, setNewPersonaType] = useState<MarketplaceProfileType>('property_owner');
  const [isAddingPersona, setIsAddingPersona] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [comp, profs] = await Promise.all([
        marketplaceProfileService.getProfileCompletion(),
        marketplaceProfileService.getMyMarketplaceProfiles(),
      ]);
      setCompletion(comp);
      setProfiles(profs);
    } catch {
      // Handled in service fallback
    }
  };

  if (!isOpen) return null;

  const handleToggleVisibility = async () => {
    if (!completion) return;
    setIsTogglingVisibility(true);
    try {
      if (completion.isPublished) {
        await marketplaceProfileService.pauseProfile();
        showToast('Profile paused from Aashvo Connect discovery.');
      } else {
        await marketplaceProfileService.publishProfile();
        showToast('Profile published to Aashvo Connect discovery!');
      }
      await loadData();
      await refreshMarketplaceProfiles();
    } catch {
      showToast('Failed to update discovery status. Please try again.');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleSwitchPersona = async (type: MarketplaceProfileType) => {
    try {
      await marketplaceProfileService.switchMarketplaceProfile(type);
      await loadData();
      await refreshMarketplaceProfiles();
      showToast(`Switched active profile to ${type.replace('_', ' ').toUpperCase()}`);
    } catch {
      showToast('Failed to switch profile persona.');
    }
  };

  const handleAddPersona = async () => {
    try {
      await marketplaceProfileService.createMarketplaceProfile(newPersonaType);
      setIsAddingPersona(false);
      await loadData();
      await refreshMarketplaceProfiles();
      showToast(`Created new ${newPersonaType.replace('_', ' ').toUpperCase()} profile persona!`);
    } catch {
      showToast('Failed to create new persona.');
    }
  };

  const activePersona = profiles.find((p) => p.isCurrentActive) || profiles[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-profile-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-[#F5F3ED] rounded-3xl shadow-2xl border border-charcoal-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-white px-5 sm:px-7 py-4 border-b border-charcoal-200/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-sm">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 id="my-profile-modal-title" className="font-serif text-lg sm:text-xl font-bold text-charcoal-900 leading-tight">
                My Profile & Personas
              </h2>
              <p className="text-xs text-charcoal-500">
                {currentUser?.email} • Role: <strong className="uppercase">{currentUser?.role || 'RENTER'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close my profile modal"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="bg-ivory-200 px-4 sm:px-7 py-2 border-b border-charcoal-200/60 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview & Checklist', icon: User },
            { id: 'personas', label: 'Marketplace Personas', icon: Layers },
            { id: 'preview', label: 'Public Preview', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-forest-700 text-white shadow-sm'
                    : 'text-charcoal-600 hover:bg-ivory-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile Card & Completion Ring */}
              <div className="bg-white p-5 rounded-2xl border border-charcoal-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-xl flex-shrink-0 border-2 border-forest-600/20">
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-charcoal-900 text-base">{currentUser?.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        completion?.isPublished ? 'bg-forest-100 text-forest-800' : 'bg-sand-200 text-forest-900'
                      }`}>
                        {completion?.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-500 mt-0.5">
                      Active Persona: <strong className="text-forest-800">{activePersona?.displayName || 'Flatmate Seeker'}</strong>
                    </p>
                    <p className="text-[11px] text-charcoal-400 mt-0.5 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Last updated: {new Date(activePersona?.updatedAt || Date.now()).toLocaleDateString('en-IN')}</span>
                    </p>
                  </div>
                </div>

                {/* Completion Metric */}
                <div className="flex items-center space-x-3 bg-ivory-100 p-3 rounded-2xl border border-charcoal-200/60 w-full sm:w-auto justify-between sm:justify-start">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-charcoal-500">Profile Completion</p>
                    <p className="text-xl font-serif font-bold text-forest-800">{completion?.totalPercent || 0}%</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenOnboarding(1);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 flex items-center space-x-1 shadow-sm transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>

              {/* Completion Checklist */}
              <div className="bg-white p-5 rounded-2xl border border-charcoal-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                  Profile Completion Checklist
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { label: 'Basic Information', score: completion?.basicInfoPercent || 0, max: 25, step: 1 },
                    { label: 'Location Preferences', score: completion?.locationPercent || 0, max: 20, step: 2 },
                    { label: 'Housing Requirements', score: completion?.housingPercent || 0, max: 20, step: 3 },
                    { label: 'Lifestyle & Habits', score: completion?.lifestylePercent || 0, max: 20, step: 4 },
                    { label: 'Profile Photo', score: completion?.photoPercent || 0, max: 15, step: 1 },
                  ].map((sec) => {
                    const isDone = sec.score >= sec.max;
                    return (
                      <div
                        key={sec.label}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isDone ? 'bg-forest-50/50 border-forest-100' : 'bg-ivory-100 border-charcoal-200/60'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-forest-700 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-sand-500 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-charcoal-800">{sec.label}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-bold text-charcoal-500">
                            {sec.score}/{sec.max}
                          </span>
                          {!isDone && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenOnboarding(sec.step);
                              }}
                              className="text-[10px] text-forest-700 hover:underline font-semibold"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discovery & Visibility Toggle */}
              <div className="bg-white p-5 rounded-2xl border border-charcoal-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-charcoal-900">Aashvo Connect Discovery</h4>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    {completion?.isPublished
                      ? 'Your profile is discoverable by compatible flatmate candidates.'
                      : 'Your profile is currently hidden / in draft mode.'}
                  </p>
                </div>
                <button
                  onClick={handleToggleVisibility}
                  disabled={isTogglingVisibility}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    completion?.isPublished
                      ? 'bg-ivory-200 text-charcoal-700 hover:bg-ivory-300'
                      : 'bg-forest-700 text-white hover:bg-forest-800 shadow-sm'
                  }`}
                >
                  {completion?.isPublished ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Pause Discovery</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Publish to Connect</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MARKETPLACE PERSONAS */}
          {activeTab === 'personas' && (
            <div className="space-y-5">
              <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200">
                <p className="text-xs font-semibold text-forest-900 leading-relaxed">
                  💡 <strong>Multi-Persona Flexibility:</strong> On Aashvo, your single account can hold multiple marketplace profiles. If you are both looking for a flatmate and listing an extra room or property, you can switch seamlessly without creating a second account.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                  Your Activated Personas
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {profiles.map((p) => {
                    const isActive = p.isCurrentActive;
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          isActive
                            ? 'bg-white border-forest-600 shadow-sm ring-1 ring-forest-600'
                            : 'bg-white/70 border-charcoal-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isActive ? 'bg-forest-100 text-forest-800' : 'bg-ivory-200 text-charcoal-600'
                          }`}>
                            {p.profileType === 'property_owner' ? (
                              <Home className="w-5 h-5 text-forest-700" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-sand-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-semibold text-sm text-charcoal-900">
                                {p.displayName || p.profileType.replace('_', ' ').toUpperCase()}
                              </p>
                              {isActive && (
                                <span className="text-[10px] bg-forest-700 text-white font-extrabold px-2 py-0.5 rounded-full">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-charcoal-500 capitalize">
                              Type: {p.profileType.replace('_', ' ')} • Status: {p.status}
                            </p>
                          </div>
                        </div>

                        <div>
                          {!isActive ? (
                            <button
                              onClick={() => handleSwitchPersona(p.profileType)}
                              className="px-3.5 py-1.5 rounded-xl border border-charcoal-300 text-xs font-semibold text-charcoal-700 hover:bg-ivory-200 transition-all"
                            >
                              Switch to this
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-forest-700">Current</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Persona */}
              <div className="bg-white p-4 rounded-2xl border border-charcoal-200 space-y-3">
                <h4 className="text-xs font-bold text-charcoal-800">Add Another Marketplace Persona</h4>
                {!isAddingPersona ? (
                  <button
                    onClick={() => setIsAddingPersona(true)}
                    className="px-4 py-2 rounded-xl border border-forest-600 text-forest-800 text-xs font-semibold hover:bg-forest-50 flex items-center space-x-1.5 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Activate New Persona</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-3 pt-1">
                    <select
                      value={newPersonaType}
                      onChange={(e) => setNewPersonaType(e.target.value as MarketplaceProfileType)}
                      className="px-3 py-2 bg-ivory-100 border border-charcoal-300 rounded-xl text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-600"
                    >
                      <option value="property_owner">Property Owner</option>
                      <option value="family_stay_host">Family Stay Host</option>
                      <option value="family_stay_seeker">Family Stay Seeker</option>
                      <option value="flatmate_seeker">Flatmate Seeker</option>
                    </select>
                    <button
                      onClick={handleAddPersona}
                      className="px-4 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => setIsAddingPersona(false)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-charcoal-500 hover:bg-ivory-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border border-charcoal-200 shadow-sm max-w-md mx-auto space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-xl">
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-charcoal-900 text-base">{currentUser?.name}</h3>
                    <p className="text-xs text-charcoal-500">Verified Aashvo Member</p>
                    <span className="inline-block mt-1 text-[10px] bg-sand-200 text-forest-900 font-bold px-2 py-0.5 rounded-full">
                      5-Dimension Lifestyle Verified
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-ivory-100 rounded-2xl border border-charcoal-100 text-xs text-charcoal-700">
                  <p className="font-semibold text-charcoal-900 mb-1">Privacy Guarantee:</p>
                  <p className="text-charcoal-600 leading-relaxed">
                    Your email address, phone number, and precise residential address are never exposed publicly. Mutual matching is strictly required before contact information or messaging is shared.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-5 sm:px-7 py-3 border-t border-charcoal-200/80 flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
