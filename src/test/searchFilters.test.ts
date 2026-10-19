import { describe, it, expect } from 'vitest';
import { SEED_PROPERTIES } from '../data/seedData';
import { Property, PropertyFilterState } from '../types';

function applyFilters(properties: Property[], filters: PropertyFilterState): Property[] {
  return properties.filter(prop => {
    if (prop.status !== 'active') return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        prop.title.toLowerCase().includes(q) ||
        prop.locality.toLowerCase().includes(q) ||
        prop.description.toLowerCase().includes(q) ||
        prop.amenities.some(a => a.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (filters.locality && filters.locality !== 'All Localities') {
      const cleanLoc = filters.locality.split(',')[0].trim();
      if (!prop.locality.toLowerCase().includes(cleanLoc.toLowerCase())) {
        return false;
      }
    }

    if (filters.roomType && filters.roomType !== 'all') {
      if (prop.roomType !== filters.roomType) return false;
    }

    if (filters.furnishing && filters.furnishing !== 'all') {
      if (prop.furnishing !== filters.furnishing) return false;
    }

    if (filters.providerType && filters.providerType !== 'all') {
      if (prop.providerType !== filters.providerType) return false;
    }

    if (prop.rent > filters.maxBudget) {
      return false;
    }

    return true;
  });
}

describe('Search & Filter Engine Tests', () => {
  const baseFilters: PropertyFilterState = {
    searchQuery: '',
    locality: 'All Localities',
    city: 'All Cities',
    roomType: 'all',
    maxBudget: 60000,
    furnishing: 'all',
    providerType: 'all',
    genderPreference: 'all',
  };

  it('returns all active properties by default with max budget ceiling of 60k', () => {
    const results = applyFilters(SEED_PROPERTIES, baseFilters);
    expect(results.length).toBe(8);
  });

  it('filters accurately by Gurugram DLF localities', () => {
    const dlfResults = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      locality: 'DLF Phase 4, Gurugram',
    });
    expect(dlfResults.length).toBe(1);
    expect(dlfResults[0].locality).toBe('DLF Phase 4');
  });

  it('filters accurately by South Delhi localities (Hauz Khas, Saket)', () => {
    const saketResults = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      locality: 'Saket, Delhi',
    });
    expect(saketResults.length).toBe(2);
    expect(saketResults.every(p => p.locality === 'Saket')).toBe(true);
  });

  it('filters accurately by Room Type (Entire Flat / 1BHK vs Private Room)', () => {
    const entireFlats = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      roomType: 'entire_flat',
    });
    expect(entireFlats.length).toBe(2);
    expect(entireFlats.every(p => p.roomType === 'entire_flat')).toBe(true);

    const privateRooms = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      roomType: 'private_room',
    });
    expect(privateRooms.length).toBe(5);
    expect(privateRooms.every(p => p.roomType === 'private_room')).toBe(true);
  });

  it('filters accurately by Budget Ceiling', () => {
    const budgetResults = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      maxBudget: 20000,
    });
    expect(budgetResults.length).toBe(4); // prop-3 (14k), prop-4 (18.5k), prop-7 (16.5k), prop-8 (15k)
    expect(budgetResults.every(p => p.rent <= 20000)).toBe(true);
  });

  it('filters accurately by Provider Type (Owner ₹0 fee vs Broker)', () => {
    const ownerOnly = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      providerType: 'owner',
    });
    expect(ownerOnly.length).toBe(6);
    expect(ownerOnly.every(p => p.providerType === 'owner')).toBe(true);
  });

  it('returns an empty array when no listings match restrictive criteria', () => {
    const impossibleResults = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      locality: 'Saket, Delhi',
      maxBudget: 10000, // No Saket listing under 10k
    });
    expect(impossibleResults.length).toBe(0);
  });

  it('filters accurately by keyword search across titles and amenities', () => {
    const balconySearch = applyFilters(SEED_PROPERTIES, {
      ...baseFilters,
      searchQuery: 'balcony',
    });
    expect(balconySearch.length).toBeGreaterThan(0);
    expect(balconySearch[0].title.toLowerCase()).toContain('balcony');
  });
});
