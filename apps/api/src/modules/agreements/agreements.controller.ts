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
import { AgreementsService } from './agreements.service';
import {
  AgreementResponseDto,
  CreateAgreementDto,
  CreatePaymentRecordDto,
  RentPaymentRecordResponseDto,
  UpdateAgreementStatusDto,
} from './dto/agreement.dto';

@ApiTags('Tenancy Agreements & Rent Trust')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenancy agreement draft' })
  @ApiResponse({ status: 201, type: AgreementResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid dates or same party error' })
  @ApiResponse({ status: 404, description: 'Tenant profile or property not found' })
  async createAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAgreementDto,
    @Req() req: RequestWithId,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.createAgreement(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get('mine')
  @ApiOperation({ summary: 'List tenancy agreements where caller is landlord or tenant' })
  @ApiResponse({ status: 200, type: [AgreementResponseDto] })
  async getMyAgreements(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AgreementResponseDto[]> {
    return this.agreementsService.getMyAgreements(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a tenancy agreement' })
  @ApiResponse({ status: 200, type: AgreementResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async getAgreementById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.getAgreementById(id, user.id, user.role);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update status of a tenancy agreement (activate, terminate, expire)' })
  @ApiResponse({ status: 200, type: AgreementResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: not authorized' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async updateAgreementStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgreementStatusDto,
    @Req() req: RequestWithId,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.updateAgreementStatus(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a rent or deposit payment against an agreement' })
  @ApiResponse({ status: 201, type: RentPaymentRecordResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid payment parameters' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentRecordDto,
    @Req() req: RequestWithId,
  ): Promise<RentPaymentRecordResponseDto> {
    return this.agreementsService.recordPayment(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'List all recorded payments for an agreement' })
  @ApiResponse({ status: 200, type: [RentPaymentRecordResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async getAgreementPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RentPaymentRecordResponseDto[]> {
    return this.agreementsService.getAgreementPayments(id, user.id, user.role);
  }
}

