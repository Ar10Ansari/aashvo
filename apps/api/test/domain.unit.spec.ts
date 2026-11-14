import { calculateCompatibilityScore } from '../src/modules/flatmates/flatmates.service';
import { maskPhoneNumber } from '../src/modules/inquiries/inquiries.service';
import { LocalStorageAdapter } from '../src/modules/media/adapters/local-storage.adapter';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
} from '../src/modules/media/dto/media.dto';
import { calculateProfileCompletion } from '../src/modules/profiles/profiles.service';

describe('Domain Unit Tests — Core Marketplace Logic & Validation', () => {
  describe('Profiles Progressive Completion Calculation', () => {
    test('calculates accurate profile completion percentages', () => {
      // Empty profile
      expect(
        calculateProfileCompletion({
          fullName: null,
          phoneNumber: null,
          bio: null,
          avatarUrl: null,
          emailVerified: false,
        }),
      ).toBe(0);

      // Name only (+25)
      expect(
        calculateProfileCompletion({
          fullName: 'Aarav Patel',
          phoneNumber: null,
          bio: null,
          avatarUrl: null,
          emailVerified: false,
        }),
      ).toBe(25);

      // Name (+25) + Phone (+25) + Email verified (+15) = 65
      expect(
        calculateProfileCompletion({
          fullName: 'Aarav Patel',
          phoneNumber: '+919876543210',
          bio: null,
          avatarUrl: null,
          emailVerified: true,
        }),
      ).toBe(65);

      // Full profile (+25 + 25 + 20 + 15 + 15 = 100)
      expect(
        calculateProfileCompletion({
          fullName: 'Aarav Patel',
          phoneNumber: '+919876543210',
          bio: 'Software engineer at Gurugram looking for peaceful stay.',
          avatarUrl: 'https://assets.aashvo.in/user-avatars/123.webp',
          emailVerified: true,
        }),
      ).toBe(100);
    });
  });

  describe('Flatmate Compatibility Scoring Algorithm', () => {
    test('computes high score for identical lifestyle and shared interests', () => {
      const userA = {
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        budgetMax: 20000,
        interests: ['Badminton', 'Reading', 'Coding', 'Cooking'],
      };
      const userB = {
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        budgetMax: 20000,
        interests: ['Coding', 'Badminton', 'Reading'],
      };

      const score = calculateCompatibilityScore(userA, userB);
      // Food(25) + Sleep(20) + Cleanliness(20) + Budget(20) + Interests(15) = 100
      expect(score).toBe(100);
    });

    test('computes partial score for compatible variations (Eggetarian/Vegetarian, Flexible sleep)', () => {
      const userA = {
        foodHabit: 'Eggetarian',
        sleepRoutine: 'Flexible',
        cleanliness: 'Moderate',
        budgetMax: 18000,
        interests: ['Music', 'Fitness'],
      };
      const userB = {
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        budgetMax: 20000,
        interests: ['Music', 'Gaming'],
      };

      const score = calculateCompatibilityScore(userA, userB);
      // Food partial(15) + Sleep partial(15) + Cleanliness partial(12) + Budget overlap(18) + 1 shared interest(5) = 65
      expect(score).toBeGreaterThanOrEqual(60);
      expect(score).toBeLessThan(80);
    });

    test('computes low score for diametric opposites', () => {
      const userA = {
        foodHabit: 'Vegan',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        budgetMax: 10000,
        interests: ['Yoga'],
      };
      const userB = {
        foodHabit: 'Non-Vegetarian',
        sleepRoutine: 'Night Owl',
        cleanliness: 'Relaxed',
        budgetMax: 40000,
        interests: ['Partying'],
      };

      const score = calculateCompatibilityScore(userA, userB);
      // Food(0) + Sleep(0) + Cleanliness(0) + Budget overlap(10000/40000 * 20 = 5) + Shared(0) = 5
      expect(score).toBeLessThanOrEqual(15);
    });
  });

  describe('Inquiries Phone Number Masking', () => {
    test('masks phone numbers safely until inquiry is accepted', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91 ***** *3210');
      expect(maskPhoneNumber('+919811122233')).toBe('+91 ***** *2233');
      expect(maskPhoneNumber('1234')).toBe('****');
    });
  });

  describe('Media Storage Abstraction & Limits', () => {
    const storage = new LocalStorageAdapter();

    test('validates MIME allowlists and file size ceilings', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/webp');
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_IMAGE_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_DOCUMENT_MIME_TYPES).toContain('application/pdf');

      expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
      expect(MAX_DOCUMENT_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });

    test('returns public URL only for public buckets and null for private document vaults', async () => {
      const publicUpload = await storage.getPresignedUploadUrl(
        'property-photos',
        'property-photos/u1/photo.webp',
        'image/webp',
        500000,
        900,
      );
      expect(publicUpload.publicUrl).toBeTruthy();
      expect(publicUpload.publicUrl).toContain('/public-media/property-photos/');

      const privateUpload = await storage.getPresignedUploadUrl(
        'rental-documents',
        'rental-documents/u1/lease.pdf',
        'application/pdf',
        2000000,
        900,
      );
      // Private documents MUST NOT have a public URL
      expect(privateUpload.publicUrl).toBeNull();
      expect(storage.getPublicUrl('rental-documents', 'rental-documents/u1/lease.pdf')).toBeNull();

      // But can generate a temporary signed download URL
      const downloadUrl = await storage.getPresignedDownloadUrl(
        'rental-documents',
        'rental-documents/u1/lease.pdf',
        900,
      );
      expect(downloadUrl).toContain('/api/v1/media/private-download/rental-documents/');
      expect(downloadUrl).toContain('sig=');
    });
  });
});
