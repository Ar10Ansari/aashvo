import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FLATMATE_INTENTIONS, type FlatmateIntention } from '@aashvo/contracts';

export class ConnectSwipeDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @IsIn(['like', 'pass'])
  action!: 'like' | 'pass';
}

export class ConnectPassDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;
}

export class ConnectDiscoverQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @IsOptional()
  @IsString()
  moveInDate?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  moveInFlexible?: boolean;

  @IsOptional()
  @IsString()
  roomType?: string;

  @IsOptional()
  @IsString()
  furnishing?: string;

  @IsOptional()
  @IsString()
  foodHabit?: string;

  @IsOptional()
  @IsString()
  sleepRoutine?: string;

  @IsOptional()
  @IsString()
  cleanliness?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  petFriendly?: boolean;

  @IsOptional()
  @IsString()
  smoking?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasRoom?: boolean;

  @IsOptional()
  @IsEnum(FLATMATE_INTENTIONS)
  intention?: FlatmateIntention;

  @IsOptional()
  @IsIn(['compatibility', 'budget_asc', 'budget_desc', 'recent'])
  sortBy?: 'compatibility' | 'budget_asc' | 'budget_desc' | 'recent';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class UpdateMatchingPreferencesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  budget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  location?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  lifestyle?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  food?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  sleep?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  moveIn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interests?: number;
}

export class SendConnectMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class BlockUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class BlockUserBodyDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReportUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class ReportUserBodyDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class UpdateVisibilityDto {
  @IsBoolean()
  discoveryHidden!: boolean;
}

export class UpdateIntentionsDto {
  @IsArray()
  @IsEnum(FLATMATE_INTENTIONS, { each: true })
  intentions!: FlatmateIntention[];
}


