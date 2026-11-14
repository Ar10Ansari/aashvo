import {
  ERROR_CODES,
  type ReviewModerationStatus,
  type TenancyReviewerRole,
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
  CreateTenancyReviewDto,
  ModerateReviewDto,
  TenancyReviewResponseDto,
} from './dto/review.dto';

interface CallMeta {
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private mapReviewToDto(review: {
    id: string;
    agreementId: string;
    reviewerId: string;
    revieweeId: string;
    reviewerRole: string;
    communicationRating: number;
    maintenanceRating: number;
    propertyCareRating: number;
    agreementClarityRating: number;
    overallRating: Prisma.Decimal | number;
    reviewTitle: string | null;
    reviewContent: string;
    isPublic: boolean;
    moderationStatus: string;
    createdAt: Date;
    reviewer?: { fullName: string } | null;
  }): TenancyReviewResponseDto {
    return {
      id: review.id,
      agreementId: review.agreementId,
      reviewerId: review.reviewerId,
      revieweeId: review.revieweeId,
      reviewerRole: review.reviewerRole as TenancyReviewerRole,
      communicationRating: review.communicationRating,
      maintenanceRating: review.maintenanceRating,
      propertyCareRating: review.propertyCareRating,
      agreementClarityRating: review.agreementClarityRating,
      overallRating: Number(review.overallRating),
      reviewTitle: review.reviewTitle,
      reviewContent: review.reviewContent,
      isPublic: review.isPublic,
      moderationStatus: review.moderationStatus as ReviewModerationStatus,
      reviewerName: review.reviewer?.fullName,
      createdAt: review.createdAt.toISOString(),
    };
  }

  async createReview(
    callerUserId: string,
    callerRole: UserRole,
    dto: CreateTenancyReviewDto,
    meta?: CallMeta,
  ): Promise<TenancyReviewResponseDto> {
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
        message: 'Only verified parties to the tenancy agreement may submit a review',
      });
    }

    const reviewerId = callerRole === 'admin' ? (agreement.landlordId === dto.revieweeId ? agreement.tenantId : agreement.landlordId) : callerUserId;
    const expectedRevieweeId = reviewerId === agreement.landlordId ? agreement.tenantId : agreement.landlordId;

    if (dto.revieweeId !== expectedRevieweeId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Reviewee must be the counterparty on the specified tenancy agreement',
      });
    }

    if (reviewerId === dto.revieweeId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Reviewer and reviewee must be distinct parties',
      });
    }

    const existing = await this.prisma.tenancyReview.findUnique({
      where: {
        agreementId_reviewerId: {
          agreementId: dto.agreementId,
          reviewerId,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_REVIEW,
        message: 'You have already submitted a review for this tenancy agreement',
      });
    }

    const avg =
      (dto.communicationRating +
        dto.maintenanceRating +
        dto.propertyCareRating +
        dto.agreementClarityRating) /
      4.0;
    const overallRating = Math.round(avg * 10) / 10;

    const review = await this.prisma.tenancyReview.create({
      data: {
        agreementId: dto.agreementId,
        reviewerId,
        revieweeId: dto.revieweeId,
        reviewerRole: dto.reviewerRole,
        communicationRating: dto.communicationRating,
        maintenanceRating: dto.maintenanceRating,
        propertyCareRating: dto.propertyCareRating,
        agreementClarityRating: dto.agreementClarityRating,
        overallRating: new Prisma.Decimal(overallRating),
        reviewTitle: dto.reviewTitle,
        reviewContent: dto.reviewContent,
        isPublic: dto.isPublic ?? true,
        moderationStatus: 'approved',
      },
      include: {
        reviewer: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'review.created',
      entityType: 'tenancy_review',
      entityId: review.id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { id: review.id, agreementId: dto.agreementId, overallRating },
    });

    return this.mapReviewToDto(review);
  }

  async getPropertyReviews(propertyId: string): Promise<TenancyReviewResponseDto[]> {
    const reviews = await this.prisma.tenancyReview.findMany({
      where: {
        agreement: { propertyId },
        isPublic: true,
        moderationStatus: 'approved',
      },
      include: {
        reviewer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapReviewToDto(r));
  }

  async getProfileReviews(profileId: string): Promise<TenancyReviewResponseDto[]> {
    const reviews = await this.prisma.tenancyReview.findMany({
      where: {
        revieweeId: profileId,
        isPublic: true,
        moderationStatus: 'approved',
      },
      include: {
        reviewer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapReviewToDto(r));
  }

  async moderateReview(
    id: string,
    callerUserId: string,
    callerRole: UserRole,
    dto: ModerateReviewDto,
    meta?: CallMeta,
  ): Promise<TenancyReviewResponseDto> {
    if (callerRole !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only administrators may moderate tenancy reviews',
      });
    }

    const existing = await this.prisma.tenancyReview.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.REVIEW_NOT_FOUND,
        message: `Tenancy review ${id} not found`,
      });
    }

    const updated = await this.prisma.tenancyReview.update({
      where: { id },
      data: { moderationStatus: dto.moderationStatus },
      include: {
        reviewer: { select: { fullName: true } },
      },
    });

    await this.audit.record({
      eventType: 'review.moderated',
      entityType: 'tenancy_review',
      entityId: id,
      actorId: callerUserId,
      actorRole: callerRole,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { beforeStatus: existing.moderationStatus, afterStatus: updated.moderationStatus },
    });

    return this.mapReviewToDto(updated);
  }
}
