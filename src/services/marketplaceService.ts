/**
 * Aashvo Nationwide Marketplace & Family Stay Service
 *
 * Implements business logic and validation for:
 * 1. Nationwide listings and free-text searches (cities and localities across India).
 * 2. Three distinct categories: Flats & Rooms, Flatmates, and Family Stays.
 * 3. Family Stay eligibility enforcement (resident families only, meal declarations).
 * 4. Location privacy masking (protecting exact residential addresses).
 * 5. Device location convenience calculations.
 */

import { Property, PropertyFilterState, User, ListingCategory } from '../types';

export interface ListingValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a property listing for publication based on category and provider rules.
 */
export function validateListingSubmission(
  listing: Partial<Property>,
  _hostUser?: User | null
): ListingValidationResult {
  const errors: string[] = [];

  // Basic required fields
  if (!listing.title || listing.title.trim().length < 5) {
    errors.push('Listing title must be at least 5 characters.');
  }

  if (!listing.locality || listing.locality.trim().length === 0) {
    errors.push('Locality is required.');
  }

  if (!listing.city || listing.city.trim().length === 0) {
    errors.push('City is required (supports any Indian city/town).');
  }

  if (listing.rent === undefined || listing.rent <= 0) {
    errors.push('Monthly rent must be a positive number.');
  }

  if (listing.deposit === undefined || listing.deposit < 0) {
    errors.push('Security deposit must be zero or a positive number.');
  }

  if (!listing.providerType) {
    errors.push('Provider type must be declared (owner, tenant_flatmate, or verified_manager).');
  }

  const category: ListingCategory = listing.category || 'flats_rooms';

  // Specific rules for Family Stays
  if (category === 'family_stays') {
    // Rule: Family Stays can ONLY be published by resident owners living in the same home
    if (listing.providerType !== 'owner') {
      errors.push('Family Stays can only be published by direct home owners (commercial managers and brokers are prohibited).');
    }

    if (listing.familyLivesOnProperty !== true) {
      errors.push('Family Stay hosts must declare that their family lives in the same home as the offered room.');
    }

    if (!listing.mealsOffered || !['included', 'optional_extra', 'none'].includes(listing.mealsOffered)) {
      errors.push('Meal availability must be declared (included, optional_extra, or none).');
    }
  }

  // Specific rules for Flats & Rooms with Broker/Manager
  if (listing.providerType === 'verified_manager') {
    if (listing.brokerageFee === undefined || listing.brokerageFee < 0) {
      errors.push('Property managers and brokers must explicitly disclose their brokerage fee (or 0 if free).');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Filters properties across India without relying on hardcoded city/locality lists.
 */
export function filterNationwideProperties(
  properties: Property[],
  filters: Partial<PropertyFilterState>
): Property[] {
  return properties.filter(prop => {
    // Category filter
    if (filters.category && filters.category !== 'all') {
      const propCategory = prop.category || 'flats_rooms';
      if (propCategory !== filters.category) return false;
    }

    // City filter (case-insensitive substring/equality)
    if (filters.city && filters.city.trim() !== '' && filters.city !== 'All Cities') {
      const cityQuery = filters.city.toLowerCase().trim();
      const propCity = prop.city.toLowerCase();
      if (!propCity.includes(cityQuery) && !cityQuery.includes(propCity)) {
        return false;
      }
    }

    // Locality filter (case-insensitive substring)
    if (filters.locality && filters.locality.trim() !== '' && filters.locality !== 'All Localities') {
      const locQuery = filters.locality.toLowerCase().trim();
      const propLoc = prop.locality.toLowerCase();
      if (!propLoc.includes(locQuery)) {
        return false;
      }
    }

    // Free-text search query across title, locality, city, state, description
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const searchHaystack = [
        prop.title,
        prop.locality,
        prop.city,
        prop.state || '',
        prop.description,
        prop.addressShort,
      ]
        .join(' ')
        .toLowerCase();

      if (!searchHaystack.includes(q)) {
        return false;
      }
    }

    // Budget slider ceiling
    if (filters.maxBudget && filters.maxBudget > 0) {
      if (prop.rent > filters.maxBudget) return false;
    }

    // Room type filter
    if (filters.roomType && filters.roomType !== 'all') {
      if (prop.roomType !== filters.roomType) return false;
    }

    // Furnishing status filter
    if (filters.furnishing && filters.furnishing !== 'all') {
      if (prop.furnishing !== filters.furnishing) return false;
    }

    // Provider type filter
    if (filters.providerType && filters.providerType !== 'all') {
      if (prop.providerType !== filters.providerType) return false;
    }

    // Gender preference filter
    if (filters.genderPreference && filters.genderPreference !== 'all') {
      if (prop.genderPreference !== filters.genderPreference && prop.genderPreference !== 'any') {
        return false;
      }
    }

    // Meals offered filter (for Family Stays)
    if (filters.mealsOffered && filters.mealsOffered !== 'any') {
      if (prop.mealsOffered !== filters.mealsOffered) return false;
    }

    return true;
  });
}

/**
 * Converts an exact residential address into a privacy-preserving public display.
 * Exact flat and door numbers are withheld until visit confirmation.
 */
export function maskAddressForPublicView(
  fullAddress: string,
  locality: string,
  city: string,
  landmark?: string
): string {
  // Strip out flat/apartment numbers like "Flat 402", "A-301", "Villa 12", "House #44"
  const sanitized = fullAddress
    .replace(/(?:flat|apt|apartment|house|unit|villa|plot|tower|block)\s*#?\s*[a-z0-9-]+[,\s]*/gi, '')
    .trim();

  const parts: string[] = [];
  if (landmark && landmark.trim().length > 0) {
    parts.push(`Near ${landmark.trim()}`);
  } else if (sanitized.length > 0 && !sanitized.toLowerCase().includes(locality.toLowerCase())) {
    parts.push(sanitized);
  }

  parts.push(locality);
  parts.push(city);

  return parts.filter(Boolean).join(', ');
}

/**
 * Calculates geographic distance in kilometers between two coordinates using the Haversine formula.
 * Used for location-assisted search convenience.
 */
export function calculateGeoDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
