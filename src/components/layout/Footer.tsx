import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, MapPin, Mail } from 'lucide-react';
import { isTrustedAdminSession } from '../../services/authorizationService';

export const Footer: React.FC = () => {
  const { setIsListPropertyOpen, setIsAdminOpen, setIsHelpOpen, currentUser } = useApp();

  return (
    <footer className="bg-charcoal-900 text-ivory-100 pt-16 pb-12 border-t border-charcoal-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Provider Call to Action Banner */}
        <div className="bg-gradient-to-r from-forest-800 to-forest-900 rounded-3xl p-8 sm:p-12 mb-16 border border-forest-700/60 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-sand-300 bg-forest-950/60 px-3 py-1 rounded-full border border-forest-600/50">
              For Property Owners Across India
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-3 mb-2">
              Have a flat or room to share?
            </h2>
            <p className="text-forest-100/80 text-sm leading-relaxed">
              List directly with zero brokerage. Connect with students and working professionals with full address and privacy control.
            </p>
          </div>

          <button
            onClick={() => setIsListPropertyOpen(true)}
            className="bg-sand-400 hover:bg-sand-300 active:bg-sand-500 text-charcoal-900 font-semibold px-6 py-3.5 rounded-2xl shadow-lg transition-all flex items-center space-x-2 flex-shrink-0"
          >
            <span>List Property (₹0 Fee)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-12 border-b border-charcoal-800">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-baseline space-x-1">
              <span className="font-serif text-3xl font-bold tracking-tight text-white">aashvo</span>
              <span className="w-2 h-2 rounded-full bg-sand-400 inline-block" />
            </div>
            <p className="text-xs text-charcoal-300 leading-relaxed max-w-sm">
              India&apos;s affordable-living discovery platform for students and working professionals. Connecting people with compatible flatmates, affordable rooms in family homes with meals, and shared living across Indian cities.
            </p>
            <div className="pt-2 text-xs text-charcoal-400 space-y-1">
              <p className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-sand-400" />
                <span>Pan-India Shared Living • Connecting flatmates and homes across Indian cities</span>
              </p>
              <p className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-sand-400" />
                <span>support@aashvo.com</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Explore Living
            </h3>
            <ul className="space-y-2 text-xs text-charcoal-300">
              <li>
                <a href="#discovery-section" className="hover:text-sand-300 transition-colors">
                  Find Flatmates & Roommates
                </a>
              </li>
              <li>
                <a href="#discovery-section" className="hover:text-sand-300 transition-colors">
                  Family Stays (with Meals)
                </a>
              </li>
              <li>
                <a href="#discovery-section" className="hover:text-sand-300 transition-colors">
                  Entire Flats & Apartments
                </a>
              </li>
              <li>
                <a href="#our-founders" className="hover:text-sand-300 transition-colors font-medium text-sand-300/90">
                  Our Founders →
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Trust, Safety & Help
            </h3>
            <ul className="space-y-2 text-xs text-charcoal-300">
              <li>
                <button onClick={() => setIsHelpOpen(true)} className="hover:text-sand-300 text-left transition-colors font-semibold text-sand-300">
                  Help Centre & FAQs
                </button>
              </li>
              <li>
                <button onClick={() => setIsHelpOpen(true)} className="hover:text-sand-300 text-left transition-colors">
                  Contact Support Team
                </button>
              </li>
              <li>
                <button onClick={() => setIsHelpOpen(true)} className="hover:text-sand-300 text-left transition-colors">
                  Zero Advance Payment Rules
                </button>
              </li>
              {isTrustedAdminSession(currentUser) && (
                <li>
                  <button onClick={() => setIsAdminOpen(true)} className="hover:text-sand-300 text-left transition-colors">
                    Staff Moderation Console
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Legal & Privacy
            </h3>
            <ul className="space-y-2 text-xs text-charcoal-300">
              <li>
                <span className="text-charcoal-300">Privacy Policy (Address Masking)</span>
              </li>
              <li>
                <span className="text-charcoal-300">Terms of Service</span>
              </li>
              <li>
                <button onClick={() => setIsHelpOpen(true)} className="hover:text-sand-300 text-left transition-colors">
                  Track Your Support Ticket
                </button>
              </li>
              <li>
                <button onClick={() => setIsHelpOpen(true)} className="hover:text-sand-300 text-left transition-colors">
                  Report Community Guideline Issue
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-charcoal-400 gap-4">
          <p>© {new Date().getFullYear()} Aashvo. All rights reserved. Pan-India Affordable Living.</p>
          <p className="flex items-center space-x-1 font-serif text-sand-300/90 italic">
            <span>Find your place. Find your people.</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
