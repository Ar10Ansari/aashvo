import {
  ERROR_CODES,
  type AgreementStatus,
  type PaymentCategory,
  type PaymentVerificationStatus,
  type UserRole,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  AgreementResponseDto,
  CreateAgreementDto,
  CreatePaymentRecordDto,
  RentPaymentRecordResponseDto,
  UpdateAgreementStatusDto,
} from './dto/agreement.dto';

interface CallMeta {
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private mapAgreementToDto(agreement: {
    id: string;
    propertyId: string | null;
    landlordId: string;
    tenantId: string;
    monthlyRent: Prisma.Decimal | number;
    securityDeposit: Prisma.Decimal | number;
    startDate: Date;
    endDate: Date | null;
    agreementStatus: string;
    documentUrl: string | null;
    termsSummary: string | null;
    createdAt: Date;
    updatedAt: Date;
    property?: { title: string } | null;
    landlord?: { fullName: string } | null;
    tenant?: { fullName: string } | null;
  }): AgreementResponseDto {
    return {
      id: agreement.id,
      propertyId: agreement.propertyId,
      landlordId: agreement.landlordId,
      tenantId: agreement.tenantId,
      monthlyRent: Number(agreement.monthlyRent),
      securityDeposit: Number(agreement.securityDeposit),
      startDate: agreement.startDate.toISOString().split('T')[0],
      endDate: agreement.endDate ? agreement.endDate.toISOString().split('T')[0] : null,
      agreementStatus: agreement.agreementStatus as AgreementStatus,
      documentUrl: agreement.documentUrl,
      termsSummary: agreement.termsSummary,
      createdAt: agreement.createdAt.toISOString(),
      updatedAt: agreement.updatedAt.toISOString(),
      propertyTitle: agreement.property?.title,
      landlordName: agreement.landlord?.fullName,
      tenantName: agreement.tenant?.fullName,
    };
  }

