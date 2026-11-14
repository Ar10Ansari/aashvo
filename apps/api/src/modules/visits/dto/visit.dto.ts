import { VISIT_STATUSES, type VisitStatus } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVisitDto {
  @ApiProperty({
    description: 'Target property listing ID to visit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsUUID()
  @IsNotEmpty()
  propertyId!: string;

  @ApiProperty({
    description: 'Requested date & time (ISO 8601 string)',
    example: '2026-11-20T11:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Optional introductory message from visitor to the host',
    example: 'Hi, I am interested in viewing the room this Saturday morning.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  visitorMessage?: string;
}

export class UpdateVisitStatusDto {
  @ApiProperty({
    enum: ['confirm', 'reject', 'cancel', 'complete'],
    description: 'Action to perform on the visit',
    example: 'confirm',
  })
  @IsIn(['confirm', 'reject', 'cancel', 'complete'])
  action!: 'confirm' | 'reject' | 'cancel' | 'complete';

  @ApiPropertyOptional({
    description: 'Optional notes from the host regarding the visit',
    example: 'Confirmed. Please ring bell 302 at the front gate.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  hostNotes?: string;
}

export class RescheduleVisitDto {
  @ApiProperty({
    description: 'Proposed new date & time slot (ISO 8601 string)',
    example: '2026-11-21T14:30:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  rescheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Reason for requesting a reschedule',
    example: 'Travelling on Friday, proposing Saturday afternoon instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class GetVisitsQueryDto {
  @ApiPropertyOptional({
    enum: ['all', 'as_visitor', 'as_host'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'as_visitor', 'as_host'])
  roleFilter?: 'all' | 'as_visitor' | 'as_host';

  @ApiPropertyOptional({
    enum: VISIT_STATUSES,
  })
  @IsOptional()
  @IsEnum(VISIT_STATUSES)
  status?: VisitStatus;
}

export class PropertyVisitResponseDto {
  @ApiProperty({ example: 'vst-91823a-12904b' })
  id!: string;

  @ApiProperty({ example: '4c9e6679-7425-40de-944b-e07fc1f90ae7' })
  propertyId!: string;

  @ApiProperty({ example: 'Furnished Master Room in DLF Phase 2' })
  propertyTitle!: string;

  @ApiProperty({ example: 'Gurugram' })
  propertyCity!: string;

  @ApiProperty({ example: 'Cyber City' })
  propertyLocality!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  visitorId!: string;

  @ApiProperty({ example: 'Rohan Verma' })
  visitorName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  visitorPhone?: string | null;

  @ApiProperty({ example: '8b9e6679-7425-40de-944b-e07fc1f90fe2' })
  hostId!: string;

  @ApiProperty({ example: 'Pooja Hegde' })
  hostName!: string;

  @ApiPropertyOptional({ example: '+919876543211' })
  hostPhone?: string | null;

  @ApiProperty({ example: '2026-11-20T11:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty({ example: '20 Nov 2026, 04:30 PM IST' })
  scheduledAtIST!: string;

  @ApiProperty({ enum: VISIT_STATUSES, example: 'pending' })
  status!: VisitStatus;

  @ApiPropertyOptional({ example: 'Hi, I work in Cyber City.' })
  visitorMessage?: string | null;

  @ApiPropertyOptional({ example: 'Gate pass required.' })
  hostNotes?: string | null;

  @ApiPropertyOptional({ example: '2026-11-21T14:30:00.000Z' })
  rescheduledAt?: string | null;

  @ApiPropertyOptional({ example: '21 Nov 2026, 08:00 PM IST' })
  rescheduledAtIST?: string | null;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  rescheduledBy?: string | null;

  @ApiProperty({ example: '2026-11-15T01:35:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-15T01:35:00.000Z' })
  updatedAt!: string;
}
