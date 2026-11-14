import { ERROR_CODES, type UserRole } from '@aashvo/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  PublicProfileResponseDto,
  UpdateProfileDto,
  UserProfileResponseDto,
} from './dto/profile.dto';

export function calculateProfileCompletion(profile: {
  fullName: string | null;
  phoneNumber: string | null;
  bio: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}): number {
  let score = 0;
  if (profile.fullName && profile.fullName.trim().length >= 2) score += 25;
  if (profile.phoneNumber && profile.phoneNumber.trim().length >= 10) score += 25;
  if (profile.bio && profile.bio.trim().length >= 10) score += 20;
  if (profile.avatarUrl && profile.avatarUrl.trim().length > 0) score += 15;
  if (profile.emailVerified) score += 15;
  return Math.min(score, 100);
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toUserView(profile: Profile): UserProfileResponseDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      role: profile.role as UserRole,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified,
      phoneVerified: profile.phoneVerified,
      idVerified: profile.idVerified,
      profileCompletionPercent: calculateProfileCompletion(profile),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private toPublicView(profile: Profile): PublicProfileResponseDto {
    return {
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role as UserRole,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified,
      phoneVerified: profile.phoneVerified,
      idVerified: profile.idVerified,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  async getMyProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    return this.toUserView(profile);
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<UserProfileResponseDto> {
    const existing = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    // Phone uniqueness check if updating phone number
    if (dto.phoneNumber && dto.phoneNumber !== existing.phoneNumber) {
      const duplicatePhone = await this.prisma.profile.findFirst({
        where: {
          phoneNumber: dto.phoneNumber,
          id: { not: userId },
        },
      });

      if (duplicatePhone) {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'This phone number is already registered to another account.',
        });
      }
    }

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() } : {}),
      },
    });

    await this.audit.record({
      actorId: userId,
      actorRole: existing.role as UserRole,
      eventType: 'profile.updated',
      entityType: 'profile',
      entityId: userId,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: {
        updatedFields: Object.keys(dto),
      },
    });

    return this.toUserView(updated);
  }

  async getPublicProfile(userId: string): Promise<PublicProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    return this.toPublicView(profile);
  }
}
