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
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateInspectionDto,
  InspectionResponseDto,
} from './dto/inspection.dto';
import { InspectionsService } from './inspections.service';

@ApiTags('Property Inspections & Move-in Condition')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a move-in, periodic, or move-out inspection' })
  @ApiResponse({ status: 201, type: InspectionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid rating or date' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant of agreement' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async createInspection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInspectionDto,
    @Req() req: RequestWithId,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.createInspection(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get('agreement/:agreementId')
  @ApiOperation({ summary: 'List all inspections for a tenancy agreement' })
  @ApiResponse({ status: 200, type: [InspectionResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden: not authorized' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async getAgreementInspections(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agreementId', ParseUUIDPipe) agreementId: string,
  ): Promise<InspectionResponseDto[]> {
    return this.inspectionsService.getAgreementInspections(agreementId, user.id, user.role);
  }

  @Patch(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Counterparty digital sign-off and acknowledgement of inspection' })
  @ApiResponse({ status: 200, type: InspectionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is conductor or not a participant' })
  @ApiResponse({ status: 404, description: 'Inspection not found' })
  async acknowledgeInspection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithId,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.acknowledgeInspection(id, user.id, user.role, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

