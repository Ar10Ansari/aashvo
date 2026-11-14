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
import { DisputesService } from './disputes.service';
import {
  CreateDisputeDto,
  DisputeResponseDto,
  ResolveDisputeDto,
} from './dto/dispute.dto';

@ApiTags('Rental Disputes & Resolution')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiOperation({ summary: 'Raise a formal rental dispute for an active or past tenancy' })
  @ApiResponse({ status: 201, type: DisputeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid dispute parameters or same party' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant of agreement' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  @ApiResponse({ status: 409, description: 'Active dispute of this category already open' })
  async createDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDisputeDto,
    @Req() req: RequestWithId,
  ): Promise<DisputeResponseDto> {
    return this.disputesService.createDispute(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get('mine')
  @ApiOperation({ summary: 'List all disputes where caller is initiator or respondent' })
  @ApiResponse({ status: 200, type: [DisputeResponseDto] })
  async getMyDisputes(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DisputeResponseDto[]> {
    return this.disputesService.getMyDisputes(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute details and evidence' })
  @ApiResponse({ status: 200, type: DisputeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not authorized' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async getDisputeById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisputeResponseDto> {
    return this.disputesService.getDisputeById(id, user.id, user.role);
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a rental dispute with binding decision (Admin only)' })
  @ApiResponse({ status: 200, type: DisputeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: admin role required' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async resolveDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @Req() req: RequestWithId,
  ): Promise<DisputeResponseDto> {
    return this.disputesService.resolveDispute(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

