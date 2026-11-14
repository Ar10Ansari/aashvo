import { MEALS_OFFERED, type MealsOffered } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PropertyDetailDto, PropertyListItemDto } from '../../properties/dto/property.dto';

export class SearchFamilyStaysQueryDto {
  @ApiPropertyOptional({ example: 'Delhi NCR' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Hauz Khas' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ enum: MEALS_OFFERED })
  @IsOptional()
  @IsEnum(MEALS_OFFERED)
  mealsOffered?: MealsOffered;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRent?: number;

  @ApiPropertyOptional({ example: 35000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRent?: number;

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

export class FamilyStayListItemDto extends PropertyListItemDto {
  @ApiProperty({ example: true, description: 'Verified that the host family lives on property' })
  verifiedHostFamily!: boolean;
}

export class FamilyStayDetailDto extends PropertyDetailDto {
  @ApiProperty({ example: true })
  verifiedHostFamily!: boolean;

  @ApiProperty({ example: 'Home-cooked North Indian vegetarian meals prepared daily by the family' })
  mealsDescription?: string;
}

export class PaginatedFamilyStaysResponseDto {
  @ApiProperty({ type: [FamilyStayListItemDto] })
  data!: FamilyStayListItemDto[];

  @ApiProperty()
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

