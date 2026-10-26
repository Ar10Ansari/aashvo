/**
 * Aashvo Data Service Adapter & Supabase Client
 *
 * Implements real Supabase client initialization when valid credentials are provided,
 * with graceful fallback to deterministic local storage during offline development and testing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Property, User, SupportTicket, SafetyReport, Flatmate } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveBackendConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseAnonKey !== 'your-supabase-anon-key-here'
);

// Real typed Supabase client instance (null when unconfigured)
export const supabase: SupabaseClient | null = (isLiveBackendConfigured && supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface BackendStatus {
  isLive: boolean;
  provider: 'Supabase PostgreSQL' | 'Local Deterministic Store';
  region: string;
}

export function getBackendStatus(): BackendStatus {
  return {
    isLive: isLiveBackendConfigured,
    provider: isLiveBackendConfigured ? 'Supabase PostgreSQL' : 'Local Deterministic Store',
    region: 'Pan-India (ap-south-1 Mumbai / Local Store)',
  };
}

/**
 * Checks Supabase connectivity by pinging the backend.
 */
export async function checkSupabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!supabase) {
    return { connected: false, error: 'Supabase client not initialized (missing environment configuration).' };
  }

  const start = performance.now();
  try {
    const { error } = await supabase.from('properties').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return { connected: false, latencyMs, error: error.message };
    }
    return { connected: true, latencyMs };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Unknown connection error' };
  }
}

// ====================================================================
// Database Schema Mappers (PostgreSQL snake_case <-> App camelCase)
// ====================================================================

export function mapSupabasePropertyToApp(row: Record<string, any>): Property {
  return {
    id: row.id,
    title: row.title || 'Untitled Listing',
    description: row.description || '',
    locality: row.locality || '',
    city: row.city || 'Delhi',
    state: row.state || undefined,
    pincode: row.pincode || undefined,
    addressShort: row.address_short || row.locality || '',
    propertyType: row.property_type || 'apartment',
    roomType: row.room_type || 'private_room',
    category: row.category || 'flats_rooms',
    familyLivesOnProperty: Boolean(row.family_lives_on_property),
    mealsOffered: row.meals_offered || 'none',
    optionalMealCost: row.optional_meal_cost !== undefined && row.optional_meal_cost !== null
      ? Number(row.optional_meal_cost)
      : undefined,
    rent: Number(row.rent_amount) || 0,
    deposit: Number(row.deposit_amount) || 0,
    maintenance: Number(row.maintenance_charge) || 0,
    electricityPerUnit: Number(row.electricity_rate_per_unit) || 8.0,
    brokerageFee: Number(row.brokerage_fee) || 0,
    providerType: row.provider_type || 'owner',
    providerName: row.provider_name || 'Verified Owner',
    providerContact: row.provider_contact || '+91 98XXX XXXXX',
    furnishing: row.furnishing || 'fully_furnished',
    bedrooms: Number(row.bedrooms) || 1,
    bathrooms: Number(row.bathrooms) || 1,
    availableFrom: row.available_from || 'Immediately',
    coordinates: row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined
      ? { lat: Number(row.latitude), lng: Number(row.longitude) }
      : undefined,
    lastVerifiedDate: row.last_availability_check || row.last_verified_date || row.created_at || new Date().toISOString(),
    images: Array.isArray(row.images) && row.images.length > 0
      ? row.images
      : ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80'],
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    rules: Array.isArray(row.house_rules) ? row.house_rules : [],
    genderPreference: row.gender_preference || 'any',
    status: row.status || 'active',
    featured: Boolean(row.featured),
  };
}

export function mapAppPropertyToSupabaseInsert(property: Partial<Property>, ownerId: string): Record<string, any> {
  return {
    owner_id: ownerId,
    title: property.title?.trim(),
    description: property.description?.trim(),
    locality: property.locality?.trim(),
    city: property.city?.trim() || 'Delhi',
    state: property.state?.trim() || null,
    pincode: property.pincode?.trim() || null,
    latitude: property.coordinates?.lat ?? null,
    longitude: property.coordinates?.lng ?? null,
    address_short: property.addressShort?.trim() || property.locality?.trim(),
    property_type: property.propertyType || 'apartment',
    room_type: property.roomType || 'private_room',
    category: property.category || 'flats_rooms',
    family_lives_on_property: Boolean(property.familyLivesOnProperty),
    meals_offered: property.mealsOffered || 'none',
    optional_meal_cost: property.optionalMealCost || 0,
    rent_amount: property.rent,
    deposit_amount: property.deposit,
    maintenance_charge: property.maintenance || 0,
    electricity_rate_per_unit: property.electricityPerUnit || 8.0,
    brokerage_fee: property.brokerageFee || 0,
    provider_type: property.providerType || 'owner',
    furnishing: property.furnishing || 'fully_furnished',
    bedrooms: property.bedrooms || 1,
    bathrooms: property.bathrooms || 1,
    available_from: property.availableFrom || 'Immediately',
    amenities: property.amenities || [],
    house_rules: property.rules || [],
    gender_preference: property.genderPreference || 'any',
    status: 'pending_review', // Default to editorial review queue
  };
}

