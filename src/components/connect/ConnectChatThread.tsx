import React, { useState, useEffect, useRef } from 'react';
import type { ConnectMatchItem, ConnectMessageItem } from '@aashvo/contracts';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Ban,
  Flag,
  ShieldCheck,
  Check,
  CheckCheck,
  User,
  Info,
} from 'lucide-react';

interface ConnectChatThreadProps {
  match: ConnectMatchItem;
  messages: ConnectMessageItem[];
  currentUserId?: string;
  onSendMessage: (content: string) => Promise<void>;
  onBack: () => void;
  onBlockUser: (targetUserId: string, reason?: string) => Promise<void>;
  onReportUser: (targetUserId: string, reason: string, details?: string) => Promise<void>;
}

export const ConnectChatThread: React.FC<ConnectChatThreadProps> = ({
  match,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  onBlockUser,
  onReportUser,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate communication');
  const [reportDetails, setReportDetails] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { partner } = match;

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(clean);
      setInputText('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmBlock = async () => {
    setIsActionSubmitting(true);
    try {
      await onBlockUser(partner.userId, 'Blocked by flatmate match');
      setShowBlockConfirm(false);
      onBack();
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSubmitReport = async () => {
    setIsActionSubmitting(true);
    try {
      await onReportUser(partner.userId, reportReason, reportDetails);
      setShowReportDialog(false);
      setReportDetails('');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[580px] sm:h-[620px] bg-white rounded-3xl border border-charcoal-200 overflow-hidden shadow-md">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal-100 bg-ivory-100/70 z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-ivory-300 text-charcoal-600 transition-colors focus:outline-none"
            aria-label="Back to matches list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Partner Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-forest-100 border border-charcoal-200">
              {partner.avatarUrl ? (
                <img
                  src={partner.avatarUrl}
                  alt={partner.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-forest-700">
                  <User className="w-5 h-5 opacity-60" />
                </div>
              )}
            </div>
            {partner.verified && (
              <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-forest-600 fill-forest-50" />
              </span>
            )}
          </div>

          {/* Partner Title */}
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-charcoal-900 truncate">
                {partner.displayName}
              </span>
              <span className="text-[10px] font-extrabold text-forest-800 bg-forest-50 px-1.5 py-0.2 rounded-full border border-forest-100">
                {partner.compatibilityScore}%
              </span>
            </div>
            <p className="text-[11px] text-charcoal-500 truncate">
              {partner.occupation} • {partner.locality || partner.city}
            </p>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-full hover:bg-ivory-300 text-charcoal-500 transition-colors focus:outline-none"
            aria-label="Safety and options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-charcoal-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowReportDialog(true);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-charcoal-700 hover:bg-ivory-100 flex items-center space-x-2"
              >
                <Flag className="w-4 h-4 text-amber-600" />
                <span>Report Flatmate</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowBlockConfirm(true);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Ban className="w-4 h-4 text-red-600" />
                <span>Block Flatmate</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-sand-50/70 border-b border-sand-200/50 px-4 py-2 flex items-center space-x-2 text-[11px] text-charcoal-600">
        <Info className="w-3.5 h-3.5 text-forest-700 flex-shrink-0" />
        <span className="truncate">
          Keep conversations on Aashvo. Never pay deposits before in-person visits.
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-charcoal-500">
            <p className="text-xs font-semibold text-charcoal-700">No messages yet</p>
            <p className="text-[11px] mt-1 max-w-xs">
              Say hello to {partner.displayName}! Ask about target move-in dates or sharing a flat.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId ? msg.senderId === currentUserId : msg.senderId !== partner.userId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-forest-700 text-white rounded-br-none'
                      : 'bg-white text-charcoal-800 border border-charcoal-200/60 rounded-bl-none'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                </div>
                <div className="flex items-center space-x-1 mt-1 px-1 text-[10px] text-charcoal-400">
                  <span>{timeStr}</span>
                  {isMe && (
                    <span>
                      {msg.readAt ? (
                        <CheckCheck className="w-3 h-3 text-forest-600 inline" />
                      ) : (
                        <Check className="w-3 h-3 text-charcoal-400 inline" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-charcoal-200/80 bg-white flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${partner.displayName}...`}
          maxLength={1000}
          className="flex-1 px-4 py-2.5 rounded-full border border-charcoal-300 text-xs sm:text-sm focus:outline-none focus:border-forest-600 focus:ring-1 focus:ring-forest-600"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            inputText.trim() && !isSending
              ? 'bg-forest-700 text-white hover:bg-forest-800 shadow-sm active:scale-95'
              : 'bg-charcoal-100 text-charcoal-300 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Safety Modal: Block User */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-charcoal-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Ban className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-lg font-bold text-charcoal-900 mb-1">
              Block {partner.displayName}?
            </h4>
            <p className="text-xs text-charcoal-600 mb-5 leading-relaxed">
              This will immediately unmatch you, archive this conversation, and prevent either of you
              from discovering each other in Aashvo Connect.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={isActionSubmitting}
                className="flex-1 py-2 text-xs font-semibold rounded-full border border-charcoal-300 text-charcoal-700 hover:bg-ivory-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                disabled={isActionSubmitting}
                className="flex-1 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                {isActionSubmitting ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Modal: Report User */}
      {showReportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-charcoal-200 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 mb-3">
              <Flag className="w-5 h-5 text-amber-600" />
              <h4 className="font-serif text-lg font-bold text-charcoal-900">
                Report {partner.displayName}
              </h4>
            </div>
            <p className="text-xs text-charcoal-600 mb-4">
              Our safety team reviews all reports against community standards.
            </p>

            <label className="block text-xs font-bold text-charcoal-700 mb-1">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-charcoal-300 text-xs text-charcoal-800 mb-3 focus:outline-none focus:border-forest-600"
            >
              <option value="Inappropriate communication">Inappropriate communication</option>
              <option value="Scam or payment fraud">Scam or payment fraud</option>
              <option value="Misleading flatmate details">Misleading flatmate details</option>
              <option value="Harassment or abuse">Harassment or abuse</option>
              <option value="Other concern">Other concern</option>
            </select>

            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              Details (Optional)
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Describe what occurred..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl border border-charcoal-300 text-xs text-charcoal-800 mb-4 focus:outline-none focus:border-forest-600"
            />

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowReportDialog(false)}
                disabled={isActionSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-charcoal-300 text-charcoal-700 hover:bg-ivory-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isActionSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-forest-700 text-white hover:bg-forest-800 shadow-sm"
              >
                {isActionSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
