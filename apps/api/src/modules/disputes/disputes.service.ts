import {
  ERROR_CODES,
  type DisputeStatus,
  type DisputeType,
  type UserRole,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreateDisputeDto,
  DisputeResponseDto,
  ResolveDisputeDto,
} from './dto/dispute.dto';

interface CallMeta {
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private generateDisputeNumber(): string {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DSP-${ym}-${rand}`;
  }

  private mapDisputeToDto(dispute: {
    id: string;
    disputeNumber: string;
    agreementId: string;
    initiatorId: string;
    respondentId: string;
    disputeType: string;
    disputedAmount: Prisma.Decimal | number;
    title: string;
    description: string;
    status: string;
    evidenceUrls: string[];
    resolutionSummary: string | null;
    assignedModeratorId: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    initiator?: { fullName: string } | null;
    respondent?: { fullName: string } | null;
  }): DisputeResponseDto {
    return {
      id: dispute.id,
      disputeNumber: dispute.disputeNumber,
      agreementId: dispute.agreementId,
      initiatorId: dispute.initiatorId,
      respondentId: dispute.respondentId,
      disputeType: dispute.disputeType as DisputeType,
      disputedAmount: Number(dispute.disputedAmount),
      title: dispute.title,
      description: dispute.description,
      status: dispute.status as DisputeStatus,
      evidenceUrls: dispute.evidenceUrls,
      resolutionSummary: dispute.resolutionSummary,
      assignedModeratorId: dispute.assignedModeratorId,
      createdAt: dispute.createdAt.toISOString(),
      resolvedAt: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
      initiatorName: dispute.initiator?.fullName,
      respondentName: dispute.respondent?.fullName,
    };
  }

  async createDispute(
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateDisputeDto,
    meta?: CallMeta,
  ): Promise<DisputeResponseDto> {
    const agreement = await this.prisma.tenancyAgreement.findUnique({
      where: { id: dto.agreementId },
    });

    if (!agreement) {
      throw new NotFoundException({
        code: ERROR_CODES.AGREEMENT_NOT_FOUND,
        message: `Tenancy agreement ${dto.agreementId} not found`,
      });
    }

    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'Only parties to the tenancy agreement may file a rental dispute',
      });
    }

    const initiatorId = callerUserId;
    const respondentId = initiatorId === agreement.landlordId ? agreement.tenantId : agreement.landlordId;

    if (initiatorId === respondentId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Initiator and respondent must be distinct parties',
      });
    }

    // Check partial unique index constraint: uq_active_dispute_per_agreement_type
    const activeDispute = await this.prisma.rentalDispute.findFirst({
      where: {
        agreementId: dto.agreementId,
        disputeType: dto.disputeType,
        status: { in: ['open', 'under_review'] },
      },
    });

    if (activeDispute) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_ACTIVE_DISPUTE,
        message: `An active dispute of type '${dto.disputeType}' already exists for this agreement (${activeDispute.disputeNumber})`,
      });
    }

    const disputeNumber = this.generateDisputeNumber();

    try {
      const dispute = await this.prisma.rentalDispute.create({
        data: {
          disputeNumber,
          agreementId: dto.agreementId,
          initiatorId,
          respondentId,
          disputeType: dto.disputeType,
          disputedAmount: new Prisma.Decimal(dto.disputedAmount ?? 0),
          title: dto.title,
          description: dto.description,
          status: 'open',
          evidenceUrls: dto.evidenceUrls ?? [],
        },
        include: {
          initiator: { select: { fullName: true } },
          respondent: { select: { fullName: true } },
        },
      });

      await this.audit.record({
        eventType: 'dispute.created',
        entityType: 'rental_dispute',
        entityId: dispute.id,
        actorId: callerUserId,
        actorRole: callerRole,
        outcome: 'success',
        ipAddress: meta?.ipAddress,
        requestId: meta?.requestId,
        metadata: { id: dispute.id, disputeNumber, disputeType: dto.disputeType },
      });

      return this.mapDisputeToDto(dispute);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.DUPLICATE_ACTIVE_DISPUTE,
          message: 'An active dispute of this type already exists for this agreement',
        });
      }
      throw err;
    }
  }

  async getMyDisputes(callerUserId: string): Promise<DisputeResponseDto[]> {
    const disputes = await this.prisma.rentalDispute.findMany({
      where: {
        OR: [{ initiatorId: callerUserId }, { respondentId: callerUserId }],
      },
      include: {
        initiator: { select: { fullName: true } },
        respondent: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return disputes.map((d) => this.mapDisputeToDto(d));
  }

  async getDisputeById(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.prisma.rentalDispute.findUnique({
      where: { id },
      include: {
        initiator: { select: { fullName: true } },
        respondent: { select: { fullName: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException({
        code: ERROR_CODES.DISPUTE_NOT_FOUND,
        message: `Dispute ${id} not found`,
      });
    }

    const isParty = dispute.initiatorId === callerUserId || dispute.respondentId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to view this dispute',
      });
    }

    return this.mapDisputeToDto(dispute);
  }

  async resolveDispute(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: ResolveDisputeDto,
    meta?: CallMeta,
  ): Promise<DisputeResponseDto> {
    if (callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only administrators may resolve rental disputes',
      });
    }

    const existing = await this.prisma.rentalDispute.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.DISPUTE_NOT_FOUND,
        message: `Dispute ${id} not found`,
      });
    }

    const resolvedAt = new Date();
    const updated = await this.prisma.rentalDispute.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionSummary: dto.resolutionSummary,
        assignedModeratorId: callerUserId,
        resolvedAt,
      },
      include: {
        initiator: { select: { fullName: true } },
        respondent: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'dispute.resolved',
      entityType: 'rental_dispute',
      entityId: id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { beforeStatus: existing.status, afterStatus: updated.status, resolutionSummary: dto.resolutionSummary },
    });

    return this.mapDisputeToDto(updated);
  }
}
