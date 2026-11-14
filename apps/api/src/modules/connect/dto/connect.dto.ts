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
  maxBudget?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasRoom?: boolean;

  @IsOptional()
  @IsEnum(FLATMATE_INTENTIONS)
  intention?: FlatmateIntention;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
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

export class UpdateVisibilityDto {
  @IsBoolean()
  discoveryHidden!: boolean;
}

export class UpdateIntentionsDto {
  @IsArray()
  @IsEnum(FLATMATE_INTENTIONS, { each: true })
  intentions!: FlatmateIntention[];
}


