import {
  ERROR_CODES,
  type MarketplaceProfileStatus,
  type MarketplaceProfileType,
  type UserRole,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CleanlinessLevel,
  MarketplaceProfileStatus as DBMarketplaceProfileStatus,
  MarketplaceProfileType as DBMarketplaceProfileType,
  Prisma,
  type FlatmateProfile,
  type MarketplaceProfile,
  type Profile,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import {
  toPrismaFoodHabit,
  toPrismaSleepRoutine,
} from '../flatmates/flatmates.service';
import type {
  CreateMarketplaceProfileDto,
  MarketplaceProfileResponseDto,
  PersonalOnboardingDto,
  ProfileCompletionBreakdownDto,
  UpdateMarketplaceProfileDto,
} from './dto/marketplace-profile.dto';
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

export function toPrismaCleanliness(level?: string): CleanlinessLevel {
  if (level === 'Spotless') return CleanlinessLevel.Spotless;
  if (level === 'Relaxed') return CleanlinessLevel.Relaxed;
  return CleanlinessLevel.Moderate;
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

  private toMarketplaceView(mp: MarketplaceProfile): MarketplaceProfileResponseDto {
    return {
      id: mp.id,
      userId: mp.userId,
      profileType: mp.profileType as MarketplaceProfileType,
      status: mp.status as MarketplaceProfileStatus,
      isCurrentActive: mp.isCurrentActive,
      displayName: mp.displayName,
      completionPercent: mp.completionPercent,
      metadata: (mp.metadata as Record<string, any>) || {},
      createdAt: mp.createdAt.toISOString(),
      updatedAt: mp.updatedAt.toISOString(),
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

  // ==================== MARKETPLACE PROFILE MANAGEMENT ====================

  async getMyMarketplaceProfiles(userId: string): Promise<MarketplaceProfileResponseDto[]> {
    let profiles = await this.prisma.marketplaceProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    // Auto-initialize default profile if none exists
    if (profiles.length === 0) {
      const parentProfile = await this.prisma.profile.findUnique({
        where: { id: userId },
        include: { flatmateProfile: true },
      });

      if (parentProfile) {
        const defaultType: DBMarketplaceProfileType =
          parentProfile.role === 'owner'
            ? DBMarketplaceProfileType.property_owner
            : DBMarketplaceProfileType.flatmate_seeker;

        const initial = await this.prisma.marketplaceProfile.create({
          data: {
            userId,
            profileType: defaultType,
            status: parentProfile.flatmateProfile?.isPublished
              ? DBMarketplaceProfileStatus.active
              : DBMarketplaceProfileStatus.draft,
            isCurrentActive: true,
            displayName: parentProfile.fullName,
            completionPercent: parentProfile.flatmateProfile ? 85 : 30,
          },
        });
        profiles = [initial];
      }
    }

    return profiles.map((p) => this.toMarketplaceView(p));
  }

  async createMarketplaceProfile(
    userId: string,
    dto: CreateMarketplaceProfileDto,
  ): Promise<MarketplaceProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Account profile not found.',
      });
    }

    const dbType = dto.profileType as DBMarketplaceProfileType;

    // Ensure default flatmate_seeker exists if creating another persona
    if (dbType !== DBMarketplaceProfileType.flatmate_seeker) {
      const defaultSeeker = await this.prisma.marketplaceProfile.findUnique({
        where: {
          userId_profileType: {
            userId,
            profileType: DBMarketplaceProfileType.flatmate_seeker,
          },
        },
      });
      if (!defaultSeeker) {
        await this.prisma.marketplaceProfile.create({
          data: {
            userId,
            profileType: DBMarketplaceProfileType.flatmate_seeker,
            status: DBMarketplaceProfileStatus.draft,
            isCurrentActive: false,
            displayName: profile.fullName,
            completionPercent: 30,
          },
        });
      }
    }

    const existing = await this.prisma.marketplaceProfile.findUnique({
      where: {
        userId_profileType: {
          userId,
          profileType: dbType,
        },
      },
    });

    if (existing) {
      // Reactivate or update
      const updated = await this.prisma.marketplaceProfile.update({
        where: { id: existing.id },
        data: {
          status: DBMarketplaceProfileStatus.active,
          displayName: dto.displayName?.trim() || existing.displayName,
          metadata: dto.metadata
            ? { ...(existing.metadata as object), ...dto.metadata }
            : (existing.metadata as Prisma.InputJsonValue),
        },
      });
      return this.toMarketplaceView(updated);
    }

    const count = await this.prisma.marketplaceProfile.count({ where: { userId } });
    const isFirst = count === 0;

    const created = await this.prisma.marketplaceProfile.create({
      data: {
        userId,
        profileType: dbType,
        status: DBMarketplaceProfileStatus.active,
        isCurrentActive: isFirst,
        displayName: dto.displayName?.trim() || profile.fullName,
        metadata: dto.metadata || {},
        completionPercent: 50,
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'marketplace_profile.created',
      entityType: 'marketplace_profile',
      entityId: created.id,
      outcome: 'success',
      metadata: { profileType: dto.profileType },
    });

    return this.toMarketplaceView(created);
  }

  async updateMarketplaceProfile(
    userId: string,
    profileType: MarketplaceProfileType,
    dto: UpdateMarketplaceProfileDto,
  ): Promise<MarketplaceProfileResponseDto> {
    const dbType = profileType as DBMarketplaceProfileType;
    const existing = await this.prisma.marketplaceProfile.findUnique({
      where: {
        userId_profileType: {
          userId,
          profileType: dbType,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: `Marketplace profile of type '${profileType}' not found for current user.`,
      });
    }

    const updated = await this.prisma.marketplaceProfile.update({
      where: { id: existing.id },
      data: {
        displayName: dto.displayName !== undefined ? dto.displayName.trim() : existing.displayName,
        status: dto.status !== undefined ? (dto.status as DBMarketplaceProfileStatus) : existing.status,
        metadata: dto.metadata
          ? { ...(existing.metadata as object), ...dto.metadata }
          : (existing.metadata as Prisma.InputJsonValue),
      },
    });

    return this.toMarketplaceView(updated);
  }

  async switchActiveProfile(
    userId: string,
    profileType: MarketplaceProfileType,
  ): Promise<MarketplaceProfileResponseDto> {
    const dbType = profileType as DBMarketplaceProfileType;

    let target = await this.prisma.marketplaceProfile.findUnique({
      where: {
        userId_profileType: {
          userId,
          profileType: dbType,
        },
      },
    });

    if (!target) {
      // Auto-create on switch
      const parent = await this.prisma.profile.findUniqueOrThrow({ where: { id: userId } });
      target = await this.prisma.marketplaceProfile.create({
        data: {
          userId,
          profileType: dbType,
          status: DBMarketplaceProfileStatus.active,
          isCurrentActive: true,
          displayName: parent.fullName,
          completionPercent: 50,
        },
      });
    }

    // Set other profiles isCurrentActive = false, this one = true
    await this.prisma.$transaction([
      this.prisma.marketplaceProfile.updateMany({
        where: { userId, id: { not: target.id } },
        data: { isCurrentActive: false },
      }),
      this.prisma.marketplaceProfile.update({
        where: { id: target.id },
        data: { isCurrentActive: true },
      }),
    ]);

    const activeProfile = await this.prisma.marketplaceProfile.findUniqueOrThrow({
      where: { id: target.id },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'marketplace_profile.switched',
      entityType: 'marketplace_profile',
      entityId: activeProfile.id,
      outcome: 'success',
      metadata: { profileType },
    });

    return this.toMarketplaceView(activeProfile);
  }

  // ==================== PROGRESSIVE ONBOARDING & COMPLETION ====================

  calculateBreakdown(
    profile: Profile | null,
    flatmate: FlatmateProfile | null,
  ): ProfileCompletionBreakdownDto {
    let basicInfo = 0;
    let location = 0;
    let housing = 0;
    let lifestyle = 0;
    let photo = 0;
    const missing: string[] = [];

    // 1. Basic Info (25 pts max)
    if (profile?.fullName && profile.fullName.trim().length >= 2) basicInfo += 10;
    else missing.push('Full Name');

    if (flatmate && flatmate.age >= 18) basicInfo += 5;
    else missing.push('Age (18+)');

    if (flatmate?.occupation && flatmate.occupation.trim().length > 0) basicInfo += 5;
    else missing.push('Profession');

    if (flatmate?.bio && flatmate.bio.trim().length >= 10) basicInfo += 5;
    else missing.push('About Me (Bio)');

    // 2. Location (20 pts max)
    if (flatmate?.city && flatmate.city.trim().length > 0) location += 10;
    else missing.push('City');

    if (flatmate?.targetLocalities && flatmate.targetLocalities.length > 0) location += 10;
    else missing.push('Preferred Localities');

    // 3. Housing Requirements (20 pts max)
    if (flatmate && Number(flatmate.budgetMax) > 0) housing += 10;
    else missing.push('Budget Maximum');

    if (flatmate?.roomType || (flatmate?.intentions && flatmate.intentions.length > 0) || flatmate?.hasRoom !== undefined) {
      housing += 10;
    } else {
      missing.push('Housing Preference (Room Type / Intention)');
    }

    // 4. Lifestyle (20 pts max)
    if (flatmate?.foodHabit) lifestyle += 5;
    else missing.push('Food Habit');

    if (flatmate?.sleepRoutine) lifestyle += 5;
    else missing.push('Sleep Routine');

    if (flatmate?.cleanliness) lifestyle += 5;
    else missing.push('Cleanliness Preference');

    if (flatmate?.smoking) lifestyle += 5;
    else missing.push('Smoking Habit');

    // 5. Photo (15 pts max)
    if (profile?.avatarUrl && profile.avatarUrl.trim().length > 0) photo += 15;
    else missing.push('Profile Photo');

    const total = basicInfo + location + housing + lifestyle + photo;
    const isComplete = missing.length === 0 || total >= 80;
    const isPublished = Boolean(flatmate?.isPublished);

    return {
      totalPercent: total,
      basicInfoPercent: basicInfo,
      locationPercent: location,
      housingPercent: housing,
      lifestylePercent: lifestyle,
      photoPercent: photo,
      missingFields: missing,
      isComplete,
      isPublished,
    };
  }

  async getProfileCompletionStatus(userId: string): Promise<ProfileCompletionBreakdownDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { flatmateProfile: true },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Profile not found.',
      });
    }

    return this.calculateBreakdown(profile, profile.flatmateProfile);
  }

  async saveOnboardingProfile(
    userId: string,
    dto: PersonalOnboardingDto,
  ): Promise<{
    marketplaceProfile: MarketplaceProfileResponseDto;
    completion: ProfileCompletionBreakdownDto;
  }> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Account profile not found.',
      });
    }

    // 1. Update Profile entity
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName.trim(),
        bio: dto.bio.trim(),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() } : {}),
      },
    });

    const isPublished = Boolean(dto.publishImmediately);
    const discoveryHidden = !isPublished;

    // 2. Upsert FlatmateProfile entity
    const flatmate = await this.prisma.flatmateProfile.upsert({
      where: { userId },
      create: {
        userId,
        occupation: dto.profession.trim(),
        age: dto.age,
        gender: dto.gender?.trim() || 'unspecified',
        hasRoom: Boolean(dto.hasRoom),
        intentions: (dto.intentions as any) || [],
        roomDetails: dto.roomDetails?.trim() || null,
        targetLocalities: dto.targetLocalities || [],
        city: dto.city.trim(),
        state: dto.state?.trim() || 'Haryana',
        country: dto.country?.trim() || 'India',
        budgetMin: dto.budgetMin ? new Prisma.Decimal(dto.budgetMin) : new Prisma.Decimal(0),
        budgetMax: new Prisma.Decimal(dto.budgetMax),
        moveInDate: dto.moveInDate?.trim() || null,
        moveInFlexible: dto.moveInFlexible !== false,
        roomType: (dto.roomType as any) || null,
        furnishing: (dto.furnishing as any) || null,
        foodHabit: toPrismaFoodHabit(dto.foodHabit),
        sleepRoutine: toPrismaSleepRoutine(dto.sleepRoutine),
        cleanliness: toPrismaCleanliness(dto.cleanliness),
        petFriendly: Boolean(dto.petFriendly),
        smoking: dto.smoking.trim(),
        drinking: dto.drinking?.trim() || 'Prefer not to say',
        bio: dto.bio.trim(),
        interests: dto.interests || [],
        languages: dto.languages || [],
        collegeOrWorkplace: dto.collegeOrWorkplace?.trim() || null,
        socialLifestyle: dto.socialLifestyle?.trim() || null,
        wfhHabits: dto.wfhHabits?.trim() || null,
        noiseTolerance: dto.noiseTolerance?.trim() || null,
        verified: profile.idVerified,
        isPublished,
        discoveryHidden,
      },
      update: {
        occupation: dto.profession.trim(),
        age: dto.age,
        gender: dto.gender?.trim() || 'unspecified',
        hasRoom: Boolean(dto.hasRoom),
        intentions: (dto.intentions as any) || [],
        roomDetails: dto.roomDetails?.trim() || null,
        targetLocalities: dto.targetLocalities || [],
        city: dto.city.trim(),
        state: dto.state?.trim() || 'Haryana',
        country: dto.country?.trim() || 'India',
        budgetMin: dto.budgetMin ? new Prisma.Decimal(dto.budgetMin) : new Prisma.Decimal(0),
        budgetMax: new Prisma.Decimal(dto.budgetMax),
        moveInDate: dto.moveInDate?.trim() || null,
        moveInFlexible: dto.moveInFlexible !== false,
        roomType: (dto.roomType as any) || null,
        furnishing: (dto.furnishing as any) || null,
        foodHabit: toPrismaFoodHabit(dto.foodHabit),
        sleepRoutine: toPrismaSleepRoutine(dto.sleepRoutine),
        cleanliness: toPrismaCleanliness(dto.cleanliness),
        petFriendly: Boolean(dto.petFriendly),
        smoking: dto.smoking.trim(),
        drinking: dto.drinking?.trim() || 'Prefer not to say',
        bio: dto.bio.trim(),
        interests: dto.interests || [],
        languages: dto.languages || [],
        collegeOrWorkplace: dto.collegeOrWorkplace?.trim() || null,
        socialLifestyle: dto.socialLifestyle?.trim() || null,
        wfhHabits: dto.wfhHabits?.trim() || null,
        noiseTolerance: dto.noiseTolerance?.trim() || null,
        isPublished,
        discoveryHidden,
      },
    });

    const updatedProfile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: userId },
    });
    const completion = this.calculateBreakdown(updatedProfile, flatmate);

    // 3. Upsert MarketplaceProfile for flatmate_seeker
    const marketplaceProfile = await this.prisma.marketplaceProfile.upsert({
      where: {
        userId_profileType: {
          userId,
          profileType: DBMarketplaceProfileType.flatmate_seeker,
        },
      },
      create: {
        userId,
        profileType: DBMarketplaceProfileType.flatmate_seeker,
        status: isPublished ? DBMarketplaceProfileStatus.active : DBMarketplaceProfileStatus.draft,
        isCurrentActive: true,
        displayName: dto.fullName.trim(),
        completionPercent: completion.totalPercent,
      },
      update: {
        status: isPublished ? DBMarketplaceProfileStatus.active : DBMarketplaceProfileStatus.draft,
        completionPercent: completion.totalPercent,
        displayName: dto.fullName.trim(),
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: isPublished ? 'profile.published' : 'profile.draft_saved',
      entityType: 'marketplace_profile',
      entityId: marketplaceProfile.id,
      outcome: 'success',
      metadata: { completionPercent: completion.totalPercent },
    });

    return {
      marketplaceProfile: this.toMarketplaceView(marketplaceProfile),
      completion,
    };
  }

  async publishProfile(userId: string): Promise<ProfileCompletionBreakdownDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { flatmateProfile: true },
    });

    if (!profile || !profile.flatmateProfile) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'No flatmate profile exists to publish. Please complete onboarding first.',
      });
    }

    const breakdown = this.calculateBreakdown(profile, profile.flatmateProfile);

    if (!profile.fullName || profile.fullName.trim().length < 2) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Full Name is required before publishing.',
      });
    }

    if (profile.flatmateProfile.age < 18) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Age must be 18 or older to publish an Aashvo profile.',
      });
    }

    await this.prisma.flatmateProfile.update({
      where: { userId },
      data: {
        isPublished: true,
        discoveryHidden: false,
      },
    });

    await this.prisma.marketplaceProfile.updateMany({
      where: { userId, profileType: DBMarketplaceProfileType.flatmate_seeker },
      data: {
        status: DBMarketplaceProfileStatus.active,
        completionPercent: breakdown.totalPercent,
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'profile.published',
      entityType: 'flatmate_profile',
      entityId: profile.flatmateProfile.id,
      outcome: 'success',
    });

    return {
      ...breakdown,
      isPublished: true,
    };
  }

  async pauseProfile(userId: string): Promise<ProfileCompletionBreakdownDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { flatmateProfile: true },
    });

    if (!profile || !profile.flatmateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Flatmate profile not found.',
      });
    }

    await this.prisma.flatmateProfile.update({
      where: { userId },
      data: {
        discoveryHidden: true,
      },
    });

    await this.prisma.marketplaceProfile.updateMany({
      where: { userId, profileType: DBMarketplaceProfileType.flatmate_seeker },
      data: { status: DBMarketplaceProfileStatus.paused },
    });

    const breakdown = this.calculateBreakdown(profile, profile.flatmateProfile);
    return breakdown;
  }
}
