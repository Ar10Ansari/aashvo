import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  CreateVisitDto,
  GetVisitsQueryDto,
  PropertyVisitResponseDto,
  RescheduleVisitDto,
  UpdateVisitStatusDto,
} from './dto/visit.dto';

export function formatToIST(date: Date): string {
  try {
    return (
      date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return date.toISOString();
  }
}

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async createVisit(
    visitorId: string,
    dto: CreateVisitDto,
  ): Promise<PropertyVisitResponseDto> {
    const prop = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { owner: true },
    });

    if (!prop) {
      throw new NotFoundException('Property listing not found.');
    }

    if (prop.ownerId === visitorId) {
      throw new BadRequestException('You cannot schedule a visit to your own property.');
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp.');
    }

    if (scheduledDate.getTime() < Date.now()) {
      throw new BadRequestException('Visit schedule time must be in the future.');
    }

    // Check block
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: visitorId, blockedId: prop.ownerId },
          { blockerId: prop.ownerId, blockedId: visitorId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('Cannot schedule a visit with an active user block.');
    }

    const visit = await this.prisma.propertyVisit.create({
      data: {
        propertyId: prop.id,
        visitorId,
        hostId: prop.ownerId,
        scheduledAt: scheduledDate,
        status: 'pending',
        visitorMessage: dto.visitorMessage,
      },
      include: {
        property: true,
        visitor: true,
        host: true,
      },
    });

    // Create In-App Notification for host
    await this.prisma.userNotification.create({
      data: {
        userId: prop.ownerId,
        category: 'visit_request',
        title: 'New Property Visit Request',
        body: `${visit.visitor.fullName} requested to view "${prop.title}" on ${formatToIST(scheduledDate)}.`,
        targetUrl: '/my-activity/visits',
        metadata: {
          visitId: visit.id,
          propertyId: prop.id,
          visitorId,
        },
      },
    });

    return this.mapToResponse(visit);
  }

  async updateStatus(
    callerId: string,
    visitId: string,
    dto: UpdateVisitStatusDto,
  ): Promise<PropertyVisitResponseDto> {
    const visit = await this.prisma.propertyVisit.findUnique({
      where: { id: visitId },
      include: { property: true, visitor: true, host: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit request not found.');
    }

    const isHost = visit.hostId === callerId;
    const isVisitor = visit.visitorId === callerId;

    if (!isHost && !isVisitor) {
      throw new ForbiddenException('You are not authorized to update this visit.');
    }

    // Action authorization logic
    if (dto.action === 'confirm' || dto.action === 'reject') {
      if (!isHost) {
        throw new ForbiddenException('Only the property host can confirm or reject viewing requests.');
      }
    }

    if (dto.action === 'confirm') {
      // Conflict check: Check if another confirmed visit exists on this property within 30 minutes
      const bufferMs = 30 * 60 * 1000;
      const windowStart = new Date(visit.scheduledAt.getTime() - bufferMs);
      const windowEnd = new Date(visit.scheduledAt.getTime() + bufferMs);

      const conflict = await this.prisma.propertyVisit.findFirst({
        where: {
          propertyId: visit.propertyId,
          status: 'confirmed',
          id: { not: visit.id },
          scheduledAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Another viewing appointment is already confirmed around this time (${formatToIST(conflict.scheduledAt)}). Please suggest an alternate slot.`,
        );
      }
    }

    const targetStatusMap: Record<string, any> = {
      confirm: 'confirmed',
      reject: 'rejected',
      cancel: 'cancelled',
      complete: 'completed',
    };

    const newStatus = targetStatusMap[dto.action];

    const updated = await this.prisma.propertyVisit.update({
      where: { id: visitId },
      data: {
        status: newStatus,
        hostNotes: dto.hostNotes ?? visit.hostNotes,
      },
      include: { property: true, visitor: true, host: true },
    });

    // Notify counterparty
    const recipientId = isHost ? visit.visitorId : visit.hostId;
    const actionLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    await this.prisma.userNotification.create({
      data: {
        userId: recipientId,
        category: 'visit_update',
        title: `Property Visit ${actionLabel}`,
        body: `Viewing request for "${visit.property.title}" was marked as ${newStatus} by ${isHost ? visit.host.fullName : visit.visitor.fullName}.`,
        targetUrl: '/my-activity/visits',
        metadata: {
          visitId: visit.id,
          newStatus,
          hostNotes: dto.hostNotes,
        },
      },
    });

    return this.mapToResponse(updated);
  }

  async rescheduleVisit(
    callerId: string,
    visitId: string,
    dto: RescheduleVisitDto,
  ): Promise<PropertyVisitResponseDto> {
    const visit = await this.prisma.propertyVisit.findUnique({
      where: { id: visitId },
      include: { property: true, visitor: true, host: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit request not found.');
    }

    const isHost = visit.hostId === callerId;
    const isVisitor = visit.visitorId === callerId;

    if (!isHost && !isVisitor) {
      throw new ForbiddenException('You are not authorized to reschedule this visit.');
    }

    const newDate = new Date(dto.rescheduledAt);
    if (isNaN(newDate.getTime()) || newDate.getTime() < Date.now()) {
      throw new BadRequestException('Rescheduled time must be a valid future timestamp.');
    }

    const updated = await this.prisma.propertyVisit.update({
      where: { id: visitId },
      data: {
        status: 'rescheduled',
        rescheduledAt: newDate,
        rescheduledBy: callerId,
        hostNotes: dto.reason ? `Reschedule note: ${dto.reason}` : visit.hostNotes,
      },
      include: { property: true, visitor: true, host: true },
    });

    const recipientId = isHost ? visit.visitorId : visit.hostId;
    await this.prisma.userNotification.create({
      data: {
        userId: recipientId,
        category: 'visit_update',
        title: 'Visit Reschedule Requested',
        body: `${isHost ? visit.host.fullName : visit.visitor.fullName} suggested moving the visit to ${formatToIST(newDate)}.`,
        targetUrl: '/my-activity/visits',
        metadata: {
          visitId: visit.id,
          rescheduledAt: newDate.toISOString(),
          reason: dto.reason,
        },
      },
    });

    return this.mapToResponse(updated);
  }

  async getVisits(
    callerId: string,
    query?: GetVisitsQueryDto,
  ): Promise<PropertyVisitResponseDto[]> {
    const where: any = {};

    if (query?.roleFilter === 'as_visitor') {
      where.visitorId = callerId;
    } else if (query?.roleFilter === 'as_host') {
      where.hostId = callerId;
    } else {
      where.OR = [{ visitorId: callerId }, { hostId: callerId }];
    }

    if (query?.status) {
      where.status = query.status;
    }

    const list = await this.prisma.propertyVisit.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: { property: true, visitor: true, host: true },
    });

    return list.map((v) => this.mapToResponse(v));
  }

  async getVisitById(callerId: string, visitId: string): Promise<PropertyVisitResponseDto> {
    const visit = await this.prisma.propertyVisit.findUnique({
      where: { id: visitId },
      include: { property: true, visitor: true, host: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found.');
    }

    if (visit.visitorId !== callerId && visit.hostId !== callerId) {
      throw new ForbiddenException('You are not authorized to view this visit.');
    }

    return this.mapToResponse(visit);
  }

  private mapToResponse(item: any): PropertyVisitResponseDto {
    return {
      id: item.id,
      propertyId: item.propertyId,
      propertyTitle: item.property.title,
      propertyCity: item.property.city,
      propertyLocality: item.property.locality,
      visitorId: item.visitorId,
      visitorName: item.visitor.fullName,
      visitorPhone: item.visitor.phoneNumber,
      hostId: item.hostId,
      hostName: item.host.fullName,
      hostPhone: item.host.phoneNumber,
      scheduledAt: item.scheduledAt.toISOString(),
      scheduledAtIST: formatToIST(item.scheduledAt),
      status: item.status,
      visitorMessage: item.visitorMessage,
      hostNotes: item.hostNotes,
      rescheduledAt: item.rescheduledAt ? item.rescheduledAt.toISOString() : null,
      rescheduledAtIST: item.rescheduledAt ? formatToIST(item.rescheduledAt) : null,
      rescheduledBy: item.rescheduledBy,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
