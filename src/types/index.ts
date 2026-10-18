export type PropertyType = 'apartment' | 'builder_floor' | 'villa' | 'gated_society';
export type RoomType = 'private_room' | 'shared_room' | 'entire_flat';
export type ProviderType = 'owner' | 'tenant_flatmate' | 'verified_manager';
export type FurnishingStatus = 'fully_furnished' | 'semi_furnished' | 'unfurnished';
export type GenderPreference = 'any' | 'female_only' | 'male_only';
export type ListingStatus = 'active' | 'pending_review' | 'rented';

export interface Property {
  id: string;
  title: string;
  locality: string;
  city: 'Gurugram' | 'Delhi';
  addressShort: string;
  propertyType: PropertyType;
  roomType: RoomType;
  rent: number;
  deposit: number;
  maintenance: number;
  electricityPerUnit: number; // e.g. 8 for ₹8/unit, 0 if included
  brokerageFee: number; // 0 for owner, or declared amount
  providerType: ProviderType;
  providerName: string;
  providerContact: string;
  furnishing: FurnishingStatus;
  bedrooms: number;
  bathrooms: number;
  availableFrom: string;
  lastVerifiedDate: string; // ISO date string
  images: string[];
  amenities: string[];
  rules: string[];
  genderPreference: GenderPreference;
  status: ListingStatus;
  description: string;
  featured?: boolean;
}

export type FoodHabit = 'Vegetarian' | 'Non-Vegetarian' | 'Eggetarian' | 'Vegan';
export type SleepRoutine = 'Early Bird' | 'Night Owl' | 'Flexible';
export type CleanlinessLevel = 'Spotless' | 'Moderate' | 'Relaxed';

export interface Flatmate {
  id: string;
  name: string;
  age: number;
  occupation: string;
  avatar: string;
  gender: 'female' | 'male' | 'non_binary';
  hasRoom: boolean; // true = has a vacant room, false = looking to team up
  roomDetails?: string;
  targetLocalities: string[];
  budgetMax: number;
  foodHabit: FoodHabit;
  sleepRoutine: SleepRoutine;
  cleanliness: CleanlinessLevel;
  petFriendly: boolean;
  smoking: 'No' | 'Outside Only' | 'Yes';
  bio: string;
  interests: string[];
  verified: boolean;
  postedDate: string;
}

export interface PropertyFilterState {
  searchQuery: string;
  locality: string;
  city: string;
  roomType: string;
  maxBudget: number;
  furnishing: string;
  providerType: string;
  genderPreference: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'renter' | 'owner' | 'broker' | 'admin';
  phone?: string;
  avatar?: string;
}

export interface ListingReport {
  id: string;
  listingId: string;
  listingTitle: string;
  reason: string;
  notes: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface ConnectRequest {
  id: string;
  targetId: string; // property or flatmate id
  targetType: 'property' | 'flatmate';
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  moveInDate: string;
  message: string;
  createdAt: string;
}
