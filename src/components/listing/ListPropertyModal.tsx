import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PropertyType, RoomType, ProviderType, FurnishingStatus, GenderPreference } from '../../types';
import { DELHI_NCR_LOCALITIES } from '../../data/seedData';
import { X, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface ListPropertyModalProps {
  onClose: () => void;
}

const AVAILABLE_AMENITIES = [
  '100% Power Backup',
  'High-Speed Wi-Fi',
  'Air Conditioner',
  'Attached Washroom',
  'Private Balcony',
  'Cook & Maid Setup',
  'Covered Parking',
  'Gated 24/7 Security',
  'Modular Kitchen',
  'Washing Machine',
  'RO Water Purifier',
  'Gym & Pool Access',
];

const SAMPLE_PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
];

export const ListPropertyModal: React.FC<ListPropertyModalProps> = ({ onClose }) => {
  const { addProperty, currentUser, showToast } = useApp();
  const [step, setStep] = useState(1);

  // Form State
  const [title, setTitle] = useState('');
  const [locality, setLocality] = useState('DLF Phase 4');
  const [city, setCity] = useState<'Gurugram' | 'Delhi'>('Gurugram');
  const [addressShort, setAddressShort] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [roomType, setRoomType] = useState<RoomType>('private_room');
  const [furnishing, setFurnishing] = useState<FurnishingStatus>('fully_furnished');
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(3);
  const [availableFrom, setAvailableFrom] = useState('Immediately');

  // Step 2: Financials
  const [rent, setRent] = useState(22000);
  const [deposit, setDeposit] = useState(30000);
  const [maintenance, setMaintenance] = useState(1500);
  const [electricityPerUnit, setElectricityPerUnit] = useState(8.5);

  // Step 3: Amenities & Rules
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    '100% Power Backup',
    'High-Speed Wi-Fi',
    'Air Conditioner',
    'Attached Washroom',
  ]);
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('any');
  const [description, setDescription] = useState('');

  // Step 4: Photos
  const [images, setImages] = useState<string[]>([SAMPLE_PHOTO_PRESETS[0], SAMPLE_PHOTO_PRESETS[1]]);
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Step 5: Identity & Brokerage declaration
  const [providerType, setProviderType] = useState<ProviderType>('owner');
  const [brokerageFee, setBrokerageFee] = useState(0);
  const [providerName, setProviderName] = useState(currentUser?.name || '');
  const [providerContact, setProviderContact] = useState(currentUser?.phone || '+91 98101 XXXXX');
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  const toggleAmenity = (item: string) => {
    setSelectedAmenities(prev =>
      prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item]
    );
  };

  const handleAddCustomImage = () => {
    if (customImageUrl.trim()) {
      setImages(prev => [...prev, customImageUrl.trim()]);
      setCustomImageUrl('');
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!title.trim() || !addressShort.trim()) {
        showToast('Please enter a listing title and landmark address.');
        return;
      }
    }
    if (step === 2) {
      if (rent <= 0 || deposit < 0) {
        showToast('Please specify valid rent and deposit amounts.');
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationAgreed) {
      showToast('Please accept the accuracy and zero-hidden-fee declaration.');
      return;
    }

    addProperty({
      title,
      locality,
      city,
      addressShort,
      propertyType,
      roomType,
      rent,
      deposit,
      maintenance,
      electricityPerUnit,
      brokerageFee: providerType === 'owner' ? 0 : brokerageFee,
      providerType,
      providerName: providerName || 'Verified Host',
      providerContact: providerContact || '+91 98101 XXXXX',
      furnishing,
      bedrooms,
      bathrooms,
      availableFrom,
      images: images.length > 0 ? images : [SAMPLE_PHOTO_PRESETS[0]],
      amenities: selectedAmenities,
      rules: ['Cleanliness observed', 'Co-living respect'],
      genderPreference,
      description: description.trim() || `Well-maintained ${roomType} in ${locality}. Ready for move-in.`,
      featured: false,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-listing-title"
      >
        {/* Top Stepper Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-ivory-100/90">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
              Listing Creation Wizard • Step {step} of 5
            </span>
            <h2 id="modal-listing-title" className="font-serif text-xl font-bold text-charcoal-900">
              {step === 1 && 'Basic Property Details'}
              {step === 2 && 'Transparent Financial Breakdown'}
              {step === 3 && 'Amenities & Living Rules'}
              {step === 4 && 'Verified Property Photos'}
              {step === 5 && 'Provider Identity & Declaration'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-800 rounded-full hover:bg-ivory-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-charcoal-100 h-1">
          <div
            className="bg-forest-600 h-1 transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Scrollable Wizard Form Body */}
        <div className="overflow-y-auto p-6 sm:p-8 flex-1">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Listing Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Spacious Private Bedroom with Balcony in DLF Phase 4"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wizard-locality-select" className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Locality Cluster *
                  </label>
                  <select
                    id="wizard-locality-select"
                    value={locality}
                    onChange={e => {
                      setLocality(e.target.value);
                      if (e.target.value.includes('Delhi')) setCity('Delhi');
                      else setCity('Gurugram');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    {DELHI_NCR_LOCALITIES.filter(l => l !== 'All Localities').map(l => (
                      <option key={l} value={l.split(',')[0]}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Landmark / Nearby Metro *
                  </label>
                  <input
                    type="text"
                    value={addressShort}
                    onChange={e => setAddressShort(e.target.value)}
                    placeholder="e.g. 5 mins walk to Rapid Metro & Galleria"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label htmlFor="wizard-property-type-select" className="block text-xs font-semibold text-charcoal-700 mb-1">Property Type</label>
                  <select
                    id="wizard-property-type-select"
                    value={propertyType}
                    onChange={e => setPropertyType(e.target.value as PropertyType)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="builder_floor">Builder Floor</option>
                    <option value="gated_society">Gated Society</option>
                    <option value="villa">Independent Villa</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="wizard-room-type-select" className="block text-xs font-semibold text-charcoal-700 mb-1">Room Setup</label>
                  <select
                    id="wizard-room-type-select"
                    value={roomType}
                    onChange={e => setRoomType(e.target.value as RoomType)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    <option value="private_room">Private Room</option>
                    <option value="shared_room">Shared Room</option>
                    <option value="entire_flat">Entire Flat</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="wizard-furnishing-select" className="block text-xs font-semibold text-charcoal-700 mb-1">Furnishing</label>
                  <select
                    id="wizard-furnishing-select"
                    value={furnishing}
                    onChange={e => setFurnishing(e.target.value as FurnishingStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    <option value="fully_furnished">Fully Furnished</option>
                    <option value="semi_furnished">Semi Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="wizard-bedrooms-select" className="block text-xs font-semibold text-charcoal-700 mb-1">Total Bedrooms</label>
                  <select
                    id="wizard-bedrooms-select"
                    value={bedrooms}
                    onChange={e => setBedrooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} Bedroom{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="wizard-bathrooms-select" className="block text-xs font-semibold text-charcoal-700 mb-1">Total Bathrooms</label>
                  <select
                    id="wizard-bathrooms-select"
                    value={bathrooms}
                    onChange={e => setBathrooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n} Bath{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FINANCIAL TRANSPARENCY */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-sand-50 border border-sand-200 rounded-2xl p-4 text-xs text-charcoal-700">
                <span className="font-bold block text-forest-800 mb-1">Aashvo Financial Trust Guarantee:</span>
                Every charge entered here will be rendered in the tenant contract calculator. No additional charges may be imposed later.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Monthly Rent (₹ INR) *
                  </label>
                  <input
                    type="number"
                    value={rent}
                    onChange={e => setRent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Security Deposit (₹ INR) *
                  </label>
                  <input
                    type="number"
                    value={deposit}
                    onChange={e => setDeposit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm font-semibold"
                    required
                  />
                  <span className="text-[10px] text-charcoal-400 mt-1 block">Usually 1 to 2 months rent</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Society Maintenance (₹ INR / month)
                  </label>
                  <input
                    type="number"
                    value={maintenance}
                    onChange={e => setMaintenance(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Electricity Rate (₹ / unit as per meter)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={electricityPerUnit}
                    onChange={e => setElectricityPerUnit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                  />
                  <span className="text-[10px] text-charcoal-400 mt-1 block">Commercial unit rate or 0 if included</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: AMENITIES & RULES */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-2">
                  Select Included Amenities
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVAILABLE_AMENITIES.map(amenity => (
                    <button
                      type="button"
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`text-xs px-3 py-2 rounded-xl text-left border flex items-center justify-between transition-all ${
                        selectedAmenities.includes(amenity)
                          ? 'bg-forest-50 border-forest-600 text-forest-800 font-semibold'
                          : 'bg-white border-charcoal-200 text-charcoal-600 hover:border-charcoal-300'
                      }`}
                    >
                      <span className="truncate">{amenity}</span>
                      {selectedAmenities.includes(amenity) && <Check className="w-3.5 h-3.5 text-forest-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wizard-gender-select" className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Gender Preference
                  </label>
                  <select
                    id="wizard-gender-select"
                    value={genderPreference}
                    onChange={e => setGenderPreference(e.target.value as GenderPreference)}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                  >
                    <option value="any">Any / Open</option>
                    <option value="female_only">Female Only</option>
                    <option value="male_only">Male Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Available From
                  </label>
                  <input
                    type="text"
                    value={availableFrom}
                    onChange={e => setAvailableFrom(e.target.value)}
                    placeholder="e.g. Immediately or 1st Nov"
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the room, furniture, sunlight, flatmate vibe, and neighborhood perks..."
                  className="w-full px-3.5 py-2 rounded-xl border border-charcoal-200 text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 4: PHOTOS */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-xs text-charcoal-500">
                Aashvo listings require authentic photos of the bedroom, living space, and washroom.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-charcoal-200 bg-ivory-200">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 p-1 bg-charcoal-900/70 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={e => setCustomImageUrl(e.target.value)}
                  placeholder="Paste direct image URL (or use curated presets below)..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-charcoal-200 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomImage}
                  className="px-4 py-2 bg-charcoal-800 text-white rounded-xl text-xs font-semibold hover:bg-charcoal-900"
                >
                  Add Photo
                </button>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-charcoal-400 block mb-1.5 font-medium">Add Architectural Sample Photos:</span>
                <div className="flex gap-2">
                  {SAMPLE_PHOTO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImages(prev => [...prev, p])}
                      className="text-xs bg-ivory-200 hover:bg-ivory-300 px-3 py-1.5 rounded-lg text-charcoal-700 font-medium"
                    >
                      + Preset {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PROVIDER IDENTITY & DECLARATION */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-2">
                  What is your relationship to this property? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProviderType('owner');
                      setBrokerageFee(0);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === 'owner'
                        ? 'border-forest-600 bg-forest-50/70 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <span className="font-serif font-bold text-sm text-forest-800 block">Direct Owner</span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">I own the property. ₹0 brokerage guarantee.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProviderType('tenant_flatmate');
                      setBrokerageFee(0);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === 'tenant_flatmate'
                        ? 'border-forest-600 bg-forest-50/70 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <span className="font-serif font-bold text-sm text-charcoal-900 block">Current Flatmate</span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">I live here and am replacing a flatmate.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProviderType('verified_manager')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === 'verified_manager'
                        ? 'border-forest-600 bg-forest-50/70 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <span className="font-serif font-bold text-sm text-charcoal-900 block">Manager / Broker</span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">Professional managing on owner behalf.</span>
                  </button>
                </div>
              </div>

              {providerType === 'verified_manager' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Declared Brokerage / Service Charge (₹ INR) *
                  </label>
                  <input
                    type="number"
                    value={brokerageFee}
                    onChange={e => setBrokerageFee(Number(e.target.value))}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
                    required
                  />
                  <span className="text-[10px] text-amber-800 mt-1 block">
                    Must be transparently displayed. Concealing charges leads to instant blacklisting.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={e => setProviderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Contact Phone (Masked for privacy)</label>
                  <input
                    type="tel"
                    value={providerContact}
                    onChange={e => setProviderContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-ivory-100 rounded-2xl border border-charcoal-200/60 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="declaration-checkbox"
                  checked={declarationAgreed}
                  onChange={e => setDeclarationAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-forest-600 cursor-pointer"
                />
                <label htmlFor="declaration-checkbox" className="text-xs text-charcoal-600 leading-relaxed cursor-pointer">
                  I solemnly declare that all photographs, rental amounts (<strong>{formatINR(rent)}</strong>), and deposit conditions are authentic and truthful. I agree to keep this listing updated and re-confirm availability every 14 days.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-charcoal-100 flex items-center justify-between bg-white">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(prev => prev - 1)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-600 hover:text-charcoal-900 rounded-xl hover:bg-ivory-200 transition-colors flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>Continue to Step {step + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-sand-300" />
              <span>Publish Listing on Aashvo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
