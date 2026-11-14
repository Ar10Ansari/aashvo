import {
  ERROR_CODES,
  type CleanlinessLevel as ContractCleanlinessLevel,
  type FlatmateIntention,
  type FoodHabit,
  type SleepRoutine,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CleanlinessLevel,
  FoodHabit as PrismaFoodHabit,
  Prisma,
  SleepRoutine as PrismaSleepRoutine,
  type FlatmateProfile,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreateFlatmateProfileDto,
  FlatmateProfileResponseDto,
  PaginatedFlatmatesResponseDto,
  SearchFlatmatesQueryDto,
  UpdateFlatmateProfileDto,
} from './dto/flatmate.dto';

type FlatmateWithUser = FlatmateProfile & {
  profile: {
    fullName: string;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
};

export function toPrismaSleepRoutine(routine?: string): PrismaSleepRoutine {
  if (routine === 'Early Bird' || routine === 'Early_Bird') return PrismaSleepRoutine.Early_Bird;
  if (routine === 'Night Owl' || routine === 'Night_Owl') return PrismaSleepRoutine.Night_Owl;
  return PrismaSleepRoutine.Flexible;
}

export function toContractSleepRoutine(routine: PrismaSleepRoutine): SleepRoutine {
  if (routine === PrismaSleepRoutine.Early_Bird) return 'Early Bird';
  if (routine === PrismaSleepRoutine.Night_Owl) return 'Night Owl';
  return 'Flexible';
}

export function toPrismaFoodHabit(habit?: string): PrismaFoodHabit {
  if (habit === 'Non-Vegetarian' || habit === 'Non_Vegetarian') return PrismaFoodHabit.Non_Vegetarian;
  if (habit === 'Vegetarian') return PrismaFoodHabit.Vegetarian;
  if (habit === 'Eggetarian') return PrismaFoodHabit.Eggetarian;
  if (habit === 'Vegan') return PrismaFoodHabit.Vegan;
  return PrismaFoodHabit.Vegetarian;
}

export function toContractFoodHabit(habit: PrismaFoodHabit): FoodHabit {
  if (habit === PrismaFoodHabit.Non_Vegetarian) return 'Non-Vegetarian';
  if (habit === PrismaFoodHabit.Vegetarian) return 'Vegetarian';
  if (habit === PrismaFoodHabit.Eggetarian) return 'Eggetarian';
  return 'Vegan';
}

export function calculateCompatibilityScore(
  a: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests?: string[];
  },
  b: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests?: string[];
  },
): number {
  let score = 0;

  // 1. Food Habit Alignment (25 pts)
  if (a.foodHabit === b.foodHabit) {
    score += 25;
  } else if (
    (a.foodHabit === 'Eggetarian' && b.foodHabit === 'Vegetarian') ||
    (a.foodHabit === 'Vegetarian' && b.foodHabit === 'Eggetarian')
  ) {
    score += 15;
  }

  // 2. Sleep Routine Alignment (20 pts)
  if (a.sleepRoutine === b.sleepRoutine) {
    score += 20;
  } else if (a.sleepRoutine === 'Flexible' || b.sleepRoutine === 'Flexible') {
    score += 15;
  }

  // 3. Cleanliness Alignment (20 pts)
  if (a.cleanliness === b.cleanliness) {
    score += 20;
  } else if (
    (a.cleanliness === 'Spotless' && b.cleanliness === 'Moderate') ||
    (a.cleanliness === 'Moderate' && b.cleanliness === 'Spotless') ||
    (a.cleanliness === 'Moderate' && b.cleanliness === 'Relaxed')
  ) {
    score += 12;
  }

  // 4. Budget Overlap (20 pts)
  const maxB = Math.max(a.budgetMax, b.budgetMax);
  if (maxB > 0) {
    const budgetRatio = Math.min(a.budgetMax, b.budgetMax) / maxB;
    score += Math.round(budgetRatio * 20);
  }

  // 5. Shared Interests (15 pts)
  const aInterests = new Set((a.interests ?? []).map((i) => i.toLowerCase().trim()));
  const bInterests = (b.interests ?? []).map((i) => i.toLowerCase().trim());
  const shared = bInterests.filter((i) => aInterests.has(i));
  if (shared.length >= 3) score += 15;
  else if (shared.length === 2) score += 10;
  else if (shared.length === 1) score += 5;

  return Math.min(100, Math.max(0, score));
}

