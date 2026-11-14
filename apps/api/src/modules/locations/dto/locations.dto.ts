import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetCitiesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter cities to only those with active live listings in the database',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withInventoryOnly?: boolean;
}

export class GetLocalitiesQueryDto {
  @ApiProperty({ description: 'City name (e.g. Gurugram, Delhi NCR, Bengaluru)', example: 'Gurugram' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({ description: 'Optional substring filter for locality search', example: 'Cyber' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Optional 6-digit Indian PIN code filter', example: '122002' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({
    description: 'Filter localities to only those with active live listings in the database',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withInventoryOnly?: boolean;
}

export class LocalityResponseDto {
  @ApiProperty({ example: 'Cyber City' })
  name!: string;

  @ApiPropertyOptional({ example: '122002' })
  pincode?: string;

  @ApiPropertyOptional({ example: 'Rapid Metro' })
  metroLine?: string;

  @ApiPropertyOptional({ example: ['DLF Phase 2', 'Cyber Hub'] })
  landmarks?: string[];

  @ApiPropertyOptional({ example: 4, description: 'Number of active listings in this locality' })
  activeListingCount?: number;
}

export class CityResponseDto {
  @ApiProperty({ example: 'gurugram' })
  id!: string;

  @ApiProperty({ example: 'Gurugram' })
  name!: string;

  @ApiProperty({ example: 'Haryana' })
  state!: string;

  @ApiProperty({ example: 28.4595 })
  latitude!: number;

  @ApiProperty({ example: 77.0266 })
  longitude!: number;

  @ApiProperty({ example: 12, description: 'Total verified active properties available in this city' })
  activeListingCount!: number;

  @ApiProperty({ type: [LocalityResponseDto] })
  popularLocalities!: LocalityResponseDto[];
}

export class LocationsResponseDto {
  @ApiProperty({ type: [CityResponseDto] })
  cities!: CityResponseDto[];

  @ApiProperty({ example: 7 })
  totalCities!: number;
}

export class GetLandmarksQueryDto {
  @ApiPropertyOptional({ description: 'Filter landmarks by city (e.g. Gurugram, Delhi NCR, Bengaluru)', example: 'Delhi NCR' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter landmarks by category', enum: ['university', 'office_park', 'metro_station'], example: 'university' })
  @IsOptional()
  @IsString()
  category?: 'university' | 'office_park' | 'metro_station';

  @ApiPropertyOptional({ description: 'Search term for landmark name or locality', example: 'IIT' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate for distance computation', example: 28.4595 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate for distance computation', example: 77.0266 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  longitude?: number;
}

export class LandmarkResponseDto {
  @ApiProperty({ example: 'lm-iit-delhi' })
  id!: string;

  @ApiProperty({ example: 'IIT Delhi' })
  name!: string;

  @ApiProperty({ example: 'university' })
  category!: 'university' | 'office_park' | 'metro_station';

  @ApiProperty({ example: 'Delhi NCR' })
  city!: string;

  @ApiProperty({ example: 'Hauz Khas' })
  locality!: string;

  @ApiProperty({ example: 28.545 })
  latitude!: number;

  @ApiProperty({ example: 77.1926 })
  longitude!: number;

  @ApiPropertyOptional({ example: 'IIT Metro Station (Magenta Line)' })
  nearestMetro?: string;

  @ApiPropertyOptional({ example: 2.4, description: 'Approximate distance in km from provided coordinates' })
  distanceKm?: number;
}


