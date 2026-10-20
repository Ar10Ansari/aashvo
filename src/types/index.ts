export type PropertyType = 'apartment' | 'builder_floor' | 'villa' | 'gated_society';
export type RoomType = 'private_room' | 'shared_room' | 'entire_flat';
export type ProviderType = 'owner' | 'tenant_flatmate' | 'verified_manager';
export type FurnishingStatus = 'fully_furnished' | 'semi_furnished' | 'unfurnished';
export type GenderPreference = 'any' | 'female_only' | 'male_only';
export type ListingStatus = 'active' | 'pending_review' | 'rented';
export type ListingCategory = 'flats_rooms' | 'flatmates' | 'family_stays';
export type MealsOffered = 'included' | 'optional_extra' | 'none';
export type DiscoveryTab = 'flatmates' | 'family_stays' | 'entire_flats' | 'places';

export interface Property {
  id: string;
  title: string;
  locality: string;
  city: string; // Nationwide support: Gurugram, Delhi, Bengaluru, Mumbai, Pune, etc.
  state?: string;
  pincode?: string;
  coordinates?: { lat: number; lng: number };
  addressShort: string;
  propertyType: PropertyType;
  roomType: RoomType;
  category?: ListingCategory;
  familyLivesOnProperty?: boolean; // Required true for Family Stays
  mealsOffered?: MealsOffered; // Mandatory declaration for Family Stays
  optionalMealCost?: number; // Monthly cost when mealsOffered === 'optional_extra'
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
  city?: string; // Nationwide support
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
  category?: ListingCategory | 'all';
  roomType: string;
  maxBudget: number;
  furnishing: string;
  providerType: string;
  genderPreference: string;
  mealsOffered?: MealsOffered | 'any';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'renter' | 'owner' | 'broker' | 'admin';
  phone?: string;
  avatar?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  authProvider?: 'google' | 'email';
  accountStatus?: 'active' | 'unverified' | 'suspended';
  bio?: string;
  isDemo?: boolean;
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
  verifiedPhoneAtSubmission?: boolean;
}

export type ActionType =
  | 'browse'
  | 'submit_inquiry'
  | 'send_flatmate_request'
  | 'create_listing'
  | 'create_family_stay';

export interface ProgressiveProfileRequirement {
  canPerform: boolean;
  missingRequirements: string[];
  requiresPhoneVerification: boolean;
  requiresEmailVerification: boolean;
  requiresFamilyDeclaration: boolean;
}

// ============================================================================
// HELP & SUPPORT SYSTEM TYPES
// ============================================================================

export type TicketCategory =
  | 'account_login'
  | 'finding_flatmates'
  | 'rooms_listings'
  | 'family_stays_meals'
  | 'location'
  | 'verification'
  | 'privacy_safety'
  | 'technical_issues'
  | 'billing_fraud'
  | 'other';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TicketStatus =
  | 'open'
  | 'in_review'
  | 'awaiting_user'
  | 'resolved'
  | 'closed';

export interface TicketAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId?: string;
  senderName: string;
  senderRole: 'user' | 'support' | 'admin';
  message: string;
  isInternal: boolean;
  attachments?: TicketAttachment[];
  createdAt: string;
}

export interface TicketAuditEvent {
  id: string;
  ticketId: string;
  actorId?: string;
  actorName: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string; // e.g. ASH-TKT-A8B9C2
  userId?: string; // null for unauthenticated / anonymous users
  userEmail: string;
  userName: string;
  userPhone?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  referenceListingId?: string;
  referenceUserId?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  assignedName?: string;
  attachments: TicketAttachment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  messages: TicketMessage[];
  auditEvents?: TicketAuditEvent[];
}

export type ReportReasonCode =
  | 'scam_fraud'
  | 'misleading_charges'
  | 'unavailable_listing'
  | 'duplicate_fake'
  | 'inappropriate_conduct'
  | 'harassment'
  | 'other';

export type ReportTargetType = 'listing' | 'flatmate' | 'user';

export type ReportPriority = 'normal' | 'high' | 'urgent';

export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

export interface SafetyReport {
  id: string;
  reporterId?: string;
  reporterName?: string;
  reporterEmail?: string;
  targetType: ReportTargetType;
  targetId: string; // property id or flatmate id
  targetTitle: string; // title or person name
  reasonCode: ReportReasonCode;
  reasonLabel: string;
  details: string;
  evidenceUrl?: string;
  priority: ReportPriority;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface FAQItem {
  id: string;
  category: TicketCategory;
  question: string;
  answer: string;
  keywords?: string[];
  helpfulCount?: number;
}
