import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { connectService } from '../../services/connectService';
import { ConnectSwipeDeck } from './ConnectSwipeDeck';
import { ConnectMatchesList } from './ConnectMatchesList';
import { ConnectChatThread } from './ConnectChatThread';
import { ConnectMatchModal } from './ConnectMatchModal';
import { ConnectProfileSettings } from './ConnectProfileSettings';
import type {
  ConnectCandidateView,
  ConnectMatchItem,
  ConnectMessageItem,
  FlatmateIntention,
} from '@aashvo/contracts';
import {
  X,
  Sparkles,
  MessageSquare,
  Sliders,
} from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'discover' | 'matches' | 'chat' | 'settings';
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'discover',
}) => {
  const {
    currentUser,
    marketplaceProfiles,
    profileCompletion,
    openOnboardingModal,
    openAuthModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'chat' | 'settings'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  const [candidates, setCandidates] = useState<ConnectCandidateView[]>([]);
  const [matches, setMatches] = useState<ConnectMatchItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ConnectMatchItem | null>(null);
  const [messages, setMessages] = useState<ConnectMessageItem[]>([]);
  const [celebratedMatch, setCelebratedMatch] = useState<ConnectMatchItem | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [discoveryHidden, setDiscoveryHidden] = useState(false);
  const [isLoadingDeck, setIsLoadingDeck] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [selectedIntentionFilter, setSelectedIntentionFilter] = useState<FlatmateIntention | 'all'>('all');

  // Load candidates
  const loadCandidates = useCallback(async (intentFilter?: FlatmateIntention | 'all') => {
    setIsLoadingDeck(true);
    try {
      const activeFilter = intentFilter !== undefined ? intentFilter : selectedIntentionFilter;
      const params = activeFilter && activeFilter !== 'all' ? { intention: activeFilter } : undefined;
      const data = await connectService.getCandidates(params);
      setCandidates(data);
    } catch {
      // Handled in service fallback
    } finally {
      setIsLoadingDeck(false);
    }
  }, [selectedIntentionFilter]);

  const handleSelectIntentionFilter = (filter: FlatmateIntention | 'all') => {
    setSelectedIntentionFilter(filter);
    loadCandidates(filter);
  };

  // Load matches
  const loadMatches = useCallback(async () => {
    if (!currentUser) {
      setMatches([]);
      return;
    }
    setIsLoadingMatches(true);
    try {
      const data = await connectService.getMatches();
      setMatches(data);
    } catch {
      setMatches([]);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [currentUser]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCandidates();
      loadMatches();
    }
  }, [isOpen, loadCandidates, loadMatches]);

  // Load messages when a match is opened
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTab === 'chat' && selectedMatch) {
      const fetchThread = async () => {
        try {
          const msgs = await connectService.getMessages(selectedMatch.id);
          setMessages(msgs);
        } catch {
          // Ignored
        }
      };

      fetchThread();
      timer = setInterval(fetchThread, 4000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeTab, selectedMatch]);

  // Handle Swipe
  const handleSwipe = async (targetUserId: string, action: 'like' | 'pass') => {
    const res = await connectService.swipe(targetUserId, action);
    setCanUndo(true);

    if (res.matched && res.match) {
      setCelebratedMatch(res.match);
      setMatches((prev) => [res.match!, ...prev.filter((m) => m.id !== res.match!.id)]);
    }

    return res;
  };

  // Handle Undo
  const handleUndo = async () => {
    await connectService.undo();
    setCanUndo(false);
  };

  // Handle Sending a Message
  const handleSendMessage = async (content: string) => {
    if (!selectedMatch) return;
    const newMsg = await connectService.sendMessage(selectedMatch.id, content);
    setMessages((prev) => [...prev, newMsg]);
    loadMatches(); // Update snippet
  };

  // Handle Unmatching a Match
  const handleUnmatch = async (matchId: string, reason?: string) => {
    await connectService.unmatch(matchId, reason);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setSelectedMatch(null);
    setActiveTab('matches');
  };

  // Handle Blocking a User
  const handleBlockUser = async (targetUserId: string, reason?: string) => {
    await connectService.blockUser(targetUserId, reason);
    setMatches((prev) => prev.filter((m) => m.partner.userId !== targetUserId));
    setCandidates((prev) => prev.filter((c) => c.userId !== targetUserId));
    setSelectedMatch(null);
    setActiveTab('matches');
  };

  // Handle Reporting a User
  const handleReportUser = async (targetUserId: string, reason: string, details?: string) => {
    await connectService.reportUser(targetUserId, reason, details);
  };

  // Handle Visibility Toggle
  const handleToggleVisibility = async (hidden: boolean) => {
    const res = await connectService.updateVisibility(hidden);
    setDiscoveryHidden(res.discoveryHidden);
  };

  // Navigate to Chat with Match
  const handleStartChatFromMatch = (match: ConnectMatchItem) => {
    setCelebratedMatch(null);
    setSelectedMatch(match);
    setActiveTab('chat');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#F5F3ED] rounded-3xl shadow-2xl border border-charcoal-200 overflow-hidden flex flex-col h-[94vh] max-h-[820px]">
        {/* Modal Top Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-charcoal-200/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-forest-700">
                aashvo connect
              </span>
              <span className="w-2 h-2 rounded-full bg-sand-400 inline-block" />
            </div>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-charcoal-500 bg-ivory-200 px-2.5 py-0.5 rounded-full border border-charcoal-200/50">
              Co-Living Match
            </span>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex items-center bg-ivory-200/90 p-1 rounded-2xl border border-charcoal-200/60 shadow-inner">
            <button
              onClick={() => {
                setActiveTab('discover');
                setSelectedMatch(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'discover'
                  ? 'bg-forest-700 text-white shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discover</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('matches');
                setSelectedMatch(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'matches' || activeTab === 'chat'
                  ? 'bg-forest-700 text-white shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Matches</span>
              {matches.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeTab === 'matches' || activeTab === 'chat'
                      ? 'bg-white text-forest-800'
                      : 'bg-forest-700 text-white'
                  }`}
                >
                  {matches.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setSelectedMatch(null);
              }}
              title="Visibility & Standards"
              className={`p-1.5 rounded-xl text-xs transition-all ${
                activeTab === 'settings'
                  ? 'bg-forest-700 text-white shadow-sm'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-200 transition-colors focus:outline-none"
            aria-label="Close Connect"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {activeTab === 'discover' && (
            <ConnectSwipeDeck
              candidates={candidates}
              onSwipe={handleSwipe}
              onUndo={handleUndo}
              canUndo={canUndo}
              onRefresh={() => loadCandidates()}
              isLoading={isLoadingDeck}
              selectedIntention={selectedIntentionFilter}
              onSelectIntention={handleSelectIntentionFilter}
              currentUser={currentUser}
              marketplaceProfiles={marketplaceProfiles}
              profileCompletion={profileCompletion}
              onOpenOnboarding={openOnboardingModal}
              onOpenAuth={openAuthModal}
            />
          )}

          {activeTab === 'matches' && (
            <ConnectMatchesList
              matches={matches}
              onSelectMatch={(match) => {
                setSelectedMatch(match);
                setActiveTab('chat');
              }}
              onGoToDiscover={() => setActiveTab('discover')}
              isLoading={isLoadingMatches}
            />
          )}

          {activeTab === 'chat' && selectedMatch && (
            <ConnectChatThread
              match={selectedMatch}
              messages={messages}
              currentUserId={currentUser?.id}
              onSendMessage={handleSendMessage}
              onBack={() => {
                setSelectedMatch(null);
                setActiveTab('matches');
              }}
              onBlockUser={handleBlockUser}
              onReportUser={handleReportUser}
              onUnmatch={handleUnmatch}
            />
          )}

          {activeTab === 'settings' && (
            <ConnectProfileSettings
              discoveryHidden={discoveryHidden}
              onToggleVisibility={handleToggleVisibility}
              currentUser={currentUser}
            />
          )}
        </div>

        {/* Mutual Match Celebration Popup */}
        {celebratedMatch && (
          <ConnectMatchModal
            match={celebratedMatch}
            onClose={() => setCelebratedMatch(null)}
            onStartChat={handleStartChatFromMatch}
          />
        )}
      </div>
    </div>
  );
};