export function mapSupabaseProfileToUser(row: Record<string, any>): User {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name || 'Aashvo Member',
    role: row.role || 'renter',
    avatar: row.avatar_url,
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    phone: row.phone_number,
    identityVerified: Boolean(row.id_verified),
    accountStatus: row.account_status || (row.email_verified ? 'active' : 'unverified'),
  };
}

export function mapSupabaseTicketToApp(row: Record<string, any>): SupportTicket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    userPhone: row.user_phone,
    category: row.category,
    subject: row.subject,
    description: row.description,
    referenceListingId: row.reference_listing_id,
    referenceUserId: row.reference_user_id,
    priority: row.priority || 'normal',
    status: row.status || 'open',
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    messages: [],
    auditEvents: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

export function mapSupabaseReportToApp(row: Record<string, any>): SafetyReport {
  const targetId = row.target_id || row.reported_property_id || row.reported_flatmate_id || row.reported_user_id;
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterEmail: row.reporter_email,
    targetType: row.target_type,
    targetId,
    targetTitle: row.target_title || 'Reported community item',
    reasonCode: row.reason_code,
    reasonLabel: row.reason_code, // enhanced in service layer
    details: row.details,
    evidenceUrl: row.evidence_url,
    priority: row.priority || 'normal',
    status: row.status || 'pending',
    createdAt: row.created_at,
  };
}

export function mapSupabaseFlatmateToApp(row: Record<string, any>): Flatmate {
  const profile = row.profiles || {};
  const displayName = profile.full_name || row.full_name || row.name || 'Aashvo Member';
  const displayAvatar = profile.avatar_url || row.avatar_url || row.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  return {
    id: row.id,
    name: displayName,
    age: Number(row.age) || 22,
    occupation: row.occupation || 'Professional',
    avatar: displayAvatar,
    gender: (row.gender as any) || 'female',
    hasRoom: Boolean(row.has_room),
    roomDetails: row.room_details || undefined,
    targetLocalities: Array.isArray(row.target_localities) ? row.target_localities : ['All Localities'],
    city: row.city || undefined,
    budgetMax: Number(row.budget_max) || 25000,
    foodHabit: (row.food_habit as any) || 'Vegetarian',
    sleepRoutine: (row.sleep_routine as any) || 'Flexible',
    cleanliness: (row.cleanliness as any) || 'Spotless',
    petFriendly: Boolean(row.pet_friendly),
    smoking: (row.smoking as any) || 'No',
    bio: row.bio || '',
    interests: Array.isArray(row.interests) ? row.interests : [],
    verified: Boolean(row.verified),
    postedDate: row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recently',
  };
}

export function mapAppFlatmateToSupabaseInsert(flatmate: Partial<Flatmate>, userId: string): Record<string, any> {
  return {
    user_id: userId,
    occupation: flatmate.occupation?.trim() || 'Professional',
    age: flatmate.age || 22,
    gender: flatmate.gender || 'female',
    has_room: Boolean(flatmate.hasRoom),
    room_details: flatmate.roomDetails?.trim() || null,
    target_localities: flatmate.targetLocalities && flatmate.targetLocalities.length > 0
      ? flatmate.targetLocalities
      : ['All Localities'],
    budget_max: flatmate.budgetMax || 25000,
    food_habit: flatmate.foodHabit || 'Vegetarian',
    sleep_routine: flatmate.sleepRoutine || 'Flexible',
    cleanliness: flatmate.cleanliness || 'Spotless',
    pet_friendly: Boolean(flatmate.petFriendly),
    smoking: flatmate.smoking || 'No',
    bio: flatmate.bio?.trim() || '',
    interests: flatmate.interests || [],
    verified: false, // Must be false for non-admins (enforced by DB trigger)
  };
}
