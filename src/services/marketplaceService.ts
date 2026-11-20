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

import { Property, PropertyFilterState, User, ListingCategory, Flatmate, ListingStatus } from '../types';
import { SEED_FLATMATES } from '../data/seedData';
import {
  supabase,
  isLiveBackendConfigured,
  mapSupabasePropertyToApp,
  mapAppPropertyToSupabaseInsert,
  mapSupabaseFlatmateToApp,
  mapAppFlatmateToSupabaseInsert,
} from './supabase';
import { apiClient } from './apiClient';

interface PropertyPhotoRow {
  photo_url?: string;
  sort_order?: number;
}

export interface InterestRequestRow {
  id: string;
  sender_id: string;
  property_id?: string | null;
  flatmate_profile_id?: string | null;
  message: string;
  proposed_move_in_date?: string | null;
  contact_phone?: string | null;
  status: string;
  created_at: string;
}

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

// ====================================================================
// Real Supabase Marketplace Methods
// ====================================================================

/**
 * Fetches active property listings from Supabase PostgreSQL
 */
export interface FetchPropertiesOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'freshness' | 'rent_asc' | 'rent_desc';
}

export async function fetchPropertiesFromSupabase(
  filters?: Partial<PropertyFilterState>,
  options?: FetchPropertiesOptions
): Promise<{ success: boolean; properties?: Property[]; totalCount?: number; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    let query = supabase
      .from('public_properties')
      .select('*', { count: 'exact' })
      .eq('status', 'active');

    // Sorting
    if (options?.sortBy === 'rent_asc') {
      query = query.order('rent_amount', { ascending: true });
    } else if (options?.sortBy === 'rent_desc') {
      query = query.order('rent_amount', { ascending: false });
    } else {
      query = query.order('last_availability_check', { ascending: false, nullsFirst: false });
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters?.roomType && filters.roomType !== 'all') {
      query = query.eq('room_type', filters.roomType);
    }

    if (filters?.maxBudget) {
      query = query.lte('rent_amount', filters.maxBudget);
    }

    if (filters?.city && filters.city.trim() !== '' && filters.city !== 'All Cities') {
      query = query.ilike('city', `%${filters.city.trim()}%`);
    }

    if (filters?.locality && filters.locality.trim() !== '' && filters.locality !== 'All Localities') {
      query = query.ilike('locality', `%${filters.locality.trim()}%`);
    }

    if (filters?.furnishing && filters.furnishing !== 'all') {
      query = query.eq('furnishing', filters.furnishing);
    }

    if (filters?.providerType && filters.providerType !== 'all') {
      query = query.eq('provider_type', filters.providerType);
    }

    if (filters?.genderPreference && filters.genderPreference !== 'all') {
      query = query.in('gender_preference', [filters.genderPreference, 'any']);
    }

    if (filters?.searchQuery && filters.searchQuery.trim() !== '') {
      const search = filters.searchQuery.trim().slice(0, 80).replace(/[(),.*%_]/g, ' ');
      query = query.or([
        `title.ilike.%${search}%`,
        `locality.ilike.%${search}%`,
        `city.ilike.%${search}%`,
        `state.ilike.%${search}%`,
        `description.ilike.%${search}%`,
      ].join(','));
    }

    if (filters?.mealsOffered && filters.mealsOffered !== 'any') {
      query = query.eq('meals_offered', filters.mealsOffered);
    }

    // Pagination
    if (options?.page && options?.pageSize && options.pageSize > 0) {
      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    const properties = (data || []).map(mapSupabasePropertyToApp);
    return { success: true, properties, totalCount: count ?? properties.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch properties' };
  }
}

/**
 * Creates and persists a property listing in Supabase with strict validation
 */
export async function createPropertyInSupabase(
  property: Partial<Property>,
  hostUser: User
): Promise<{ success: boolean; property?: Property; errors?: string[] }> {
  const validation = validateListingSubmission(property, hostUser);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      const dbRow = mapAppPropertyToSupabaseInsert(property, hostUser.id);
      const { data, error } = await supabase
        .from('properties')
        .insert(dbRow)
        .select()
        .single();

      if (error) {
        return { success: false, errors: [error.message] };
      }

      if (data) {
        const imageUrls = (property.images || []).filter(Boolean);
        if (imageUrls.length > 0) {
          const { error: photoError } = await supabase
            .from('property_photos')
            .insert(imageUrls.map((photoUrl, index) => ({
              property_id: data.id,
              photo_url: photoUrl,
              sort_order: index,
              is_primary: index === 0,
            })));

          if (photoError) {
            await supabase.from('properties').delete().eq('id', data.id).eq('owner_id', hostUser.id);
            return { success: false, errors: [`Listing photo persistence failed: ${photoError.message}`] };
          }
        }

        return { success: true, property: mapSupabasePropertyToApp({ ...data, images: imageUrls }) };
      }
    } catch (err) {
      return { success: false, errors: [err instanceof Error ? err.message : 'Database insertion error'] };
    }
  }

  // Local deterministic fallback
  if (import.meta.env.PROD) {
    return { success: false, errors: ['Live database is unconfigured. Cannot publish listing in production.'] };
  }

  const mockCreated: Property = {
    ...property as Property,
    id: `prop-${Date.now()}`,
    status: 'pending_review',
    lastVerifiedDate: new Date().toISOString(),
    images: property.images || ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80'],
  };

  return { success: true, property: mockCreated };
}

