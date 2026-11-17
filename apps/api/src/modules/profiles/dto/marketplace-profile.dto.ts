import {
  CLEANLINESS_LEVELS,
  FLATMATE_INTENTIONS,
  FOOD_HABITS,
  FURNISHING_STATUSES,
  MARKETPLACE_PROFILE_STATUSES,
  MARKETPLACE_PROFILE_TYPES,
  ROOM_TYPES,
  SLEEP_ROUTINES,
  type CleanlinessLevel,
  type FlatmateIntention,
  type FoodHabit,
  type FurnishingStatus,
  type MarketplaceProfileStatus,
  type MarketplaceProfileType,
  type RoomType,
  type SleepRoutine,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMarketplaceProfileDto {
  @ApiProperty({ enum: MARKETPLACE_PROFILE_TYPES, example: 'flatmate_seeker' })
  @IsEnum(MARKETPLACE_PROFILE_TYPES)
  profileType!: MarketplaceProfileType;

  @ApiPropertyOptional({ example: 'Aarav (Flatmate Seeker)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateMarketplaceProfileDto {
  @ApiPropertyOptional({ example: 'Aarav (Property Owner)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ enum: MARKETPLACE_PROFILE_STATUSES, example: 'active' })
  @IsOptional()
  @IsEnum(MARKETPLACE_PROFILE_STATUSES)
  status?: MarketplaceProfileStatus;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SwitchMarketplaceProfileDto {
  @ApiProperty({ enum: MARKETPLACE_PROFILE_TYPES, example: 'flatmate_seeker' })
  @IsEnum(MARKETPLACE_PROFILE_TYPES)
  profileType!: MarketplaceProfileType;
}

export class PersonalOnboardingDto {
  // Step 1: Basic Information
  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ example: 22 })
  @IsInt()
  @Min(18, { message: 'Aashvo users must be at least 18 years of age.' })
  @Max(120)
  age!: number;

  @ApiPropertyOptional({ example: 'male' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @ApiProperty({ example: 'Working Professional' })
  @IsString()
  @MaxLength(120)
  profession!: string;

  @ApiPropertyOptional({ example: 'IIT Delhi / Razorpay' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  collegeOrWorkplace?: string;

  @ApiProperty({ example: 'Calm software engineer who likes quiet weekends and books.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  bio!: string;

  @ApiPropertyOptional({ example: ['English', 'Hindi'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ example: ['Reading', 'Yoga', 'Tech'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  // Step 2: Location
  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Haryana' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'Gurugram' })
  @IsString()
  city!: string;

  @ApiPropertyOptional({ example: ['DLF Phase 2', 'Cyber City'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocalities?: string[];

  // Step 3: Housing Requirements
  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(1000)
  budgetMax!: number;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsString()
  moveInDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  moveInFlexible?: boolean;

  @ApiPropertyOptional({ enum: ROOM_TYPES, example: 'private_room' })
  @IsOptional()
  @IsEnum(ROOM_TYPES)
  roomType?: RoomType;

  @ApiPropertyOptional({ enum: FURNISHING_STATUSES, example: 'fully_furnished' })
  @IsOptional()
  @IsEnum(FURNISHING_STATUSES)
  furnishing?: FurnishingStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasRoom?: boolean;

  @ApiPropertyOptional({ enum: FLATMATE_INTENTIONS, isArray: true })
  @IsOptional()
  @IsArray()
  intentions?: FlatmateIntention[];

  @ApiPropertyOptional({ example: 'Master bedroom with attached bathroom' })
  @IsOptional()
  @IsString()
  roomDetails?: string;

  // Step 4: Lifestyle
  @ApiProperty({ enum: FOOD_HABITS, example: 'Vegetarian' })
  @IsEnum(FOOD_HABITS)
  foodHabit!: FoodHabit;

  @ApiProperty({ enum: SLEEP_ROUTINES, example: 'Early Bird' })
  @IsEnum(SLEEP_ROUTINES)
  sleepRoutine!: SleepRoutine;

  @ApiProperty({ enum: CLEANLINESS_LEVELS, example: 'Spotless' })
  @IsEnum(CLEANLINESS_LEVELS)
  cleanliness!: CleanlinessLevel;

  @ApiProperty({ example: 'No' })
  @IsString()
  smoking!: string;

  @ApiPropertyOptional({ example: 'No' })
  @IsOptional()
  @IsString()
  drinking?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  petFriendly!: boolean;

  @ApiPropertyOptional({ example: 'Quiet and introverted' })
  @IsOptional()
  @IsString()
  socialLifestyle?: string;

  @ApiPropertyOptional({ example: 'Hybrid (3 days office)' })
  @IsOptional()
  @IsString()
  wfhHabits?: string;

  @ApiPropertyOptional({ example: 'Moderate' })
  @IsOptional()
  @IsString()
  noiseTolerance?: string;

  // Step 5: Publish Action
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean;
}

export class MarketplaceProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: MARKETPLACE_PROFILE_TYPES })
  profileType!: MarketplaceProfileType;

  @ApiProperty({ enum: MARKETPLACE_PROFILE_STATUSES })
  status!: MarketplaceProfileStatus;

  @ApiProperty()
  isCurrentActive!: boolean;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty()
  completionPercent!: number;

  @ApiProperty()
  metadata!: Record<string, any>;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ProfileCompletionBreakdownDto {
  @ApiProperty({ example: 85 })
  totalPercent!: number;

  @ApiProperty({ example: 25 })
  basicInfoPercent!: number;

  @ApiProperty({ example: 20 })
  locationPercent!: number;

  @ApiProperty({ example: 20 })
  housingPercent!: number;

  @ApiProperty({ example: 20 })
  lifestylePercent!: number;

  @ApiProperty({ example: 15 })
  photoPercent!: number;

  @ApiProperty({ example: [] })
  missingFields!: string[];

  @ApiProperty({ example: true })
  isComplete!: boolean;

  @ApiProperty({ example: true })
  isPublished!: boolean;
}
