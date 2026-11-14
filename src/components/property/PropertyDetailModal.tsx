import React, { useState, useEffect } from 'react';
import { Property } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR, getFreshnessInfo, getProviderBadge } from '../../utils/formatters';
import {
  X,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  ChevronRight,
  Zap,
  ShieldCheck,
  Bookmark,
  Calendar,
  Award,
  Navigation,
  Building2,
  GraduationCap,
  Train,
} from 'lucide-react';
import { savedService } from '../../services/savedService';
import { getLandmarks } from '../../services/marketplaceService';
import { ScheduleVisitModal } from '../visit/ScheduleVisitModal';
import { PropertyVerificationModal } from './PropertyVerificationModal';

interface PropertyDetailModalProps {
  property: Property;
  onClose: () => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({ property, onClose }) => {
  const { currentUser, submitConnectRequest, setReportingTarget, showToast } = useApp();
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  // Feature Expansion Modals & Saved State
  const [isSaved, setIsSaved] = useState(false);
  const [isScheduleVisitOpen, setIsScheduleVisitOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [landmarks, setLandmarks] = useState<any[]>([]);

  // Inquiry Form State
  const [senderName, setSenderName] = useState(currentUser?.name || '');
  const [senderPhone, setSenderPhone] = useState(currentUser?.phone || '');
  const senderEmail = currentUser?.email || '';
  const [moveInDate, setMoveInDate] = useState('Within 15 days');
  const [message, setMessage] = useState('Hi, I am interested in viewing this property in person. Please confirm your availability.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const type = property.category === 'family_stays' ? 'family_stay' : 'property';
      savedService
        .checkSaved(type, property.id)
        .then((res) => setIsSaved(res.isSaved))
        .catch(() => {});
    }
  }, [currentUser, property.id, property.category]);

  useEffect(() => {
    // Fetch nearby verified landmarks for this city/coords
    getLandmarks(property.city, property.coordinates?.lat, property.coordinates?.lng, 12)
      .then((items) => setLandmarks(items))
      .catch(() => setLandmarks([]));
  }, [property.city, property.coordinates?.lat, property.coordinates?.lng]);

  const handleToggleSave = async () => {
    if (!currentUser) {
      if (showToast) showToast('Please sign in to save listings.');
      return;
    }
    const targetType = property.category === 'family_stays' ? 'family_stay' : 'property';
    try {
      if (isSaved) {
        await savedService.unsaveItem(targetType, property.id);
        setIsSaved(false);
        if (showToast) showToast('Removed from saved.');
      } else {
        await savedService.saveItem(targetType, property.id);
        setIsSaved(true);
        if (showToast) showToast('Saved to shortlist!');
      }
    } catch {
      setIsSaved(!isSaved);
    }
  };



  const freshness = getFreshnessInfo(property.lastVerifiedDate);
  const provider = getProviderBadge(property.providerType, property.brokerageFee);

