import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  X,
  PlusCircle,
  ShieldCheck,
  LogOut,
  ChevronDown,
  HelpCircle,
  Sparkles,
  Calculator,
  Bookmark,
  Compass,
  MessageSquare,
  Calendar,
  User,
} from 'lucide-react';
import { isTrustedAdminSession } from '../../services/authorizationService';
import { NotificationCenter } from '../notifications/NotificationCenter';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsListPropertyOpen,
    setIsAdminOpen,
    openAuthModal,
    setIsHelpOpen,
    setIsRentalTrustOpen,
    openConnectModal,
    openMyActivityModal,
    setIsCalculatorOpen,
    setIsSavedOpen,
    marketplaceProfiles,
    activeMarketplaceProfile,
    switchMarketplaceProfile,
    openMyProfileModal,
    openOnboardingModal,
    profileCompletion,
    currentUser,
    logout,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#F5F3ED]/95 backdrop-blur-md border-b border-[#292D2A]/10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand Wordmark */}
          <div className="flex items-center space-x-8">
            <button
              onClick={() => {
                setActiveTab('places');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group text-left focus:outline-none flex items-baseline space-x-1.5"
            >
              <span className="font-serif text-3xl font-bold tracking-tight text-forest-700 transition-colors group-hover:text-forest-900">
                aashvo
              </span>
              <span className="w-2 h-2 rounded-full bg-sand-400 group-hover:bg-sand-500 transition-colors inline-block" />
            </button>

            {/* Desktop Navigation Links — 6 Core Sections */}
            <nav className="hidden lg:flex items-center space-x-1 text-xs xl:text-sm font-medium">
              {/* 1. Explore */}
              <div className="relative group">
                <button
                  onClick={() => {
                    setActiveTab('places');
                    const el = document.getElementById('discovery-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 ${
                    activeTab === 'places' || activeTab === 'flatmates' || activeTab === 'family_stays' || activeTab === 'entire_flats'
                      ? 'text-forest-800 bg-forest-50/80 font-semibold'
                      : 'text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-forest-700" />
                  <span>Explore</span>
                  <ChevronDown className="w-3 h-3 text-charcoal-400 group-hover:rotate-180 transition-transform" />
                </button>

                <div className="absolute left-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-charcoal-100 py-1.5 hidden group-hover:block z-50 animate-in fade-in duration-150">
                  <button
                    onClick={() => {
                      setActiveTab('flatmates');
                      const el = document.getElementById('discovery-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-ivory-100 ${
                      activeTab === 'flatmates' ? 'text-forest-800 font-bold bg-forest-50/50' : 'text-charcoal-700'
                    }`}
                  >
                    <span>Flatmates & Rooms</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('family_stays');
                      const el = document.getElementById('discovery-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-ivory-100 ${
                      activeTab === 'family_stays' ? 'text-forest-800 font-bold bg-forest-50/50' : 'text-charcoal-700'
                    }`}
                  >
                    <span>Family Stays</span>
                    <span className="text-[9px] bg-sand-200 text-forest-900 px-1 py-0.2 rounded font-bold">Meals</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('entire_flats');
                      const el = document.getElementById('discovery-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-ivory-100 ${
                      activeTab === 'entire_flats' ? 'text-forest-800 font-bold bg-forest-50/50' : 'text-charcoal-700'
                    }`}
                  >
                    <span>Entire Flats</span>
                  </button>
                </div>
              </div>

              {/* 2. Connect */}
              <button
                onClick={() => openConnectModal('discover')}
                className="px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 bg-forest-700/10 hover:bg-forest-700/20 text-forest-900 font-semibold border border-forest-600/30"
                title="Aashvo Connect — Swipe & Mutual Matching"
              >
                <Sparkles className="w-3.5 h-3.5 text-sand-500" />
                <span>Connect</span>
                <span className="text-[9px] bg-forest-700 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                  MATCH
                </span>
              </button>

              {/* 3. Saved */}
              <button
                onClick={() => setIsSavedOpen(true)}
                className="px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60"
                title="Saved Listings & Shortlists"
              >
                <Bookmark className="w-3.5 h-3.5 text-forest-700" />
                <span>Saved</span>
              </button>

              {/* 4. Messages */}
              <button
                onClick={() => openConnectModal('matches')}
                className="px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60"
                title="Conversations & Match Messages"
              >
                <MessageSquare className="w-3.5 h-3.5 text-forest-700" />
                <span>Messages</span>
              </button>

              {/* 5. My Activity */}
              <button
                onClick={() => openMyActivityModal('visits')}
                className="px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60"
                title="Visits, Agreements, Move-In Checklists & Verifications"
              >
                <Calendar className="w-3.5 h-3.5 text-forest-700" />
                <span>My Activity</span>
              </button>

              {/* Founders anchor link */}
              <button
                onClick={() => {
                  const el = document.getElementById('our-founders');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-300/40 transition-all text-xs"
              >
                Founders
              </button>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Shortlisted Items Button */}
            <button
              onClick={() => setIsSavedOpen(true)}
              className="p-2 rounded-full text-charcoal-600 hover:text-forest-800 hover:bg-ivory-300/70 transition-all focus:outline-none"
              title="Saved Listings & Shortlists"
              aria-label="View saved listings"
            >
              <Bookmark className="w-5 h-5 text-forest-800" />
            </button>

            {/* In-App Notifications Center */}
            <NotificationCenter />

            {/* Admin Badge: Restricted to verified staff identity */}
            {isTrustedAdminSession(currentUser) && (
              <button
                onClick={() => setIsAdminOpen(true)}
                className="text-xs text-charcoal-400 hover:text-forest-700 px-2.5 py-1.5 rounded-md hover:bg-ivory-300/70 border border-charcoal-200/50 flex items-center space-x-1.5 transition-all"
                title="Open Safety & Moderation Queue"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
                <span>Moderation Console</span>
              </button>
            )}

            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 text-sm font-medium text-charcoal-700 hover:text-forest-700 bg-white/70 px-3.5 py-2 rounded-full border border-charcoal-200 shadow-sm transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-forest-100 text-forest-800 font-semibold flex items-center justify-center text-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="max-w-[120px] truncate">{currentUser.name}</span>
                  <ChevronDown className="w-4 h-4 text-charcoal-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-charcoal-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Account Identity & System Role */}
                    <div className="px-4 py-2.5 border-b border-charcoal-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-charcoal-400 uppercase tracking-wider font-bold">Account</p>
                        <span className="text-[10px] bg-charcoal-100 text-charcoal-700 px-2 py-0.5 rounded-full font-semibold uppercase">
                          Role: {currentUser.role}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-charcoal-900 truncate mt-0.5">{currentUser.name}</p>
                      <p className="text-xs text-charcoal-500 truncate">{currentUser.email}</p>

                      {/* Active Marketplace Persona Pill */}
                      <div className="mt-2.5 p-2 bg-forest-50/80 rounded-xl border border-forest-100/80 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-forest-700 font-bold">Active Persona</p>
                          <p className="text-xs font-bold text-forest-900 capitalize">
                            {activeMarketplaceProfile?.displayName || activeMarketplaceProfile?.profileType?.replace('_', ' ') || 'Flatmate Seeker'}
                          </p>
                        </div>
                        <span className="text-[9px] bg-forest-700 text-white font-extrabold px-1.5 py-0.5 rounded">
                          ACTIVE
                        </span>
                      </div>
                    </div>

                    {/* Persona Switcher Quick Actions */}
                    {marketplaceProfiles && marketplaceProfiles.length > 1 && (
                      <div className="px-4 py-2 border-b border-charcoal-100 bg-ivory-50/60">
                        <p className="text-[10px] uppercase font-bold text-charcoal-400 mb-1.5">Switch Persona</p>
                        <div className="space-y-1">
                          {marketplaceProfiles
                            .filter((p) => !p.isCurrentActive)
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={async () => {
                                  await switchMarketplaceProfile(p.profileType);
                                  setProfileDropdownOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-charcoal-700 hover:bg-forest-50 hover:text-forest-800 flex items-center justify-between transition-colors"
                              >
                                <span className="capitalize">{p.displayName || p.profileType.replace('_', ' ')}</span>
                                <span className="text-[10px] text-forest-600 font-bold">Switch</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* My Profile Navigation */}
                    <div className="py-1 border-b border-charcoal-100">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          openMyProfileModal();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-forest-800 hover:bg-forest-50 flex items-center justify-between"
                      >
                        <span className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-forest-700" />
                          <span>My Profile & Personas</span>
                        </span>
                        {profileCompletion && (
                          <span className="text-[10px] bg-sand-200 text-forest-900 px-1.5 py-0.5 rounded-full font-bold">
                            {profileCompletion.totalPercent}%
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          openOnboardingModal();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-charcoal-700 hover:bg-ivory-100 flex items-center space-x-2 font-medium"
                      >
                        <PlusCircle className="w-4 h-4 text-forest-600" />
                        <span>Edit / Complete Profile Flow</span>
                      </button>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          openConnectModal('discover');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-700 hover:bg-ivory-100 flex items-center space-x-2 font-medium"
                      >
                        <Sparkles className="w-4 h-4 text-forest-600" />
                        <span>Aashvo Connect (Matches)</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          openMyActivityModal('visits');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-700 hover:bg-ivory-100 flex items-center space-x-2 font-medium"
                      >
                        <Calendar className="w-4 h-4 text-forest-600" />
                        <span>My Activity (Visits & Tenancy)</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsSavedOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <Bookmark className="w-4 h-4 text-forest-600" />
                        <span>Saved Listings & Shortlists</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsCalculatorOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <Calculator className="w-4 h-4 text-forest-600" />
                        <span>Rent & Utility Split Calculator</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsRentalTrustOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-forest-600" />
                        <span>Rental Trust & Ledger</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsHelpOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <HelpCircle className="w-4 h-4 text-forest-600" />
                        <span>Help Centre & Tickets</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsListPropertyOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <PlusCircle className="w-4 h-4 text-forest-600" />
                        <span>Add New Listing</span>
                      </button>
                    </div>

                    <div className="border-t border-charcoal-100 pt-1">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal('signin')}
                  className="text-sm font-medium text-charcoal-700 hover:text-forest-700 px-3.5 py-2 rounded-full hover:bg-ivory-300 transition-all"
                >
                  Sign in
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  className="text-xs font-semibold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-300/80 px-3.5 py-2 rounded-full transition-all shadow-2xs"
                >
                  Register
                </button>
              </div>
            )}

            {/* List Property Main CTA */}
            <button
              onClick={() => setIsListPropertyOpen(true)}
              className="bg-forest-600 hover:bg-forest-700 active:bg-forest-800 text-ivory-50 text-sm font-medium px-5 py-2.5 rounded-full shadow-sm transition-all hover:shadow duration-200 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4 text-sand-300" />
              <span>Get started</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-charcoal-600 hover:text-forest-700 hover:bg-ivory-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-menu-drawer" className="md:hidden bg-[#F5F3ED] border-b border-charcoal-200/50 px-4 pt-2 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => {
                setActiveTab('flatmates');
                setMobileMenuOpen(false);
                const el = document.getElementById('discovery-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`p-3 rounded-xl text-center text-xs font-semibold transition-all ${
                activeTab === 'flatmates'
                  ? 'bg-forest-600 text-white shadow-sm'
                  : 'bg-white border border-charcoal-200 text-charcoal-700'
              }`}
            >
              Flatmates & Rooms
            </button>
            <button
              onClick={() => {
                setActiveTab('family_stays');
                setMobileMenuOpen(false);
                const el = document.getElementById('discovery-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`p-3 rounded-xl text-center text-xs font-semibold transition-all ${
                activeTab === 'family_stays'
                  ? 'bg-forest-600 text-white shadow-sm'
                  : 'bg-white border border-charcoal-200 text-charcoal-700'
              }`}
            >
              Family Stays
            </button>
            <button
              onClick={() => {
                setActiveTab('entire_flats');
                setMobileMenuOpen(false);
                const el = document.getElementById('discovery-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`p-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                activeTab === 'entire_flats'
                  ? 'bg-forest-600 text-white shadow-sm'
                  : 'bg-white border border-charcoal-200 text-charcoal-700'
              }`}
            >
              Entire Flats
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                const el = document.getElementById('our-founders');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="p-2.5 rounded-xl text-center text-xs font-semibold bg-white border border-charcoal-200 text-charcoal-700 hover:text-forest-700"
            >
              Our Founders
            </button>
          </div>

          <div className="pt-2 border-t border-charcoal-200/40 space-y-2">
            <button
              onClick={() => {
                openConnectModal('discover');
                setMobileMenuOpen(false);
              }}
              className="w-full bg-forest-50 border border-forest-200 text-forest-900 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-sand-500" />
              <span>Aashvo Connect (Swipe & Matches)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsSavedOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5"
              >
                <Bookmark className="w-4 h-4 text-forest-700" />
                <span>Saved Listings</span>
              </button>
              <button
                onClick={() => {
                  openConnectModal('matches');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5"
              >
                <MessageSquare className="w-4 h-4 text-forest-700" />
                <span>Messages</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  openMyActivityModal('visits');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5"
              >
                <Calendar className="w-4 h-4 text-forest-700" />
                <span>My Activity</span>
              </button>
              <button
                onClick={() => {
                  setIsCalculatorOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5"
              >
                <Calculator className="w-4 h-4 text-forest-700" />
                <span>Split Calculator</span>
              </button>
            </div>

            <button
              onClick={() => {
                setIsListPropertyOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full bg-forest-600 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center space-x-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-sand-300" />
              <span>List a property (Owner / Manager)</span>
            </button>

            <button
              onClick={() => {
                setIsRentalTrustOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full bg-white border border-sand-300 text-charcoal-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-forest-600" />
              <span>Rental Trust & Protection</span>
            </button>

            <button
              onClick={() => {
                setIsHelpOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center space-x-2"
            >
              <HelpCircle className="w-4 h-4 text-forest-600" />
              <span>Help Centre & Safety FAQs</span>
            </button>

            {isTrustedAdminSession(currentUser) && (
              <button
                onClick={() => {
                  setIsAdminOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-white border border-charcoal-200 text-charcoal-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4 text-forest-600" />
                <span>Moderation Console</span>
              </button>
            )}

            {currentUser ? (
              <div className="space-y-2 pt-1">
                <div className="w-full bg-ivory-300/80 text-charcoal-800 p-3 rounded-xl text-sm font-medium">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-bold">{currentUser.name}</span>
                    <span className="text-[10px] bg-forest-100 text-forest-800 px-2 py-0.5 rounded font-semibold ml-2 uppercase">
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-charcoal-200/60 flex items-center justify-between">
                    <span className="text-xs text-charcoal-600">Active Persona:</span>
                    <span className="text-xs font-bold text-forest-800 capitalize">
                      {activeMarketplaceProfile?.displayName || activeMarketplaceProfile?.profileType?.replace('_', ' ') || 'Flatmate Seeker'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      openMyProfileModal();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-white border border-charcoal-200 text-forest-800 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                  >
                    <User className="w-4 h-4 text-forest-700" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      openOnboardingModal();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-forest-700 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4 text-sand-300" />
                    <span>Onboarding</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    openAuthModal('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-white border border-charcoal-200 text-charcoal-800 py-2.5 rounded-xl text-xs font-semibold text-center"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    openAuthModal('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-forest-800 text-white py-2.5 rounded-xl text-xs font-semibold text-center"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
