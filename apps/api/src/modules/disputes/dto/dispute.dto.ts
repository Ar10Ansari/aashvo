import {
  DISPUTE_STATUSES,
  DISPUTE_TYPES,
  type DisputeStatus,
  type DisputeType,
  type DisputeView,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  agreementId!: string;

  @ApiProperty({ enum: DISPUTE_TYPES, example: 'deposit_deduction' })
  @IsIn(DISPUTE_TYPES)
  disputeType!: DisputeType;

  @ApiPropertyOptional({ example: 15000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  disputedAmount?: number;

  @ApiProperty({ example: 'Unwarranted painting deduction from security deposit' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Landlord withheld Rs. 15,000 for painting despite move-in inspection showing scuffed walls.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ type: [String], example: ['https://storage.aashvo.com/disputes/inspection_report.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: DISPUTE_STATUSES, example: 'resolved_tenant' })
  @IsIn(DISPUTE_STATUSES)
  status!: DisputeStatus;

  @ApiProperty({ example: 'Based on move-in inspection evidence, the scuffed walls pre-existed. Full deposit refund ordered.' })
  @IsString()
  resolutionSummary!: string;
}

export class DisputeResponseDto implements DisputeView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  disputeNumber!: string;

  @ApiProperty()
  agreementId!: string;

  @ApiProperty()
  initiatorId!: string;

  @ApiProperty()
  respondentId!: string;

  @ApiProperty({ enum: DISPUTE_TYPES })
  disputeType!: DisputeType;

  @ApiProperty()
  disputedAmount!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: DISPUTE_STATUSES })
  status!: DisputeStatus;

  @ApiProperty({ type: [String] })
  evidenceUrls!: string[];

  @ApiProperty({ nullable: true })
  resolutionSummary!: string | null;

  @ApiProperty({ nullable: true })
  assignedModeratorId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  resolvedAt!: string | null;

  @ApiPropertyOptional()
  initiatorName?: string;

  @ApiPropertyOptional()
  respondentName?: string;
}

