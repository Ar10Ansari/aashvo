import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  FamilyStayDetailDto,
  PaginatedFamilyStaysResponseDto,
  SearchFamilyStaysQueryDto,
} from './dto/family-stays.dto';
import { FamilyStaysService } from './family-stays.service';

@ApiTags('Family Stays')
@Controller('api/v1/family-stays')
export class FamilyStaysController {
  constructor(private readonly familyStaysService: FamilyStaysService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search verified Family Stays with living host family and home-cooked meal options',
  })
  @ApiResponse({ status: 200, type: PaginatedFamilyStaysResponseDto })
  async searchFamilyStays(
    @Query() query: SearchFamilyStaysQueryDto,
  ): Promise<PaginatedFamilyStaysResponseDto> {
    return this.familyStaysService.searchFamilyStays(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get details of a verified Family Stay listing',
  })
  @ApiResponse({ status: 200, type: FamilyStayDetailDto })
  @ApiResponse({ status: 404, description: 'Family stay not found or inactive' })
  async getFamilyStayById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyStayDetailDto> {
    return this.familyStaysService.getFamilyStayById(id);
  }
}

