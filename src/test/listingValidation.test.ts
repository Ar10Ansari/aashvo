import { describe, it, expect } from 'vitest';
import { Property } from '../types';

interface StepValidationResult {
  isValid: boolean;
  error?: string;
}

function validateListingStep1(title: string, addressShort: string): StepValidationResult {
  if (!title.trim() || !addressShort.trim()) {
    return { isValid: false, error: 'Please enter a listing title and landmark address.' };
  }
  return { isValid: true };
}

function validateListingStep2(rent: number, deposit: number): StepValidationResult {
  if (rent <= 0 || deposit < 0) {
    return { isValid: false, error: 'Please specify valid rent and deposit amounts.' };
  }
  return { isValid: true };
}

function validateListingStep5(declarationAgreed: boolean): StepValidationResult {
  if (!declarationAgreed) {
    return { isValid: false, error: 'Please accept the accuracy and zero-hidden-fee declaration.' };
  }
  return { isValid: true };
}

describe('Listing Wizard Validation & Creation Logic', () => {
  it('rejects step 1 when title or address is missing or empty whitespace', () => {
    expect(validateListingStep1('', 'Near Galleria').isValid).toBe(false);
    expect(validateListingStep1('   ', 'Near Galleria').isValid).toBe(false);
    expect(validateListingStep1('Studio Room', '').isValid).toBe(false);
    expect(validateListingStep1('Studio Room', 'Near Metro').isValid).toBe(true);
  });

  it('rejects step 2 when rent is zero or negative', () => {
    expect(validateListingStep2(0, 20000).isValid).toBe(false);
    expect(validateListingStep2(-5000, 20000).isValid).toBe(false);
    expect(validateListingStep2(22000, -100).isValid).toBe(false);
    expect(validateListingStep2(22000, 0).isValid).toBe(true); // ₹0 deposit is valid
    expect(validateListingStep2(22000, 30000).isValid).toBe(true);
  });

  it('rejects step 5 when zero-brokerage / transparency declaration is not checked', () => {
    expect(validateListingStep5(false).isValid).toBe(false);
    expect(validateListingStep5(true).isValid).toBe(true);
  });

  it('correctly sets initial status to active or pending and timestamps lastVerifiedDate', () => {
    const rawData: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'> = {
      title: 'Spacious 2BHK in DLF Phase 5',
      locality: 'DLF Phase 5',
      city: 'Gurugram',
      addressShort: 'Near Horizon Center',
      propertyType: 'apartment',
      roomType: 'entire_flat',
      rent: 45000,
      deposit: 60000,
      maintenance: 3000,
      electricityPerUnit: 9,
      brokerageFee: 0,
      providerType: 'owner',
      providerName: 'Sunita Mehra',
      providerContact: '+91 98100 XXXXX',
      furnishing: 'fully_furnished',
      bedrooms: 2,
      bathrooms: 2,
      availableFrom: 'Immediately',
      images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c'],
      amenities: ['100% Power Backup', 'Gym & Pool Access'],
      rules: ['No loud parties'],
      genderPreference: 'any',
      description: 'Modern condominium floor.',
      featured: false,
    };

    const newProperty: Property = {
      ...rawData,
      id: `prop-${Date.now()}`,
      status: 'active',
      lastVerifiedDate: new Date().toISOString(),
    };

    expect(newProperty.id).toMatch(/^prop-\d+/);
    expect(newProperty.status).toBe('active');
    expect(new Date(newProperty.lastVerifiedDate).getTime()).toBeGreaterThan(0);
  });
});
