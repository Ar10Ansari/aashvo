export const USER_ROLES = ['renter', 'owner', 'broker', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended', 'deleted_pending'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PROPERTY_CATEGORIES = ['flats_rooms', 'family_stays'] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const PROPERTY_TYPES = ['apartment', 'builder_floor', 'villa', 'gated_society'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const ROOM_TYPES = ['private_room', 'shared_room', 'entire_flat'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const PROVIDER_TYPES = ['owner', 'tenant_flatmate', 'verified_manager'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const FURNISHING_STATUSES = ['fully_furnished', 'semi_furnished', 'unfurnished'] as const;
export type FurnishingStatus = (typeof FURNISHING_STATUSES)[number];

export const GENDER_PREFERENCES = ['any', 'female_only', 'male_only'] as const;
export type GenderPreference = (typeof GENDER_PREFERENCES)[number];

export const MODERATION_STATUSES = ['pending_review', 'active', 'paused', 'rented', 'rejected'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MEALS_OFFERED = ['included', 'optional_extra', 'none'] as const;
export type MealsOffered = (typeof MEALS_OFFERED)[number];

export const FOOD_HABITS = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'] as const;
export type FoodHabit = (typeof FOOD_HABITS)[number];

export const SLEEP_ROUTINES = ['Early Bird', 'Night Owl', 'Flexible'] as const;
export type SleepRoutine = (typeof SLEEP_ROUTINES)[number];

export const CLEANLINESS_LEVELS = ['Spotless', 'Moderate', 'Relaxed'] as const;
export type CleanlinessLevel = (typeof CLEANLINESS_LEVELS)[number];

export const INQUIRY_STATUSES = ['pending', 'accepted', 'declined'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const TICKET_STATUSES = ['open', 'in_review', 'awaiting_user', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SENDER_ROLES = ['user', 'support', 'admin'] as const;
export type TicketSenderRole = (typeof TICKET_SENDER_ROLES)[number];

export const SAFETY_TARGET_TYPES = ['listing', 'flatmate', 'user'] as const;
export type SafetyTargetType = (typeof SAFETY_TARGET_TYPES)[number];

export const SAFETY_REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'dismissed'] as const;
export type SafetyReportStatus = (typeof SAFETY_REPORT_STATUSES)[number];

export const AGREEMENT_STATUSES = ['draft', 'active', 'terminated', 'expired'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const PAYMENT_CATEGORIES = ['monthly_rent', 'security_deposit', 'maintenance', 'utility'] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const PAYMENT_VERIFICATION_STATUSES = [
  'pending_confirmation',
  'confirmed_by_landlord',
  'disputed',
] as const;
export type PaymentVerificationStatus = (typeof PAYMENT_VERIFICATION_STATUSES)[number];

export const INSPECTION_TYPES = ['move_in', 'periodic', 'move_out'] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const TENANCY_REVIEWER_ROLES = ['landlord', 'tenant'] as const;
export type TenancyReviewerRole = (typeof TENANCY_REVIEWER_ROLES)[number];

export const REVIEW_MODERATION_STATUSES = ['approved', 'flagged', 'hidden'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const DISPUTE_TYPES = [
  'deposit_deduction',
  'unpaid_rent',
  'maintenance_responsibility',
  'early_termination',
  'other',
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = [
  'open',
  'under_review',
  'resolved_tenant',
  'resolved_landlord',
  'dismissed',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const MEDIA_BUCKETS = [
  'property-photos',
  'user-avatars',
  'support-attachments',
  'rental-documents',
] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

export const MEDIA_STATUSES = ['pending_upload', 'verified', 'deleted'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const FLATMATE_INTEREST_TYPES = ['like', 'pass'] as const;
export type FlatmateInterestType = (typeof FLATMATE_INTEREST_TYPES)[number];

export const FLATMATE_MATCH_STATUSES = ['active', 'unmatched', 'blocked'] as const;
export type FlatmateMatchStatus = (typeof FLATMATE_MATCH_STATUSES)[number];

export const FLATMATE_INTENTIONS = ['has_room', 'needs_room', 'team_up'] as const;
export type FlatmateIntention = (typeof FLATMATE_INTENTIONS)[number];

export const SAVED_ITEM_TYPES = [
  'property',
  'flatmate_profile',
  'connect_profile',
  'family_stay',
] as const;
export type SavedItemType = (typeof SAVED_ITEM_TYPES)[number];

export const VISIT_STATUSES = [
  'pending',
  'confirmed',
  'rescheduled',
  'completed',
  'cancelled',
  'rejected',
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const PROPERTY_VERIFICATION_STATUSES = [
  'not_submitted',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'expired',
] as const;
export type PropertyVerificationStatus = (typeof PROPERTY_VERIFICATION_STATUSES)[number];

export const NOTIFICATION_CATEGORIES = [
  'connect_match',
  'connect_message',
  'visit_request',
  'visit_update',
  'property_inquiry',
  'property_verification',
  'agreement_update',
  'inspection_update',
  'listing_alert',
  'support_update',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];