/**
 * Fetches a single property by ID from Supabase
 */
export async function fetchPropertyByIdFromSupabase(
  id: string
): Promise<{ success: boolean; property?: Property; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('public_properties')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Property not found' };
      return { success: true, property: mapSupabasePropertyToApp(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch property' };
    }
  }

  return { success: false, error: 'Live backend unconfigured' };
}

/**
 * Updates an existing property listing in Supabase (owner-only under RLS)
 */
export async function updatePropertyInSupabase(
  propertyId: string,
  updates: Partial<Property>,
  owner: User
): Promise<{ success: boolean; property?: Property; errors?: string[] }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const dbRow: Record<string, any> = {};
      if (updates.title !== undefined) dbRow.title = updates.title.trim();
      if (updates.description !== undefined) dbRow.description = updates.description.trim();
      if (updates.locality !== undefined) dbRow.locality = updates.locality.trim();
      if (updates.city !== undefined) dbRow.city = updates.city.trim();
      if (updates.rent !== undefined) dbRow.rent_amount = updates.rent;
      if (updates.deposit !== undefined) dbRow.deposit_amount = updates.deposit;
      if (updates.maintenance !== undefined) dbRow.maintenance_charge = updates.maintenance;
      if (updates.furnishing !== undefined) dbRow.furnishing = updates.furnishing;
      if (updates.coordinates !== undefined) {
        dbRow.latitude = updates.coordinates?.lat ?? null;
        dbRow.longitude = updates.coordinates?.lng ?? null;
      }
      if (updates.status !== undefined) dbRow.status = updates.status;

      const { data, error } = await supabase
        .from('properties')
        .update(dbRow)
        .eq('id', propertyId)
        .eq('owner_id', owner.id)
        .select()
        .single();

      if (error) return { success: false, errors: [error.message] };
      if (data) return { success: true, property: mapSupabasePropertyToApp(data) };
      return { success: false, errors: ['Listing not found or update unauthorized under RLS.'] };
    } catch (err) {
      return { success: false, errors: [err instanceof Error ? err.message : 'Update failed'] };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, errors: ['Live database is unconfigured. Cannot update listing in production.'] };
  }

  return { success: true, property: { ...updates, id: propertyId } as Property };
}

/**
 * Deletes a property listing in Supabase (owner-only under RLS)
 */
export async function deletePropertyInSupabase(
  propertyId: string,
  owner: User
): Promise<{ success: boolean; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId)
        .eq('owner_id', owner.id)
        .select();

      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Listing not found or deletion unauthorized under RLS.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Deletion failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Live database is unconfigured. Cannot delete listing in production.' };
  }

  return { success: true };
}

/**
 * Fetches all properties owned by a specific host (including pending_review listings)
 */
export async function fetchOwnerPropertiesFromSupabase(
  ownerId: string
): Promise<{ success: boolean; properties?: Property[]; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, property_photos(photo_url, sort_order)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      const mapped = (data || []).map((row: Record<string, any>) => {
        const photos = Array.isArray(row.property_photos)
          ? [...row.property_photos]
              .sort((a: PropertyPhotoRow, b: PropertyPhotoRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((p: PropertyPhotoRow) => p.photo_url)
              .filter(Boolean)
          : [];
        return mapSupabasePropertyToApp({ ...row, images: photos });
      });
      return { success: true, properties: mapped };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch owner properties' };
    }
  }

  return { success: true, properties: [] };
}

