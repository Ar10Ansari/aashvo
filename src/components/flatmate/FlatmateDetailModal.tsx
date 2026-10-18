import React, { useState } from 'react';
import { Flatmate } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/formatters';
import { X, CheckCircle2, MapPin, Send } from 'lucide-react';

interface FlatmateDetailModalProps {
  flatmate: Flatmate;
  onClose: () => void;
}

export const FlatmateDetailModal: React.FC<FlatmateDetailModalProps> = ({ flatmate, onClose }) => {
  const { currentUser, submitConnectRequest, showToast } = useApp();

  const [senderName, setSenderName] = useState(currentUser?.name || '');
  const [senderPhone, setSenderPhone] = useState(currentUser?.phone || '');
  const [message, setMessage] = useState(
    `Hi ${flatmate.name}, I loved your profile and lifestyle preferences. I am also looking in ${flatmate.targetLocalities[0]}. Let's connect!`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectSent, setConnectSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderPhone) {
      showToast('Please provide your name and phone number.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      submitConnectRequest({
        targetId: flatmate.id,
        targetType: 'flatmate',
        senderName,
        senderPhone,
        senderEmail: currentUser?.email || '',
        moveInDate: 'Flexible',
        message,
      });
      setIsSubmitting(false);
      setConnectSent(true);
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-flatmate-title"
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-ivory-100/80">
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                flatmate.hasRoom
                  ? 'bg-forest-50 text-forest-700 border-forest-200'
                  : 'bg-sand-100 text-charcoal-800 border-sand-300'
              }`}
            >
              {flatmate.hasRoom ? 'Has Vacant Room Available' : 'Looking to Team Up & Rent'}
            </span>
            {flatmate.verified && (
              <span className="flex items-center space-x-1 text-xs text-forest-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-forest-600" />
                <span>Identity Verified</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-800 rounded-full hover:bg-ivory-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Top Profile Intro */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">
            <img
              src={flatmate.avatar}
              alt={flatmate.name}
              className="w-24 h-24 rounded-3xl object-cover border-4 border-ivory-200 shadow-md"
            />
            <div>
              <h2 id="modal-flatmate-title" className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900">
                {flatmate.name}, {flatmate.age}
              </h2>
              <p className="text-sm font-medium text-forest-700">{flatmate.occupation}</p>
              <div className="flex items-center space-x-1.5 text-xs text-charcoal-500 mt-1">
                <MapPin className="w-3.5 h-3.5 text-forest-600" />
                <span>Looking in: {flatmate.targetLocalities.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* If has room details */}
          {flatmate.hasRoom && flatmate.roomDetails && (
            <div className="bg-forest-50/70 border border-forest-200 rounded-2xl p-4 text-xs text-forest-900">
              <span className="font-bold block uppercase tracking-wider mb-1">Room Opportunity:</span>
              <p>{flatmate.roomDetails}</p>
            </div>
          )}

          {/* Bio */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-2">About Me</h3>
            <p className="text-sm text-charcoal-600 leading-relaxed">{flatmate.bio}</p>
          </div>

          {/* Living Compatibility Matrix */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">Living Compatibility</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Diet & Food</span>
                <p className="font-semibold text-charcoal-800 mt-1">🥗 {flatmate.foodHabit}</p>
              </div>

              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Sleep Schedule</span>
                <p className="font-semibold text-charcoal-800 mt-1">⏰ {flatmate.sleepRoutine}</p>
              </div>

              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Cleanliness Standard</span>
                <p className="font-semibold text-charcoal-800 mt-1">✨ {flatmate.cleanliness}</p>
              </div>

              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Pet Policy</span>
                <p className="font-semibold text-charcoal-800 mt-1">
                  🐾 {flatmate.petFriendly ? 'Loves Pets' : 'Prefer No Pets'}
                </p>
              </div>

              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Smoking</span>
                <p className="font-semibold text-charcoal-800 mt-1">🚭 {flatmate.smoking}</p>
              </div>

              <div className="bg-ivory-100 p-3 rounded-2xl border border-charcoal-100">
                <span className="text-charcoal-400 block font-semibold uppercase tracking-wider text-[10px]">Max Rent Outlay</span>
                <p className="font-semibold text-forest-800 font-serif mt-1">{formatINR(flatmate.budgetMax)} / mo</p>
              </div>
            </div>
          </div>

          {/* Interests & Passions */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-2">Interests & Hobbies</h3>
            <div className="flex flex-wrap gap-2">
              {flatmate.interests.map(interest => (
                <span
                  key={interest}
                  className="text-xs bg-sand-50 text-charcoal-700 border border-sand-200 px-3 py-1 rounded-full font-medium"
                >
                  #{interest}
                </span>
              ))}
            </div>
          </div>

          {/* Connect Request Form */}
          <div className="bg-[#F5F3ED] p-6 rounded-3xl border border-charcoal-200">
            <h3 className="font-serif text-xl font-semibold text-charcoal-900 mb-1">
              Connect with {flatmate.name}
            </h3>
            <p className="text-xs text-charcoal-500 mb-4">
              Send an introductory message. Contact info is shared only upon mutual approval.
            </p>

            {connectSent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center text-emerald-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                <h4 className="font-serif text-base font-bold">Connection Request Sent!</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  {flatmate.name} will be notified with your note. You can check your requests in your profile.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-600 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-600 mb-1">Your Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={senderPhone}
                      onChange={e => setSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-600 mb-1">Introductory Note</label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-forest-600 hover:bg-forest-700 text-white font-semibold py-3 px-6 rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4 text-sand-300" />
                  <span>{isSubmitting ? 'Sending Request...' : `Send Connect Request to ${flatmate.name}`}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
