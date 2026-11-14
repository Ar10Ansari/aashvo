import { SAVED_ITEM_TYPES, type SavedItemType } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSavedItemDto {
  @ApiProperty({
    enum: SAVED_ITEM_TYPES,
    description: 'Type of item being saved to shortlist',
    example: 'property',
  })
  @IsEnum(SAVED_ITEM_TYPES)
  @IsNotEmpty()
  itemType!: SavedItemType;

  @ApiProperty({
    description: 'Target UUID of the property or flatmate profile',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsUUID()
  @IsNotEmpty()
  targetId!: string;

  @ApiPropertyOptional({
    description: 'Optional personal note for this shortlisted item',
    example: 'Close to office, low security deposit',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetSavedItemsQueryDto {
  @ApiPropertyOptional({
    enum: SAVED_ITEM_TYPES,
    description: 'Filter saved items by type',
  })
  @IsOptional()
  @IsEnum(SAVED_ITEM_TYPES)
  itemType?: SavedItemType;
}

export class SavedItemResponseDto {
  @ApiProperty({ example: 'e3b0c442-98fc-1c14-9afb-4c8996fb9242' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiProperty({ enum: SAVED_ITEM_TYPES, example: 'property' })
  itemType!: SavedItemType;

  @ApiProperty({ example: '4c9e6679-7425-40de-944b-e07fc1f90ae7' })
  targetId!: string;

  @ApiPropertyOptional({ example: 'Close to office' })
  notes?: string | null;

  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @ApiProperty({ example: 'active' })
  availabilityStatus!: string;

  @ApiProperty({ example: 'Furnished Master Room in DLF Phase 2' })
  title!: string;

  @ApiPropertyOptional({ example: 'Spacious 2BHK with Balcony' })
  subtitle?: string | null;

  @ApiProperty({ example: 'Gurugram' })
  city!: string;

  @ApiPropertyOptional({ example: 'Cyber City' })
  locality?: string | null;

  @ApiPropertyOptional({ example: 22000 })
  priceMonthly?: number | null;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267' })
  thumbnailUrl?: string | null;

  @ApiProperty({ example: '2026-11-15T01:30:00.000Z' })
  savedAt!: string;
}