@Injectable()
export class FlatmatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toView(
    item: FlatmateWithUser,
    callerProfile?: FlatmateProfile | null,
  ): FlatmateProfileResponseDto {
    let compatibilityScore: number | undefined;
    if (callerProfile && callerProfile.id !== item.id) {
      compatibilityScore = calculateCompatibilityScore(
        {
          foodHabit: callerProfile.foodHabit,
          sleepRoutine: callerProfile.sleepRoutine,
          cleanliness: callerProfile.cleanliness,
          budgetMax: Number(callerProfile.budgetMax),
          interests: callerProfile.interests,
        },
        {
          foodHabit: item.foodHabit,
          sleepRoutine: item.sleepRoutine,
          cleanliness: item.cleanliness,
          budgetMax: Number(item.budgetMax),
          interests: item.interests,
        },
      );
    }

    const intentions =
      item.intentions && item.intentions.length > 0
        ? (item.intentions as FlatmateIntention[])
        : item.hasRoom
          ? (['has_room'] as FlatmateIntention[])
          : (['needs_room', 'team_up'] as FlatmateIntention[]);

    return {
      id: item.id,
      userId: item.userId,
      occupation: item.occupation,
      age: item.age,
      gender: item.gender,
      hasRoom: item.hasRoom,
      intentions,
      roomDetails: item.roomDetails,
      targetLocalities: item.targetLocalities,
      city: item.city,
      budgetMax: Number(item.budgetMax),
      foodHabit: toContractFoodHabit(item.foodHabit),
      sleepRoutine: toContractSleepRoutine(item.sleepRoutine),
      cleanliness: item.cleanliness as ContractCleanlinessLevel,
      petFriendly: item.petFriendly,
      smoking: item.smoking,
      bio: item.bio,
      interests: item.interests,
      verified: item.verified,
      compatibilityScore,
      createdAt: item.createdAt.toISOString(),
      user: {
        fullName: item.profile.fullName,
        avatarUrl: item.profile.avatarUrl,
        idVerified: item.profile.idVerified,
        phoneVerified: item.profile.phoneVerified,
      },
    };
  }

  async createProfile(
    userId: string,
    dto: CreateFlatmateProfileDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<FlatmateProfileResponseDto> {
    if (dto.age < 18) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Applicant must be at least 18 years old to create a flatmate listing.',
      });
    }

    if (dto.budgetMax <= 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Maximum budget must be greater than 0.',
      });
    }

    const existing = await this.prisma.flatmateProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: 'A flatmate profile already exists for this account. Use update instead.',
      });
    }

    const resolvedIntentions =
      dto.intentions && dto.intentions.length > 0
        ? dto.intentions
        : dto.hasRoom
          ? ['has_room']
          : ['needs_room', 'team_up'];
    const hasRoom = dto.hasRoom !== undefined ? dto.hasRoom : resolvedIntentions.includes('has_room');

    const created = await this.prisma.flatmateProfile.create({
      data: {
        userId,
        occupation: dto.occupation.trim(),
        age: dto.age,
        gender: dto.gender.trim(),
        hasRoom,
        intentions: resolvedIntentions as any,
        roomDetails: dto.roomDetails?.trim() ?? null,
        targetLocalities: dto.targetLocalities,
        city: dto.city.trim(),
        budgetMax: new Prisma.Decimal(dto.budgetMax),
        foodHabit: toPrismaFoodHabit(dto.foodHabit),
        sleepRoutine: toPrismaSleepRoutine(dto.sleepRoutine),
        cleanliness: dto.cleanliness as CleanlinessLevel,
        petFriendly: dto.petFriendly ?? false,
        smoking: dto.smoking.trim(),
        bio: dto.bio.trim(),
        interests: dto.interests ?? [],
      },
      include: {
        profile: {
          select: {
            fullName: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'flatmate_profile.created',
      entityType: 'flatmate_profile',
      entityId: created.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { city: created.city, age: created.age },
    });

    return this.toView(created as FlatmateWithUser);
  }

  async updateProfile(
    userId: string,
    dto: UpdateFlatmateProfileDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<FlatmateProfileResponseDto> {
    if (dto.age !== undefined && dto.age < 18) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Applicant must be at least 18 years old to create a flatmate listing.',
      });
    }

    if (dto.budgetMax !== undefined && dto.budgetMax <= 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Maximum budget must be greater than 0.',
      });
    }

    const existing = await this.prisma.flatmateProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.FLATMATE_PROFILE_NOT_FOUND,
        message: 'Flatmate profile not found.',
      });
    }

    const updated = await this.prisma.flatmateProfile.update({
      where: { userId },
      data: {
        ...(dto.occupation !== undefined ? { occupation: dto.occupation.trim() } : {}),
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
        ...(dto.intentions !== undefined
          ? {
              intentions: dto.intentions as any,
              hasRoom: dto.hasRoom !== undefined ? dto.hasRoom : dto.intentions.includes('has_room'),
            }
          : dto.hasRoom !== undefined
            ? { hasRoom: dto.hasRoom }
            : {}),
        ...(dto.roomDetails !== undefined ? { roomDetails: dto.roomDetails.trim() } : {}),
        ...(dto.targetLocalities !== undefined ? { targetLocalities: dto.targetLocalities } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: new Prisma.Decimal(dto.budgetMax) } : {}),
        ...(dto.foodHabit !== undefined ? { foodHabit: toPrismaFoodHabit(dto.foodHabit) } : {}),
        ...(dto.sleepRoutine !== undefined ? { sleepRoutine: toPrismaSleepRoutine(dto.sleepRoutine) } : {}),
        ...(dto.cleanliness !== undefined ? { cleanliness: dto.cleanliness as CleanlinessLevel } : {}),
        ...(dto.petFriendly !== undefined ? { petFriendly: dto.petFriendly } : {}),
        ...(dto.smoking !== undefined ? { smoking: dto.smoking.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
        ...(dto.interests !== undefined ? { interests: dto.interests } : {}),
      },
      include: {
        profile: {
          select: {
            fullName: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'flatmate_profile.updated',
      entityType: 'flatmate_profile',
      entityId: existing.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
    });

    return this.toView(updated as FlatmateWithUser);
  }

  async getMyProfile(userId: string): Promise<FlatmateProfileResponseDto> {
    const item = await this.prisma.flatmateProfile.findUnique({
      where: { userId },
      include: {
        profile: {
          select: {
            fullName: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: ERROR_CODES.FLATMATE_PROFILE_NOT_FOUND,
        message: 'You have not created a flatmate profile yet.',
      });
    }

    return this.toView(item as FlatmateWithUser);
  }

  async getProfileById(id: string, callerUserId?: string): Promise<FlatmateProfileResponseDto> {
    const item = await this.prisma.flatmateProfile.findUnique({
      where: { id },
      include: {
        profile: {
          select: {
            fullName: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: ERROR_CODES.FLATMATE_PROFILE_NOT_FOUND,
        message: 'Flatmate profile not found.',
      });
    }

    let callerProfile: FlatmateProfile | null = null;
    if (callerUserId) {
      callerProfile = await this.prisma.flatmateProfile.findUnique({
        where: { userId: callerUserId },
      });
    }

    return this.toView(item as FlatmateWithUser, callerProfile);
  }

  async searchFlatmates(
    query: SearchFlatmatesQueryDto,
    callerUserId?: string,
  ): Promise<PaginatedFlatmatesResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FlatmateProfileWhereInput = {
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.locality ? { targetLocalities: { has: query.locality } } : {}),
      ...(query.gender ? { gender: { equals: query.gender, mode: 'insensitive' } } : {}),
      ...(query.foodHabit ? { foodHabit: toPrismaFoodHabit(query.foodHabit) } : {}),
      ...(query.sleepRoutine ? { sleepRoutine: toPrismaSleepRoutine(query.sleepRoutine) } : {}),
      ...(query.cleanliness ? { cleanliness: query.cleanliness as CleanlinessLevel } : {}),
      ...(query.hasRoom !== undefined ? { hasRoom: query.hasRoom } : {}),
      ...(query.maxBudget !== undefined
        ? { budgetMax: { lte: new Prisma.Decimal(query.maxBudget) } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.flatmateProfile.count({ where }),
      this.prisma.flatmateProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          profile: {
            select: {
              fullName: true,
              avatarUrl: true,
              idVerified: true,
              phoneVerified: true,
            },
          },
        },
      }),
    ]);

    let callerProfile: FlatmateProfile | null = null;
    if (callerUserId) {
      callerProfile = await this.prisma.flatmateProfile.findUnique({
        where: { userId: callerUserId },
      });
    }

    return {
      data: items.map((item) => this.toView(item as FlatmateWithUser, callerProfile)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
      },
    };
  }
}
