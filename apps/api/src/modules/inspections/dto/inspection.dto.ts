import {
  INSPECTION_TYPES,
  type InspectionType,
  type InspectionView,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateInspectionDto {
  @ApiProperty({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  agreementId!: string;

  @ApiProperty({ enum: INSPECTION_TYPES, example: 'move_in' })
  @IsIn(INSPECTION_TYPES)
  inspectionType!: InspectionType;

  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  inspectionDate!: string;

  @ApiProperty({ example: 'Master Bedroom' })
  @IsString()
  roomName!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  conditionRating!: number;

  @ApiPropertyOptional({ example: 'Minor scuff on the left baseboard.' })
  @IsOptional()
  @IsString()
  damageNotes?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://storage.aashvo.com/inspections/bed1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiPropertyOptional({ example: { electricityKwh: 1240.5, waterUnits: 15 } })
  @IsOptional()
  meterReadings?: Record<string, any>;

  @ApiPropertyOptional({
    example: [
      { name: 'Ceiling Fan', category: 'electrical', condition: 'excellent' },
      { name: 'Queen Bed & Mattress', category: 'furniture', condition: 'good' },
    ],
  })
  @IsOptional()
  @IsArray()
  inventory?: any[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  keyHandoverConfirmed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  depositConfirmed?: boolean;
}

export class InspectionResponseDto implements InspectionView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  agreementId!: string;

  @ApiProperty({ enum: INSPECTION_TYPES })
  inspectionType!: InspectionType;

  @ApiProperty()
  conductedBy!: string;

  @ApiProperty()
  inspectionDate!: string;

  @ApiProperty()
  roomName!: string;

  @ApiProperty()
  conditionRating!: number;

  @ApiProperty({ nullable: true })
  damageNotes!: string | null;

  @ApiProperty({ type: [String] })
  photoUrls!: string[];

  @ApiPropertyOptional()
  meterReadings?: Record<string, any>;

  @ApiPropertyOptional()
  inventory?: any[];

  @ApiPropertyOptional()
  keyHandoverConfirmed?: boolean;

  @ApiPropertyOptional()
  depositConfirmed?: boolean;

  @ApiProperty()
  acknowledgedByCounterparty!: boolean;

  @ApiProperty({ nullable: true })
  acknowledgedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  conductorName?: string;
}

