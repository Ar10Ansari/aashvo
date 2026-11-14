import React from 'react';
import type { ConnectMatchItem } from '@aashvo/contracts';
import { Sparkles, MessageSquare, ArrowRight, X, ShieldCheck } from 'lucide-react';

interface ConnectMatchModalProps {
  match: ConnectMatchItem;
  onClose: () => void;
  onStartChat: (match: ConnectMatchItem) => void;
}

export const ConnectMatchModal: React.FC<ConnectMatchModalProps> = ({
  match,
  onClose,
  onStartChat,
}) => {
  const { partner } = match;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden text-center p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-charcoal-400 hover:text-charcoal-700 rounded-full hover:bg-ivory-200 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Badge */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-forest-50 border border-forest-200/80 text-forest-800 text-xs font-bold mb-5">
          <Sparkles className="w-3.5 h-3.5 text-sand-500" />
          <span>Mutual Flatmate Interest</span>
        </div>

        {/* Title & Description */}
        <h3 className="font-serif text-3xl font-bold text-forest-900 tracking-tight mb-2">
          It's a Mutual Match!
        </h3>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-xs mx-auto mb-6 leading-relaxed">
          You and <span className="font-semibold text-charcoal-900">{partner.displayName}</span> both
          expressed interest in teaming up for shared living.
        </p>

        {/* Overlapping Avatars Graphic */}
        <div className="flex items-center justify-center -space-x-4 mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-forest-100 flex items-center justify-center overflow-hidden z-10">
            <span className="font-serif font-bold text-2xl text-forest-800">You</span>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-sand-100 flex items-center justify-center overflow-hidden z-20">
            {partner.avatarUrl ? (
              <img
                src={partner.avatarUrl}
                alt={partner.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-serif font-bold text-2xl text-charcoal-700">
                {partner.displayName.charAt(0)}
              </span>
            )}
          </div>
        </div>

        {/* Compatibility & Details Pill */}
        <div className="bg-ivory-100/90 border border-charcoal-200/70 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-charcoal-900">{partner.displayName}</span>
              {partner.verified && (
                <span title="Verified Member">
                  <ShieldCheck className="w-4 h-4 text-forest-600" />
                </span>
              )}
            </div>
            <span className="text-xs font-extrabold text-forest-800 bg-forest-100/80 px-2 py-0.5 rounded-full">
              {partner.compatibilityScore}% Compatibility
            </span>
          </div>
          <p className="text-xs text-charcoal-600">{partner.occupation}</p>
          <div className="flex items-center justify-between text-xs text-charcoal-500 mt-2 pt-2 border-t border-charcoal-200/50">
            <span>Location: {partner.locality || partner.city}</span>
            <span>Budget: ₹{partner.budgetMax.toLocaleString('en-IN')}/mo</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2.5">
          <button
            onClick={() => onStartChat(match)}
            className="w-full py-3 rounded-full bg-forest-700 text-white font-semibold text-sm hover:bg-forest-800 shadow-md flex items-center justify-center space-x-2 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send a Message</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full border border-charcoal-200 text-charcoal-600 font-medium text-xs hover:bg-ivory-200 transition-colors"
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  );
};
