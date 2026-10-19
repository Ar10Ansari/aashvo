import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OurFounders } from '../components/about/OurFounders';
import { Hero } from '../components/hero/Hero';
import { Footer } from '../components/layout/Footer';
import { AppProvider } from '../context/AppContext';
import { calculateMoveInCost } from '../utils/formatters';
import { validateListingSubmission } from '../services/marketplaceService';
import { Property } from '../types';
import { SEED_PROPERTIES } from '../data/seedData';

describe('Aashvo Product Hierarchy & Founders Suite', () => {
  describe('Part 1 & 4: Our Founders Section Verification', () => {
    it('renders the exact heading "Our Founders" and not "Our Funders"', () => {
      render(<OurFounders />);
      const heading = screen.getByRole('heading', { level: 2, name: /Our Founders/i });
      expect(heading).toBeDefined();
      expect(screen.queryByText(/Our Funders/i)).toBeNull();
    });

    it('faithfully describes Abdul Rehman Ansari with approved technical leadership focus', () => {
      render(<OurFounders />);
      expect(screen.getByText('Abdul Rehman Ansari')).toBeDefined();
      expect(screen.getByText('Co-founder & CTO')).toBeDefined();
      expect(screen.getByText(/Technology, Product & Engineering/i)).toBeDefined();
      expect(screen.getByText(/Leads Aashvo's technology, product direction, and engineering/i)).toBeDefined();
    });

    it('faithfully introduces Tushar Jaisawl with non-invented co-founder details', () => {
      render(<OurFounders />);
      expect(screen.getByText('Tushar Jaisawl')).toBeDefined();
      expect(screen.getByText('Co-founder & Head of Marketing')).toBeDefined();
      expect(screen.getByText(/Brand Strategy, Marketing & Growth/i)).toBeDefined();
      expect(screen.getByText(/Leads Aashvo's brand positioning, marketing initiatives, and customer acquisition/i)).toBeDefined();
    });

    it('uses tasteful text-first monogram layout and no fake or stock imagery', () => {
      render(<OurFounders />);
      // Monogram initials AA and TJ should be rendered
      expect(screen.getByText('AA')).toBeDefined();
      expect(screen.getByText('TJ')).toBeDefined();
      // Ensure no <img> elements with fake portraits exist in the component
      const images = screen.queryAllByRole('img');
      expect(images.length).toBe(0);
    });

    it('articulates the authentic shared mission for students and working professionals', () => {
      render(<OurFounders />);
      expect(screen.getByText(/Our Shared Mission/i)).toBeDefined();
      expect(screen.getByText(/students and working professionals/i)).toBeDefined();
      // Zero hallucinated funding or investor claims
      expect(screen.queryByText(/Seed round/i)).toBeNull();
      expect(screen.queryByText(/Series A/i)).toBeNull();
      expect(screen.queryByText(/funded by/i)).toBeNull();
    });
  });

  describe('Part 2: Family Stay Eligibility & Zero Double-Counting of Meals', () => {
    const baseFamilyProperty: Property = {
      id: 'prop-fam-1',
      title: 'Warm Family Room in South Delhi',
      locality: 'Saket',
      city: 'Delhi',
      addressShort: 'Near Saket Metro',
      propertyType: 'apartment',
      roomType: 'private_room',
      category: 'family_stays',
      familyLivesOnProperty: true,
      mealsOffered: 'included',
      rent: 18000,
      deposit: 18000,
      maintenance: 1000,
      electricityPerUnit: 8,
      brokerageFee: 0,
      providerType: 'owner',
      providerName: 'Sunita & Ramesh Sharma',
      providerContact: '+91 98111 XXXXX',
      furnishing: 'fully_furnished',
      bedrooms: 3,
      bathrooms: 2,
      availableFrom: 'Immediately',
      lastVerifiedDate: new Date().toISOString(),
      images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c'],
      amenities: ['Wi-Fi', 'Home Cooked Food'],
      rules: ['Cleanliness'],
      genderPreference: 'any',
      status: 'active',
      description: 'Family home with home-cooked meals included.',
    };

    it('does NOT double-count meals when mealsOffered === "included"', () => {
      // In Family Stays where meals are included in rent, total move-in is rent + deposit + maintenance + brokerage
      // An additional meal charge must NEVER be added to the outlay.
      const costs = calculateMoveInCost(baseFamilyProperty);
      expect(costs.monthlyRent).toBe(18000);
      expect(costs.securityDeposit).toBe(18000);
      expect(costs.maintenance).toBe(1000);
      expect(costs.brokerageFee).toBe(0);
      // Total move in = 18000 + 18000 + 1000 = 37000
      expect(costs.totalMoveInCost).toBe(37000);
    });

    it('distinguishes recurring monthly charges from one-time refundable deposits', () => {
      const costs = calculateMoveInCost(baseFamilyProperty);
      // Recurring monthly = rent (18000) + maintenance (1000) = 19000
      const recurringMonthly = costs.monthlyRent + costs.maintenance;
      expect(recurringMonthly).toBe(19000);
      // One-time refundable move-in = deposit (18000)
      expect(costs.securityDeposit).toBe(18000);
    });

    it('strictly enforces resident family rule: non-resident landlord cannot list Family Stays', () => {
      const invalidListing: Partial<Property> = {
        ...baseFamilyProperty,
        category: 'family_stays',
        familyLivesOnProperty: false, // Landlord does not live here!
        providerType: 'owner',
      };
      const validation = validateListingSubmission(invalidListing);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Family Stay hosts must declare that their family lives in the same home as the offered room.'
      );
    });

    it('strictly prohibits commercial brokers or managers from listing under Family Stays', () => {
      const invalidBrokerListing: Partial<Property> = {
        ...baseFamilyProperty,
        category: 'family_stays',
        familyLivesOnProperty: true,
        providerType: 'verified_manager', // Broker pretending to be resident family
      };
      const validation = validateListingSubmission(invalidBrokerListing);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Family Stays can only be published by direct home owners (commercial managers and brokers are prohibited).'
      );
    });

    it('accepts genuine resident host family with canonical meal declaration', () => {
      const validListing: Partial<Property> = {
        ...baseFamilyProperty,
        category: 'family_stays',
        familyLivesOnProperty: true,
        providerType: 'owner',
        mealsOffered: 'optional_extra',
        optionalMealCost: 3500,
      };
      const validation = validateListingSubmission(validListing);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('Part 3 & 5: Pan-India Discovery & Secondary Entire Flats', () => {
    it('preserves entire flats as a searchable secondary category without regression', () => {
      const entireFlats = SEED_PROPERTIES.filter(p => p.roomType === 'entire_flat');
      expect(entireFlats.length).toBe(2);
      expect(entireFlats.every(p => p.status === 'active')).toBe(true);
    });

    it('supports nationwide location properties beyond Delhi NCR', () => {
      const nationwideFamilyStay: Partial<Property> = {
        title: 'Cozy Room in Indiranagar Family Villa',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        category: 'family_stays',
        familyLivesOnProperty: true,
        providerType: 'owner',
        mealsOffered: 'included',
        rent: 16000,
        deposit: 32000,
      };
      const validation = validateListingSubmission(nationwideFamilyStay);
      expect(validation.isValid).toBe(true);
    });

    it('renders nationwide hero announcement banner without obsolete Delhi NCR pilot messaging', () => {
      render(
        <AppProvider>
          <Hero />
        </AppProvider>
      );
      expect(screen.getByText(/Made for moving, anywhere in India/i)).toBeDefined();
      expect(screen.queryByText(/Delhi NCR Pilot/i)).toBeNull();
    });

    it('renders pan-India footer headline without regional restriction', () => {
      render(
        <AppProvider>
          <Footer />
        </AppProvider>
      );
      expect(screen.getByText(/Have a flat or room to share\?/i)).toBeDefined();
      expect(screen.queryByText(/Have a flat or room in Delhi NCR\?/i)).toBeNull();
    });
  });
});
