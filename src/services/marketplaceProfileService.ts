/**
 * Marketplace Profile & Onboarding Service Adapter
 *
 * Manages multi-persona marketplace profiles (Flatmate Seeker, Property Owner, Family Stay Host, Family Stay Seeker)
 * and multi-step progressive onboarding with local in-memory fallback for preview mode.
 */

import { apiClient } from './apiClient';
import type {
  MarketplaceProfileType,
  MarketplaceProfileView,
  PersonalOnboardingInput,
  ProfileCompletionBreakdown,
} from '@aashvo/contracts';

// Local storage keys for persisting persona and onboarding state across browser refreshes
const ACTIVE_PROFILE_TYPE_KEY = 'aashvo_active_marketplace_profile';
const ONBOARDING_DATA_KEY = 'aashvo_user_onboarding_data';

// Default mock profiles for unauthenticated / demo state
const DEFAULT_DEMO_PROFILES: MarketplaceProfileView[] = [
  {
    id: 'mp-demo-seeker',
    userId: 'demo-user-id',
    profileType: 'flatmate_seeker',
    status: 'active',
    isCurrentActive: true,
    displayName: 'Flatmate Seeker',
    completionPercent: 85,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mp-demo-owner',
    userId: 'demo-user-id',
    profileType: 'property_owner',
    status: 'draft',
    isCurrentActive: false,
    displayName: 'Property Owner',
    completionPercent: 40,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class MarketplaceProfileService {
  private localProfiles: MarketplaceProfileView[] = [...DEFAULT_DEMO_PROFILES];
  private localOnboardingData: PersonalOnboardingInput | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedActive = localStorage.getItem(ACTIVE_PROFILE_TYPE_KEY);
      if (storedActive) {
        this.localProfiles = this.localProfiles.map((p) => ({
          ...p,
          isCurrentActive: p.profileType === storedActive,
        }));
      }
      const storedOnboarding = localStorage.getItem(ONBOARDING_DATA_KEY);
      if (storedOnboarding) {
        this.localOnboardingData = JSON.parse(storedOnboarding);
      }
    } catch {
      // Ignore localStorage errors in non-browser test runners
    }
  }

  private saveToStorage() {
    try {
      const active = this.localProfiles.find((p) => p.isCurrentActive);
      if (active) {
        localStorage.setItem(ACTIVE_PROFILE_TYPE_KEY, active.profileType);
      }
      if (this.localOnboardingData) {
        localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(this.localOnboardingData));
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Retrieves all marketplace profiles for the current user.
   */
  async getMyMarketplaceProfiles(): Promise<MarketplaceProfileView[]> {
    try {
      const res = await apiClient.get<MarketplaceProfileView[]>('/api/v1/profiles/marketplace');
      if (Array.isArray(res) && res.length > 0) {
        this.localProfiles = res;
        this.saveToStorage();
        return res;
      }
    } catch {
      // Fallback to local profiles
    }
    return this.localProfiles;
  }

  /**
   * Creates or activates a marketplace profile persona.
   */
  async createMarketplaceProfile(
    profileType: MarketplaceProfileType,
    displayName?: string,
    metadata?: Record<string, any>,
  ): Promise<MarketplaceProfileView> {
    try {
      const res = await apiClient.post<MarketplaceProfileView>('/api/v1/profiles/marketplace', {
        profileType,
        displayName,
        metadata,
      });
      if (res && res.id) {
        await this.getMyMarketplaceProfiles();
        return res;
      }
    } catch {
      // Local fallback
    }

    const existing = this.localProfiles.find((p) => p.profileType === profileType);
    if (existing) {
      existing.status = 'active';
      existing.displayName = displayName || existing.displayName;
      this.saveToStorage();
      return existing;
    }

    const newProfile: MarketplaceProfileView = {
      id: `mp-local-${Date.now()}`,
      userId: 'current-user',
      profileType,
      status: 'active',
      isCurrentActive: false,
      displayName: displayName || profileType.replace('_', ' ').toUpperCase(),
      completionPercent: 50,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.localProfiles.push(newProfile);
    this.saveToStorage();
    return newProfile;
  }

  /**
   * Switches active marketplace profile.
   */
  async switchMarketplaceProfile(
    profileType: MarketplaceProfileType,
  ): Promise<MarketplaceProfileView> {
    try {
      const res = await apiClient.post<MarketplaceProfileView>(
        '/api/v1/profiles/marketplace/switch',
        { profileType },
      );
      if (res && res.id) {
        this.localProfiles = this.localProfiles.map((p) => ({
          ...p,
          isCurrentActive: p.profileType === profileType,
        }));
        this.saveToStorage();
        return res;
      }
    } catch {
      // Local fallback
    }

    this.localProfiles = this.localProfiles.map((p) => ({
      ...p,
      isCurrentActive: p.profileType === profileType,
    }));
    this.saveToStorage();

    const active = this.localProfiles.find((p) => p.isCurrentActive);
    if (!active) {
      return this.createMarketplaceProfile(profileType);
    }
    return active;
  }

  /**
   * Saves multi-step onboarding data as draft or publishes it.
   */
  async saveOnboarding(
    data: PersonalOnboardingInput,
  ): Promise<{
    marketplaceProfile: MarketplaceProfileView;
    completion: ProfileCompletionBreakdown;
  }> {
    this.localOnboardingData = data;
    this.saveToStorage();

    try {
      const res = await apiClient.post<{
        marketplaceProfile: MarketplaceProfileView;
        completion: ProfileCompletionBreakdown;
      }>('/api/v1/profiles/onboarding', data);

      if (res && res.marketplaceProfile) {
        await this.getMyMarketplaceProfiles();
        return res;
      }
    } catch {
      // Local fallback
    }

    const isPublished = Boolean(data.publishImmediately);
    const breakdown = this.calculateLocalCompletion(data);

    let seekerProfile = this.localProfiles.find((p) => p.profileType === 'flatmate_seeker');
    if (!seekerProfile) {
      seekerProfile = {
        id: `mp-seeker-${Date.now()}`,
        userId: 'current-user',
        profileType: 'flatmate_seeker',
        status: isPublished ? 'active' : 'draft',
        isCurrentActive: true,
        displayName: data.fullName,
        completionPercent: breakdown.totalPercent,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.localProfiles.push(seekerProfile);
    } else {
      seekerProfile.status = isPublished ? 'active' : 'draft';
      seekerProfile.displayName = data.fullName;
      seekerProfile.completionPercent = breakdown.totalPercent;
      seekerProfile.isCurrentActive = true;
    }

    this.saveToStorage();
    return {
      marketplaceProfile: seekerProfile,
      completion: breakdown,
    };
  }

  /**
   * Retrieves profile completion status.
   */
  async getProfileCompletion(): Promise<ProfileCompletionBreakdown> {
    try {
      const res = await apiClient.get<ProfileCompletionBreakdown>('/api/v1/profiles/completion');
      if (res && typeof res.totalPercent === 'number') {
        return res;
      }
    } catch {
      // Local fallback
    }

    return this.calculateLocalCompletion(this.localOnboardingData);
  }

  /**
   * Publishes profile to Aashvo Connect.
   */
  async publishProfile(): Promise<ProfileCompletionBreakdown> {
    try {
      const res = await apiClient.post<ProfileCompletionBreakdown>('/api/v1/profiles/publish', {});
      if (res) {
        const seeker = this.localProfiles.find((p) => p.profileType === 'flatmate_seeker');
        if (seeker) seeker.status = 'active';
        this.saveToStorage();
        return res;
      }
    } catch {
      // Local fallback
    }

    const breakdown = this.calculateLocalCompletion(this.localOnboardingData);
    breakdown.isPublished = true;
    const seeker = this.localProfiles.find((p) => p.profileType === 'flatmate_seeker');
    if (seeker) seeker.status = 'active';
    this.saveToStorage();
    return breakdown;
  }

  /**
   * Pauses profile from discovery.
   */
  async pauseProfile(): Promise<ProfileCompletionBreakdown> {
    try {
      const res = await apiClient.post<ProfileCompletionBreakdown>('/api/v1/profiles/pause', {});
      if (res) {
        const seeker = this.localProfiles.find((p) => p.profileType === 'flatmate_seeker');
        if (seeker) seeker.status = 'paused';
        this.saveToStorage();
        return res;
      }
    } catch {
      // Local fallback
    }

    const breakdown = this.calculateLocalCompletion(this.localOnboardingData);
    const seeker = this.localProfiles.find((p) => p.profileType === 'flatmate_seeker');
    if (seeker) seeker.status = 'paused';
    this.saveToStorage();
    return breakdown;
  }

  /**
   * Gets cached local onboarding data.
   */
  getLocalOnboardingData(): PersonalOnboardingInput | null {
    return this.localOnboardingData;
  }

  /**
   * Calculates completion score locally.
   */
  calculateLocalCompletion(data: PersonalOnboardingInput | null): ProfileCompletionBreakdown {
    if (!data) {
      return {
        totalPercent: 25,
        basicInfoPercent: 10,
        locationPercent: 0,
        housingPercent: 0,
        lifestylePercent: 0,
        photoPercent: 15,
        missingFields: ['Age (18+)', 'City', 'Housing Requirements', 'Lifestyle Preferences'],
        isComplete: false,
        isPublished: false,
      };
    }

    let basicInfo = 0;
    let location = 0;
    let housing = 0;
    let lifestyle = 0;
    let photo = 0;
    const missing: string[] = [];

    // Basic Info (25 pts max)
    if (data.fullName && data.fullName.trim().length >= 2) basicInfo += 10;
    else missing.push('Full Name');
    if (data.age && data.age >= 18) basicInfo += 5;
    else missing.push('Age (18+)');
    if (data.profession && data.profession.trim().length > 0) basicInfo += 5;
    else missing.push('Profession');
    if (data.bio && data.bio.trim().length >= 10) basicInfo += 5;
    else missing.push('About Me (Bio)');

    // Location (20 pts max)
    if (data.city && data.city.trim().length > 0) location += 10;
    else missing.push('City');
    if (data.targetLocalities && data.targetLocalities.length > 0) location += 10;
    else missing.push('Preferred Localities');

    // Housing (20 pts max)
    if (data.budgetMax && data.budgetMax > 0) housing += 10;
    else missing.push('Budget Maximum');
    if (data.roomType || (data.intentions && data.intentions.length > 0) || data.hasRoom !== undefined) {
      housing += 10;
    } else {
      missing.push('Housing Preference (Room Type / Intention)');
    }

    // Lifestyle (20 pts max)
    if (data.foodHabit) lifestyle += 5;
    else missing.push('Food Habit');
    if (data.sleepRoutine) lifestyle += 5;
    else missing.push('Sleep Routine');
    if (data.cleanliness) lifestyle += 5;
    else missing.push('Cleanliness Preference');
    if (data.smoking) lifestyle += 5;
    else missing.push('Smoking Habit');

    // Photo (15 pts max)
    if (data.avatarUrl && data.avatarUrl.trim().length > 0) photo += 15;
    else missing.push('Profile Photo');

    const total = basicInfo + location + housing + lifestyle + photo;
    const isComplete = missing.length === 0 || total >= 80;
    const isPublished = Boolean(data.publishImmediately);

    return {
      totalPercent: total,
      basicInfoPercent: basicInfo,
      locationPercent: location,
      housingPercent: housing,
      lifestylePercent: lifestyle,
      photoPercent: photo,
      missingFields: missing,
      isComplete,
      isPublished,
    };
  }

  resetForTesting() {
    this.localProfiles = [
      {
        id: 'mp-demo-seeker',
        userId: 'demo-user-id',
        profileType: 'flatmate_seeker',
        status: 'active',
        isCurrentActive: true,
        displayName: 'Flatmate Seeker',
        completionPercent: 85,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mp-demo-owner',
        userId: 'demo-user-id',
        profileType: 'property_owner',
        status: 'draft',
        isCurrentActive: false,
        displayName: 'Property Owner',
        completionPercent: 40,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    this.localOnboardingData = null;
    try {
      localStorage.removeItem(ACTIVE_PROFILE_TYPE_KEY);
      localStorage.removeItem(ONBOARDING_DATA_KEY);
    } catch {
      // Ignored
    }
  }
}

export const marketplaceProfileService = new MarketplaceProfileService();
