import type {
  AgreementStatus,
  CleanlinessLevel,
  DisputeStatus,
  DisputeType,
  FlatmateInterestType,
  FlatmateIntention,
  FlatmateMatchStatus,
  FoodHabit,
  FurnishingStatus,
  GenderPreference,
  InquiryStatus,
  InspectionType,
  MarketplaceProfileStatus,
  MarketplaceProfileType,
  MealsOffered,
  MediaBucket,
  MediaStatus,
  ModerationStatus,
  NotificationCategory,
  PaymentCategory,
  PaymentVerificationStatus,
  PropertyCategory,
  PropertyType,
  PropertyVerificationStatus,
  ProviderType,
  ReviewModerationStatus,
  RoomType,
  SavedItemType,
  SleepRoutine,
  TenancyReviewerRole,
  TicketPriority,
  TicketSenderRole,
  TicketStatus,
  UserRole,
  VisitStatus,
} from './enums';

// ==================== PROFILES ====================

export interface UserProfileView {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserRole;
  bio: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  profileCompletionPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfileView {
  id: string;
  fullName: string;
  role: UserRole;
  bio: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  createdAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phoneNumber?: string;
  bio?: string;
  avatarUrl?: string;
}

// ==================== LOCATIONS ====================

export interface LocationLocality {
  name: string;
  pincode?: string;
  metroLine?: string;
  landmarks?: string[];
  activeListingCount?: number;
}

export interface LocationCity {
  id: string;
  name: string;
  state: string;
  popularLocalities: LocationLocality[];
  activeListingCount: number;
  latitude: number;
  longitude: number;
}

export interface LocationsResponse {
  cities: LocationCity[];
  totalCities: number;
}

// ==================== PROPERTIES & FAMILY STAYS ====================

export interface PropertyPhotoView {
  id: string;
  photoUrl: string;
  roomTag: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface PropertyListItem {
  id: string;
  ownerId: string;
  title: string;
  category: PropertyCategory;
  propertyType: PropertyType;
  roomType: RoomType;
  furnishing: FurnishingStatus;
  locality: string;
  city: string;
  state: string;
  pincode: string | null;
  rentAmount: number;
  depositAmount: number;
  maintenanceCharge: number;
  providerType: ProviderType;
  genderPreference: GenderPreference;
  bedrooms: number;
  bathrooms: number;
  availableFrom: string;
  amenities: string[];
  familyLivesOnProperty: boolean;
  mealsOffered: MealsOffered;
  optionalMealCost: number | null;
  featured: boolean;
  status: ModerationStatus;
  primaryPhotoUrl: string | null;
  photosCount: number;
  createdAt: string;
}

export interface PropertyDetail extends PropertyListItem {
  description: string;
  addressShort: string;
  electricityRatePerUnit: number | null;
  brokerageFee: number;
  houseRules: string[];
  moderationReason: string | null;
  photos: PropertyPhotoView[];
  owner: {
    id: string;
    fullName: string;
    role: UserRole;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
}

export interface CreatePropertyInput {
  title: string;
  description: string;
  category?: PropertyCategory;
  propertyType: PropertyType;
  roomType: RoomType;
  furnishing: FurnishingStatus;
  locality: string;
  city: string;
  state?: string;
  pincode?: string;
  addressShort: string;
  rentAmount: number;
  depositAmount?: number;
  maintenanceCharge?: number;
  electricityRatePerUnit?: number;
  brokerageFee?: number;
  providerType: ProviderType;
  genderPreference?: GenderPreference;
  bedrooms?: number;
  bathrooms?: number;
  availableFrom: string;
  amenities?: string[];
  houseRules?: string[];
  familyLivesOnProperty?: boolean;
  mealsOffered?: MealsOffered;
  optionalMealCost?: number;
  photoUrls?: Array<{
    photoUrl: string;
    roomTag?: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
}

export interface UpdatePropertyInput extends Partial<CreatePropertyInput> {
  status?: ModerationStatus;
}

export interface SearchPropertiesQuery {
  city?: string;
  locality?: string;
  category?: PropertyCategory;
  propertyType?: PropertyType;
  roomType?: RoomType;
  furnishing?: FurnishingStatus;
  minRent?: number;
  maxRent?: number;
  genderPreference?: GenderPreference;
  amenities?: string[];
  featuredOnly?: boolean;
  mealsOffered?: MealsOffered;
  page?: number;
  limit?: number;
  sortBy?: 'rent_asc' | 'rent_desc' | 'newest' | 'available_soon';
}

// ==================== FLATMATES ====================

export interface FlatmateProfileItem {
  id: string;
  userId: string;
  occupation: string;
  age: number;
  gender: string;
  hasRoom: boolean;
  intentions?: FlatmateIntention[];
  roomDetails: string | null;
  targetLocalities: string[];
  city: string;
  budgetMax: number;
  foodHabit: FoodHabit;
  sleepRoutine: SleepRoutine;
  cleanliness: CleanlinessLevel;
  petFriendly: boolean;
  smoking: string;
  bio: string;
  interests: string[];
  verified: boolean;
  createdAt: string;
  user: {
    fullName: string;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
}

export interface CreateFlatmateInput {
  occupation: string;
  age: number;
  gender: string;
  hasRoom?: boolean;
  roomDetails?: string;
  targetLocalities: string[];
  city: string;
  budgetMax: number;
  foodHabit: FoodHabit;
  sleepRoutine: SleepRoutine;
  cleanliness: CleanlinessLevel;
  petFriendly?: boolean;
  smoking: string;
  bio: string;
  interests?: string[];
}

export interface UpdateFlatmateInput extends Partial<CreateFlatmateInput> {}

export interface SearchFlatmatesQuery {
  city?: string;
  locality?: string;
  gender?: string;
  foodHabit?: FoodHabit;
  sleepRoutine?: SleepRoutine;
  cleanliness?: CleanlinessLevel;
  maxBudget?: number;
  hasRoom?: boolean;
  page?: number;
  limit?: number;
}

// ==================== MEDIA ====================

export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bucket: MediaBucket;
}

export interface PresignedUploadResponse {
  assetId: string;
  uploadUrl: string;
  publicUrl: string | null;
  objectKey: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface ConfirmUploadRequest {
  assetId: string;
}

export interface MediaAssetView {
  id: string;
  bucket: MediaBucket;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
  status: MediaStatus;
  url: string | null;
  createdAt: string;
}

// ==================== INQUIRIES ====================

export interface CreateInquiryInput {
  propertyId?: string;
  targetFlatmateId?: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  moveInDate?: string;
  message: string;
}

export interface UpdateInquiryStatusInput {
  status: InquiryStatus;
}

export interface InquiryItem {
  id: string;
  senderId: string;
  propertyId: string | null;
  targetFlatmateId: string | null;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  moveInDate: string | null;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  targetTitle?: string;
  targetType: 'property' | 'flatmate';
}

// ==================== TENANCY AGREEMENTS ====================

export interface CreateAgreementInput {
  propertyId?: string;
  landlordId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate?: string;
  documentUrl?: string;
  termsSummary?: string;
}

export interface UpdateAgreementStatusInput {
  agreementStatus: AgreementStatus;
}

export interface AgreementView {
  id: string;
  propertyId: string | null;
  landlordId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate: string | null;
  agreementStatus: AgreementStatus;
  documentUrl: string | null;
  termsSummary: string | null;
  createdAt: string;
  updatedAt: string;
  propertyTitle?: string;
  landlordName?: string;
  tenantName?: string;
}

// ==================== RENT PAYMENTS ====================

export interface CreatePaymentRecordInput {
  agreementId: string;
  payerId: string;
  recipientId: string;
  amount: number;
  paymentCategory: PaymentCategory;
  paymentDate: string;
  receiptUrl?: string;
  transactionReference?: string;
  notes?: string;
}

export interface RentPaymentRecordView {
  id: string;
  agreementId: string;
  payerId: string;
  recipientId: string;
  amount: number;
  paymentCategory: PaymentCategory;
  paymentDate: string;
  receiptUrl: string | null;
  transactionReference: string | null;
  verificationStatus: PaymentVerificationStatus;
  notes: string | null;
  createdAt: string;
}

// ==================== PROPERTY INSPECTIONS ====================

export interface CreateInspectionInput {
  agreementId: string;
  inspectionType: InspectionType;
  inspectionDate: string;
  roomName: string;
  conditionRating: number;
  damageNotes?: string;
  photoUrls?: string[];
}

export interface InspectionView {
  id: string;
  agreementId: string;
  inspectionType: InspectionType;
  conductedBy: string;
  inspectionDate: string;
  roomName: string;
  conditionRating: number;
  damageNotes: string | null;
  photoUrls: string[];
  acknowledgedByCounterparty: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  conductorName?: string;
}

// ==================== TENANCY REVIEWS ====================

export interface CreateTenancyReviewInput {
  agreementId: string;
  revieweeId: string;
  reviewerRole: TenancyReviewerRole;
  communicationRating: number;
  maintenanceRating: number;
  propertyCareRating: number;
  agreementClarityRating: number;
  reviewTitle?: string;
  reviewContent: string;
  isPublic?: boolean;
}

export interface TenancyReviewView {
  id: string;
  agreementId: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: TenancyReviewerRole;
  communicationRating: number;
  maintenanceRating: number;
  propertyCareRating: number;
  agreementClarityRating: number;
  overallRating: number;
  reviewTitle: string | null;
  reviewContent: string;
  isPublic: boolean;
  moderationStatus: ReviewModerationStatus;
  reviewerName?: string;
  createdAt: string;
}

// ==================== RENTAL DISPUTES ====================

export interface CreateDisputeInput {
  agreementId: string;
  disputeType: DisputeType;
  disputedAmount?: number;
  title: string;
  description: string;
  evidenceUrls?: string[];
}

export interface ResolveDisputeInput {
  status: DisputeStatus;
  resolutionSummary: string;
}

export interface DisputeView {
  id: string;
  disputeNumber: string;
  agreementId: string;
  initiatorId: string;
  respondentId: string;
  disputeType: DisputeType;
  disputedAmount: number;
  title: string;
  description: string;
  status: DisputeStatus;
  evidenceUrls: string[];
  resolutionSummary: string | null;
  assignedModeratorId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  initiatorName?: string;
  respondentName?: string;
}

// ==================== SUPPORT TICKETS ====================

export interface CreateSupportTicketInput {
  category: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
  referenceListingId?: string;
  referenceUserId?: string;
  attachments?: string[];
}

export interface GuestSupportTicketInput {
  userName: string;
  userEmail: string;
  userPhone?: string;
  category: string;
  subject: string;
  description: string;
  referenceListingId?: string;
  attachments?: string[];
}

export interface CreateTicketMessageInput {
  message: string;
  attachments?: string[];
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
  assignedTo?: string;
}

export interface TicketMessageView {
  id: string;
  ticketId: string;
  senderId: string | null;
  senderName: string;
  senderRole: TicketSenderRole;
  message: string;
  attachments: string[];
  createdAt: string;
}

export interface SupportTicketView {
  id: string;
  ticketNumber: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  userPhone: string | null;
  category: string;
  subject: string;
  description: string;
  referenceListingId: string | null;
  referenceUserId: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messages?: TicketMessageView[];
}

// ==================== AASHVO CONNECT ====================

export interface CompatibilityBreakdown {
  overallScore: number;
  foodScore: number;
  sleepScore: number;
  cleanlinessScore: number;
  budgetScore: number;
  interestsScore: number;
  sharedInterests: string[];
}

export interface ConnectCandidateView {
  userId: string;
  profileId: string;
  displayName: string;
  age: number;
  gender: string;
  occupation: string;
  city: string;
  targetLocalities: string[];
  budgetMax: number;
  foodHabit: FoodHabit;
  sleepRoutine: SleepRoutine;
  cleanliness: CleanlinessLevel;
  petFriendly: boolean;
  smoking: string;
  bio: string;
  interests: string[];
  avatarUrl: string | null;
  verified: boolean;
  hasRoom: boolean;
  intentions?: FlatmateIntention[];
  roomDetails: string | null;
  compatibility: CompatibilityBreakdown;
}

export interface ConnectSwipeInput {
  targetUserId: string;
  action: 'like' | 'pass';
}

export interface ConnectSwipeResponse {
  success: boolean;
  action: 'like' | 'pass';
  matched: boolean;
  match?: ConnectMatchItem;
}

export interface ConnectUndoResponse {
  success: boolean;
  undoneTargetUserId: string;
  previousAction: 'like' | 'pass';
}

export interface ConnectMatchPartnerView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  locality?: string;
  occupation: string;
  budgetMax: number;
  verified: boolean;
  compatibilityScore: number;
}

export interface ConnectMatchItem {
  id: string;
  status: FlatmateMatchStatus;
  matchedAt: string;
  lastInteractionAt: string;
  partner: ConnectMatchPartnerView;
  lastMessage?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    read: boolean;
  };
}

export interface ConnectMessageItem {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface SendConnectMessageInput {
  content: string;
}

export interface BlockUserInput {
  reason?: string;
}

export interface ReportUserInput {
  reason: string;
  details?: string;
}

export interface UpdateVisibilityInput {
  discoveryHidden: boolean;
}

export interface UpdateIntentionsInput {
  intentions: FlatmateIntention[];
}

// ==================== MASTER FEATURE EXPANSION ====================

// 1. Locations & Landmarks
export interface LandmarkItem {
  id: string;
  name: string;
  category: 'university' | 'office_park' | 'metro_station';
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
  nearestMetro?: string;
  distanceKm?: number;
}

// 2. Rent Split Calculator
export interface FlatmateRoomConfig {
  flatmateName: string;
  roomSizeSqFt?: number;
  hasAttachedBath?: boolean;
  hasPrivateBalcony?: boolean;
  customRentAmount?: number;
  percentageShare?: number;
}

export interface CalculateRentSplitInput {
  splitMethod: 'equal' | 'custom' | 'percentage';
  totalMonthlyRent: number;
  totalDeposit: number;
  utilities: {
    electricity?: number;
    water?: number;
    wifi?: number;
    maintenance?: number;
    housekeeping?: number;
    other?: number;
  };
  flatmates: FlatmateRoomConfig[];
}

export interface RentSplitAllocation {
  flatmateName: string;
  rentShare: number;
  utilitiesShare: number;
  totalMonthlyPayment: number;
  depositShare: number;
  sharePercentage: number;
}

export interface RentSplitSummary {
  splitMethod: 'equal' | 'custom' | 'percentage';
  totalMonthlyRent: number;
  totalMonthlyUtilities: number;
  totalMonthlyCommitment: number;
  totalDeposit: number;
  allocations: RentSplitAllocation[];
  isValidAllocation: boolean;
  validationMessage?: string;
}

// 3. Saved Items & Shortlists
export interface CreateSavedItemInput {
  itemType: SavedItemType;
  targetId: string;
  notes?: string;
}

export interface SavedItemView {
  id: string;
  userId: string;
  itemType: SavedItemType;
  targetId: string;
  notes?: string | null;
  isAvailable: boolean;
  availabilityStatus: string;
  title: string;
  subtitle?: string | null;
  city: string;
  locality?: string | null;
  priceMonthly?: number | null;
  thumbnailUrl?: string | null;
  savedAt: string;
}

// 4. Property Visit Scheduling
export interface CreateVisitInput {
  propertyId: string;
  scheduledAt: string; // ISO 8601
  visitorMessage?: string;
}

export interface UpdateVisitStatusInput {
  action: 'confirm' | 'reject' | 'cancel' | 'complete';
  hostNotes?: string;
}

export interface RescheduleVisitInput {
  rescheduledAt: string; // ISO 8601
  reason?: string;
}

export interface PropertyVisitItem {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyCity: string;
  propertyLocality: string;
  visitorId: string;
  visitorName: string;
  visitorPhone?: string | null;
  hostId: string;
  hostName: string;
  hostPhone?: string | null;
  scheduledAt: string;
  scheduledAtIST: string;
  status: VisitStatus;
  visitorMessage?: string | null;
  hostNotes?: string | null;
  rescheduledAt?: string | null;
  rescheduledAtIST?: string | null;
  rescheduledBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 5. Property Verification Workflow
export interface SubmitPropertyVerificationInput {
  propertyId: string;
  documentType: 'electricity_bill' | 'property_tax_receipt' | 'registered_sale_deed' | 'lease_agreement' | 'society_noc';
  documentUrl: string;
  ownerIdType: 'aadhaar' | 'pan' | 'passport';
}

export interface ReviewPropertyVerificationInput {
  action: 'approve' | 'reject';
  reviewNotes: string;
  rejectionReason?: string;
  expiresInDays?: number;
}

export interface PropertyVerificationItem {
  id: string;
  propertyId: string;
  submittedBy: string;
  status: PropertyVerificationStatus;
  documentType: string;
  documentUrl: string;
  ownerIdType: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 6. Move-In Checklist
export interface MoveInInventoryItem {
  name: string;
  category: 'electrical' | 'furniture' | 'plumbing' | 'fixture';
  condition: 'excellent' | 'good' | 'minor_wear' | 'damaged' | 'missing';
  notes?: string;
}

export interface MoveInChecklistInput {
  agreementId: string;
  inspectionDate: string;
  roomName: string;
  electricityMeterKwh?: number;
  waterMeterUnits?: number;
  keyHandoverConfirmed: boolean;
  depositRecordConfirmed: boolean;
  inventory: MoveInInventoryItem[];
  photoUrls?: string[];
  damageNotes?: string;
}

// 7. Notifications
export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  targetUrl?: string | null;
  metadata?: Record<string, any>;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  total: number;
}

// ==================== MARKETPLACE PROFILES & ONBOARDING ====================

export interface MarketplaceProfileView {
  id: string;
  userId: string;
  profileType: MarketplaceProfileType;
  status: MarketplaceProfileStatus;
  isCurrentActive: boolean;
  displayName: string | null;
  completionPercent: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketplaceProfileInput {
  profileType: MarketplaceProfileType;
  displayName?: string;
  metadata?: Record<string, any>;
}

export interface UpdateMarketplaceProfileInput {
  displayName?: string;
  status?: MarketplaceProfileStatus;
  metadata?: Record<string, any>;
}

export interface SwitchMarketplaceProfileInput {
  profileType: MarketplaceProfileType;
}

export interface ProfileCompletionBreakdown {
  totalPercent: number;
  basicInfoPercent: number;
  locationPercent: number;
  housingPercent: number;
  lifestylePercent: number;
  photoPercent: number;
  missingFields: string[];
  isComplete: boolean;
  isPublished: boolean;
}

export interface PersonalOnboardingInput {
  // Step 1: Basic Information
  fullName: string;
  avatarUrl?: string;
  age: number;
  gender?: string;
  profession: string;
  collegeOrWorkplace?: string;
  bio: string;
  languages?: string[];
  interests?: string[];

  // Step 2: Location
  country?: string;
  state?: string;
  city: string;
  targetLocalities?: string[];

  // Step 3: Housing Requirements
  budgetMin?: number;
  budgetMax: number;
  moveInDate?: string;
  moveInFlexible?: boolean;
  roomType?: RoomType;
  furnishing?: FurnishingStatus;
  hasRoom?: boolean;
  intentions?: FlatmateIntention[];
  roomDetails?: string;

  // Step 4: Lifestyle
  foodHabit: FoodHabit;
  sleepRoutine: SleepRoutine;
  cleanliness: CleanlinessLevel;
  smoking: string;
  drinking?: string;
  petFriendly: boolean;
  socialLifestyle?: string;
  wfhHabits?: string;
  noiseTolerance?: string;

  // Step 5: Publish Action
  publishImmediately?: boolean;
}

export interface ConnectLikeItem {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  occupation: string;
  budgetMax: number;
  createdAt: string;
}

export interface ConnectUnmatchInput {
  reason?: string;
}






