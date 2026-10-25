import { describe, it, expect } from 'vitest';
import {
  calculateFlatmateCompatibility,
  upsertFlatmateProfileInSupabase,
  submitInquiryInSupabase,
  fetchFlatmatesFromSupabase,
} from '../services/marketplaceService';
import { mapSupabaseFlatmateToApp } from '../services/supabase';
import { Flatmate, User } from '../types';

describe('Flatmate & Marketplace Completion Suite', () => {
  const baseTargetFlatmate: Flatmate = {
    id: 'flt-target-1',
    name: 'Aanya Sen',
    age: 23,
    occupation: 'UX Designer',
    avatar: 'https://example.com/avatar.jpg',
    gender: 'female',
    hasRoom: true,
    roomDetails: 'Spacious balcony room',
    targetLocalities: ['DLF Phase 2', 'Cyber City'],
    budgetMax: 28000,
    foodHabit: 'Vegetarian',
    sleepRoutine: 'Early Bird',
    cleanliness: 'Spotless',
    petFriendly: true,
    smoking: 'No',
    bio: 'Calm professional who loves yoga and clean common areas.',
    interests: ['Design', 'Yoga', 'Cooking'],
    verified: true,
    postedDate: 'Today',
  };

  const testUser: User = {
    id: 'usr-renter-101',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    role: 'renter',
    isDemo: false,
  };

  describe('1. Transparent Flatmate Compatibility Scoring', () => {
    it('returns a 100% High match when all 6 lifestyle dimensions align perfectly', () => {
      const perfectMatch: Partial<Flatmate> = {
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'No',
        budgetMax: 27000, // Within 20% of 28,000
      };

      const result = calculateFlatmateCompatibility(perfectMatch, baseTargetFlatmate);
      expect(result.score).toBe(100);
      expect(result.matchLevel).toBe('High');
      expect(result.matchedFactors.length).toBe(6);
      expect(result.divergentFactors.length).toBe(0);
      expect(result.matchedFactors).toContain('Shared diet preference (Vegetarian)');
      expect(result.matchedFactors).toContain('Aligned smoking policy (No)');
      expect(result.matchedFactors).toEqual(
        expect.arrayContaining([expect.stringContaining('Aligned budget expectations')])
      );
    });

    it('identifies divergent diet, sleep routines and budget transparently', () => {
      const divergentPref: Partial<Flatmate> = {
        foodHabit: 'Non-Vegetarian',
        sleepRoutine: 'Night Owl',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'No',
        budgetMax: 12000, // Diverges from 28,000 by >35%
      };

      const result = calculateFlatmateCompatibility(divergentPref, baseTargetFlatmate);
      expect(result.score).toBeLessThan(60);
      expect(result.divergentFactors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Diet: You prefer Non-Vegetarian, flatmate is Vegetarian'),
          expect.stringContaining('Schedule: You are Night Owl, flatmate is Early Bird'),
          expect.stringContaining('Budget: You budgeted max ₹12,000, flatmate is ₹28,000'),
        ])
      );
    });

    it('accommodates flexible sleep routines, close cleanliness standards and flexible budgets', () => {
      const flexiblePref: Partial<Flatmate> = {
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Flexible',
        cleanliness: 'Moderate',
        petFriendly: true,
        smoking: 'No',
        // budgetMax omitted: flexible budget
      };

      const result = calculateFlatmateCompatibility(flexiblePref, baseTargetFlatmate);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.matchedFactors).toContain('Compatible sleep schedule (Early Bird)');
      expect(result.matchedFactors).toContain('Close cleanliness standard alignment');
      expect(result.matchedFactors).toContain('Flexible budget alignment');
    });

    it('gracefully handles missing, invalid or NaN preference inputs without crashing', () => {
      const invalidPref: any = {
        budgetMax: -5000,
        foodHabit: null,
        sleepRoutine: undefined,
        cleanliness: '',
      };

      const result = calculateFlatmateCompatibility(invalidPref, baseTargetFlatmate);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.matchedFactors).toContain('Flexible budget alignment');
    });
  });

  describe('2. Flatmate Profile Validation & Persistence', () => {
    it('rejects flatmate creation if mandatory fields fail validation', async () => {
      const invalidData: Partial<Flatmate> = {
        age: 16, // Underage
        budgetMax: -500, // Negative budget
        occupation: '', // Empty
        targetLocalities: [], // Missing localities
        bio: 'Short', // Too brief
      };

      const res = await upsertFlatmateProfileInSupabase(invalidData, testUser);
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.errors).toContain('Occupation is required.');
      expect(res.errors).toContain('Age must be at least 18.');
      expect(res.errors).toContain('Maximum monthly budget must be a positive number.');
      expect(res.errors).toContain('At least one target locality is required.');
      expect(res.errors).toContain('Bio must be at least 10 characters.');
    });

    it('creates a validated flatmate profile with unverified initial state', async () => {
      const validData: Partial<Flatmate> = {
        age: 24,
        budgetMax: 22000,
        occupation: 'Software Engineer',
        gender: 'female',
        hasRoom: false,
        targetLocalities: ['Indiranagar', 'Koramangala'],
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Flexible',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'No',
        bio: 'Moving to Bengaluru for tech job. Looking for friendly, respectful flatmates.',
        interests: ['Tech', 'Reading'],
      };

      const res = await upsertFlatmateProfileInSupabase(validData, testUser);
      expect(res.success).toBe(true);
      expect(res.flatmate).toBeDefined();
      expect(res.flatmate?.verified).toBe(false); // Anti-forgery baseline
    });
  });

  describe('3. Targeted Inquiry Validation (Property vs Flatmate)', () => {
    it('rejects inquiry if neither property_id nor target_flatmate_id is provided', async () => {
      const res = await submitInquiryInSupabase({
        senderId: testUser.id,
        senderName: testUser.name,
        senderEmail: testUser.email,
        message: 'Hello, I want to connect!',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Inquiry must target either a property listing or a flatmate profile.');
    });

    it('successfully constructs inquiry targeting a flatmate profile', async () => {
      const res = await submitInquiryInSupabase({
        targetFlatmateId: 'flt-target-1',
        senderId: testUser.id,
        senderName: testUser.name,
        senderEmail: testUser.email,
        message: 'Loved your profile! Let us team up for a flat in DLF Phase 2.',
      });

      expect(res.success).toBe(true);
      expect(res.inquiryId).toBeDefined();
    });

    it('successfully constructs inquiry targeting a property listing', async () => {
      const res = await submitInquiryInSupabase({
        listingId: 'prop-gurugram-01',
        senderId: testUser.id,
        senderName: testUser.name,
        senderEmail: testUser.email,
        message: 'Is this room available for move-in from 1st of next month?',
      });

      expect(res.success).toBe(true);
      expect(res.inquiryId).toBeDefined();
    });
  });

  describe('4. Flatmate Feed Fallback & Seed Integrity', () => {
    it('returns valid flatmate feed even when remote cloud backend is offline', async () => {
      const res = await fetchFlatmatesFromSupabase();
      expect(res.success).toBe(true);
      expect(res.flatmates.length).toBeGreaterThanOrEqual(4);
      expect(res.flatmates[0]).toHaveProperty('budgetMax');
      expect(res.flatmates[0]).toHaveProperty('foodHabit');
      expect(res.flatmates[0]).toHaveProperty('targetLocalities');
    });
  });

  describe('5. Entity Mapper Anti-Deception & Privacy Controls', () => {
    it('never falsely marks unverified flatmates as Verified Flatmate when name is missing', () => {
      const unverifiedRow = {
        id: 'flt-unverified-1',
        age: 22,
        occupation: 'Student',
        gender: 'female',
        has_room: false,
        budget_max: 18000,
        verified: false,
        created_at: new Date().toISOString(),
      };

      const mapped = mapSupabaseFlatmateToApp(unverifiedRow);
      expect(mapped.verified).toBe(false);
      expect(mapped.name).not.toContain('Verified');
      expect(mapped.name).toBe('Aashvo Member');
    });

    it('correctly maps public discovery view fields from public_flatmates', () => {
      const publicViewRow = {
        id: 'flt-view-1',
        user_id: 'usr-202',
        full_name: 'Ananya Sharma',
        avatar_url: 'https://example.com/ananya.jpg',
        age: 24,
        occupation: 'Product Manager',
        gender: 'female',
        has_room: true,
        budget_max: 30000,
        verified: true,
        target_localities: ['Indiranagar'],
      };

      const mapped = mapSupabaseFlatmateToApp(publicViewRow);
      expect(mapped.name).toBe('Ananya Sharma');
      expect(mapped.avatar).toBe('https://example.com/ananya.jpg');
      expect(mapped.verified).toBe(true);
      expect(mapped.occupation).toBe('Product Manager');
    });

    it('verifies that public discovery entity completely shields private user_id, phone and email', () => {
      const publicViewRow = {
        id: 'flt-view-privacy-1',
        full_name: 'Tanvi M.',
        avatar_url: 'https://example.com/tanvi.jpg',
        age: 23,
        occupation: 'Data Scientist',
        gender: 'female',
        has_room: false,
        budget_max: 25000,
        verified: true,
        target_localities: ['Koramangala'],
      };

      const mapped = mapSupabaseFlatmateToApp(publicViewRow);
      expect((mapped as any).user_id).toBeUndefined();
      expect((mapped as any).phone).toBeUndefined();
      expect((mapped as any).email).toBeUndefined();
      expect((mapped as any).phone_number).toBeUndefined();
      expect(mapped.id).toBe('flt-view-privacy-1');
      expect(mapped.name).toBe('Tanvi M.');
    });
  });
});
