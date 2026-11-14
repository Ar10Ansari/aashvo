import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { visitService } from '../../services/visitService';
import { useApp } from '../../context/AppContext';
import type { Property } from '../../types';

interface ScheduleVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({
  isOpen,
  onClose,
  property,
}) => {
  const { currentUser, openAuthModal, showToast } = useApp();

  // Tomorrow as min date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(minDateStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('11:00');
  const [visitorNotes, setVisitorNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !property) return null;

  const timeSlots = [
    { time: '10:00', label: '10:00 AM (Morning)' },
    { time: '11:30', label: '11:30 AM (Late Morning)' },
    { time: '14:00', label: '02:00 PM (Afternoon)' },
    { time: '16:00', label: '04:00 PM (Late Afternoon)' },
    { time: '17:30', label: '05:30 PM (Evening)' },
    { time: '19:00', label: '07:00 PM (Night)' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      openAuthModal('signin');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Build ISO timestamp in Indian Standard Time (UTC+05:30)
      const scheduledAt = new Date(`${selectedDate}T${selectedTimeSlot}:00+05:30`).toISOString();

      await visitService.scheduleVisit({
        propertyId: property.id,
        scheduledAt,
        visitorMessage: visitorNotes.trim() || undefined,
      });

      setSuccess(true);
      if (showToast) {
        showToast('Viewing request submitted to host!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule viewing';
      if (msg.includes('conflict') || msg.includes('409') || msg.includes('booked')) {
        setErrorMessage('This time slot is already reserved for a viewing. Please select an alternate time.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setErrorMessage(null);
    setVisitorNotes('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-visit-title"
    >
      <div className="bg-[#FBF9F5] rounded-3xl max-w-lg w-full shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5 text-sand-400" />
            </div>
            <div>
              <h2 id="schedule-visit-title" className="font-serif font-bold text-lg text-forest-900">Schedule In-Person Visit</h2>
              <p className="text-xs text-charcoal-500">Coordinate a verified property inspection with the host</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            aria-label="Close schedule visit dialog"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {success ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-forest-900">Viewing Request Sent!</h3>
                <p className="text-xs text-charcoal-600 mt-1 max-w-xs mx-auto">
                  The host has been notified with your requested slot ({selectedDate} at {selectedTimeSlot} IST). You will receive an in-app update once confirmed.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Property Card Summary */}
              <div className="bg-white p-3.5 rounded-2xl border border-charcoal-200/60 shadow-xs flex items-center space-x-3">
                {property.images && property.images[0] && (
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-forest-900 truncate">{property.title}</h4>
                  <p className="text-[11px] text-charcoal-500 flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-forest-700 flex-shrink-0" />
                    <span className="truncate">{property.locality}, {property.city}</span>
                  </p>
                  <p className="text-xs font-bold text-forest-800 mt-1">
                    ₹{property.rent.toLocaleString('en-IN')}/mo
                  </p>
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Select Visit Date (IST)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    min={minDateStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-2">
                  Select Time Slot (IST)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.time}
                      onClick={() => setSelectedTimeSlot(slot.time)}
                      className={`p-2 rounded-xl text-xs font-semibold border text-left transition-all ${
                        selectedTimeSlot === slot.time
                          ? 'bg-forest-800 text-white border-forest-800 shadow-xs'
                          : 'bg-white text-charcoal-700 border-charcoal-200 hover:bg-charcoal-50'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 opacity-70" />
                        <span>{slot.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note to Host */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-600 mb-1">
                  Note to Host (Optional)
                </label>
                <textarea
                  value={visitorNotes}
                  onChange={(e) => setVisitorNotes(e.target.value)}
                  placeholder="e.g., Interested in immediate move-in; will be visiting with a colleague."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-charcoal-200 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-600 resize-none"
                />
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Conflict & Scheduling Guidelines Notice */}
              <div className="p-3 bg-[#F5F3ED] rounded-xl text-[11px] text-charcoal-600 flex items-start space-x-2 border border-charcoal-200/50">
                <ShieldCheck className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
                <p>
                  Visits are spaced with a mandatory 30-minute interval to prevent double-booking. The host will confirm or suggest an alternate time.
                </p>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-charcoal-600 hover:text-charcoal-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Submitting...' : 'Request Viewing'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
