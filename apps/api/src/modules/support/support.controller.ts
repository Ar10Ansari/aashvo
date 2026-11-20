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
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateSafetyReportDto,
  CreateSupportTicketDto,
  CreateTicketMessageDto,
  GuestSupportTicketDto,
  SupportTicketResponseDto,
  TicketMessageResponseDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('Customer Support & Assistance')
@Controller('api/v1/support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Submit a customer support ticket (Authenticated users)' })
  @ApiResponse({ status: 201, type: SupportTicketResponseDto })
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
    @Req() req: RequestWithId,
  ): Promise<SupportTicketResponseDto> {
    return this.supportService.createTicket(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Public()
  @Post('guest')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Submit a guest inquiry or support ticket without an account' })
  @ApiResponse({ status: 201, type: SupportTicketResponseDto })
  async createGuestTicket(
    @Body() dto: GuestSupportTicketDto,
    @Req() req: RequestWithId,
  ): Promise<SupportTicketResponseDto> {
    return this.supportService.createGuestTicket(dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Public()
  @Post('reports')
  @ApiOperation({ summary: 'Submit a safety or listing violation report (Public / Guest / Authenticated)' })
  @ApiResponse({ status: 201, description: 'Safety report submitted successfully' })
  async submitSafetyReport(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: CreateSafetyReportDto,
    @Req() req: RequestWithId,
  ): Promise<{ success: boolean; id: string; message: string }> {
    return this.supportService.submitSafetyReport(user?.id || null, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get('mine')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'List support tickets created by the authenticated user' })
  @ApiResponse({ status: 200, type: [SupportTicketResponseDto] })
  async getMyTickets(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SupportTicketResponseDto[]> {
    return this.supportService.getMyTickets(user.id);
  }

  @Get(':id')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get details and conversation messages for a support ticket' })
  @ApiResponse({ status: 200, type: SupportTicketResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not ticket owner or admin' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupportTicketResponseDto> {
    return this.supportService.getTicketById(id, user.id, user.role);
  }

  @Post(':id/messages')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Send a reply message on a support ticket' })
  @ApiResponse({ status: 201, type: TicketMessageResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not authorized' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addTicketMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
    @Req() req: RequestWithId,
  ): Promise<TicketMessageResponseDto> {
    return this.supportService.addTicketMessage(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Patch(':id/status')
  @ApiBearerAuth('BearerAuth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update ticket resolution status or assignment (Admin/Staff only)' })
  @ApiResponse({ status: 200, type: SupportTicketResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: admin role required' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicketStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @Req() req: RequestWithId,
  ): Promise<SupportTicketResponseDto> {
    return this.supportService.updateTicketStatus(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