/**
 * Fetches all properties (all moderation statuses) for verified staff administrators under RLS.
 */
export async function fetchAllPropertiesForAdminFromSupabase(): Promise<{
  success: boolean;
  properties?: Property[];
  error?: string;
}> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_photos(photo_url, sort_order), profiles:owner_id(full_name)')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    const mapped = (data || []).map((row: Record<string, any>) => {
      const photos = Array.isArray(row.property_photos)
        ? [...row.property_photos]
            .sort((a: PropertyPhotoRow, b: PropertyPhotoRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((p: PropertyPhotoRow) => p.photo_url)
            .filter(Boolean)
        : [];
      return mapSupabasePropertyToApp({
        ...row,
        provider_name: row.profiles?.full_name || row.provider_name,
        images: photos,
      });
    });

    return { success: true, properties: mapped };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch admin properties' };
  }
}

/**
 * Submits an inquiry / interest request to Supabase (stored in public.interest_requests)
 * Supports both property listings (property_id) and flatmate connect requests (target_flatmate_id)
 */
export interface SubmitInquiryParams {
  listingId?: string;
  targetFlatmateId?: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  moveInDate?: string;
}

export async function submitInquiryInSupabase(
  inquiry: SubmitInquiryParams
): Promise<{ success: boolean; inquiryId?: string; error?: string }> {
  if (!inquiry.listingId && !inquiry.targetFlatmateId) {
    return { success: false, error: 'Inquiry must target either a property listing or a flatmate profile.' };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      const payload: Record<string, any> = {
        sender_id: inquiry.senderId,
        sender_name: inquiry.senderName.trim(),
        sender_email: inquiry.senderEmail.trim(),
        sender_phone: inquiry.senderPhone?.trim() || '',
        move_in_date: inquiry.moveInDate?.trim() || 'Immediately',
        message: inquiry.message.trim(),
        status: 'pending',
      };

      if (inquiry.listingId) {
        payload.property_id = inquiry.listingId;
      }
      if (inquiry.targetFlatmateId) {
        payload.target_flatmate_id = inquiry.targetFlatmateId;
      }

      const { data, error } = await supabase
        .from('interest_requests')
        .insert(payload)
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, inquiryId: data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Inquiry submission failed' };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, error: 'Live database is unconfigured. Cannot submit inquiry in production.' };
  }

  return { success: true, inquiryId: `inq-${Date.now()}` };
}

/**
 * Fetches inquiries for a property (authorized for property owner under RLS)
 */
export async function fetchInquiriesForProperty(
  propertyId: string
): Promise<{ success: boolean; inquiries?: InterestRequestRow[]; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('interest_requests')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, inquiries: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch inquiries' };
    }
  }

  return { success: true, inquiries: [] };
}

/**
 * Fetches inquiries received by a targeted flatmate (authorized under RLS)
 */
export async function fetchInquiriesForFlatmate(
  flatmateProfileId: string
): Promise<{ success: boolean; inquiries?: InterestRequestRow[]; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('interest_requests')
        .select('*')
        .eq('target_flatmate_id', flatmateProfileId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, inquiries: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch flatmate inquiries' };
    }
  }

  return { success: true, inquiries: [] };
}

// ====================================================================
// FLATMATE PROFILES & COMPATIBILITY ENGINE
// ====================================================================

/**
 * Fetches flatmate discovery profiles from Supabase PostgreSQL
 */
export async function fetchFlatmatesFromSupabase(): Promise<{
  success: boolean;
  flatmates: Flatmate[];
  error?: string;
}> {
  if (isLiveBackendConfigured && supabase) {
    try {
      // First attempt query on public_flatmates view which safely joins public_profiles
      const { data: viewData, error: viewError } = await supabase
        .from('public_flatmates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!viewError && viewData && viewData.length > 0) {
        return { success: true, flatmates: viewData.map(mapSupabaseFlatmateToApp) };
      }

      if (!viewError) {
        return { success: true, flatmates: [] };
      }

      // Never fall back to the private base table: its least-privilege RLS is
      // intentionally incompatible with public discovery.
      return { success: false, flatmates: [], error: viewError?.message || 'Public flatmate discovery is unavailable.' };
    } catch (err) {
      return { success: false, flatmates: [], error: err instanceof Error ? err.message : 'Failed to fetch flatmates' };
    }
  }

  const isTestEnv =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
  if (isTestEnv) {
    return { success: true, flatmates: SEED_FLATMATES };
  }

  return { success: true, flatmates: [] };
}

