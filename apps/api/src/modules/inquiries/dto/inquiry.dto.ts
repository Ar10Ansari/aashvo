import { INQUIRY_STATUSES, type InquiryStatus } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInquiryDto {
  @ApiPropertyOptional({
    description: 'Target property listing ID. Exactly one of propertyId or targetFlatmateId must be provided.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Target flatmate profile ID. Exactly one of propertyId or targetFlatmateId must be provided.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  targetFlatmateId?: string;

  @ApiProperty({ example: 'Rohan Verma', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  senderName!: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s\-()]/g, '') : value))
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'senderPhone must be a valid international phone format (e.g. +919876543210)',
  })
  senderPhone!: string;

  @ApiProperty({ example: 'rohan.verma@example.com' })
  @IsEmail()
  senderEmail!: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  moveInDate?: string;

  @ApiProperty({
    example: 'Hi, I am interested in renting this room. Can we schedule a visit this Saturday?',
    minLength: 5,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}

export class UpdateInquiryStatusDto {
  @ApiProperty({ enum: ['accepted', 'declined'], example: 'accepted' })
  @IsEnum(['accepted', 'declined'])
  status!: 'accepted' | 'declined';
}

export class InquiryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty({ nullable: true })
  propertyId!: string | null;

  @ApiProperty({ nullable: true })
  targetFlatmateId!: string | null;

  @ApiProperty()
  senderName!: string;

  @ApiProperty({
    description: 'Direct phone number; masked with asterisks while status is pending unless caller is sender',
  })
  senderPhone!: string;

  @ApiProperty()
  senderEmail!: string;

  @ApiProperty({ nullable: true })
  moveInDate!: string | null;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: INQUIRY_STATUSES })
  status!: InquiryStatus;

  @ApiProperty({ example: 'property' })
  targetType!: 'property' | 'flatmate';

  @ApiPropertyOptional({ example: 'Spacious 2BHK in Hauz Khas' })
  targetTitle?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
