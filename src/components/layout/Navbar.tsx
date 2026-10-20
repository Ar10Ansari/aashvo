import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Menu, X, PlusCircle, ShieldCheck, UserCheck, LogOut, ChevronDown, HelpCircle } from 'lucide-react';
import { isTrustedAdminSession } from '../../services/authorizationService';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsListPropertyOpen,
    setIsAdminOpen,
    setIsAuthOpen,
    setIsHelpOpen,
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

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1 text-xs xl:text-sm font-medium">
              <button
                onClick={() => {
                  setActiveTab('flatmates');
                  const el = document.getElementById('discovery-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  activeTab === 'flatmates'
                    ? 'text-forest-800 bg-forest-50/80 font-semibold'
                    : 'text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60'
                }`}
              >
                Flatmates
              </button>

              <button
                onClick={() => {
                  setActiveTab('family_stays');
                  const el = document.getElementById('discovery-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 ${
                  activeTab === 'family_stays'
                    ? 'text-forest-800 bg-forest-50/80 font-semibold'
                    : 'text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60'
                }`}
              >
                <span>Family Stays</span>
                <span className="text-[10px] bg-sand-200/90 text-forest-900 font-bold px-1.5 py-0.2 rounded-full">
                  Meals
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('entire_flats');
                  const el = document.getElementById('discovery-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  activeTab === 'entire_flats'
                    ? 'text-forest-800 bg-forest-50/80 font-semibold'
                    : 'text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60'
                }`}
              >
                Entire Flats
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('our-founders');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-full text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60 transition-all"
              >
                Founders
              </button>

              <button
                onClick={() => setIsListPropertyOpen(true)}
                className="px-3 py-1.5 rounded-full text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60 transition-all flex items-center space-x-1"
              >
                <span>List Property</span>
                <span className="text-[11px] bg-forest-100 text-forest-700 font-semibold px-1.5 py-0.2 rounded-full ml-0.5">
                  ₹0
                </span>
              </button>

              <button
                onClick={() => setIsHelpOpen(true)}
                className="px-2.5 py-1.5 rounded-full text-charcoal-500 hover:text-charcoal-800 hover:bg-ivory-300/60 transition-all flex items-center space-x-1"
                title="Help Centre & Safety FAQs"
              >
                <HelpCircle className="w-3.5 h-3.5 text-forest-700" />
                <span>Help</span>
              </button>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="hidden md:flex items-center space-x-4">
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
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-charcoal-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-charcoal-100">
                      <p className="text-xs text-charcoal-400 uppercase tracking-wider font-semibold">Active Profile</p>
                      <p className="text-sm font-semibold text-charcoal-800">{currentUser.name}</p>
                      <span className="inline-block mt-1 text-xs bg-forest-50 text-forest-700 px-2 py-0.5 rounded-full font-medium">
                        Role: {currentUser.role.toUpperCase()}
                      </span>
                    </div>

                    <div className="py-1">
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

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setIsAuthOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-charcoal-600 hover:bg-ivory-100 flex items-center space-x-2"
                      >
                        <UserCheck className="w-4 h-4 text-forest-600" />
                        <span>Switch Persona / Login</span>
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
              <button
                onClick={() => setIsAuthOpen(true)}
                className="text-sm font-medium text-charcoal-700 hover:text-forest-700 px-4 py-2 rounded-full hover:bg-ivory-300 transition-all"
              >
                Sign in
              </button>
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
              className="p-2 rounded-lg text-charcoal-600 hover:text-forest-700 hover:bg-ivory-300 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#F5F3ED] border-b border-charcoal-200/50 px-4 pt-2 pb-6 space-y-3">
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

            <button
              onClick={() => {
                setIsAuthOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full bg-ivory-300/80 text-charcoal-800 py-2.5 rounded-xl text-sm font-medium"
            >
              {currentUser ? `Signed in as ${currentUser.name}` : 'Sign in / Switch Account'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