/**
 * Fetches the authenticated user's own flatmate profile from public.flatmate_profiles under RLS.
 */
export async function fetchMyFlatmateProfileFromSupabase(
  userId: string
): Promise<{ success: boolean; flatmate?: Flatmate | null; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: false, error: 'Live backend unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('flatmate_profiles')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role,
          id_verified,
          phone_verified
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, flatmate: data ? mapSupabaseFlatmateToApp(data) : null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch flatmate profile' };
  }
}

/**
 * Creates or updates a flatmate discovery profile in Supabase
 */
export async function upsertFlatmateProfileInSupabase(
  flatmateData: Partial<Flatmate>,
  user: User
): Promise<{ success: boolean; flatmate?: Flatmate; errors?: string[] }> {
  const errors: string[] = [];
  if (!flatmateData.occupation || flatmateData.occupation.trim().length === 0) {
    errors.push('Occupation is required.');
  }
  if (!flatmateData.age || flatmateData.age < 18) {
    errors.push('Age must be at least 18.');
  }
  if (!flatmateData.budgetMax || flatmateData.budgetMax <= 0) {
    errors.push('Maximum monthly budget must be a positive number.');
  }
  if (!flatmateData.targetLocalities || flatmateData.targetLocalities.length === 0) {
    errors.push('At least one target locality is required.');
  }
  if (!flatmateData.bio || flatmateData.bio.trim().length < 10) {
    errors.push('Bio must be at least 10 characters.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      const dbRow = mapAppFlatmateToSupabaseInsert(flatmateData, user.id);
      const { data, error } = await supabase
        .from('flatmate_profiles')
        .upsert(dbRow, { onConflict: 'user_id' })
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            role,
            id_verified,
            phone_verified
          )
        `)
        .single();

      if (error) return { success: false, errors: [error.message] };
      if (data) return { success: true, flatmate: mapSupabaseFlatmateToApp(data) };
    } catch (err) {
      return { success: false, errors: [err instanceof Error ? err.message : 'Database error'] };
    }
  }

  if (import.meta.env.PROD) {
    return { success: false, errors: ['Live database is unconfigured. Cannot save flatmate profile in production.'] };
  }

  return {
    success: true,
    flatmate: {
      id: `flt-${Date.now()}`,
      name: user.name,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      age: flatmateData.age || 23,
      occupation: flatmateData.occupation || 'Professional',
      gender: flatmateData.gender || 'female',
      hasRoom: Boolean(flatmateData.hasRoom),
      roomDetails: flatmateData.roomDetails,
      targetLocalities: flatmateData.targetLocalities || ['All Localities'],
      city: flatmateData.city,
      budgetMax: flatmateData.budgetMax || 25000,
      foodHabit: flatmateData.foodHabit || 'Vegetarian',
      sleepRoutine: flatmateData.sleepRoutine || 'Flexible',
      cleanliness: flatmateData.cleanliness || 'Spotless',
      petFriendly: Boolean(flatmateData.petFriendly),
      smoking: flatmateData.smoking || 'No',
      bio: flatmateData.bio || '',
      interests: flatmateData.interests || [],
      verified: false,
      postedDate: 'Today',
    },
  };
}

/**
 * Transparent rule-based 6-dimensional flatmate compatibility scoring
 * Explains exactly which dimensions match and which diverge (zero black-box AI)
 */
export interface FlatmateCompatibilityResult {
  score: number; // 0 - 100
  matchLevel: 'High' | 'Good' | 'Moderate';
  matchedFactors: string[];
  divergentFactors: string[];
}

export function calculateFlatmateCompatibility(
  userPref: Partial<Flatmate>,
  target: Flatmate
): FlatmateCompatibilityResult {
  let matchedWeight = 0;
  let totalWeight = 0;
  const matchedFactors: string[] = [];
  const divergentFactors: string[] = [];

  // Safe normalization of user inputs
  const safePref = userPref || {};

  // 1. Food Habit / Diet Match (Weight: 20)
  totalWeight += 20;
  if (!safePref.foodHabit || safePref.foodHabit === target.foodHabit) {
    matchedWeight += 20;
    matchedFactors.push(`Shared diet preference (${target.foodHabit})`);
  } else if (
    (safePref.foodHabit === 'Eggetarian' && target.foodHabit === 'Vegetarian') ||
    (safePref.foodHabit === 'Vegetarian' && target.foodHabit === 'Eggetarian')
  ) {
    matchedWeight += 13;
    matchedFactors.push('Compatible vegetarian-friendly dietary preferences');
  } else {
    divergentFactors.push(`Diet: You prefer ${safePref.foodHabit}, flatmate is ${target.foodHabit}`);
  }

  // 2. Sleep Routine (Weight: 20)
  totalWeight += 20;
  if (!safePref.sleepRoutine || safePref.sleepRoutine === target.sleepRoutine || target.sleepRoutine === 'Flexible' || safePref.sleepRoutine === 'Flexible') {
    matchedWeight += 20;
    matchedFactors.push(`Compatible sleep schedule (${target.sleepRoutine})`);
  } else {
    divergentFactors.push(`Schedule: You are ${safePref.sleepRoutine}, flatmate is ${target.sleepRoutine}`);
  }

  // 3. Cleanliness Standards (Weight: 15)
  totalWeight += 15;
  if (!safePref.cleanliness || safePref.cleanliness === target.cleanliness) {
    matchedWeight += 15;
    matchedFactors.push(`Identical cleanliness expectation (${target.cleanliness})`);
  } else if (
    (safePref.cleanliness === 'Moderate' && target.cleanliness === 'Spotless') ||
    (safePref.cleanliness === 'Spotless' && target.cleanliness === 'Moderate')
  ) {
    matchedWeight += 10;
    matchedFactors.push('Close cleanliness standard alignment');
  } else {
    divergentFactors.push(`Cleanliness: You prefer ${safePref.cleanliness}, flatmate is ${target.cleanliness}`);
  }

  // 4. Pet Compatibility (Weight: 15)
  totalWeight += 15;
  if (safePref.petFriendly === undefined || safePref.petFriendly === target.petFriendly) {
    matchedWeight += 15;
    matchedFactors.push(target.petFriendly ? 'Both pet-friendly' : 'Both prefer pet-free living');
  } else {
    divergentFactors.push(`Pets: ${target.petFriendly ? 'Flatmate loves pets' : 'Flatmate prefers no pets'}`);
  }

  // 5. Smoking Policy (Weight: 15)
  totalWeight += 15;
  if (!safePref.smoking || safePref.smoking === target.smoking) {
    matchedWeight += 15;
    matchedFactors.push(`Aligned smoking policy (${target.smoking})`);
  } else if (target.smoking === 'No' && safePref.smoking !== 'No') {
    divergentFactors.push('Strictly non-smoking living environment');
  } else {
    matchedWeight += 8;
    divergentFactors.push(`Smoking: ${target.smoking}`);
  }

  // 6. Budget Compatibility (Weight: 15)
  totalWeight += 15;
  const userBudget = typeof safePref.budgetMax === 'number' && Number.isFinite(safePref.budgetMax) && safePref.budgetMax > 0
    ? safePref.budgetMax
    : null;
  const targetBudget = typeof target.budgetMax === 'number' && Number.isFinite(target.budgetMax) && target.budgetMax > 0
    ? target.budgetMax
    : null;

  if (!userBudget || !targetBudget) {
    // Missing or flexible budget preference: treat as neutral flexible match
    matchedWeight += 15;
    matchedFactors.push('Flexible budget alignment');
  } else {
    const diffRatio = Math.abs(userBudget - targetBudget) / Math.max(userBudget, targetBudget);
    if (diffRatio <= 0.20) {
      matchedWeight += 15;
      matchedFactors.push(`Aligned budget expectations (₹${userBudget.toLocaleString('en-IN')} / ₹${targetBudget.toLocaleString('en-IN')})`);
    } else if (diffRatio <= 0.35) {
      matchedWeight += 10;
      matchedFactors.push('Compatible budget bandwidth');
    } else {
      divergentFactors.push(`Budget: You budgeted max ₹${userBudget.toLocaleString('en-IN')}, flatmate is ₹${targetBudget.toLocaleString('en-IN')}`);
    }
  }

  const score = totalWeight > 0 ? Math.min(100, Math.max(0, Math.round((matchedWeight / totalWeight) * 100))) : 100;
  let matchLevel: 'High' | 'Good' | 'Moderate' = 'Moderate';
  if (score >= 80) matchLevel = 'High';
  else if (score >= 60) matchLevel = 'Good';

  return {
    score,
    matchLevel,
    matchedFactors,
    divergentFactors,
  };
}

/**
 * Updates a listing moderation status in Supabase (admin only under RLS)
 */
export async function updateListingStatusInSupabase(
  propertyId: string,
  status: ListingStatus
): Promise<{ success: boolean; error?: string }> {
  if (!isLiveBackendConfigured || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('properties')
      .update({
        status,
        last_availability_check: new Date().toISOString(),
      })
      .eq('id', propertyId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Status update failed' };
  }
}

// ============================================================================
// INDEPENDENT NESTJS BACKEND INTEGRATION (/api/v1)
// ============================================================================

export function mapBackendPropertyToApp(item: any): Property {
  return {
    id: item.id,
    title: item.title,
    locality: item.locality,
    city: item.city,
    state: item.state,
    pincode: item.pincode,
    addressShort: item.addressShort || `${item.locality}, ${item.city}`,
    propertyType: item.propertyType || 'apartment',
    roomType: item.roomType || 'private_room',
    category: item.category || 'flats_rooms',
    familyLivesOnProperty: Boolean(item.familyLivesOnProperty),
    mealsOffered: item.mealsOffered || 'none',
    optionalMealCost: item.optionalMealCost ? Number(item.optionalMealCost) : undefined,
    rent: Number(item.rentAmount || 0),
    deposit: Number(item.depositAmount || 0),
    maintenance: Number(item.maintenanceCharge || 0),
    electricityPerUnit: item.electricityRatePerUnit ? Number(item.electricityRatePerUnit) : 8,
    brokerageFee: Number(item.brokerageFee || 0),
    providerType: item.providerType || 'owner',
    providerName: 'Verified Host',
    providerContact: 'Verified via Aashvo',
    furnishing: item.furnishing || 'semi_furnished',
    bedrooms: Number(item.bedrooms || 1),
    bathrooms: Number(item.bathrooms || 1),
    availableFrom: item.availableFrom || 'Immediately',
    lastVerifiedDate: item.createdAt || new Date().toISOString(),
    images: item.primaryPhotoUrl ? [item.primaryPhotoUrl] : [],
    amenities: item.amenities || [],
    rules: item.houseRules || [],
    genderPreference: item.genderPreference || 'any',
    status: item.status || 'active',
    description: item.description || item.title,
    featured: Boolean(item.featured),
  };
}

export function mapBackendFlatmateToApp(item: any): Flatmate {
  return {
    id: item.id,
    name: item.user?.fullName || 'Verified Flatmate',
    age: Number(item.age || 22),
    occupation: item.occupation || 'Professional',
    avatar: item.user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    gender: item.gender?.toLowerCase() === 'female' ? 'female' : 'male',
    hasRoom: Boolean(item.hasRoom),
    roomDetails: item.roomDetails || undefined,
    targetLocalities: item.targetLocalities || [],
    city: item.city || 'Delhi NCR',
    budgetMax: Number(item.budgetMax || 20000),
    foodHabit: item.foodHabit || 'Vegetarian',
    sleepRoutine: item.sleepRoutine || 'Flexible',
    cleanliness: item.cleanliness || 'Spotless',
    petFriendly: Boolean(item.petFriendly),
    smoking: item.smoking === 'Non-smoker' || item.smoking === 'No' ? 'No' : 'Yes',
    bio: item.bio || '',
    interests: item.interests || [],
    verified: Boolean(item.verified || item.user?.idVerified),
    postedDate: item.createdAt || new Date().toISOString(),
  };
}

export async function fetchPropertiesFromBackend(
  filters?: PropertyFilterState,
  options?: { page?: number; pageSize?: number }
): Promise<{ success: boolean; properties?: Property[]; totalCount?: number; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.city && filters.city !== 'All Cities') params.append('city', filters.city);
    if (filters?.locality && filters.locality !== 'All Localities') params.append('locality', filters.locality);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.roomType && filters.roomType !== 'all') params.append('roomType', filters.roomType);
    if (filters?.maxBudget) params.append('maxRent', filters.maxBudget.toString());
    if (filters?.furnishing && filters.furnishing !== 'all') params.append('furnishing', filters.furnishing);
    if (filters?.genderPreference && filters.genderPreference !== 'all') params.append('genderPreference', filters.genderPreference);
    if (filters?.mealsOffered && filters.mealsOffered !== 'any') params.append('mealsOffered', filters.mealsOffered);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('limit', options.pageSize.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ data: any[]; pagination: { total: number } }>(`/properties${qs}`);
    const properties = (res.data || []).map(mapBackendPropertyToApp);
    return { success: true, properties, totalCount: res.pagination?.total ?? properties.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch properties from backend';
    return { success: false, error: message };
  }
}

export async function fetchFlatmatesFromBackend(
  query?: { city?: string; locality?: string; gender?: string; maxBudget?: number; page?: number; limit?: number }
): Promise<{ success: boolean; flatmates: Flatmate[]; totalCount?: number; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (query?.city && query.city !== 'All Cities') params.append('city', query.city);
    if (query?.locality && query.locality !== 'All Localities') params.append('locality', query.locality);
    if (query?.gender && query.gender !== 'all') params.append('gender', query.gender);
    if (query?.maxBudget) params.append('maxBudget', query.maxBudget.toString());
    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('limit', query.limit.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ data: any[]; pagination: { total: number } }>(`/flatmates${qs}`);
    const flatmates = (res.data || []).map(mapBackendFlatmateToApp);
    return { success: true, flatmates, totalCount: res.pagination?.total ?? flatmates.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch flatmates from backend';
    return { success: false, flatmates: [], error: message };
  }
}

export async function fetchFamilyStaysFromBackend(
  filters?: PropertyFilterState,
  options?: { page?: number; pageSize?: number }
): Promise<{ success: boolean; familyStays: Property[]; totalCount?: number; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.city && filters.city !== 'All Cities') params.append('city', filters.city);
    if (filters?.mealsOffered && filters.mealsOffered !== 'any') params.append('mealsOffered', filters.mealsOffered);
    if (filters?.maxBudget) params.append('maxRent', filters.maxBudget.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('limit', options.pageSize.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ data: any[]; pagination: { total: number } }>(`/family-stays${qs}`);
    const familyStays = (res.data || []).map(mapBackendPropertyToApp);
    return { success: true, familyStays, totalCount: res.pagination?.total ?? familyStays.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch family stays from backend';
    return { success: false, familyStays: [], error: message };
  }
}

export async function createPropertyInBackend(
  property: Partial<Property>,
  options?: { asDraft?: boolean }
): Promise<{ success: boolean; property?: Property; errors?: string[] }> {
  try {
    const rawImages = (property.images || []).filter((url) => typeof url === 'string' && url.trim().length > 0);
    const validPhotos = rawImages.length > 0
      ? rawImages.map((url, idx) => ({ photoUrl: url, isPrimary: idx === 0, sortOrder: idx }))
      : [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }];

    const payload = {
      title: property.title,
      description: property.description || `Spacious and comfortable accommodation in ${property.locality || 'a prime neighborhood'}, ${property.city || 'Delhi NCR'}.`,
      category: property.category || 'flats_rooms',
      propertyType: property.propertyType || 'apartment',
      roomType: property.roomType || 'private_room',
      furnishing: property.furnishing || 'semi_furnished',
      locality: property.locality,
      city: property.city,
      state: property.state || 'Delhi NCR',
      pincode: property.pincode || null,
      addressShort: property.addressShort || `${property.locality}, ${property.city}`,
      rentAmount: property.rent || 0,
      depositAmount: property.deposit || 0,
      maintenanceCharge: property.maintenance || 0,
      electricityRatePerUnit: property.electricityPerUnit || null,
      brokerageFee: property.brokerageFee || 0,
      providerType: property.providerType || 'owner',
      genderPreference: property.genderPreference || 'any',
      bedrooms: property.bedrooms || 1,
      bathrooms: property.bathrooms || 1,
      availableFrom: property.availableFrom || 'Immediately',
      amenities: property.amenities || [],
      houseRules: property.rules || [],
      familyLivesOnProperty: Boolean(property.familyLivesOnProperty),
      mealsOffered: property.mealsOffered || 'none',
      optionalMealCost: property.optionalMealCost || null,
      photoUrls: validPhotos,
      asDraft: Boolean(options?.asDraft || property.status === 'paused'),
    };

    const created = await apiClient.post<any>('/properties', payload);
    return { success: true, property: mapBackendPropertyToApp(created) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Property creation failed';
    return { success: false, errors: [message] };
  }
}

export async function updatePropertyInBackend(
  propertyId: string,
  dto: Record<string, any>
): Promise<{ success: boolean; property?: Property; error?: string }> {
  try {
    const updated = await apiClient.patch<any>(`/properties/${encodeURIComponent(propertyId)}`, dto);
    return { success: true, property: mapBackendPropertyToApp(updated) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Property update failed';
    return { success: false, error: message };
  }
}

export async function deletePropertyInBackend(
  propertyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(`/properties/${encodeURIComponent(propertyId)}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Property deletion failed';
    return { success: false, error: message };
  }
}

