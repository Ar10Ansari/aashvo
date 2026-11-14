import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateFlatmateProfileDto,
  FlatmateProfileResponseDto,
  PaginatedFlatmatesResponseDto,
  SearchFlatmatesQueryDto,
  UpdateFlatmateProfileDto,
} from './dto/flatmate.dto';
import { FlatmatesService } from './flatmates.service';

@ApiTags('Flatmates & Shared Living')
@Controller('api/v1/flatmates')
export class FlatmatesController {
  constructor(private readonly flatmatesService: FlatmatesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search flatmate candidates and room-sharing listings across Indian cities',
  })
  @ApiResponse({ status: 200, type: PaginatedFlatmatesResponseDto })
  async searchFlatmates(
    @Query() query: SearchFlatmatesQueryDto,
    @Req() req: RequestWithId,
  ): Promise<PaginatedFlatmatesResponseDto> {
    const callerUserId = req.user?.id;
    return this.flatmatesService.searchFlatmates(query, callerUserId);
  }

  @Get('me')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get current authenticated user’s flatmate profile' })
  @ApiResponse({ status: 200, type: FlatmateProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FlatmateProfileResponseDto> {
    return this.flatmatesService.getMyProfile(user.id);
  }

  @Post('me')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Create a flatmate discovery profile for current user' })
  @ApiResponse({ status: 201, type: FlatmateProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed or applicant is under 18' })
  @ApiResponse({ status: 409, description: 'Flatmate profile already exists' })
  async createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlatmateProfileDto,
    @Req() req: RequestWithId,
  ): Promise<FlatmateProfileResponseDto> {
    return this.flatmatesService.createProfile(user.id, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Update flatmate discovery preferences and budget for current user' })
  @ApiResponse({ status: 200, type: FlatmateProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Flatmate profile not found' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFlatmateProfileDto,
    @Req() req: RequestWithId,
  ): Promise<FlatmateProfileResponseDto> {
    return this.flatmatesService.updateProfile(user.id, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get detailed flatmate profile with lifestyle compatibility score' })
  @ApiResponse({ status: 200, type: FlatmateProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Flatmate profile not found' })
  async getProfileById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithId,
  ): Promise<FlatmateProfileResponseDto> {
    const callerUserId = req.user?.id;
    return this.flatmatesService.getProfileById(id, callerUserId);
  }
}

