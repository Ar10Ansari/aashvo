import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../common/decorators/roles.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreatePropertyDto,
  ModeratePropertyDto,
  PaginatedPropertiesResponseDto,
  PropertyDetailDto,
  PropertyListItemDto,
  PropertyVerificationResponseDto,
  ReviewPropertyVerificationDto,
  SearchPropertiesQueryDto,
  SubmitPropertyVerificationDto,
  UpdatePropertyDto,
} from './dto/property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties & Listings')
@Controller('api/v1/properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Search and filter active properties across Indian cities' })
  @ApiResponse({ status: 200, type: PaginatedPropertiesResponseDto })
  async searchProperties(
    @Query() query: SearchPropertiesQueryDto,
  ): Promise<PaginatedPropertiesResponseDto> {
    return this.propertiesService.searchProperties(query);
  }

  @Get('mine')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'List all properties owned by the authenticated user across all statuses' })
  @ApiResponse({ status: 200, type: [PropertyListItemDto] })
  async getMyProperties(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PropertyListItemDto[]> {
    return this.propertiesService.getMyProperties(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get full property listing details by ID' })
  @ApiResponse({ status: 200, type: PropertyDetailDto })
  @ApiResponse({ status: 404, description: 'Property not found or inactive' })
  async getPropertyById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithId,
  ): Promise<PropertyDetailDto> {
    // CurrentUser might not be populated if public, but extract if bearer token is present
    const callerId = req.user?.id;
    const callerRole = req.user?.role;
    return this.propertiesService.getPropertyById(id, callerId, callerRole);
  }

  @Post()
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Create a new property listing (defaults to pending_review)' })
  @ApiResponse({ status: 201, type: PropertyDetailDto })
  @ApiResponse({ status: 400, description: 'Validation failed or family stay constraint violated' })
  async createProperty(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePropertyDto,
    @Req() req: RequestWithId,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.createProperty(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Patch(':id')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Update an existing property listing (owner or admin only)' })
  @ApiResponse({ status: 200, type: PropertyDetailDto })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not the listing owner' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async updateProperty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() req: RequestWithId,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.updateProperty(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Delete a property listing (owner or admin only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async deleteProperty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithId,
  ): Promise<void> {
    await this.propertiesService.deleteProperty(id, user.id, user.role, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Patch(':id/moderate')
  @Roles('admin')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Moderate property listing (approve/reject/pause) - Admin only' })
  @ApiResponse({ status: 200, type: PropertyDetailDto })
  @ApiResponse({ status: 403, description: 'Forbidden: admin role required' })
  async moderateProperty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModeratePropertyDto,
    @Req() req: RequestWithId,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.moderateProperty(id, user.id, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Post(':id/verification')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Submit property ownership & ID verification documents' })
  @ApiResponse({ status: 201, type: PropertyVerificationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not the property owner' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPropertyVerificationDto,
  ): Promise<PropertyVerificationResponseDto> {
    return this.propertiesService.submitVerification(user.id, id, dto);
  }

  @Get(':id/verification')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get property verification status and history' })
  @ApiResponse({ status: 200, type: PropertyVerificationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not owner or admin' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PropertyVerificationResponseDto> {
    return this.propertiesService.getVerification(user.id, user.role, id);
  }

  @Patch(':id/verification/review')
  @Roles('admin')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Review property verification submission (approve or reject) - Admin only' })
  @ApiResponse({ status: 200, type: PropertyVerificationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: admin role required' })
  @ApiResponse({ status: 404, description: 'Verification submission not found' })
  async reviewVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPropertyVerificationDto,
  ): Promise<PropertyVerificationResponseDto> {
    return this.propertiesService.reviewVerification(user.id, id, dto);
  }
}