export async function fetchMyPropertiesFromBackend(): Promise<{ success: boolean; properties?: Property[]; error?: string }> {
  try {
    const res = await apiClient.get<any[]>('/properties/mine');
    const properties = (res || []).map(mapBackendPropertyToApp);
    return { success: true, properties };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch owner properties';
    return { success: false, error: message };
  }
}

export async function moderatePropertyInBackend(
  propertyId: string,
  status: 'active' | 'rejected' | 'paused',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch(`/properties/${propertyId}/moderate`, { status, reason });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Moderation failed';
    return { success: false, error: message };
  }
}

export async function sendInquiryToBackend(params: {
  targetId: string;
  targetType: 'property' | 'flatmate';
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  message: string;
  moveInDate?: string;
}): Promise<{ success: boolean; inquiry?: any; error?: string }> {
  try {
    const payload = {
      propertyId: params.targetType === 'property' ? params.targetId : undefined,
      targetFlatmateId: params.targetType === 'flatmate' ? params.targetId : undefined,
      senderName: params.senderName.trim(),
      senderPhone: params.senderPhone.trim(),
      senderEmail: params.senderEmail.trim().toLowerCase(),
      moveInDate: params.moveInDate?.trim() || undefined,
      message: params.message.trim(),
    };
    const res = await apiClient.post<any>('/inquiries', payload);
    return { success: true, inquiry: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit inquiry';
    return { success: false, error: message };
  }
}

export async function fetchSentInquiriesFromBackend(): Promise<{ success: boolean; inquiries?: any[]; error?: string }> {
  try {
    const res = await apiClient.get<any[]>('/inquiries/sent');
    return { success: true, inquiries: res || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sent inquiries';
    return { success: false, error: message };
  }
}

export async function fetchReceivedInquiriesFromBackend(): Promise<{ success: boolean; inquiries?: any[]; error?: string }> {
  try {
    const res = await apiClient.get<any[]>('/inquiries/received');
    return { success: true, inquiries: res || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch received inquiries';
    return { success: false, error: message };
  }
}

export async function updateInquiryStatusInBackend(
  inquiryId: string,
  status: 'accepted' | 'declined'
): Promise<{ success: boolean; inquiry?: any; error?: string }> {
  try {
    const res = await apiClient.patch<any>(`/inquiries/${encodeURIComponent(inquiryId)}/status`, { status });
    return { success: true, inquiry: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update inquiry status';
    return { success: false, error: message };
  }
}

export async function submitPropertyVerification(
  propertyId: string,
  input: {
    documentType: string;
    documentUrl: string;
    ownershipType?: string;
    notes?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await apiClient.post(`/properties/${propertyId}/verification`, input);
    return { success: true, data: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit verification';
    return { success: false, error: message };
  }
}

export async function getPropertyVerification(
  propertyId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await apiClient.get(`/properties/${propertyId}/verification`);
    return { success: true, data: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get verification';
    return { success: false, error: message };
  }
}

export async function reviewPropertyVerification(
  propertyId: string,
  input: {
    status: 'verified' | 'rejected' | 'pending';
    reviewNotes?: string;
    rejectionReason?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await apiClient.patch(`/properties/${propertyId}/verification/review`, input);
    return { success: true, data: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to review verification';
    return { success: false, error: message };
  }
}

export async function getLandmarks(
  city?: string,
  lat?: number,
  lng?: number,
  radiusKm = 10
): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (lat !== undefined && lng !== undefined) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
      params.append('radiusKm', String(radiusKm));
    }
    return await apiClient.get<any[]>(`/locations/landmarks?${params.toString()}`);
  } catch {
    return [];
  }
}
