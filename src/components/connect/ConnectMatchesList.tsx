import React from 'react';
import type { ConnectMatchItem } from '@aashvo/contracts';
import { ShieldCheck, MessageSquare, ChevronRight, User } from 'lucide-react';

interface ConnectMatchesListProps {
  matches: ConnectMatchItem[];
  onSelectMatch: (match: ConnectMatchItem) => void;
  onGoToDiscover: () => void;
  isLoading?: boolean;
}

export const ConnectMatchesList: React.FC<ConnectMatchesListProps> = ({
  matches,
  onSelectMatch,
  onGoToDiscover,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-8 h-8 border-2 border-forest-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-charcoal-700">Loading your matches...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-charcoal-200">
        <div className="w-16 h-16 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-sand-500" />
        </div>
        <h4 className="font-serif text-xl font-bold text-charcoal-900 mb-2">No Matches Yet</h4>
        <p className="text-xs sm:text-sm text-charcoal-600 max-w-sm mb-6 leading-relaxed">
          Mutual matches occur when both you and another flatmate express interest. Keep exploring verified
          candidates in Discover!
        </p>
        <button
          onClick={onGoToDiscover}
          className="px-5 py-2.5 rounded-full bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm transition-all"
        >
          Explore Discover Deck
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-bold text-charcoal-700 uppercase tracking-wider">
          Active Matches ({matches.length})
        </h4>
        <span className="text-[11px] text-charcoal-500">Mutual interest confirmed</span>
      </div>

      <div className="divide-y divide-charcoal-100 bg-white rounded-2xl border border-charcoal-200 shadow-sm overflow-hidden">
        {matches.map((item) => {
          const { partner, lastMessage } = item;
          const isUnread = lastMessage && !lastMessage.read && lastMessage.senderId === partner.userId;

          return (
            <button
              key={item.id}
              onClick={() => onSelectMatch(item)}
              className="w-full text-left p-4 hover:bg-ivory-100 transition-colors flex items-center space-x-3.5 focus:outline-none focus:bg-ivory-100"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-forest-100 border border-charcoal-200">
                  {partner.avatarUrl ? (
                    <img
                      src={partner.avatarUrl}
                      alt={partner.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-forest-700">
                      <User className="w-6 h-6 opacity-60" />
                    </div>
                  )}
                </div>
                {partner.verified && (
                  <span
                    title="ID Verified"
                    className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4 text-forest-600 fill-forest-50" />
                  </span>
                )}
              </div>

              {/* Partner Details & Last Message */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-sm text-charcoal-900 truncate">
                    {partner.displayName}
                  </span>
                  <span className="text-[10px] font-extrabold text-forest-800 bg-forest-50 px-2 py-0.5 rounded-full border border-forest-100 ml-2 flex-shrink-0">
                    {partner.compatibilityScore}%
                  </span>
                </div>

                <div className="text-xs text-charcoal-500 truncate mb-1">
                  {partner.occupation} • {partner.locality || partner.city}
                </div>

                <p
                  className={`text-xs truncate ${
                    isUnread
                      ? 'font-bold text-forest-900'
                      : 'text-charcoal-600'
                  }`}
                >
                  {lastMessage ? lastMessage.content : 'Matched! Say hello and discuss shared rooms.'}
                </p>
              </div>

              {/* Indicator & Arrow */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {isUnread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-forest-600 animate-pulse" />
                )}
                <ChevronRight className="w-4 h-4 text-charcoal-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
