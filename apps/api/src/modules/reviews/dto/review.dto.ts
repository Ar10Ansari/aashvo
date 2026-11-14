import {
  REVIEW_MODERATION_STATUSES,
  TENANCY_REVIEWER_ROLES,
  type ReviewModerationStatus,
  type TenancyReviewView,
  type TenancyReviewerRole,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateTenancyReviewDto {
  @ApiProperty({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  agreementId!: string;

  @ApiProperty({ example: '12e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  revieweeId!: string;

  @ApiProperty({ enum: TENANCY_REVIEWER_ROLES, example: 'tenant' })
  @IsIn(TENANCY_REVIEWER_ROLES)
  reviewerRole!: TenancyReviewerRole;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  communicationRating!: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  maintenanceRating!: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  propertyCareRating!: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  agreementClarityRating!: number;

  @ApiPropertyOptional({ example: 'Great stay and responsive landlord' })
  @IsOptional()
  @IsString()
  reviewTitle?: string;

  @ApiProperty({ example: 'The property was clean, repairs were handled promptly, and the deposit was refunded in full.' })
  @IsString()
  reviewContent!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ModerateReviewDto {
  @ApiProperty({ enum: REVIEW_MODERATION_STATUSES, example: 'approved' })
  @IsIn(REVIEW_MODERATION_STATUSES)
  moderationStatus!: ReviewModerationStatus;
}

export class TenancyReviewResponseDto implements TenancyReviewView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  agreementId!: string;

  @ApiProperty()
  reviewerId!: string;

  @ApiProperty()
  revieweeId!: string;

  @ApiProperty({ enum: TENANCY_REVIEWER_ROLES })
  reviewerRole!: TenancyReviewerRole;

  @ApiProperty()
  communicationRating!: number;

  @ApiProperty()
  maintenanceRating!: number;

  @ApiProperty()
  propertyCareRating!: number;

  @ApiProperty()
  agreementClarityRating!: number;

  @ApiProperty()
  overallRating!: number;

  @ApiProperty({ nullable: true })
  reviewTitle!: string | null;

  @ApiProperty()
  reviewContent!: string;

  @ApiProperty()
  isPublic!: boolean;

  @ApiProperty({ enum: REVIEW_MODERATION_STATUSES })
  moderationStatus!: ReviewModerationStatus;

  @ApiPropertyOptional()
  reviewerName?: string;

  @ApiProperty()
  createdAt!: string;
}

