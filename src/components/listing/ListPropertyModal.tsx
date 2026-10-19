import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PropertyType, RoomType, ProviderType, FurnishingStatus, GenderPreference, MealsOffered } from '../../types';
import { X, Check, ArrowRight, ArrowLeft, Sparkles, MapPin, Navigation, UtensilsCrossed, ShieldAlert, Building2, Users } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface ListPropertyModalProps {
  onClose: () => void;
}

type ListingIntent = 'flats_rooms' | 'family_stays' | 'entire_flats';

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

const INDIAN_STATES = [
  'Haryana',
  'Delhi NCT',
  'Karnataka',
  'Maharashtra',
  'Telangana',
  'Tamil Nadu',
  'Uttar Pradesh',
  'West Bengal',
  'Gujarat',
  'Rajasthan',
  'Punjab',
  'Kerala',
];

export const ListPropertyModal: React.FC<ListPropertyModalProps> = ({ onClose }) => {
  const { addProperty, currentUser, showToast } = useApp();
  const [step, setStep] = useState(1);

  // Step 1: Category & Living Hierarchy
  const [listingIntent, setListingIntent] = useState<ListingIntent>('flats_rooms');
  const [familyLivesOnProperty, setFamilyLivesOnProperty] = useState(false);
  const [mealsOffered, setMealsOffered] = useState<MealsOffered>('none');
  const [optionalMealCost, setOptionalMealCost] = useState(3000);

  // Step 1: Pan-India Location Support
  const [locationMode, setLocationMode] = useState<'manual' | 'gps'>('manual');
  const [state, setState] = useState('Haryana');
  const [city, setCity] = useState('Gurugram');
  const [locality, setLocality] = useState('DLF Phase 4');
  const [pincode, setPincode] = useState('122002');
  const [addressShort, setAddressShort] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Basic Property Details
  const [title, setTitle] = useState('');
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
  const [familyDeclarationAgreed, setFamilyDeclarationAgreed] = useState(false);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // Category switch handler with Family Stay eligibility enforcement
  const handleIntentChange = (newIntent: ListingIntent) => {
    setListingIntent(newIntent);
    if (newIntent === 'family_stays') {
      setFamilyLivesOnProperty(true);
      setProviderType('owner'); // Non-resident landlords or brokers not permitted for family stays
      setBrokerageFee(0);
      setRoomType('private_room');
      if (mealsOffered === 'none') {
        setMealsOffered('included');
      }
    } else if (newIntent === 'entire_flats') {
      setFamilyLivesOnProperty(false);
      setRoomType('entire_flat');
      setMealsOffered('none');
    } else {
      setFamilyLivesOnProperty(false);
      setRoomType('private_room');
      setMealsOffered('none');
    }
  };

  // Option A: Use Current Location (Device GPS)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Geolocation is not supported by your browser. Please enter details manually.');
      return;
    }

    setGpsLoading(true);
    setGpsMessage('Requesting GPS coordinates from your device...');

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        setLocationMode('gps');
        setGpsLoading(false);
        setGpsMessage(`Location captured (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}). You may review and refine the locality below.`);
        showToast('📍 Current coordinates detected. Please confirm your locality and landmark.');
      },
      error => {
        setGpsLoading(false);
        let errorMsg = 'Could not access device location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. You can proceed seamlessly with manual city and locality selection.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is currently unavailable. Please enter details manually.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'GPS location request timed out. Please enter details manually.';
        }
        setGpsMessage(errorMsg);
        setLocationMode('manual');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

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
      if (!title.trim() || !locality.trim() || !addressShort.trim()) {
        showToast('Please enter a listing title, locality, and landmark.');
        return;
      }
      if (listingIntent === 'family_stays' && !familyLivesOnProperty) {
        showToast('Family Stays are only eligible for resident families sharing their home.');
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

    if (listingIntent === 'family_stays') {
      if (!familyDeclarationAgreed) {
        showToast('Please certify that your family actually lives on this property full-time.');
        return;
      }
      if (providerType !== 'owner') {
        showToast('Non-resident landlords and brokers cannot publish Family Stay listings.');
        return;
      }
    }

    if (!declarationAgreed) {
      showToast('Please accept the accuracy and zero-hidden-fee declaration.');
      return;
    }

    const finalCategory: 'family_stays' | 'flats_rooms' = listingIntent === 'family_stays' ? 'family_stays' : 'flats_rooms';
    const finalRoomType: RoomType = listingIntent === 'entire_flats' ? 'entire_flat' : roomType;

    addProperty({
      title,
      locality,
      city,
      state,
      pincode,
      coordinates,
      addressShort,
      propertyType,
      roomType: finalRoomType,
      category: finalCategory,
      familyLivesOnProperty: listingIntent === 'family_stays' ? true : familyLivesOnProperty,
      mealsOffered: listingIntent === 'family_stays' ? mealsOffered : 'none',
      optionalMealCost: mealsOffered === 'optional_extra' ? optionalMealCost : 0,
      rent,
      deposit,
      maintenance,
      electricityPerUnit,
      brokerageFee: providerType === 'owner' ? 0 : brokerageFee,
      providerType,
      providerName: providerName || (listingIntent === 'family_stays' ? 'Resident Host Family' : 'Verified Host'),
      providerContact: providerContact || '+91 98101 XXXXX',
      furnishing,
      bedrooms,
      bathrooms,
      availableFrom,
      images: images.length > 0 ? images : [SAMPLE_PHOTO_PRESETS[0]],
      amenities: selectedAmenities,
      rules: listingIntent === 'family_stays'
        ? ['Family home respect', 'Cleanliness observed', 'Co-living harmony']
        : ['Cleanliness observed', 'Co-living respect'],
      genderPreference,
      description: description.trim() || `Well-maintained ${finalRoomType} in ${locality}, ${city}. Ready for move-in.`,
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
              {step === 1 && 'Living Category & Pan-India Location'}
              {step === 2 && 'Transparent Financial Breakdown'}
              {step === 3 && 'Amenities & Living Rules'}
              {step === 4 && 'Verified Property Photos'}
              {step === 5 && 'Provider Identity & Family Stay Verification'}
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
          {/* STEP 1: CATEGORY HIERARCHY & NATIONWIDE LOCATION */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-2">
                  1. Select Living Category *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Primary A: Flatmates & Rooms */}
                  <button
                    type="button"
                    onClick={() => handleIntentChange('flats_rooms')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      listingIntent === 'flats_rooms'
                        ? 'border-forest-600 bg-forest-50/80 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-forest-800 font-bold text-sm mb-1">
                      <Users className="w-4 h-4" />
                      <span>Flatmates & Rooms</span>
                    </div>
                    <span className="text-[11px] text-charcoal-500 block leading-tight">
                      Share an apartment or find a roommate.
                    </span>
                  </button>

                  {/* Primary B: Family Stay */}
                  <button
                    type="button"
                    onClick={() => handleIntentChange('family_stays')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      listingIntent === 'family_stays'
                        ? 'border-forest-600 bg-forest-50/80 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-forest-800 font-bold text-sm mb-1">
                      <UtensilsCrossed className="w-4 h-4 text-sand-500" />
                      <span>Family Stay</span>
                    </div>
                    <span className="text-[11px] text-charcoal-500 block leading-tight">
                      Resident family home with optional meal facilities.
                    </span>
                  </button>

                  {/* Secondary C: Entire Flat */}
                  <button
                    type="button"
                    onClick={() => handleIntentChange('entire_flats')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      listingIntent === 'entire_flats'
                        ? 'border-forest-600 bg-forest-50/80 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-charcoal-800 font-bold text-sm mb-1">
                      <Building2 className="w-4 h-4 text-charcoal-500" />
                      <span>Entire Flat</span>
                    </div>
                    <span className="text-[11px] text-charcoal-500 block leading-tight">
                      Independent flat/house for lease.
                    </span>
                  </button>
                </div>

                {/* Family Stay Eligibility Alert */}
                {listingIntent === 'family_stays' && (
                  <div className="mt-3 bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-900 flex items-start space-x-2.5">
                    <ShieldAlert className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Strict Family Stay Eligibility Rule:</strong>
                      Only resident families who physically live in this home full-time can list here. Non-resident landlords, brokers, and commercial agencies are strictly prohibited and will be blocked.
                    </div>
                  </div>
                )}
              </div>

              {/* Meal Options if Family Stay */}
              {listingIntent === 'family_stays' && (
                <div className="bg-sand-50/70 border border-sand-200 rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-charcoal-800 uppercase tracking-wider">
                    Home-Cooked Food & Meal Arrangements *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'included', label: 'Meals Included in Rent', desc: 'Covered in monthly rent' },
                        { id: 'optional_extra', label: 'Meals Available (Extra)', desc: 'Separate optional food charge' },
                        { id: 'none', label: 'No Meals / Self-Catering', desc: 'Tenant cooks or eats outside' },
                      ] as const
                    ).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMealsOffered(m.id)}
                        className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                          mealsOffered === m.id
                            ? 'bg-white border-forest-600 text-forest-800 font-semibold shadow-xs'
                            : 'bg-white/60 border-sand-300/60 text-charcoal-700 hover:border-sand-400'
                        }`}
                      >
                        <span className="block font-medium">{m.label}</span>
                        <span className="text-[10px] text-charcoal-400 mt-0.5 block">{m.desc}</span>
                      </button>
                    ))}
                  </div>

                  {mealsOffered === 'optional_extra' && (
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                        Optional Monthly Meal Cost (₹ INR / month)
                      </label>
                      <input
                        type="number"
                        value={optionalMealCost}
                        onChange={e => setOptionalMealCost(Number(e.target.value))}
                        className="w-full sm:w-48 px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                        placeholder="e.g. 3000"
                        min="0"
                      />
                      <span className="text-[10px] text-charcoal-500 mt-1 block">
                        Will be listed as an optional add-on. Will not be counted twice if already included in rent.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Title & Setup */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Listing Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={
                    listingIntent === 'family_stays'
                      ? 'e.g. Warm Family Home with Home-Cooked Food in DLF Phase 2'
                      : listingIntent === 'entire_flats'
                      ? 'e.g. Sunny 2BHK Independent Apartment in Sector 43'
                      : 'e.g. Spacious Private Bedroom in Shared Apartment'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  required
                />
              </div>

              {/* Nationwide Location Method Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700">
                    2. Pan-India Location *
                  </label>
                  <span className="text-[11px] text-charcoal-400">Works across all Indian states & cities</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {/* Option A: Use Current Location */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={gpsLoading}
                    className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border text-xs font-semibold transition-all ${
                      locationMode === 'gps'
                        ? 'bg-forest-50 border-forest-600 text-forest-800'
                        : 'bg-white border-charcoal-200 text-charcoal-700 hover:border-charcoal-300'
                    }`}
                  >
                    <Navigation className="w-4 h-4 text-forest-600" />
                    <span>{gpsLoading ? 'Detecting GPS...' : 'Option A: Use Current Location'}</span>
                  </button>

                  {/* Option B: Manual Entry */}
                  <button
                    type="button"
                    onClick={() => setLocationMode('manual')}
                    className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border text-xs font-semibold transition-all ${
                      locationMode === 'manual'
                        ? 'bg-forest-50 border-forest-600 text-forest-800'
                        : 'bg-white border-charcoal-200 text-charcoal-700 hover:border-charcoal-300'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-charcoal-600" />
                    <span>Option B: Select Manually</span>
                  </button>
                </div>

                {gpsMessage && (
                  <div className="mb-3 text-xs bg-ivory-200 p-2.5 rounded-xl text-charcoal-700">
                    {gpsMessage}
                  </div>
                )}

                {/* Structured Location Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">State / Union Territory</label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white"
                    >
                      {INDIAN_STATES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Gurugram, New Delhi, Bengaluru, Mumbai, Pune"
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">Locality / Sector</label>
                    <input
                      type="text"
                      value={locality}
                      onChange={e => setLocality(e.target.value)}
                      placeholder="e.g. DLF Phase 4, Koramangala, Indiranagar, Saket"
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={e => setPincode(e.target.value)}
                      placeholder="e.g. 122002"
                      className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-charcoal-600 mb-1">
                    Landmark / Nearest Metro or Transit *
                  </label>
                  <input
                    type="text"
                    value={addressShort}
                    onChange={e => setAddressShort(e.target.value)}
                    placeholder="e.g. 5 mins walk to Rapid Metro Phase 1, near Galleria Market"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                    required
                  />
                </div>

                {/* Address Privacy Notice */}
                <p className="mt-2 text-[11px] text-charcoal-400 flex items-center space-x-1.5">
                  <span className="font-semibold text-forest-700">Privacy Masking:</span>
                  <span>Door & flat numbers are never exposed publicly. Prospective tenants only see verified locality & landmarks.</span>
                </p>
              </div>

              {/* Room setup & furnishings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Property Type</label>
                  <select
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
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Room Setup</label>
                  <select
                    value={roomType}
                    onChange={e => setRoomType(e.target.value as RoomType)}
                    disabled={listingIntent === 'entire_flats'}
                    className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm bg-white disabled:bg-ivory-200"
                  >
                    {listingIntent !== 'entire_flats' && <option value="private_room">Private Room</option>}
                    {listingIntent !== 'entire_flats' && <option value="shared_room">Shared Room</option>}
                    {listingIntent !== 'family_stays' && <option value="entire_flat">Entire Flat</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Furnishing</label>
                  <select
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Total Bedrooms</label>
                  <select
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
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Total Bathrooms</label>
                  <select
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
                <span className="font-bold block text-forest-800 mb-1">Aashvo Radical Cost Transparency:</span>
                Every monthly charge and one-time move-in expense entered here will be rendered in the tenant outlay calculator. No unlisted fees may be charged.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Monthly Rent (₹ INR / month) *
                  </label>
                  <input
                    type="number"
                    value={rent}
                    onChange={e => setRent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm font-semibold"
                    required
                  />
                  {listingIntent === 'family_stays' && mealsOffered === 'included' && (
                    <span className="text-[10px] text-forest-700 font-medium mt-1 block">
                      ✓ Includes all daily meals. Food cost is already covered in this monthly rent.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Refundable Security Deposit (₹ INR) *
                  </label>
                  <input
                    type="number"
                    value={deposit}
                    onChange={e => setDeposit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm font-semibold"
                    required
                  />
                  <span className="text-[10px] text-charcoal-400 mt-1 block">One-time move-in cost, 100% refundable upon vacate.</span>
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
                  <span className="text-[10px] text-charcoal-400 mt-1 block">Meter unit rate or 0 if included in rent</span>
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
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Gender Preference
                  </label>
                  <select
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
                  Detailed Description & House Atmosphere
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={
                    listingIntent === 'family_stays'
                      ? 'Describe your family background, food routines, meal preparation, room furnishing, and house guidelines...'
                      : 'Describe the room, furniture, sunlight, flatmate vibe, and neighborhood perks...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 4: PHOTOS */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-xs text-charcoal-500">
                Aashvo listings require authentic photos of the bedroom, living space, washroom, and kitchen.
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

          {/* STEP 5: PROVIDER IDENTITY & FAMILY STAY VERIFICATION */}
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
                    <span className="font-serif font-bold text-sm text-forest-800 block">
                      {listingIntent === 'family_stays' ? 'Resident Host Family' : 'Direct Owner'}
                    </span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">
                      {listingIntent === 'family_stays' ? 'We live here full-time. ₹0 brokerage.' : 'I own the property. ₹0 brokerage guarantee.'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={listingIntent === 'family_stays'}
                    onClick={() => {
                      setProviderType('tenant_flatmate');
                      setBrokerageFee(0);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === 'tenant_flatmate'
                        ? 'border-forest-600 bg-forest-50/70 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    } ${listingIntent === 'family_stays' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-serif font-bold text-sm text-charcoal-900 block">Current Flatmate</span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">I live here and am replacing a flatmate.</span>
                  </button>

                  <button
                    type="button"
                    disabled={listingIntent === 'family_stays'}
                    onClick={() => setProviderType('verified_manager')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === 'verified_manager'
                        ? 'border-forest-600 bg-forest-50/70 ring-1 ring-forest-600'
                        : 'border-charcoal-200 bg-white hover:border-charcoal-300'
                    } ${listingIntent === 'family_stays' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-serif font-bold text-sm text-charcoal-900 block">Manager / Broker</span>
                    <span className="text-[11px] text-charcoal-500 mt-1 block">
                      {listingIntent === 'family_stays' ? 'Not permitted for Family Stays' : 'Professional managing on owner behalf.'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Family Stay Co-living Declaration */}
              {listingIntent === 'family_stays' && (
                <div className="p-4 bg-forest-50/90 rounded-2xl border border-forest-300 flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="family-declaration-checkbox"
                    checked={familyDeclarationAgreed}
                    onChange={e => setFamilyDeclarationAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded accent-forest-700 cursor-pointer"
                  />
                  <label htmlFor="family-declaration-checkbox" className="text-xs text-forest-900 leading-relaxed cursor-pointer font-medium">
                    Resident Family Legal Certification: I solemnly swear that my family actually lives inside this home as our primary residence. I understand that non-resident landlords, commercial boarding house operators, and brokers will be permanently blacklisted.
                  </label>
                </div>
              )}

              {providerType === 'verified_manager' && listingIntent !== 'family_stays' && (
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
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    {listingIntent === 'family_stays' ? 'Host Family Contact Name' : 'Your Full Name'}
                  </label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={e => setProviderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-charcoal-200 text-sm"
                    placeholder="e.g. Meenakshi & S.K. Rao"
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
                  I solemnly declare that all photographs, rental amounts (<strong>{formatINR(rent)}</strong>), deposit conditions, and meal arrangements are authentic and truthful. I agree to keep this listing updated and re-confirm availability every 14 days.
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
