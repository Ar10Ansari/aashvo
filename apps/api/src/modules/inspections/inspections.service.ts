import {
  ERROR_CODES,
  type InspectionType,
  type UserRole,
} from '@aashvo/contracts';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreateInspectionDto,
  InspectionResponseDto,
} from './dto/inspection.dto';

interface CallMeta {
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private mapInspectionToDto(inspection: {
    id: string;
    agreementId: string;
    inspectionType: string;
    conductedBy: string;
    inspectionDate: Date;
    roomName: string;
    conditionRating: number;
    damageNotes: string | null;
    photoUrls: string[];
    meterReadings?: any;
    inventory?: any;
    keyHandoverConfirmed?: boolean;
    depositConfirmed?: boolean;
    acknowledgedByCounterparty: boolean;
    acknowledgedAt: Date | null;
    createdAt: Date;
    conductor?: { fullName: string } | null;
  }): InspectionResponseDto {
    return {
      id: inspection.id,
      agreementId: inspection.agreementId,
      inspectionType: inspection.inspectionType as InspectionType,
      conductedBy: inspection.conductedBy,
      inspectionDate: inspection.inspectionDate.toISOString().split('T')[0],
      roomName: inspection.roomName,
      conditionRating: inspection.conditionRating,
      damageNotes: inspection.damageNotes,
      photoUrls: inspection.photoUrls,
      meterReadings: (inspection.meterReadings as any) ?? {},
      inventory: (inspection.inventory as any) ?? [],
      keyHandoverConfirmed: inspection.keyHandoverConfirmed ?? false,
      depositConfirmed: inspection.depositConfirmed ?? false,
      acknowledgedByCounterparty: inspection.acknowledgedByCounterparty,
      acknowledgedAt: inspection.acknowledgedAt ? inspection.acknowledgedAt.toISOString() : null,
      createdAt: inspection.createdAt.toISOString(),
      conductorName: inspection.conductor?.fullName,
    };
  }

  async createInspection(
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateInspectionDto,
    meta?: CallMeta,
  ): Promise<InspectionResponseDto> {
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
        message: 'You are not authorized to conduct an inspection for this agreement',
      });
    }

    const inspection = await this.prisma.propertyInspection.create({
      data: {
        agreementId: dto.agreementId,
        inspectionType: dto.inspectionType,
        conductedBy: callerUserId,
        inspectionDate: new Date(dto.inspectionDate),
        roomName: dto.roomName,
        conditionRating: dto.conditionRating,
        damageNotes: dto.damageNotes,
        photoUrls: dto.photoUrls ?? [],
        meterReadings: dto.meterReadings ?? {},
        inventory: dto.inventory ?? [],
        keyHandoverConfirmed: dto.keyHandoverConfirmed ?? false,
        depositConfirmed: dto.depositConfirmed ?? false,
      },
      include: {
        conductor: { select: { fullName: true } },
      },
    });

    // Notify counterparty
    const counterpartyId =
      agreement.landlordId === callerUserId ? agreement.tenantId : agreement.landlordId;
    await this.prisma.userNotification.create({
      data: {
        userId: counterpartyId,
        category: 'inspection_update',
        title: `Move-In Checklist Created (${dto.roomName})`,
        body: `A new ${dto.inspectionType.replace('_', ' ')} checklist was submitted for your agreement and is ready for your digital acknowledgement.`,
        targetUrl: '/my-activity/inspections',
        metadata: { inspectionId: inspection.id, agreementId: dto.agreementId },
      },
    });

    await this.audit.record({
      eventType: 'inspection.created',
      entityType: 'property_inspection',
      entityId: inspection.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: inspection.id, agreementId: dto.agreementId, rating: dto.conditionRating },
    });

    return this.mapInspectionToDto(inspection);
  }

  async getAgreementInspections(
    agreementId: string,
    callerUserId: string,
    callerRole: UserRole,
  ): Promise<InspectionResponseDto[]> {
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
        message: 'You are not authorized to view inspections for this agreement',
      });
    }

    const inspections = await this.prisma.propertyInspection.findMany({
      where: { agreementId },
      include: {
        conductor: { select: { fullName: true } },
      },
      orderBy: { inspectionDate: 'desc' },
    });

    return inspections.map((i) => this.mapInspectionToDto(i));
  }

  async acknowledgeInspection(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    meta?: CallMeta,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.prisma.propertyInspection.findUnique({
      where: { id },
      include: { agreement: true },
    });

    if (!inspection) {
      throw new NotFoundException({
        code: ERROR_CODES.INSPECTION_NOT_FOUND,
        message: `Property inspection ${id} not found`,
      });
    }

    const agreement = inspection.agreement;
    const isParty = agreement.landlordId === callerUserId || agreement.tenantId === callerUserId;
    if (!isParty && callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.UNAUTHORIZED_AGREEMENT_ACCESS,
        message: 'You are not authorized to acknowledge this inspection',
      });
    }

    // Must be counterparty (cannot acknowledge own inspection) unless admin
    if (callerRole !== 'admin' && inspection.conductedBy === callerUserId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Inspection must be acknowledged by the counterparty',
      });
    }

    const acknowledgedAt = new Date();
    const updated = await this.prisma.propertyInspection.update({
      where: { id },
      data: {
        acknowledgedByCounterparty: true,
        acknowledgedAt,
      },
      include: {
        conductor: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'inspection.acknowledged',
      entityType: 'property_inspection',
      entityId: id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id, acknowledgedByCounterparty: true, acknowledgedAt: acknowledgedAt.toISOString() },
    });

    await this.prisma.userNotification.create({
      data: {
        userId: inspection.conductedBy,
        category: 'inspection_update',
        title: 'Checklist Digitally Acknowledged',
        body: `The counterparty has digitally reviewed and acknowledged the ${inspection.inspectionType.replace('_', ' ')} checklist for ${inspection.roomName}.`,
        targetUrl: '/my-activity/inspections',
        metadata: { inspectionId: inspection.id, agreementId: inspection.agreementId },
      },
    });

    return this.mapInspectionToDto(updated);
  }
}
