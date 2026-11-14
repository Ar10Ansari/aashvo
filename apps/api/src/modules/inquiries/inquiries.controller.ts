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
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateInquiryDto,
  InquiryResponseDto,
  UpdateInquiryStatusDto,
} from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('Inquiries & Interest Requests')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Submit an inquiry or interest request for a property or flatmate' })
  @ApiResponse({ status: 201, type: InquiryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid target or attempted self-inquiry' })
  @ApiResponse({ status: 409, description: 'Duplicate pending inquiry already active' })
  async createInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInquiryDto,
    @Req() req: RequestWithId,
  ): Promise<InquiryResponseDto> {
    return this.inquiriesService.createInquiry(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get('sent')
  @ApiOperation({ summary: 'List all inquiries submitted by the authenticated caller' })
  @ApiResponse({ status: 200, type: [InquiryResponseDto] })
  async getSentInquiries(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InquiryResponseDto[]> {
    return this.inquiriesService.getSentInquiries(user.id);
  }

  @Get('received')
  @ApiOperation({ summary: 'List all inquiries received for properties or flatmate profile owned by caller' })
  @ApiResponse({ status: 200, type: [InquiryResponseDto] })
  async getReceivedInquiries(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InquiryResponseDto[]> {
    return this.inquiriesService.getReceivedInquiries(user.id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept or decline an inquiry (listing owner or target flatmate only)' })
  @ApiResponse({ status: 200, type: InquiryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not authorized to update this inquiry' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async updateInquiryStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInquiryStatusDto,
    @Req() req: RequestWithId,
  ): Promise<InquiryResponseDto> {
    return this.inquiriesService.updateInquiryStatus(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

