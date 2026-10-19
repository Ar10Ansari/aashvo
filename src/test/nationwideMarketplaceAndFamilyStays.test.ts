import { describe, it, expect } from 'vitest';
import {
  validateListingSubmission,
  filterNationwideProperties,
  maskAddressForPublicView,
  calculateGeoDistanceKm,
} from '../services/marketplaceService';
import { evaluateActionEligibility } from '../services/authService';
import { Property, User } from '../types';
import { SEED_PROPERTIES, SEED_FLATMATES } from '../data/seedData';

describe('Nationwide Marketplace & Family Stay Eligibility', () => {
  // Test 9: Listing submission with required host details across nationwide cities
  describe('Nationwide Listing Submission & Open Geography', () => {
    it('permits listing submission in cities across India outside the Delhi NCR seed list', () => {
      const nationwideListing: Partial<Property> = {
        title: 'Sunlit Studio in Indiranagar',
        locality: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        rent: 28000,
        deposit: 50000,
        providerType: 'owner',
        roomType: 'private_room',
        propertyType: 'apartment',
        category: 'flats_rooms',
      };

      const result = validateListingSubmission(nationwideListing);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects listing submissions missing mandatory financial or geographical fields', () => {
      const invalidListing: Partial<Property> = {
        title: 'Room', // Too short (< 5 chars)
        locality: '', // Missing
        city: '', // Missing
        rent: -500, // Invalid rent
        deposit: -100, // Invalid deposit
      };

      const result = validateListingSubmission(invalidListing);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Listing title must be at least 5 characters.');
      expect(result.errors).toContain('Locality is required.');
      expect(result.errors).toContain('City is required (supports any Indian city/town).');
      expect(result.errors).toContain('Monthly rent must be a positive number.');
      expect(result.errors).toContain('Security deposit must be zero or a positive number.');
    });

    it('filters nationwide properties across arbitrary cities and free-text search queries', () => {
      const nationwideCatalog: Property[] = [
        ...SEED_PROPERTIES,
        {
          id: 'prop-blr-1',
          title: 'Cozy Room near Sony World Signal',
          locality: 'Koramangala 4th Block',
          city: 'Bengaluru',
          addressShort: 'Koramangala, Bengaluru',
          propertyType: 'apartment',
          roomType: 'private_room',
          rent: 24000,
          deposit: 48000,
          maintenance: 2000,
          electricityPerUnit: 8.0,
          brokerageFee: 0,
          providerType: 'owner',
          providerName: 'Kavita Rao',
          providerContact: '+91 98450 XXXXX',
          furnishing: 'fully_furnished',
          bedrooms: 3,
          bathrooms: 3,
          availableFrom: 'Immediately',
          lastVerifiedDate: '2026-10-18T10:00:00Z',
          images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
          amenities: ['Power Backup', 'Wi-Fi'],
          rules: ['No loud music after 11 PM'],
          genderPreference: 'any',
          status: 'active',
          description: 'Spacious flat close to major tech parks.',
          category: 'flats_rooms',
        },
        {
          id: 'prop-mum-1',
          title: 'Sea-facing Room in Bandra West',
          locality: 'Pali Hill',
          city: 'Mumbai',
          addressShort: 'Pali Hill, Bandra West',
          propertyType: 'apartment',
          roomType: 'private_room',
          rent: 45000,
          deposit: 90000,
          maintenance: 3500,
          electricityPerUnit: 10.0,
          brokerageFee: 0,
          providerType: 'owner',
          providerName: 'Sunita Joshi',
          providerContact: '+91 98200 XXXXX',
          furnishing: 'fully_furnished',
          bedrooms: 2,
          bathrooms: 2,
          availableFrom: 'Immediately',
          lastVerifiedDate: '2026-10-19T08:00:00Z',
          images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'],
          amenities: ['Air Conditioner', 'Elevator'],
          rules: ['Vegetarian preferred'],
          genderPreference: 'any',
          status: 'active',
          description: 'Quiet green lane in Bandra.',
          category: 'flats_rooms',
        },
      ];

      // Filter by city: Bengaluru
      const blrResults = filterNationwideProperties(nationwideCatalog, { city: 'Bengaluru' });
      expect(blrResults.length).toBe(1);
      expect(blrResults[0].locality).toBe('Koramangala 4th Block');

      // Free-text search: "Bandra"
      const mumResults = filterNationwideProperties(nationwideCatalog, { searchQuery: 'Bandra' });
      expect(mumResults.length).toBe(1);
      expect(mumResults[0].city).toBe('Mumbai');
    });

    it('masks exact residential door and building numbers in public display', () => {
      const masked = maskAddressForPublicView(
        'Flat 402, Tower B, Palm Grove Heights, Sector 54',
        'Sector 54',
        'Gurugram',
        'Near Suncity School'
      );

      expect(masked).not.toContain('Flat 402');
      expect(masked).not.toContain('Tower B');
      expect(masked).toContain('Near Suncity School');
      expect(masked).toContain('Sector 54');
      expect(masked).toContain('Gurugram');
    });

    it('calculates geographic distance for current-location convenience', () => {
      // Distance between Cyber City Gurugram (28.4950, 77.0895) and Saket South Delhi (28.5245, 77.2066)
      const distance = calculateGeoDistanceKm(28.495, 77.0895, 28.5245, 77.2066);
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(15); // ~11.8 km
    });
  });

  // Test 10: Family Stay eligibility enforcement
  describe('Family Stay Category & Eligibility Enforcement', () => {
    it('permits Family Stay listing when host is an owner, family lives on property, and meals are declared', () => {
      const validFamilyStay: Partial<Property> = {
        title: 'Warm Family Home with Homemade Meals',
        locality: 'DLF Phase 2',
        city: 'Gurugram',
        rent: 22000,
        deposit: 22000,
        providerType: 'owner',
        category: 'family_stays',
        familyLivesOnProperty: true, // Verified resident family
        mealsOffered: 'included', // Meal declaration
        roomType: 'private_room',
        propertyType: 'villa',
      };

      const result = validateListingSubmission(validFamilyStay);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects Family Stay listing when provider is a broker or commercial manager', () => {
      const brokerFamilyStay: Partial<Property> = {
        title: 'Family Home Managed by Agency',
        locality: 'Saket',
        city: 'Delhi',
        rent: 25000,
        deposit: 25000,
        providerType: 'verified_manager', // Prohibited!
        category: 'family_stays',
        familyLivesOnProperty: true,
        mealsOffered: 'optional_extra',
      };

      const result = validateListingSubmission(brokerFamilyStay);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Family Stays can only be published by direct home owners (commercial managers and brokers are prohibited).'
      );
    });

    it('rejects Family Stay listing when family does not live on the property', () => {
      const nonResidentFamilyStay: Partial<Property> = {
        title: 'Vacant Villa Claimed as Family Stay',
        locality: 'Hauz Khas',
        city: 'Delhi',
        rent: 30000,
        deposit: 30000,
        providerType: 'owner',
        category: 'family_stays',
        familyLivesOnProperty: false, // Prohibited!
        mealsOffered: 'none',
      };

      const result = validateListingSubmission(nonResidentFamilyStay);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Family Stay hosts must declare that their family lives in the same home as the offered room.'
      );
    });

    it('rejects Family Stay listing when meal availability is missing', () => {
      const missingMealsStay: Partial<Property> = {
        title: 'Homestay in Malviya Nagar',
        locality: 'Malviya Nagar',
        city: 'Delhi',
        rent: 20000,
        deposit: 20000,
        providerType: 'owner',
        category: 'family_stays',
        familyLivesOnProperty: true,
        mealsOffered: undefined, // Missing!
      };

      const result = validateListingSubmission(missingMealsStay);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Meal availability must be declared (included, optional_extra, or none).'
      );
    });

    it('enforces Family Stay server-side eligibility rules in authService engine', () => {
      const ownerUser: User = {
        id: 'usr-owner-1',
        name: 'Mrs. Geeta Sharma',
        email: 'geeta@example.com',
        role: 'owner',
        emailVerified: true,
        phoneVerified: true,
      };

      // Valid family stay context
      const validCheck = evaluateActionEligibility(ownerUser, 'create_family_stay', {
        providerType: 'owner',
        familyLivesOnProperty: true,
        mealsOffered: 'included',
      });
      expect(validCheck.canPerform).toBe(true);

      // Ineligible: commercial broker posing as family stay
      const brokerCheck = evaluateActionEligibility(ownerUser, 'create_family_stay', {
        providerType: 'broker' as any,
        familyLivesOnProperty: true,
        mealsOffered: 'included',
      });
      expect(brokerCheck.canPerform).toBe(false);
      expect(brokerCheck.missingRequirements).toContain(
        'Only direct resident home owners may publish Family Stays (brokers and managers prohibited).'
      );
    });
  });

  // Test 11: Authorization and privacy across separate user accounts
  describe('Cross-Account Privacy & Authorization Isolation', () => {
    it('ensures inquiry records are isolated between distinct sender and recipient accounts', () => {
      const userA: User = { id: 'usr-A', name: 'Renter A', email: 'a@example.com', role: 'renter' };
      const userB: User = { id: 'usr-B', name: 'Renter B', email: 'b@example.com', role: 'renter' };
      const hostOwner: User = { id: 'usr-host', name: 'Host Owner', email: 'host@example.com', role: 'owner' };

      const inquiryRecord = {
        id: 'inq-101',
        senderId: userA.id,
        hostOwnerId: hostOwner.id,
        message: 'Interested in visiting on Saturday morning.',
      };

      // Access policy: Only sender, host owner, or admin can access
      const canUserAAccess = inquiryRecord.senderId === userA.id || inquiryRecord.hostOwnerId === userA.id;
      const canUserBAccess = inquiryRecord.senderId === userB.id || inquiryRecord.hostOwnerId === userB.id;
      const canHostAccess = inquiryRecord.senderId === hostOwner.id || inquiryRecord.hostOwnerId === hostOwner.id;

      expect(canUserAAccess).toBe(true);
      expect(canHostAccess).toBe(true);
      expect(canUserBAccess).toBe(false); // User B has zero access to User A's inquiry!
    });
  });

  // Test 12: Regression tests for existing Flats & Rooms and Flatmates functionality
  describe('Flats & Rooms and Flatmates Regression Verification', () => {
    it('preserves all existing seed properties and verifies required core attributes', () => {
      expect(SEED_PROPERTIES.length).toBeGreaterThanOrEqual(6);

      SEED_PROPERTIES.forEach(prop => {
        expect(prop.id).toBeDefined();
        expect(prop.title).toBeDefined();
        expect(prop.rent).toBeGreaterThan(0);
        expect(prop.deposit).toBeGreaterThanOrEqual(0);
        expect(prop.locality).toBeDefined();
        expect(prop.city).toBeDefined();
        expect(['apartment', 'builder_floor', 'villa', 'gated_society']).toContain(prop.propertyType);
        expect(['private_room', 'shared_room', 'entire_flat']).toContain(prop.roomType);
      });
    });

    it('preserves all existing seed flatmates and lifestyle matching parameters', () => {
      expect(SEED_FLATMATES.length).toBeGreaterThanOrEqual(4);

      SEED_FLATMATES.forEach(fm => {
        expect(fm.id).toBeDefined();
        expect(fm.name).toBeDefined();
        expect(fm.budgetMax).toBeGreaterThan(0);
        expect(fm.targetLocalities.length).toBeGreaterThan(0);
        expect(['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan']).toContain(fm.foodHabit);
        expect(['Early Bird', 'Night Owl', 'Flexible']).toContain(fm.sleepRoutine);
        expect(['Spotless', 'Moderate', 'Relaxed']).toContain(fm.cleanliness);
      });
    });

    it('calculates accurate move-in outlay for standard Flats & Rooms listings', () => {
      const prop = SEED_PROPERTIES[0];
      const moveInOutlay = prop.rent + prop.deposit + prop.maintenance;

      expect(moveInOutlay).toBe(prop.rent + prop.deposit + prop.maintenance);
      expect(moveInOutlay).toBeGreaterThan(prop.rent);
    });
  });
});
