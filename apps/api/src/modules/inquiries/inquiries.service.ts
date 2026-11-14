import { ERROR_CODES, type InquiryStatus, type UserRole } from '@aashvo/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InterestRequest } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreateInquiryDto,
  InquiryResponseDto,
  UpdateInquiryStatusDto,
} from './dto/inquiry.dto';

type InquiryWithRelations = InterestRequest & {
  property?: { title: string; ownerId: string } | null;
  targetFlatmate?: { userId: string; occupation: string } | null;
};

export function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) return '****';
  const visibleLast4 = phone.slice(-4);
  const prefix = phone.slice(0, 3);
  return `${prefix} ***** *${visibleLast4}`;
}

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toView(
    inquiry: InquiryWithRelations,
    callerUserId: string,
  ): InquiryResponseDto {
    const isSender = inquiry.senderId === callerUserId;
    const isAccepted = inquiry.status === 'accepted';
    // Contact phone is revealed to sender always, or to recipient after acceptance
    const revealedPhone = isSender || isAccepted
      ? inquiry.senderPhone
      : maskPhoneNumber(inquiry.senderPhone);

    const targetType = inquiry.propertyId ? 'property' : 'flatmate';
    const targetTitle = inquiry.property?.title ?? inquiry.targetFlatmate?.occupation ?? undefined;

    return {
      id: inquiry.id,
      senderId: inquiry.senderId,
      propertyId: inquiry.propertyId,
      targetFlatmateId: inquiry.targetFlatmateId,
      senderName: inquiry.senderName,
      senderPhone: revealedPhone,
      senderEmail: inquiry.senderEmail,
      moveInDate: inquiry.moveInDate,
      message: inquiry.message,
      status: inquiry.status as InquiryStatus,
      targetType,
      targetTitle,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString(),
    };
  }

  async createInquiry(
    senderId: string,
    role: UserRole,
    dto: CreateInquiryDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<InquiryResponseDto> {
    const hasProperty = Boolean(dto.propertyId);
    const hasFlatmate = Boolean(dto.targetFlatmateId);

    // Enforce exclusive single target (matches chk_interest_request_target)
    if ((hasProperty && hasFlatmate) || (!hasProperty && !hasFlatmate)) {
      throw new BadRequestException({
        code: ERROR_CODES.INQUIRY_TARGET_INVALID,
        message:
          'Inquiry must target exactly one recipient: either a propertyId or a targetFlatmateId, not both and not neither.',
      });
    }

    let recipientId = '';
    let targetTitle = '';

    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
      });

      if (!property) {
        throw new NotFoundException({
          code: ERROR_CODES.PROPERTY_NOT_FOUND,
          message: 'Property listing not found.',
        });
      }

      if (property.ownerId === senderId) {
        throw new BadRequestException({
          code: ERROR_CODES.BAD_REQUEST,
          message: 'You cannot send an inquiry for your own property.',
        });
      }

      recipientId = property.ownerId;
      targetTitle = property.title;

      // Duplicate check for open inquiry
      const existingInquiry = await this.prisma.interestRequest.findFirst({
        where: {
          senderId,
          propertyId: dto.propertyId,
          status: 'pending',
        },
      });

      if (existingInquiry) {
        throw new ConflictException({
          code: ERROR_CODES.DUPLICATE_INQUIRY,
          message: 'You already have a pending inquiry for this property. Please await the owner’s response.',
        });
      }
    } else if (dto.targetFlatmateId) {
      const flatmate = await this.prisma.flatmateProfile.findUnique({
        where: { id: dto.targetFlatmateId },
      });

      if (!flatmate) {
        throw new NotFoundException({
          code: ERROR_CODES.FLATMATE_PROFILE_NOT_FOUND,
          message: 'Target flatmate profile not found.',
        });
      }

      if (flatmate.userId === senderId) {
        throw new BadRequestException({
          code: ERROR_CODES.BAD_REQUEST,
          message: 'You cannot send an inquiry to your own flatmate profile.',
        });
      }

      recipientId = flatmate.userId;
      targetTitle = flatmate.occupation;

      const existingInquiry = await this.prisma.interestRequest.findFirst({
        where: {
          senderId,
          targetFlatmateId: dto.targetFlatmateId,
          status: 'pending',
        },
      });

      if (existingInquiry) {
        throw new ConflictException({
          code: ERROR_CODES.DUPLICATE_INQUIRY,
          message: 'You already have a pending inquiry for this flatmate candidate.',
        });
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const inq = await tx.interestRequest.create({
        data: {
          senderId,
          propertyId: dto.propertyId ?? null,
          targetFlatmateId: dto.targetFlatmateId ?? null,
          senderName: dto.senderName.trim(),
          senderPhone: dto.senderPhone.trim(),
          senderEmail: dto.senderEmail.trim().toLowerCase(),
          moveInDate: dto.moveInDate?.trim() ?? null,
          message: dto.message.trim(),
          status: 'pending',
        },
        include: {
          property: { select: { title: true, ownerId: true } },
          targetFlatmate: { select: { userId: true, occupation: true } },
        },
      });

      // Queue outbox notification for recipient
      await tx.notificationOutbox.create({
        data: {
          channel: 'email',
          templateKey: 'inquiry_received',
          recipient: recipientId,
          payload: {
            inquiryId: inq.id,
            senderName: inq.senderName,
            targetTitle,
          },
          status: 'pending',
        },
      });

      return inq;
    });

    await this.audit.record({
      actorId: senderId,
      actorRole: role,
      eventType: 'inquiry.created',
      entityType: 'interest_request',
      entityId: created.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: {
        propertyId: created.propertyId,
        targetFlatmateId: created.targetFlatmateId,
      },
    });

    return this.toView(created as InquiryWithRelations, senderId);
  }

  async getSentInquiries(senderId: string): Promise<InquiryResponseDto[]> {
    const items = await this.prisma.interestRequest.findMany({
      where: { senderId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { title: true, ownerId: true } },
        targetFlatmate: { select: { userId: true, occupation: true } },
      },
    });

    return items.map((item) => this.toView(item as InquiryWithRelations, senderId));
  }

  async getReceivedInquiries(userId: string): Promise<InquiryResponseDto[]> {
    const items = await this.prisma.interestRequest.findMany({
      where: {
        OR: [
          { property: { ownerId: userId } },
          { targetFlatmate: { userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { title: true, ownerId: true } },
        targetFlatmate: { select: { userId: true, occupation: true } },
      },
    });

    return items.map((item) => this.toView(item as InquiryWithRelations, userId));
  }

  async updateInquiryStatus(
    inquiryId: string,
    userId: string,
    role: UserRole,
    dto: UpdateInquiryStatusDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<InquiryResponseDto> {
    const inquiry = await this.prisma.interestRequest.findUnique({
      where: { id: inquiryId },
      include: {
        property: { select: { title: true, ownerId: true } },
        targetFlatmate: { select: { userId: true, occupation: true } },
      },
    });

    if (!inquiry) {
      throw new NotFoundException({
        code: ERROR_CODES.INQUIRY_NOT_FOUND,
        message: 'Inquiry not found.',
      });
    }

    // Only property owner or target flatmate can accept or decline
    const isOwner = inquiry.property?.ownerId === userId;
    const isTargetFlatmate = inquiry.targetFlatmate?.userId === userId;
    const isAdmin = role === 'admin';

    if (!isOwner && !isTargetFlatmate && !isAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to update this inquiry status.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const inq = await tx.interestRequest.update({
        where: { id: inquiryId },
        data: { status: dto.status },
        include: {
          property: { select: { title: true, ownerId: true } },
          targetFlatmate: { select: { userId: true, occupation: true } },
        },
      });

      // Queue notification to inform sender of outcome
      await tx.notificationOutbox.create({
        data: {
          channel: 'email',
          templateKey: `inquiry_${dto.status}`,
          recipient: inq.senderEmail,
          payload: {
            inquiryId: inq.id,
            status: dto.status,
          },
          status: 'pending',
        },
      });

      return inq;
    });

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'inquiry.status_updated',
      entityType: 'interest_request',
      entityId: inquiryId,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { newStatus: dto.status },
    });

    return this.toView(updated as InquiryWithRelations, userId);
  }
}
