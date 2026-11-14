import {
  CLEANLINESS_LEVELS,
  FLATMATE_INTENTIONS,
  FOOD_HABITS,
  SLEEP_ROUTINES,
  type CleanlinessLevel,
  type FlatmateIntention,
  type FoodHabit,
  type SleepRoutine,
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
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFlatmateProfileDto {
  @ApiProperty({ example: 'Software Engineer at Zomato', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  occupation!: string;

  @ApiProperty({ example: 24, description: 'Adult age required (>= 18)' })
  @IsInt()
  @Min(18, { message: 'Flatmate profile requires applicant to be at least 18 years old.' })
  @Max(120)
  age!: number;

  @ApiProperty({ example: 'Female' })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasRoom?: boolean;

  @ApiPropertyOptional({
    enum: FLATMATE_INTENTIONS,
    isArray: true,
    example: ['needs_room', 'team_up'],
    description: 'Flatmate intentions (has_room, needs_room, team_up)',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(FLATMATE_INTENTIONS, { each: true })
  intentions?: FlatmateIntention[];

  @ApiPropertyOptional({ example: 'Have a 3BHK in DLF Phase 5, looking for 1 flatmate for master bedroom.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  roomDetails?: string;

  @ApiProperty({
    example: ['Cyber City', 'DLF Phase 2', 'Golf Course Road'],
    description: 'Preferred target localities',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(15)
  targetLocalities!: string[];

  @ApiProperty({ example: 'Gurugram' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 18000, description: 'Maximum monthly budget in INR (> 0)' })
  @IsNumber()
  @Min(1, { message: 'Maximum budget must be greater than 0.' })
  budgetMax!: number;

  @ApiProperty({ enum: FOOD_HABITS, example: 'Vegetarian' })
  @IsEnum(FOOD_HABITS)
  foodHabit!: FoodHabit;

  @ApiProperty({ enum: SLEEP_ROUTINES, example: 'Early Bird' })
  @IsEnum(SLEEP_ROUTINES)
  sleepRoutine!: SleepRoutine;

  @ApiProperty({ enum: CLEANLINESS_LEVELS, example: 'Moderate' })
  @IsEnum(CLEANLINESS_LEVELS)
  cleanliness!: CleanlinessLevel;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  petFriendly?: boolean;

  @ApiProperty({ example: 'Non-smoker' })
  @IsString()
  @MaxLength(64)
  smoking!: string;

  @ApiProperty({
    example: 'Friendly tech professional who likes badminton and cooking on weekends. Looking for a neat flatmate.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  bio!: string;

  @ApiPropertyOptional({ example: ['Coding', 'Badminton', 'Reading', 'Music'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  interests?: string[];
}

export class UpdateFlatmateProfileDto extends PartialType(CreateFlatmateProfileDto) {}

export class SearchFlatmatesQueryDto {
  @ApiPropertyOptional({ example: 'Gurugram' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Cyber City' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ example: 'Female' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ enum: FOOD_HABITS })
  @IsOptional()
  @IsEnum(FOOD_HABITS)
  foodHabit?: FoodHabit;

  @ApiPropertyOptional({ enum: SLEEP_ROUTINES })
  @IsOptional()
  @IsEnum(SLEEP_ROUTINES)
  sleepRoutine?: SleepRoutine;

  @ApiPropertyOptional({ enum: CLEANLINESS_LEVELS })
  @IsOptional()
  @IsEnum(CLEANLINESS_LEVELS)
  cleanliness?: CleanlinessLevel;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasRoom?: boolean;

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
}

export class FlatmateProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  occupation!: string;

  @ApiProperty()
  age!: number;

  @ApiProperty()
  gender!: string;

  @ApiProperty()
  hasRoom!: boolean;

  @ApiPropertyOptional({ enum: FLATMATE_INTENTIONS, isArray: true })
  intentions?: FlatmateIntention[];

  @ApiProperty({ nullable: true })
  roomDetails!: string | null;

  @ApiProperty({ type: [String] })
  targetLocalities!: string[];

  @ApiProperty()
  city!: string;

  @ApiProperty()
  budgetMax!: number;

  @ApiProperty({ enum: FOOD_HABITS })
  foodHabit!: FoodHabit;

  @ApiProperty({ enum: SLEEP_ROUTINES })
  sleepRoutine!: SleepRoutine;

  @ApiProperty({ enum: CLEANLINESS_LEVELS })
  cleanliness!: CleanlinessLevel;

  @ApiProperty()
  petFriendly!: boolean;

  @ApiProperty()
  smoking!: string;

  @ApiProperty()
  bio!: string;

  @ApiProperty({ type: [String] })
  interests!: string[];

  @ApiProperty()
  verified!: boolean;

  @ApiPropertyOptional({ example: 85, description: 'Calculated compatibility score (0-100%) against caller' })
  compatibilityScore?: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  user!: {
    fullName: string;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
}

export class PaginatedFlatmatesResponseDto {
  @ApiProperty({ type: [FlatmateProfileResponseDto] })
  data!: FlatmateProfileResponseDto[];

  @ApiProperty()
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}
