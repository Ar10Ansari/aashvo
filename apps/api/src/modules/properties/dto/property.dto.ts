import {
  FURNISHING_STATUSES,
  GENDER_PREFERENCES,
  MEALS_OFFERED,
  MODERATION_STATUSES,
  PROPERTY_CATEGORIES,
  PROPERTY_TYPES,
  PROVIDER_TYPES,
  ROOM_TYPES,
  type FurnishingStatus,
  type GenderPreference,
  type MealsOffered,
  type ModerationStatus,
  type PropertyCategory,
  type PropertyType,
  type ProviderType,
  type RoomType,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PropertyPhotoInputDto {
  @ApiProperty({ example: 'https://assets.aashvo.in/property-photos/123/living-room.webp' })
  @IsUrl()
  photoUrl!: string;

  @ApiPropertyOptional({ example: 'Living Room' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  roomTag?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Spacious 2BHK in Hauz Khas near IIT Delhi', minLength: 5, maxLength: 160 })
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'Fully furnished apartment with 24/7 power backup and balcony.', minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ enum: PROPERTY_CATEGORIES, default: 'flats_rooms' })
  @IsOptional()
  @IsEnum(PROPERTY_CATEGORIES)
  category?: PropertyCategory;

  @ApiProperty({ enum: PROPERTY_TYPES, example: 'apartment' })
  @IsEnum(PROPERTY_TYPES)
  propertyType!: PropertyType;

  @ApiProperty({ enum: ROOM_TYPES, example: 'private_room' })
  @IsEnum(ROOM_TYPES)
  roomType!: RoomType;

  @ApiProperty({ enum: FURNISHING_STATUSES, example: 'fully_furnished' })
  @IsEnum(FURNISHING_STATUSES)
  furnishing!: FurnishingStatus;

  @ApiProperty({ example: 'Hauz Khas' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  locality!: string;

  @ApiProperty({ example: 'Delhi NCR' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: '110016' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;

  @ApiProperty({ example: 'Block C, near Hauz Khas Metro Station' })
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  addressShort!: string;

  @ApiProperty({ example: 18000, description: 'Monthly rent amount in INR (>= 0)' })
  @IsNumber()
  @Min(0)
  rentAmount!: number;

  @ApiPropertyOptional({ example: 36000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: 1500, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceCharge?: number;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityRatePerUnit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  brokerageFee?: number;

  @ApiProperty({ enum: PROVIDER_TYPES, example: 'owner' })
  @IsEnum(PROVIDER_TYPES)
  providerType!: ProviderType;

  @ApiPropertyOptional({ enum: GENDER_PREFERENCES, default: 'any' })
  @IsOptional()
  @IsEnum(GENDER_PREFERENCES)
  genderPreference?: GenderPreference;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  bathrooms?: number;

  @ApiProperty({ example: 'Immediately' })
  @IsString()
  @MaxLength(80)
  availableFrom!: string;

  @ApiPropertyOptional({ example: ['Wifi', 'AC', 'Attached Washroom', 'Washing Machine'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  amenities?: string[];

  @ApiPropertyOptional({ example: ['No loud music after 11 PM', 'Vegetarian preferred'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  houseRules?: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Mandatory true if category is family_stays (family lives on property)',
  })
  @IsOptional()
  @IsBoolean()
  familyLivesOnProperty?: boolean;

  @ApiPropertyOptional({ enum: MEALS_OFFERED, default: 'none' })
  @IsOptional()
  @IsEnum(MEALS_OFFERED)
  mealsOffered?: MealsOffered;

  @ApiPropertyOptional({ example: 3500, description: 'Optional extra meal cost if mealsOffered is optional_extra' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionalMealCost?: number;

  @ApiPropertyOptional({ type: [PropertyPhotoInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyPhotoInputDto)
  photoUrls?: PropertyPhotoInputDto[];

  @ApiPropertyOptional({ example: false, description: 'If true, listing is saved as draft rather than submitted for review' })
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({ enum: MODERATION_STATUSES })
  @IsOptional()
  @IsEnum(MODERATION_STATUSES)
  status?: ModerationStatus;
}

export class ModeratePropertyDto {
  @ApiProperty({ enum: ['active', 'rejected', 'paused'] })
  @IsEnum(['active', 'rejected', 'paused'])
  status!: 'active' | 'rejected' | 'paused';

  @ApiPropertyOptional({ example: 'Address verified and photos conform to quality standards' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SearchPropertiesQueryDto {
  @ApiPropertyOptional({ example: 'Gurugram' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Cyber City' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ enum: PROPERTY_CATEGORIES })
  @IsOptional()
  @IsEnum(PROPERTY_CATEGORIES)
  category?: PropertyCategory;

  @ApiPropertyOptional({ enum: PROPERTY_TYPES })
  @IsOptional()
  @IsEnum(PROPERTY_TYPES)
  propertyType?: PropertyType;

  @ApiPropertyOptional({ enum: ROOM_TYPES })
  @IsOptional()
  @IsEnum(ROOM_TYPES)
  roomType?: RoomType;

  @ApiPropertyOptional({ enum: FURNISHING_STATUSES })
  @IsOptional()
  @IsEnum(FURNISHING_STATUSES)
  furnishing?: FurnishingStatus;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRent?: number;

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRent?: number;

  @ApiPropertyOptional({ enum: GENDER_PREFERENCES })
  @IsOptional()
  @IsEnum(GENDER_PREFERENCES)
  genderPreference?: GenderPreference;

  @ApiPropertyOptional({
    description: 'Comma-separated amenities (e.g. Wifi,AC)',
    example: 'Wifi,AC',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featuredOnly?: boolean;

  @ApiPropertyOptional({ enum: MEALS_OFFERED })
  @IsOptional()
  @IsEnum(MEALS_OFFERED)
  mealsOffered?: MealsOffered;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ['rent_asc', 'rent_desc', 'newest', 'available_soon'],
    default: 'newest',
  })
  @IsOptional()
  @IsEnum(['rent_asc', 'rent_desc', 'newest', 'available_soon'])
  sortBy?: 'rent_asc' | 'rent_desc' | 'newest' | 'available_soon' = 'newest';
}

export class PropertyPhotoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  photoUrl!: string;

  @ApiProperty({ nullable: true })
  roomTag!: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

export class PropertyListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: PROPERTY_CATEGORIES })
  category!: PropertyCategory;

  @ApiProperty({ enum: PROPERTY_TYPES })
  propertyType!: PropertyType;

  @ApiProperty({ enum: ROOM_TYPES })
  roomType!: RoomType;

  @ApiProperty({ enum: FURNISHING_STATUSES })
  furnishing!: FurnishingStatus;

  @ApiProperty()
  locality!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty({ nullable: true })
  pincode!: string | null;

  @ApiProperty()
  rentAmount!: number;

  @ApiProperty()
  depositAmount!: number;

  @ApiProperty()
  maintenanceCharge!: number;

  @ApiProperty({ enum: PROVIDER_TYPES })
  providerType!: ProviderType;

  @ApiProperty({ enum: GENDER_PREFERENCES })
  genderPreference!: GenderPreference;

  @ApiProperty()
  bedrooms!: number;

  @ApiProperty()
  bathrooms!: number;

  @ApiProperty()
  availableFrom!: string;

  @ApiProperty({ type: [String] })
  amenities!: string[];

  @ApiProperty()
  familyLivesOnProperty!: boolean;

  @ApiProperty({ enum: MEALS_OFFERED })
  mealsOffered!: MealsOffered;

  @ApiProperty({ nullable: true })
  optionalMealCost!: number | null;

  @ApiProperty()
  featured!: boolean;

  @ApiProperty({ enum: MODERATION_STATUSES })
  status!: ModerationStatus;

  @ApiProperty({ nullable: true })
  primaryPhotoUrl!: string | null;

  @ApiProperty()
  photosCount!: number;

  @ApiProperty()
  createdAt!: string;
}

export class PropertyDetailDto extends PropertyListItemDto {
  @ApiProperty()
  description!: string;

  @ApiProperty()
  addressShort!: string;

  @ApiProperty({ nullable: true })
  electricityRatePerUnit!: number | null;

  @ApiProperty()
  brokerageFee!: number;

  @ApiProperty({ type: [String] })
  houseRules!: string[];

  @ApiProperty({ nullable: true })
  moderationReason!: string | null;

  @ApiProperty({ type: [PropertyPhotoResponseDto] })
  photos!: PropertyPhotoResponseDto[];

  @ApiProperty()
  owner!: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
}

export class PaginatedPropertiesResponseDto {
  @ApiProperty({ type: [PropertyListItemDto] })
  data!: PropertyListItemDto[];

  @ApiProperty()
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

export class SubmitPropertyVerificationDto {
  @ApiProperty({
    enum: ['electricity_bill', 'property_tax_receipt', 'registered_sale_deed', 'lease_agreement', 'society_noc'],
    example: 'electricity_bill',
  })
  @IsString()
  @IsNotEmpty()
  documentType!: 'electricity_bill' | 'property_tax_receipt' | 'registered_sale_deed' | 'lease_agreement' | 'society_noc';

  @ApiProperty({ example: 'https://assets.aashvo.in/rental-documents/bill-123.pdf' })
  @IsUrl()
  @IsNotEmpty()
  documentUrl!: string;

  @ApiProperty({
    enum: ['aadhaar', 'pan', 'passport'],
    example: 'aadhaar',
  })
  @IsString()
  @IsNotEmpty()
  ownerIdType!: 'aadhaar' | 'pan' | 'passport';
}

export class ReviewPropertyVerificationDto {
  @ApiProperty({ enum: ['approve', 'reject'], example: 'approve' })
  @IsString()
  @IsNotEmpty()
  action!: 'approve' | 'reject';

  @ApiProperty({ example: 'Utility bill address matches property location exactly.' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reviewNotes!: string;

  @ApiPropertyOptional({ example: 'Document image is blurred or illegible.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ example: 180, description: 'Validity period in days' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(365)
  expiresInDays?: number;
}

export class PropertyVerificationResponseDto {
  @ApiProperty({ example: 'vfy-1a2b3c' })
  id!: string;

  @ApiProperty({ example: '4c9e6679-7425-40de-944b-e07fc1f90ae7' })
  propertyId!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  submittedBy!: string;

  @ApiProperty({ example: 'verified' })
  status!: string;

  @ApiProperty({ example: 'electricity_bill' })
  documentType!: string;

  @ApiProperty({ example: 'https://assets.aashvo.in/rental-documents/bill-123.pdf' })
  documentUrl!: string;

  @ApiProperty({ example: 'aadhaar' })
  ownerIdType!: string;

  @ApiPropertyOptional({ example: 'admin-uuid' })
  reviewedBy?: string | null;

  @ApiPropertyOptional({ example: 'Document verified' })
  reviewNotes?: string | null;

  @ApiPropertyOptional({ example: null })
  rejectionReason?: string | null;

  @ApiProperty({ example: '2026-11-15T01:30:00.000Z' })
  submittedAt!: string;

  @ApiPropertyOptional({ example: '2026-11-15T01:35:00.000Z' })
  reviewedAt?: string | null;

  @ApiPropertyOptional({ example: '2027-05-15T01:35:00.000Z' })
  expiresAt?: string | null;

  @ApiProperty({ example: '2026-11-15T01:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-15T01:35:00.000Z' })
  updatedAt!: string;
}

