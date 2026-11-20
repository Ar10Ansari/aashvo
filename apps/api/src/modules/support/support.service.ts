import {
  ERROR_CODES,
  type TicketPriority,
  type TicketSenderRole,
  type TicketStatus,
  type UserRole,
} from '@aashvo/contracts';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreateSafetyReportDto,
  CreateSupportTicketDto,
  CreateTicketMessageDto,
  GuestSupportTicketDto,
  SupportTicketResponseDto,
  TicketMessageResponseDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';

interface CallMeta {
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private generateTicketNumber(): string {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ASH-TKT-${rand}`;
  }

  private mapMessageToDto(msg: {
    id: string;
    ticketId: string;
    senderId: string | null;
    senderName: string;
    senderRole: string;
    message: string;
    attachments: Prisma.JsonValue;
    createdAt: Date;
  }): TicketMessageResponseDto {
    return {
      id: msg.id,
      ticketId: msg.ticketId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole as TicketSenderRole,
      message: msg.message,
      attachments: Array.isArray(msg.attachments) ? (msg.attachments as string[]) : [],
      createdAt: msg.createdAt.toISOString(),
    };
  }

  private mapTicketToDto(ticket: {
    id: string;
    ticketNumber: string;
    userId: string | null;
    userEmail: string;
    userName: string;
    userPhone: string | null;
    category: string;
    subject: string;
    description: string;
    referenceListingId: string | null;
    referenceUserId: string | null;
    priority: string;
    status: string;
    assignedTo: string | null;
    attachments: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    messages?: Array<{
      id: string;
      ticketId: string;
      senderId: string | null;
      senderName: string;
      senderRole: string;
      message: string;
      attachments: Prisma.JsonValue;
      createdAt: Date;
    }>;
  }): SupportTicketResponseDto {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: ticket.userId,
      userEmail: ticket.userEmail,
      userName: ticket.userName,
      userPhone: ticket.userPhone,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      referenceListingId: ticket.referenceListingId,
      referenceUserId: ticket.referenceUserId,
      priority: ticket.priority as TicketPriority,
      status: ticket.status as TicketStatus,
      assignedTo: ticket.assignedTo,
      attachments: Array.isArray(ticket.attachments) ? (ticket.attachments as string[]) : [],
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      messages: ticket.messages?.map((m) => this.mapMessageToDto(m)),
    };
  }

  async createTicket(
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateSupportTicketDto,
    meta?: CallMeta,
  ): Promise<SupportTicketResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: callerUserId },
      include: { user: { select: { email: true } } },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User profile not found',
      });
    }

    const ticketNumber = this.generateTicketNumber();
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: callerUserId,
        userEmail: profile.user.email,
        userName: profile.fullName,
        userPhone: profile.phoneNumber,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        status: 'open',
        referenceListingId: dto.referenceListingId,
        referenceUserId: dto.referenceUserId,
        attachments: dto.attachments ?? [],
        messages: {
          create: {
            senderId: callerUserId,
            senderName: profile.fullName,
            senderRole: 'user',
            message: dto.description,
            attachments: dto.attachments ?? [],
          },
        },
      },
      include: {
        messages: true,
      },
    });

    await this.audit.record({
      eventType: 'ticket.created',
      entityType: 'support_ticket',
      entityId: ticket.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: ticket.id, ticketNumber, category: dto.category },
    });

    return this.mapTicketToDto(ticket);
  }

  async createGuestTicket(
    dto: GuestSupportTicketDto,
    meta?: CallMeta,
  ): Promise<SupportTicketResponseDto> {
    const ticketNumber = this.generateTicketNumber();
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: null,
        userEmail: dto.userEmail,
        userName: dto.userName,
        userPhone: dto.userPhone,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
        priority: 'medium',
        status: 'open',
        referenceListingId: dto.referenceListingId,
        attachments: dto.attachments ?? [],
        messages: {
          create: {
            senderId: null,
            senderName: dto.userName,
            senderRole: 'user',
            message: dto.description,
            attachments: dto.attachments ?? [],
          },
        },
      },
      include: {
        messages: true,
      },
    });

    await this.audit.record({
      eventType: 'ticket.created_guest',
      entityType: 'support_ticket',
      entityId: ticket.id,
      actorRole: 'renter',
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: ticket.id, ticketNumber, guestEmail: dto.userEmail },
    });

    return this.mapTicketToDto(ticket);
  }

  async getMyTickets(callerUserId: string): Promise<SupportTicketResponseDto[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId: callerUserId },
      orderBy: { createdAt: 'desc' },
    });

    return tickets.map((t) => this.mapTicketToDto(t));
  }

  async getTicketById(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ERROR_CODES.TICKET_NOT_FOUND,
        message: `Support ticket ${id} not found`,
      });
    }

    if (callerRole !== 'admin' && ticket.userId !== callerUserId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to view this support ticket',
      });
    }

    return this.mapTicketToDto(ticket);
  }

  async addTicketMessage(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateTicketMessageDto,
    meta?: CallMeta,
  ): Promise<TicketMessageResponseDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ERROR_CODES.TICKET_NOT_FOUND,
        message: `Support ticket ${id} not found`,
      });
    }

    if (callerRole !== 'admin' && ticket.userId !== callerUserId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to respond to this ticket',
      });
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: callerUserId },
      select: { fullName: true },
    });
    const senderName = profile?.fullName ?? 'Support Staff';
    const senderRole: TicketSenderRole = callerRole === 'admin' ? 'admin' : 'user';

    const msg = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: callerUserId,
        senderName,
        senderRole,
        message: dto.message,
        attachments: dto.attachments ?? [],
      },
    });

    // If ticket was awaiting_user and user replied, change status to in_review
    if (senderRole === 'user' && ticket.status === 'awaiting_user') {
      await this.prisma.supportTicket.update({
        where: { id },
        data: { status: 'in_review' },
      });
    }

    await this.audit.record({
      eventType: 'ticket.message_added',
      entityType: 'ticket_message',
      entityId: msg.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { ticketId: id, senderRole },
    });

    return this.mapMessageToDto(msg);
  }

  async updateTicketStatus(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: UpdateTicketStatusDto,
    meta?: CallMeta,
  ): Promise<SupportTicketResponseDto> {
    if (callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only support administrators may update ticket status',
      });
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ERROR_CODES.TICKET_NOT_FOUND,
        message: `Support ticket ${id} not found`,
      });
    }

    const isResolved = dto.status === 'resolved' || dto.status === 'closed';
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        assignedTo: dto.assignedTo ?? ticket.assignedTo,
        resolvedAt: isResolved ? new Date() : ticket.resolvedAt,
        resolvedBy: isResolved ? callerUserId : ticket.resolvedBy,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    await this.audit.record({
      eventType: 'ticket.status_updated',
      entityType: 'support_ticket',
      entityId: id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { beforeStatus: ticket.status, afterStatus: updated.status },
    });

    return this.mapTicketToDto(updated);
  }

  async submitSafetyReport(
    callerUserId: string | null,
    dto: CreateSafetyReportDto,
    meta?: CallMeta,
  ): Promise<{ success: boolean; id: string; message: string }> {
    const isListing = dto.targetType === 'listing';
    const isFlatmate = dto.targetType === 'flatmate';
    const isUser = dto.targetType === 'user';

    const report = await this.prisma.safetyReport.create({
      data: {
        reporterId: callerUserId,
        reporterEmail: dto.reporterEmail,
        targetType: dto.targetType as any,
        reportedPropertyId: isListing ? dto.targetId : null,
        reportedFlatmateId: isFlatmate ? dto.targetId : null,
        reportedUserId: isUser ? dto.targetId : null,
        targetTitle: dto.targetTitle || `${dto.targetType} report`,
        reasonCode: dto.reasonCode,
        details: dto.details,
        priority: 'high',
        status: 'pending',
      },
    });

    await this.audit.record({
      eventType: 'safety_report.created',
      entityType: 'safety_report',
      entityId: report.id,
      actorId: callerUserId ?? null,
      actorRole: callerUserId ? 'user' : 'guest',
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        reasonCode: dto.reasonCode,
      },
    });

    return {
      success: true,
      id: report.id,
      message: 'Safety report received and queued for investigation.',
    };
  }
}
