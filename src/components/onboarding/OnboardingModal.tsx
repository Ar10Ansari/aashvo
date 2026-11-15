import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { marketplaceProfileService } from '../../services/marketplaceProfileService';
import type {
  CleanlinessLevel,
  FlatmateIntention,
  FoodHabit,
  FurnishingStatus,
  PersonalOnboardingInput,
  ProfileCompletionBreakdown,
  RoomType,
  SleepRoutine,
} from '@aashvo/contracts';
import {
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  MapPin,
  Home,
  Heart,
  Save,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

const POPULAR_LANGUAGES = ['English', 'Hindi', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Kannada'];
const POPULAR_INTERESTS = ['Tech & Coding', 'Reading', 'Yoga & Wellness', 'Cooking', 'Music', 'Fitness & Gym', 'Movies', 'Travel', 'Gaming'];
const POPULAR_LOCALITIES = ['DLF Phase 2', 'Cyber City', 'Sector 56', 'Golf Course Road', 'Sohna Road', 'Hauz Khas', 'Koramangala', 'Indiranagar', 'Bandra'];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  initialStep = 1,
}) => {
  const { currentUser, showToast, refreshMarketplaceProfiles } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ProfileCompletionBreakdown | null>(null);

  // Form State
  const [formData, setFormData] = useState<PersonalOnboardingInput>({
    // Step 1: Basic Information
    fullName: currentUser?.name || '',
    avatarUrl: currentUser?.avatar || '',
    age: 22,
    gender: 'Prefer not to say',
    profession: 'Working Professional',
    collegeOrWorkplace: '',
    bio: '',
    languages: ['English', 'Hindi'],
    interests: ['Tech & Coding', 'Reading'],

    // Step 2: Location
    country: 'India',
    state: 'Haryana',
    city: 'Gurugram',
    targetLocalities: ['DLF Phase 2'],

    // Step 3: Housing Requirements
    budgetMin: 12000,
    budgetMax: 25000,
    moveInDate: '',
    moveInFlexible: true,
    roomType: 'private_room',
    furnishing: 'fully_furnished',
    hasRoom: false,
    intentions: ['needs_room', 'team_up'],
    roomDetails: '',

    // Step 4: Lifestyle
    foodHabit: 'Vegetarian',
    sleepRoutine: 'Early Bird',
    cleanliness: 'Spotless',
    smoking: 'No',
    drinking: 'Prefer not to say',
    petFriendly: true,
    socialLifestyle: 'Moderate',
    wfhHabits: 'Hybrid',
    noiseTolerance: 'Moderate',

    // Step 5
    publishImmediately: true,
  });

  // Load existing onboarding data if available
  useEffect(() => {
    if (isOpen) {
      const existing = marketplaceProfileService.getLocalOnboardingData();
      if (existing) {
        setFormData((prev) => ({ ...prev, ...existing }));
      }
      marketplaceProfileService.getProfileCompletion().then((b) => setBreakdown(b));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!formData.fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (formData.age < 18) {
        setErrorMsg('Aashvo requires all flatmate members to be at least 18 years old.');
        return;
      }
      if (!formData.bio.trim() || formData.bio.trim().length < 10) {
        setErrorMsg('Please enter a brief bio (at least 10 characters).');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.city.trim()) {
        setErrorMsg('Please specify your target city.');
        return;
      }
    } else if (currentStep === 3) {
      if (formData.budgetMax <= 0) {
        setErrorMsg('Please specify your maximum monthly budget.');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const handlePrev = () => {
    setErrorMsg(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: PersonalOnboardingInput = {
        ...formData,
        publishImmediately: false,
      };
      const res = await marketplaceProfileService.saveOnboarding(payload);
      setBreakdown(res.completion);
      await refreshMarketplaceProfiles();
      showToast('Profile draft saved successfully! You can resume anytime.');
      onClose();
    } catch {
      setErrorMsg('Failed to save profile draft. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: PersonalOnboardingInput = {
        ...formData,
        publishImmediately: true,
      };
      const res = await marketplaceProfileService.saveOnboarding(payload);
      setBreakdown(res.completion);
      await refreshMarketplaceProfiles();
      showToast('🎉 Your Flatmate Profile is now published to Aashvo Connect!');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish profile. Please ensure all mandatory fields are complete.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArrayItem = (key: 'languages' | 'interests' | 'targetLocalities', item: string) => {
    setFormData((prev) => {
      const currentList = prev[key] || [];
      const exists = currentList.includes(item);
      const updated = exists ? currentList.filter((i) => i !== item) : [...currentList, item];
      return { ...prev, [key]: updated };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-[#F5F3ED] rounded-3xl shadow-2xl border border-charcoal-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="bg-white px-5 sm:px-7 py-4 border-b border-charcoal-200/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-forest-50 text-forest-800 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-sand-500" />
            </div>
            <div>
              <h2 id="onboarding-modal-title" className="font-serif text-lg sm:text-xl font-bold text-charcoal-900 leading-tight">
                Complete Your Profile
              </h2>
              <p className="text-xs text-charcoal-500">
                Step {currentStep} of 5 — {currentStep === 1 ? 'Basic Info' : currentStep === 2 ? 'Location' : currentStep === 3 ? 'Housing Requirements' : currentStep === 4 ? 'Lifestyle Preferences' : 'Review & Publish'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close onboarding modal"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-ivory-200 px-5 sm:px-7 py-2.5 border-b border-charcoal-200/60 flex items-center justify-between">
          {[
            { step: 1, label: 'Basic', icon: User },
            { step: 2, label: 'Location', icon: MapPin },
            { step: 3, label: 'Housing', icon: Home },
            { step: 4, label: 'Lifestyle', icon: Heart },
            { step: 5, label: 'Review', icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            return (
              <button
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-forest-700 text-white shadow-sm'
                    : isCompleted
                    ? 'text-forest-800 hover:bg-forest-50'
                    : 'text-charcoal-400 hover:text-charcoal-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: BASIC INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Age <span className="text-red-500">* (18+)</span>
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={120}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value, 10) || 18 })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Profession <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="Student">Student</option>
                    <option value="Working Professional">Working Professional</option>
                    <option value="Self-employed / Freelancer">Self-employed / Freelancer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    College or Workplace (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.collegeOrWorkplace || ''}
                    onChange={(e) => setFormData({ ...formData, collegeOrWorkplace: e.target.value })}
                    placeholder="e.g. IIT Delhi / Microsoft"
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  About Me <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Share a few words about your daily routine, values, and what kind of flatmate you enjoy living with..."
                  className="w-full px-3.5 py-2 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Languages Spoken
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_LANGUAGES.map((lang) => {
                    const isSelected = formData.languages?.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleArrayItem('languages', lang)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-forest-700 text-white border-forest-800'
                            : 'bg-white text-charcoal-600 border-charcoal-200 hover:bg-ivory-200'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Hobbies & Interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_INTERESTS.map((interest) => {
                    const isSelected = formData.interests?.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleArrayItem('interests', interest)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-forest-700 text-white border-forest-800'
                            : 'bg-white text-charcoal-600 border-charcoal-200 hover:bg-ivory-200'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.country || 'India'}
                    className="w-full px-3.5 py-2.5 bg-ivory-200 border border-charcoal-200 rounded-xl text-sm text-charcoal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="Gurugram">Gurugram</option>
                    <option value="Delhi">Delhi NCR</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Preferred Localities
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_LOCALITIES.map((loc) => {
                    const isSelected = formData.targetLocalities?.includes(loc);
                    return (
                      <button
                        type="button"
                        key={loc}
                        onClick={() => toggleArrayItem('targetLocalities', loc)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-forest-700 text-white border-forest-800'
                            : 'bg-white text-charcoal-600 border-charcoal-200 hover:bg-ivory-200'
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HOUSING REQUIREMENTS */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Minimum Monthly Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.budgetMin || 0}
                    onChange={(e) => setFormData({ ...formData, budgetMin: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Maximum Monthly Budget (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.budgetMax}
                    onChange={(e) => setFormData({ ...formData, budgetMax: parseInt(e.target.value, 10) || 1000 })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Preferred Room Type
                  </label>
                  <select
                    value={formData.roomType || 'private_room'}
                    onChange={(e) => setFormData({ ...formData, roomType: e.target.value as RoomType })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="private_room">Private Room</option>
                    <option value="shared_room">Shared Room</option>
                    <option value="entire_flat">Entire Flat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Furnishing Preference
                  </label>
                  <select
                    value={formData.furnishing || 'fully_furnished'}
                    onChange={(e) => setFormData({ ...formData, furnishing: e.target.value as FurnishingStatus })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="fully_furnished">Fully Furnished</option>
                    <option value="semi_furnished">Semi-Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  Your Co-Living Purpose (Intentions)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'needs_room', label: 'Needs a Room' },
                    { id: 'has_room', label: 'Has a Room' },
                    { id: 'team_up', label: 'Rent Together' },
                  ].map((intent) => {
                    const isSelected = formData.intentions?.includes(intent.id as FlatmateIntention);
                    return (
                      <button
                        type="button"
                        key={intent.id}
                        onClick={() => {
                          const current = formData.intentions || [];
                          const updated = current.includes(intent.id as FlatmateIntention)
                            ? current.filter((i) => i !== intent.id)
                            : [...current, intent.id as FlatmateIntention];
                          setFormData({ ...formData, intentions: updated, hasRoom: updated.includes('has_room') });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-forest-700 text-white border-forest-800'
                            : 'bg-white text-charcoal-700 border-charcoal-200 hover:bg-ivory-100'
                        }`}
                      >
                        {intent.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LIFESTYLE */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Food Habit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.foodHabit}
                    onChange={(e) => setFormData({ ...formData, foodHabit: e.target.value as FoodHabit })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Non-Vegetarian">Non-Vegetarian</option>
                    <option value="Eggetarian">Eggetarian</option>
                    <option value="Vegan">Vegan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Sleep Routine <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.sleepRoutine}
                    onChange={(e) => setFormData({ ...formData, sleepRoutine: e.target.value as SleepRoutine })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="Early Bird">Early Bird (Sleeps before 11 PM)</option>
                    <option value="Night Owl">Night Owl (Stays up late)</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Cleanliness Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.cleanliness}
                    onChange={(e) => setFormData({ ...formData, cleanliness: e.target.value as CleanlinessLevel })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="Spotless">Spotless (Clean immediately)</option>
                    <option value="Moderate">Moderate (Tidy daily)</option>
                    <option value="Relaxed">Relaxed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Smoking Habit
                  </label>
                  <select
                    value={formData.smoking}
                    onChange={(e) => setFormData({ ...formData, smoking: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="No">No</option>
                    <option value="Outside Only">Outside Only</option>
                    <option value="Yes">Yes</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Drinking Habit
                  </label>
                  <select
                    value={formData.drinking || 'Prefer not to say'}
                    onChange={(e) => setFormData({ ...formData, drinking: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="No">No</option>
                    <option value="Socially">Socially</option>
                    <option value="Yes">Yes</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                    Pet Friendly?
                  </label>
                  <select
                    value={formData.petFriendly ? 'yes' : 'no'}
                    onChange={(e) => setFormData({ ...formData, petFriendly: e.target.value === 'yes' })}
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="yes">Yes, loves pets</option>
                    <option value="no">No pets</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW AND PUBLISH */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-2xl border border-charcoal-200/80 shadow-sm space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-lg">
                    {formData.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-charcoal-900">{formData.fullName}</h3>
                    <p className="text-xs text-charcoal-500">
                      {formData.profession} • {formData.age} yrs • {formData.city}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-charcoal-700 leading-relaxed italic bg-ivory-100 p-3 rounded-xl border border-charcoal-100">
                  "{formData.bio || 'No bio provided yet.'}"
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                  <div className="bg-forest-50 p-2.5 rounded-xl border border-forest-100">
                    <p className="text-[10px] text-forest-700 font-semibold uppercase">Diet</p>
                    <p className="text-xs font-bold text-charcoal-800 mt-0.5">{formData.foodHabit}</p>
                  </div>
                  <div className="bg-forest-50 p-2.5 rounded-xl border border-forest-100">
                    <p className="text-[10px] text-forest-700 font-semibold uppercase">Routine</p>
                    <p className="text-xs font-bold text-charcoal-800 mt-0.5">{formData.sleepRoutine}</p>
                  </div>
                  <div className="bg-forest-50 p-2.5 rounded-xl border border-forest-100">
                    <p className="text-[10px] text-forest-700 font-semibold uppercase">Cleanliness</p>
                    <p className="text-xs font-bold text-charcoal-800 mt-0.5">{formData.cleanliness}</p>
                  </div>
                  <div className="bg-forest-50 p-2.5 rounded-xl border border-forest-100">
                    <p className="text-[10px] text-forest-700 font-semibold uppercase">Max Budget</p>
                    <p className="text-xs font-bold text-charcoal-800 mt-0.5">₹{formData.budgetMax.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {breakdown && breakdown.missingFields.length > 0 && (
                <div className="bg-sand-50 border border-sand-200 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-forest-900 mb-1.5 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-sand-500" />
                    <span>Profile Completeness Checklist</span>
                  </p>
                  <ul className="text-xs text-charcoal-600 space-y-1 list-disc list-inside">
                    {breakdown.missingFields.map((field) => (
                      <li key={field}>{field} is recommended for higher matching visibility</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="bg-white px-5 sm:px-7 py-3.5 border-t border-charcoal-200/80 flex items-center justify-between flex-shrink-0">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal-600 hover:bg-ivory-200 flex items-center space-x-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal-600 hover:bg-ivory-200 flex items-center space-x-1.5 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save as Draft</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-sm flex items-center space-x-1.5 transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-charcoal-300 text-xs font-semibold text-charcoal-700 hover:bg-ivory-200 transition-all"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 shadow-md flex items-center space-x-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-sand-300" />
                  <span>Publish Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
