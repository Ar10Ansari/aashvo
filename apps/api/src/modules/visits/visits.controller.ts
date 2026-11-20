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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateVisitDto,
  GetVisitsQueryDto,
  PropertyVisitResponseDto,
  RescheduleVisitDto,
  UpdateVisitStatusDto,
} from './dto/visit.dto';
import { VisitsService } from './visits.service';

@ApiTags('Property Visits & Viewing Scheduling')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Request an in-person property visit or viewing appointment' })
  @ApiResponse({ status: 201, type: PropertyVisitResponseDto })
  @ApiResponse({ status: 400, description: 'Attempted to visit own property or invalid time' })
  @ApiResponse({ status: 403, description: 'Blocked user boundary' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async createVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVisitDto,
  ): Promise<PropertyVisitResponseDto> {
    return this.visitsService.createVisit(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scheduled visits for caller (as visitor or host)' })
  @ApiResponse({ status: 200, type: [PropertyVisitResponseDto] })
  async getVisits(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetVisitsQueryDto,
  ): Promise<PropertyVisitResponseDto[]> {
    return this.visitsService.getVisits(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single visit details with IST timestamp formatting' })
  @ApiResponse({ status: 200, type: PropertyVisitResponseDto })
  @ApiResponse({ status: 403, description: 'Caller is neither visitor nor host' })
  @ApiResponse({ status: 404, description: 'Visit not found' })
  async getVisitById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PropertyVisitResponseDto> {
    return this.visitsService.getVisitById(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update visit status (confirm, reject, cancel, complete)' })
  @ApiResponse({ status: 200, type: PropertyVisitResponseDto })
  @ApiResponse({ status: 403, description: 'Unauthorized to perform this action' })
  @ApiResponse({ status: 409, description: 'Conflicting confirmed appointment exists' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitStatusDto,
  ): Promise<PropertyVisitResponseDto> {
    return this.visitsService.updateStatus(user.id, id, dto);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Propose a rescheduled time slot for an appointment' })
  @ApiResponse({ status: 200, type: PropertyVisitResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid future timestamp' })
  @ApiResponse({ status: 403, description: 'Caller not authorized' })
  async rescheduleVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleVisitDto,
  ): Promise<PropertyVisitResponseDto> {
    return this.visitsService.rescheduleVisit(user.id, id, dto);
  }

  @Patch(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Propose a rescheduled time slot for an appointment (PATCH alias)' })
  @ApiResponse({ status: 200, type: PropertyVisitResponseDto })
  async rescheduleVisitPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleVisitDto,
  ): Promise<PropertyVisitResponseDto> {
    return this.visitsService.rescheduleVisit(user.id, id, dto);
  }
}
