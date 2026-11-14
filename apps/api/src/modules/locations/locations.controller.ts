import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  GetCitiesQueryDto,
  GetLandmarksQueryDto,
  GetLocalitiesQueryDto,
  LandmarkResponseDto,
  LocalityResponseDto,
  LocationsResponseDto,
} from './dto/locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('api/v1/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  @Public()
  @ApiOperation({
    summary: 'Get supported Indian cities with active listing counts and popular localities',
  })
  @ApiResponse({ status: 200, type: LocationsResponseDto })
  async getCities(@Query() query: GetCitiesQueryDto): Promise<LocationsResponseDto> {
    return this.locationsService.getCities(query.withInventoryOnly);
  }

  @Get('localities')
  @Public()
  @ApiOperation({
    summary: 'Get verified localities and transit lines for a specified city, PIN code, or search term',
  })
  @ApiResponse({ status: 200, type: [LocalityResponseDto] })
  async getLocalities(@Query() query: GetLocalitiesQueryDto): Promise<LocalityResponseDto[]> {
    return this.locationsService.getLocalities(
      query.city,
      query.search,
      query.withInventoryOnly,
      query.pincode,
    );
  }

  @Get('landmarks')
  @Public()
  @ApiOperation({
    summary: 'Search verified landmarks (universities, tech parks, metro stations) with optional proximity',
  })
  @ApiResponse({ status: 200, type: [LandmarkResponseDto] })
  async getLandmarks(@Query() query: GetLandmarksQueryDto): Promise<LandmarkResponseDto[]> {
    return this.locationsService.getLandmarks(query);
  }
}

