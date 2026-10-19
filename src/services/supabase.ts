/**
 * Aashvo Data Service Adapter & Supabase Client
 *
 * Implements real Supabase client initialization when valid credentials are provided,
 * with graceful fallback to deterministic local storage during offline development and testing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Property, User, SupportTicket, SafetyReport } from '../types';

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
    optionalMealCost: row.optional_meal_cost ? Number(row.optional_meal_cost) : undefined,
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
    lastVerifiedDate: row.last_verified_date || row.created_at || new Date().toISOString(),
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
    images: property.images || [],
  };
}

export function mapSupabaseProfileToUser(row: Record<string, any>): User {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name || 'Aashvo Member',
    role: row.role || 'renter',
    avatar: row.avatar_url,
    phoneVerified: Boolean(row.phone_verified),
    phone: row.phone_number,
    identityVerified: Boolean(row.id_verified),
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
    attachments: [],
    messages: [],
    auditEvents: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

export function mapSupabaseReportToApp(row: Record<string, any>): SafetyReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterEmail: row.reporter_email,
    targetType: row.target_type,
    targetId: row.target_id,
    targetTitle: row.target_title,
    reasonCode: row.reason_code,
    reasonLabel: row.reason_code, // enhanced in service layer
    details: row.details,
    evidenceUrl: row.evidence_url,
    priority: row.priority || 'normal',
    status: row.status || 'pending',
    createdAt: row.created_at,
  };
}