  // Total move-in calculation
  const totalMoveInEstimate = property.rent + property.deposit + property.maintenance + property.brokerageFee;

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderPhone) {
      showToast('Please provide your name and phone number to schedule a visit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitConnectRequest({
        targetId: property.id,
        targetType: 'property',
        senderName,
        senderPhone,
        senderEmail,
        moveInDate,
        message,
      });
      if (result.success) setInquirySent(true);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-property-title"
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-ivory-100/80">
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${freshness.badgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{freshness.label}</span>
            </span>
            <span className={`px-3 py-1 rounded-full text-xs border ${provider.badgeStyle}`}>
              {provider.label}
            </span>
            {property.verificationStatus === 'verified' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Award className="w-3.5 h-3.5 text-emerald-700" />
                <span>Verified Listing</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Host Verification Trigger */}
            {(currentUser?.role === 'owner' || currentUser?.role === 'broker' || currentUser?.id === property.ownerId) && (
              <button
                onClick={() => setIsVerificationOpen(true)}
                className="text-xs font-semibold text-forest-800 hover:text-forest-900 bg-sand-200/80 hover:bg-sand-300 px-3 py-1.5 rounded-full transition-all flex items-center space-x-1"
                title="Verify ownership documentation"
              >
                <Award className="w-3.5 h-3.5 text-forest-700" />
                <span>Verify Property</span>
              </button>
            )}

            {/* Bookmark button */}
            <button
              onClick={handleToggleSave}
              className={`p-2 rounded-full border transition-all ${
                isSaved
                  ? 'bg-forest-800 text-sand-300 border-forest-700'
                  : 'bg-white hover:bg-ivory-200 text-charcoal-600 border-charcoal-200'
              }`}
              title={isSaved ? 'Remove from saved' : 'Save listing'}
              aria-label={isSaved ? 'Remove from saved' : 'Save listing'}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-charcoal-400 hover:text-charcoal-800 rounded-full hover:bg-ivory-200 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
          {/* Title & Location Header */}
          <div>
            <div className="flex items-center space-x-2 text-xs text-charcoal-500 font-medium mb-1">
              <MapPin className="w-4 h-4 text-forest-600" />
              <span>{property.locality}, {property.city}</span>
              <span>•</span>
              <span>{property.addressShort}</span>
            </div>
            <h2 id="modal-property-title" className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal-900">
              {property.title}
            </h2>
          </div>

          {/* Image Gallery */}
          <div className="space-y-3">
            <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-ivory-300">
              <img
                src={property.images[selectedImgIndex]}
                alt={`${property.title} main view`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Thumbnail selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {property.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImgIndex(idx)}
                  className={`w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    selectedImgIndex === idx ? 'border-forest-600 scale-95' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* ITEM-BY-ITEM TRANSPARENT COST BREAKDOWN */}
          <div className="bg-[#F5F3ED] rounded-3xl p-6 sm:p-7 border border-charcoal-200/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-semibold text-charcoal-900 flex items-center space-x-2">
                <span>Transparent Financial Breakdown</span>
              </h3>
              <span className="text-xs bg-forest-100 text-forest-800 font-semibold px-3 py-1 rounded-full">
                Guaranteed No Surprises
              </span>
            </div>

            <p className="text-xs text-charcoal-500 mb-6">
              All costs are verified with the provider. Tenant rights mandate complete upfront disclosure of recurring monthly rent, security deposits, and meal costs without hidden add-ons.
            </p>

            {/* Recurring Monthly Costs vs One-Time Outlay */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-2xl border border-charcoal-100 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">Monthly Rent</span>
                <p className="font-serif text-2xl font-bold text-forest-800 mt-1">{formatINR(property.rent)}</p>
                <span className="text-[11px] text-charcoal-500">
                  {property.category === 'family_stays' && property.mealsOffered === 'included'
                    ? 'Includes home-cooked meals'
                    : 'Recurring monthly'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-charcoal-100 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">Security Deposit</span>
                <p className="font-serif text-2xl font-bold text-charcoal-800 mt-1">{formatINR(property.deposit)}</p>
                <span className="text-[11px] text-emerald-700 font-medium">100% refundable upon move-out</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-charcoal-100 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">Monthly Maintenance</span>
                <p className="font-serif text-2xl font-bold text-charcoal-800 mt-1">{formatINR(property.maintenance)}</p>
                <span className="text-[11px] text-charcoal-500">Society / amenities dues</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-charcoal-100 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">Brokerage / Service Fee</span>
                <p className="font-serif text-2xl font-bold text-forest-800 mt-1">
                  {property.brokerageFee === 0 ? '₹0 Free' : formatINR(property.brokerageFee)}
                </p>
                <span className="text-[11px] text-charcoal-500">
                  {property.brokerageFee === 0 ? 'Direct Owner listing' : 'Declared upfront'}
                </span>
              </div>
            </div>

            {/* Family Stay Meal Disclosure Banner if applicable */}
            {property.category === 'family_stays' && property.mealsOffered && (
              <div className="mb-6 p-4 rounded-2xl bg-white border border-sand-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800">
                    Resident Family Co-Living & Meal Policy
                  </span>
                  <p className="text-xs text-charcoal-700 mt-0.5">
                    {property.mealsOffered === 'included' && (
                      <span>
                        <strong>Home-Cooked Meals: Included in Rent.</strong> Daily breakfast & dinner prepared by the host family are covered at ₹0 additional charge (no double counting).
                      </span>
                    )}
                    {property.mealsOffered === 'optional_extra' && (
                      <span>
                        <strong>Home-Cooked Meals: Available for an optional fee.</strong> Fresh family dinner can be opted into for <strong>+{formatINR(property.optionalMealCost || 3000)}/mo</strong>.
                      </span>
                    )}
                    {property.mealsOffered === 'none' && (
                      <span>
                        <strong>Self-Catering Setup.</strong> Host provides pantry appliances (microwave, induction, kettle). Regular meal plan is not provided.
                      </span>
                    )}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sand-100 text-forest-900 border border-sand-300 flex-shrink-0">
                  Family Host Verified
                </span>
              </div>
            )}

            {/* Utility Sub-Meter & Estimated Move-In */}
            <div className="pt-4 border-t border-charcoal-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-charcoal-600">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>
                  Electricity rate: <strong>₹{property.electricityPerUnit} / unit</strong> (Billed as per actual sub-meter reading)
                </span>
              </div>

              <div className="bg-white/80 px-4 py-2 rounded-xl border border-charcoal-200/40">
                <span>Estimated 1st Month Outlay (Rent + Deposit + Maint): </span>
                <strong className="text-forest-800 font-serif text-sm font-bold ml-1">
                  {formatINR(totalMoveInEstimate)}
                </strong>
              </div>
            </div>
          </div>

          {/* Description & Specs */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-2">About this Home</h3>
            <p className="text-sm text-charcoal-600 leading-relaxed whitespace-pre-line">{property.description}</p>
          </div>

          {/* Amenities Grid */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">Amenities & Perks Included</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {property.amenities.map(amenity => (
                <div
                  key={amenity}
                  className="flex items-center space-x-2 text-xs font-medium text-charcoal-700 bg-ivory-100 px-3 py-2.5 rounded-xl border border-charcoal-100"
                >
                  <CheckCircle2 className="w-4 h-4 text-forest-600 flex-shrink-0" />
                  <span className="truncate">{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* House Rules */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">House Rules & Preferences</h3>
            <div className="flex flex-wrap gap-2">
              {property.rules.map(rule => (
                <span
                  key={rule}
                  className="text-xs bg-white text-charcoal-700 border border-charcoal-200 px-3 py-1.5 rounded-full font-medium"
                >
                  {rule}
                </span>
              ))}
            </div>
          </div>

          {/* Verified Nearby Landmarks & Transit Proximity (Feature 1) */}
          {landmarks.length > 0 && (
            <div className="bg-[#F5F3ED]/80 p-5 rounded-3xl border border-charcoal-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-forest-700" />
                  <h3 className="font-serif text-base font-bold text-forest-900">
                    Verified Landmarks & Commute Proximity
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-charcoal-500">
                  Approx. straight-line distance
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {landmarks.slice(0, 6).map((lm, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-2xl border border-charcoal-200/50 shadow-xs flex items-center space-x-2.5 text-xs"
                  >
                    <div className="p-2 rounded-xl bg-forest-50 text-forest-800 flex-shrink-0">
                      {lm.category === 'metro_station' ? (
                        <Train className="w-4 h-4 text-emerald-700" />
                      ) : lm.category === 'tech_park' ? (
                        <Building2 className="w-4 h-4 text-blue-700" />
                      ) : (
                        <GraduationCap className="w-4 h-4 text-amber-700" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-charcoal-800 truncate">{lm.name}</p>
                      <p className="text-[11px] text-charcoal-500 truncate">
                        {lm.distanceKm !== undefined ? `${lm.distanceKm} km away` : lm.locality}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact / Schedule Visit Section */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-charcoal-200 shadow-sm">
            <h3 className="font-serif text-xl font-semibold text-charcoal-900 mb-2">
              Connect with {property.providerName}
            </h3>
            <p className="text-xs text-charcoal-500 mb-6">
              Your details are protected under Aashvo Safety Shield. Phone numbers are never blasted to third-party telemarketers.
            </p>

            {inquirySent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center text-emerald-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-serif text-lg font-bold">Inquiry Sent Successfully!</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  {property.providerName} has received your inquiry and will coordinate with you via WhatsApp or phone.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendInquiry} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-600 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="e.g. Rohan Varma"
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-600 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={senderPhone}
                      onChange={e => setSenderPhone(e.target.value)}
                      placeholder="+91 9811X XXXXX"
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-600 mb-1">Target Move-in</label>
                    <select
                      value={moveInDate}
                      onChange={e => setMoveInDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 bg-white"
                    >
                      <option value="Immediately">Immediately</option>
                      <option value="Within 7 days">Within 7 days</option>
                      <option value="Within 15 days">Within 15 days</option>
                      <option value="1st of next month">1st of next month</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-600 mb-1">Introduction & Questions</label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduleVisitOpen(true)}
                    className="flex-1 bg-forest-800 hover:bg-forest-900 text-white font-semibold py-3 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <Calendar className="w-4 h-4 text-sand-300" />
                    <span>Schedule In-Person Visit</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-white hover:bg-ivory-100 text-forest-900 border border-charcoal-200 font-semibold py-3 px-6 rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? <span>Sending...</span> : <span>Send Direct Inquiry</span>}
                    <ChevronRight className="w-4 h-4 text-charcoal-400" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Reporting Footer Trigger */}
          <div className="pt-4 border-t border-charcoal-100 flex items-center justify-between text-xs text-charcoal-400">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
              <span>Aashvo Freshness Verified Property</span>
            </span>

            <button
              onClick={() => {
                setReportingTarget({
                  type: 'listing',
                  id: property.id,
                  title: property.title,
                });
              }}
              className="text-charcoal-500 hover:text-red-600 underline text-xs flex items-center space-x-1 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Report inaccuracy, scam or misleading charges</span>
            </button>
          </div>
        </div>
      </div>

      {/* Property Viewing Schedule Modal */}
      {isScheduleVisitOpen && (
        <ScheduleVisitModal
          isOpen={isScheduleVisitOpen}
          onClose={() => setIsScheduleVisitOpen(false)}
          property={property}
        />
      )}

      {/* Property Owner Verification Modal */}
      {isVerificationOpen && (
        <PropertyVerificationModal
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          property={property}
        />
      )}
    </div>
  );
};