  private mapPaymentToDto(payment: {
    id: string;
    agreementId: string;
    payerId: string;
    recipientId: string;
    amount: Prisma.Decimal | number;
    paymentCategory: string;
    paymentDate: Date;
    receiptUrl: string | null;
    transactionReference: string | null;
    verificationStatus: string;
    notes: string | null;
    createdAt: Date;
  }): RentPaymentRecordResponseDto {
    return {
      id: payment.id,
      agreementId: payment.agreementId,
      payerId: payment.payerId,
      recipientId: payment.recipientId,
      amount: Number(payment.amount),
      paymentCategory: payment.paymentCategory as PaymentCategory,
      paymentDate: payment.paymentDate.toISOString().split('T')[0],
      receiptUrl: payment.receiptUrl,
      transactionReference: payment.transactionReference,
      verificationStatus: payment.verificationStatus as PaymentVerificationStatus,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  async createAgreement(
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateAgreementDto,
    meta?: CallMeta,
  ): Promise<AgreementResponseDto> {
    const landlordId = callerRole === 'admin' ? (dto.tenantId === callerUserId ? dto.tenantId : callerUserId) : callerUserId;
    const tenantId = dto.tenantId;

    if (landlordId === tenantId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Landlord and tenant must be distinct parties',
      });
    }

    const startDate = new Date(dto.startDate);
    let endDate: Date | null = null;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
      if (endDate < startDate) {
        throw new BadRequestException({
          code: ERROR_CODES.BAD_REQUEST,
          message: 'End date must be on or after start date',
        });
      }
    }

    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
        select: { id: true, ownerId: true },
      });
      if (!property) {
        throw new NotFoundException({
          code: ERROR_CODES.PROPERTY_NOT_FOUND,
          message: `Property with ID ${dto.propertyId} not found`,
        });
      }
      if (callerRole !== 'admin' && property.ownerId !== callerUserId) {
        throw new ForbiddenException({
          code: ERROR_CODES.UNAUTHORIZED_PROPERTY_ACCESS,
          message: 'Only the property owner or an administrator can draft an agreement for this property',
        });
      }
    }

    const tenantProfile = await this.prisma.profile.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenantProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: `Tenant profile with ID ${tenantId} not found`,
      });
    }

    const created = await this.prisma.tenancyAgreement.create({
      data: {
        propertyId: dto.propertyId,
        landlordId,
        tenantId,
        monthlyRent: new Prisma.Decimal(dto.monthlyRent),
        securityDeposit: new Prisma.Decimal(dto.securityDeposit),
        startDate,
        endDate,
        agreementStatus: 'draft',
        documentUrl: dto.documentUrl,
        termsSummary: dto.termsSummary,
      },
      include: {
        property: { select: { title: true } },
        landlord: { select: { fullName: true } },
        tenant: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'agreement.created',
      entityType: 'tenancy_agreement',
      entityId: created.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: created.id, status: created.agreementStatus, landlordId, tenantId },
    });

    return this.mapAgreementToDto(created);
  }

  async getMyAgreements(callerUserId: string): Promise<AgreementResponseDto[]> {
    const records = await this.prisma.tenancyAgreement.findMany({
      where: {
        OR: [{ landlordId: callerUserId }, { tenantId: callerUserId }],
      },
      include: {
        property: { select: { title: true } },
        landlord: { select: { fullName: true } },
        tenant: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapAgreementToDto(r));
  }

  async getAgreementById(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
  ): Promise<AgreementResponseDto> {
    const agreement = await this.prisma.tenancyAgreement.findUnique({
      where: { id },
      include: {
        property: { select: { title: true } },
        landlord: { select: { fullName: true } },
        tenant: { select: { fullName: true } },
      },
    });

    if (!agreement) {
      throw new NotFoundException({
        code: ERROR_CODES.AGREEMENT_NOT_FOUND,
        message: `Tenancy agreement ${id} not found`,
      });
    }

    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'You are not authorized to view this agreement',
      });
    }

    return this.mapAgreementToDto(agreement);
  }

  async updateAgreementStatus(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: UpdateAgreementStatusDto,
    meta?: CallMeta,
  ): Promise<AgreementResponseDto> {
    const agreement = await this.prisma.tenancyAgreement.findUnique({
      where: { id },
    });

    if (!agreement) {
      throw new NotFoundException({
        code: ERROR_CODES.AGREEMENT_NOT_FOUND,
        message: `Tenancy agreement ${id} not found`,
      });
    }

    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'You are not authorized to modify this agreement',
      });
    }

    const updated = await this.prisma.tenancyAgreement.update({
      where: { id },
      data: { agreementStatus: dto.agreementStatus },
      include: {
        property: { select: { title: true } },
        landlord: { select: { fullName: true } },
        tenant: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'agreement.status_updated',
      entityType: 'tenancy_agreement',
      entityId: id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { beforeStatus: agreement.agreementStatus, afterStatus: updated.agreementStatus },
    });

    return this.mapAgreementToDto(updated);
  }

  async recordPayment(
    agreementId: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: CreatePaymentRecordDto,
    meta?: CallMeta,
  ): Promise<RentPaymentRecordResponseDto> {
    const agreement = await this.prisma.tenancyAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      throw new NotFoundException({
        code: ERROR_CODES.AGREEMENT_NOT_FOUND,
        message: `Tenancy agreement ${agreementId} not found`,
      });
    }

    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'You are not authorized to record payments for this agreement',
      });
    }

    if (dto.payerId === dto.recipientId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Payer and recipient must be distinct parties',
      });
    }

    const payment = await this.prisma.rentPaymentRecord.create({
      data: {
        agreementId,
        payerId: dto.payerId,
        recipientId: dto.recipientId,
        amount: new Prisma.Decimal(dto.amount),
        paymentCategory: dto.paymentCategory,
        paymentDate: new Date(dto.paymentDate),
        receiptUrl: dto.receiptUrl,
        transactionReference: dto.transactionReference,
        verificationStatus: 'pending_confirmation',
        notes: dto.notes,
      },
    });

    await this.audit.record({
      eventType: 'rent_payment.recorded',
      entityType: 'rent_payment_record',
      entityId: payment.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: payment.id, amount: dto.amount, category: dto.paymentCategory },
    });

    return this.mapPaymentToDto(payment);
  }

  async getAgreementPayments(
    agreementId: string,
    callerUserId: string,
    callerRole: UserRole,
  ): Promise<RentPaymentRecordResponseDto[]> {
    const agreement = await this.prisma.tenancyAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      throw new NotFoundException({
        code: ERROR_CODES.AGREEMENT_NOT_FOUND,
        message: `Tenancy agreement ${agreementId} not found`,
      });
    }

    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'You are not authorized to view payments for this agreement',
      });
    }

    const payments = await this.prisma.rentPaymentRecord.findMany({
      where: { agreementId },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((p) => this.mapPaymentToDto(p));
  }
}
