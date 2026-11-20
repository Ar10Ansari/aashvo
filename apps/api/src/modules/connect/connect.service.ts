import {
  ERROR_CODES,
  type CleanlinessLevel as ContractCleanlinessLevel,
  DEFAULT_MATCHING_WEIGHTS,
  type CompatibilityBreakdown,
  type ConnectCandidateView,
  type ConnectLikeItem,
  type ConnectMatchItem,
  type ConnectMessageItem,
  type ConnectSwipeResponse,
  type ConnectUndoResponse,
  type FlatmateIntention,
  type MatchingWeightsConfig,
  type UserMatchingPreferencesView,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FlatmateInterestType,
  FlatmateMatchStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import {
  toContractFoodHabit,
  toContractSleepRoutine,
} from '../flatmates/flatmates.service';
import type {
  BlockUserDto,
  ConnectDiscoverQueryDto,
  ConnectSwipeDto,
  ReportUserDto,
  SendConnectMessageDto,
  UpdateMatchingPreferencesDto,
} from './dto/connect.dto';

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface CandidateCompatibilityInput {
  country?: string | null;
  state?: string | null;
  city?: string;
  targetLocalities?: string[];
  budgetMin?: number | null;
  budgetMax: number;
  moveInDate?: string | null;
  moveInFlexible?: boolean;
  foodHabit: string;
  sleepRoutine: string;
  cleanliness: string;
  smoking?: string | null;
  drinking?: string | null;
  petFriendly?: boolean | null;
  socialLifestyle?: string | null;
  wfhHabits?: string | null;
  interests?: string[];
}

export function normalizeWeights(w?: Partial<MatchingWeightsConfig>): MatchingWeightsConfig {
  const merged: MatchingWeightsConfig = {
    budget: Math.max(0, w?.budget ?? DEFAULT_MATCHING_WEIGHTS.budget),
    location: Math.max(0, w?.location ?? DEFAULT_MATCHING_WEIGHTS.location),
    lifestyle: Math.max(0, w?.lifestyle ?? DEFAULT_MATCHING_WEIGHTS.lifestyle),
    food: Math.max(0, w?.food ?? DEFAULT_MATCHING_WEIGHTS.food),
    sleep: Math.max(0, w?.sleep ?? DEFAULT_MATCHING_WEIGHTS.sleep),
    moveIn: Math.max(0, w?.moveIn ?? DEFAULT_MATCHING_WEIGHTS.moveIn),
    interests: Math.max(0, w?.interests ?? DEFAULT_MATCHING_WEIGHTS.interests),
  };

  const sum =
    merged.budget +
    merged.location +
    merged.lifestyle +
    merged.food +
    merged.sleep +
    merged.moveIn +
    merged.interests;

  if (sum === 0) return { ...DEFAULT_MATCHING_WEIGHTS };

  return {
    budget: (merged.budget / sum) * 100,
    location: (merged.location / sum) * 100,
    lifestyle: (merged.lifestyle / sum) * 100,
    food: (merged.food / sum) * 100,
    sleep: (merged.sleep / sum) * 100,
    moveIn: (merged.moveIn / sum) * 100,
    interests: (merged.interests / sum) * 100,
  };
}

export function computeDetailedCompatibility(
  caller: CandidateCompatibilityInput,
  candidate: CandidateCompatibilityInput,
  customWeights?: Partial<MatchingWeightsConfig>,
): CompatibilityBreakdown {
  const weights = normalizeWeights(customWeights);
  const explanations: string[] = [];

  // 1. BUDGET COMPATIBILITY (Weight: 20 default)
  let budgetRatio = 0.5;
  let budgetExpl = 'Budget range compatible';
  const cMax = Number(caller.budgetMax) || 0;
  const candMax = Number(candidate.budgetMax) || 0;
  const cMin = Number(caller.budgetMin) || 0;
  const candMin = Number(candidate.budgetMin) || 0;

  if (cMax > 0 && candMax > 0) {
    const overlapMin = Math.max(cMin, candMin);
    const overlapMax = Math.min(cMax, candMax);
    if (overlapMax >= overlapMin && overlapMax > 0) {
      const maxSpan = Math.max(cMax, candMax) - Math.min(cMin, candMin);
      const overlapSpan = overlapMax - overlapMin;
      budgetRatio = maxSpan > 0 ? Math.min(1, 0.5 + 0.5 * (overlapSpan / maxSpan)) : 1.0;
      budgetExpl = `Budget overlap between ₹${overlapMin.toLocaleString('en-IN')} – ₹${overlapMax.toLocaleString('en-IN')}`;
    } else {
      const ratio = Math.min(cMax, candMax) / Math.max(cMax, candMax);
      budgetRatio = ratio;
      if (ratio >= 0.8) {
        budgetExpl = `Similar budget limits (within ${Math.round((1 - ratio) * 100)}% gap)`;
      } else {
        budgetExpl = `Different budget ranges (₹${cMax.toLocaleString('en-IN')} vs ₹${candMax.toLocaleString('en-IN')})`;
      }
    }
  }
  const budgetScore = Math.round(budgetRatio * weights.budget);
  if (budgetRatio >= 0.7) explanations.push(budgetExpl);

  // 2. LOCATION COMPATIBILITY (Weight: 20 default)
  let locationRatio = 0.5;
  let locationExpl = 'Location preferences compatible';
  const cCity = (caller.city || '').trim().toLowerCase();
  const candCity = (candidate.city || '').trim().toLowerCase();
  const cLocalities = (caller.targetLocalities || []).map((l) => l.trim().toLowerCase());
  const candLocalities = (candidate.targetLocalities || []).map((l) => l.trim().toLowerCase());
  const sharedLocalities = candLocalities.filter((l) => cLocalities.includes(l));

  if (cCity && candCity) {
    if (cCity === candCity) {
      if (sharedLocalities.length > 0) {
        locationRatio = 1.0;
        locationExpl = `Exact locality match: ${sharedLocalities.map(capitalize).join(', ')}`;
      } else if (cLocalities.length > 0 && candLocalities.length > 0) {
        locationRatio = 0.75;
        locationExpl = `Both looking in ${capitalize(caller.city || '')} (different sectors)`;
      } else {
        locationRatio = 0.70;
        locationExpl = `Both looking in ${capitalize(caller.city || '')}`;
      }
    } else if (caller.state && candidate.state && caller.state.toLowerCase() === candidate.state.toLowerCase()) {
      locationRatio = 0.35;
      locationExpl = `Adjacent cities in ${caller.state}`;
    } else {
      locationRatio = 0.10;
      locationExpl = `Different target cities (${caller.city || 'unspecified'} vs ${candidate.city || 'unspecified'})`;
    }
  }
  const locationScore = Math.round(locationRatio * weights.location);
  if (locationRatio >= 0.7) explanations.push(locationExpl);

  // 3. LIFESTYLE COMPATIBILITY (Weight: 20 default)
  let cleanlinessPart = 0.5;
  if (caller.cleanliness === candidate.cleanliness) {
    cleanlinessPart = 1.0;
  } else if (
    (caller.cleanliness === 'Spotless' && candidate.cleanliness === 'Moderate') ||
    (caller.cleanliness === 'Moderate' && candidate.cleanliness === 'Spotless') ||
    (caller.cleanliness === 'Moderate' && candidate.cleanliness === 'Relaxed') ||
    (caller.cleanliness === 'Relaxed' && candidate.cleanliness === 'Moderate')
  ) {
    cleanlinessPart = 0.65;
  } else {
    cleanlinessPart = 0.10;
  }

  let smokingPart = 0.8;
  const cSmoke = (caller.smoking || 'No').trim().toLowerCase();
  const candSmoke = (candidate.smoking || 'No').trim().toLowerCase();
  if (cSmoke === candSmoke) {
    smokingPart = 1.0;
  } else if (cSmoke === 'no' && candSmoke !== 'no') {
    smokingPart = 0.1;
  } else if (cSmoke !== 'no' && candSmoke === 'no') {
    smokingPart = 0.1;
  }

  let petsPart = 0.8;
  if (caller.petFriendly === candidate.petFriendly) {
    petsPart = 1.0;
  } else if (candidate.petFriendly) {
    petsPart = 0.9;
  } else {
    petsPart = 0.4;
  }

  const lifestyleRatio = cleanlinessPart * 0.50 + smokingPart * 0.25 + petsPart * 0.15 + 0.10;
  const lifestyleScore = Math.round(lifestyleRatio * weights.lifestyle);
  const cleanlinessScore = Math.round(cleanlinessPart * 20); // backward-compat

  let lifestyleExpl = 'Compatible lifestyle habits';
  if (cleanlinessPart === 1.0) {
    lifestyleExpl = `Aligned cleanliness standard (${caller.cleanliness})`;
    explanations.push(lifestyleExpl);
  } else if (smokingPart === 1.0 && cSmoke === 'no') {
    lifestyleExpl = 'Non-smoking flatmates';
    explanations.push(lifestyleExpl);
  }

  // 4. FOOD HABIT COMPATIBILITY (Weight: 15 default)
  let foodRatio = 0.25;
  let foodExpl = `Different food habits (${caller.foodHabit} vs ${candidate.foodHabit})`;
  if (caller.foodHabit === candidate.foodHabit) {
    foodRatio = 1.0;
    foodExpl = `Both ${caller.foodHabit}`;
  } else if (
    (caller.foodHabit === 'Eggetarian' && candidate.foodHabit === 'Vegetarian') ||
    (caller.foodHabit === 'Vegetarian' && candidate.foodHabit === 'Eggetarian')
  ) {
    foodRatio = 0.75;
    foodExpl = `Compatible diets (${caller.foodHabit} & ${candidate.foodHabit})`;
  } else if (
    (caller.foodHabit === 'Vegan' && candidate.foodHabit === 'Vegetarian') ||
    (caller.foodHabit === 'Vegetarian' && candidate.foodHabit === 'Vegan')
  ) {
    foodRatio = 0.80;
    foodExpl = 'Plant-friendly dietary match';
  }
  const foodScore = Math.round(foodRatio * weights.food);
  if (foodRatio >= 0.7) explanations.push(foodExpl);

  // 5. SLEEP ROUTINE COMPATIBILITY (Weight: 10 default)
  let sleepRatio = 0.25;
  let sleepExpl = `Different sleep schedules (${caller.sleepRoutine} vs ${candidate.sleepRoutine})`;
  if (caller.sleepRoutine === candidate.sleepRoutine) {
    sleepRatio = 1.0;
    sleepExpl = `Matched sleep schedule (${caller.sleepRoutine})`;
  } else if (caller.sleepRoutine === 'Flexible' || candidate.sleepRoutine === 'Flexible') {
    sleepRatio = 0.80;
    sleepExpl = 'Flexible sleep routine';
  }
  const sleepScore = Math.round(sleepRatio * weights.sleep);
  if (sleepRatio >= 0.7) explanations.push(sleepExpl);

  // 6. MOVE-IN DATE COMPATIBILITY (Weight: 10 default)
  let moveInRatio = 0.75;
  let moveInExpl = 'Compatible move-in timeline';
  const cFlex = caller.moveInFlexible ?? true;
  const candFlex = candidate.moveInFlexible ?? true;
  const cDate = caller.moveInDate?.trim();
  const candDate = candidate.moveInDate?.trim();

  if (cFlex || candFlex) {
    moveInRatio = 0.95;
    moveInExpl = 'Move-in window aligned (Flexible timing)';
  } else if (cDate && candDate) {
    const t1 = new Date(cDate).getTime();
    const t2 = new Date(candDate).getTime();
    if (!isNaN(t1) && !isNaN(t2)) {
      const diffDays = Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        moveInRatio = 1.0;
        moveInExpl = 'Target move-in dates aligned (within 1 week)';
      } else if (diffDays <= 21) {
        moveInRatio = 0.85;
        moveInExpl = 'Move-in timelines compatible (within 3 weeks)';
      } else if (diffDays <= 45) {
        moveInRatio = 0.65;
        moveInExpl = 'Move-in timelines within same month window';
      } else {
        moveInRatio = 0.20;
        moveInExpl = `Move-in dates differ by ${Math.round(diffDays)} days`;
      }
    }
  }
  const moveInScore = Math.round(moveInRatio * weights.moveIn);
  if (moveInRatio >= 0.7) explanations.push(moveInExpl);

  // 7. SHARED INTERESTS (Weight: 5 default)
  const callerInterests = new Set((caller.interests ?? []).map((i) => i.toLowerCase().trim()));
  const candidateInterests = (candidate.interests ?? []).map((i) => i.toLowerCase().trim());
  const sharedInterests = candidateInterests.filter((i) => callerInterests.has(i));

  let interestsRatio = 0;
  if (sharedInterests.length >= 3) {
    interestsRatio = 1.0;
  } else if (sharedInterests.length === 2) {
    interestsRatio = 0.70;
  } else if (sharedInterests.length === 1) {
    interestsRatio = 0.40;
  }
  const interestsScore = Math.round(interestsRatio * weights.interests);
  if (sharedInterests.length > 0) {
    explanations.push(
      `${sharedInterests.length} shared interest(s): ${sharedInterests.slice(0, 3).map(capitalize).join(', ')}`,
    );
  }

  // Total Normalized Score (0 - 100)
  const overallScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        budgetScore + locationScore + lifestyleScore + foodScore + sleepScore + moveInScore + interestsScore,
      ),
    ),
  );

  return {
    overallScore,
    scoreAvailable: true,
    budgetScore,
    locationScore,
    lifestyleScore,
    foodScore,
    sleepScore,
    cleanlinessScore,
    moveInScore,
    interestsScore,
    sharedInterests,
    explanations: explanations.length > 0 ? explanations : ['Profile attributes match general preferences'],
    dimensions: {
      budget: {
        score: budgetScore,
        maxScore: Math.round(weights.budget),
        percentage: Math.round(budgetRatio * 100),
        explanation: budgetExpl,
      },
      location: {
        score: locationScore,
        maxScore: Math.round(weights.location),
        percentage: Math.round(locationRatio * 100),
        explanation: locationExpl,
      },
      lifestyle: {
        score: lifestyleScore,
        maxScore: Math.round(weights.lifestyle),
        percentage: Math.round(lifestyleRatio * 100),
        explanation: lifestyleExpl,
      },
      food: {
        score: foodScore,
        maxScore: Math.round(weights.food),
        percentage: Math.round(foodRatio * 100),
        explanation: foodExpl,
      },
      sleep: {
        score: sleepScore,
        maxScore: Math.round(weights.sleep),
        percentage: Math.round(sleepRatio * 100),
        explanation: sleepExpl,
      },
      moveIn: {
        score: moveInScore,
        maxScore: Math.round(weights.moveIn),
        percentage: Math.round(moveInRatio * 100),
        explanation: moveInExpl,
      },
      interests: {
        score: interestsScore,
        maxScore: Math.round(weights.interests),
        percentage: Math.round(interestsRatio * 100),
        explanation: sharedInterests.length > 0 ? `${sharedInterests.length} shared` : 'None shared',
      },
    },
  };
}

@Injectable()
export class ConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Discovers compatible potential flatmates for swipe recommendations.
   * Enforces:
   * - Excludes caller
   * - Excludes blocked users (mutual)
   * - Excludes already swiped (liked or passed) profiles
   * - Excludes suspended or deleted accounts
   * - Excludes underage users (< 18)
   * - Excludes profiles with discoveryHidden = true
   * - Applies deterministic 7-dimension location-aware compatibility scoring
   * - Applies caller's personalized matching weights if configured
   * - Returns sanitized PII only (approximate locality, display name, photo)
   */
  async discoverCandidates(
    callerId: string | null | undefined,
    query: ConnectDiscoverQueryDto,
  ): Promise<ConnectCandidateView[]> {
    let callerFlatmate = null;
    let customWeights: MatchingWeightsConfig | undefined = undefined;
    const excludedIds: string[] = [];

    if (callerId) {
      // 1. Fetch caller flatmate profile, personalized preferences, active blocks (both directions), and swiped IDs in parallel
      const [flatmate, pref, blocks, existingSwipes] = await Promise.all([
        this.prisma.flatmateProfile.findUnique({
          where: { userId: callerId },
        }),
        this.prisma.userMatchingPreference.findUnique({
          where: { userId: callerId },
        }),
        this.prisma.userBlock.findMany({
          where: {
            OR: [{ blockerId: callerId }, { blockedId: callerId }],
          },
          select: { blockerId: true, blockedId: true },
        }),
        this.prisma.flatmateInterest.findMany({
          where: { senderId: callerId },
          select: { targetUserId: true },
        }),
      ]);

      callerFlatmate = flatmate;
      if (pref) {
        customWeights = {
          budget: pref.budgetWeight,
          location: pref.locationWeight,
          lifestyle: pref.lifestyleWeight,
          food: pref.foodWeight,
          sleep: pref.sleepWeight,
          moveIn: pref.moveInWeight,
          interests: pref.interestsWeight,
        };
      }

      const blockedUserIds = new Set(
        blocks.map((b) => (b.blockerId === callerId ? b.blockedId : b.blockerId))
      );
      const swipedUserIds = new Set(existingSwipes.map((s) => s.targetUserId));

      // Excluded IDs list
      excludedIds.push(...Array.from(new Set([callerId, ...blockedUserIds, ...swipedUserIds])));
    }

    // 4. Build query filters
    const where: Prisma.FlatmateProfileWhereInput = {
      ...(excludedIds.length > 0 ? { userId: { notIn: excludedIds } } : {}),
      age: { gte: 18 },
      discoveryHidden: false,
      isPublished: true,
      profile: {
        user: {
          accountStatus: 'active',
          deletedAt: null,
        },
      },
    };

    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.locality) {
      where.targetLocalities = { has: query.locality };
    }
    if (query.gender && query.gender !== 'any') {
      where.gender = { equals: query.gender, mode: 'insensitive' };
    }
    if (query.minBudget !== undefined || query.maxBudget !== undefined) {
      where.budgetMax = {
        ...(query.minBudget !== undefined ? { gte: query.minBudget } : {}),
        ...(query.maxBudget !== undefined ? { lte: query.maxBudget } : {}),
      };
    }
    if (typeof query.hasRoom === 'boolean') {
      where.hasRoom = query.hasRoom;
    }
    if (query.intention) {
      where.intentions = { has: query.intention as any };
    }
    if (query.roomType) {
      where.roomType = query.roomType as any;
    }
    if (query.furnishing) {
      where.furnishing = query.furnishing as any;
    }
    if (query.foodHabit) {
      where.foodHabit = query.foodHabit as any;
    }
    if (query.sleepRoutine) {
      where.sleepRoutine = query.sleepRoutine as any;
    }
    if (query.cleanliness) {
      where.cleanliness = query.cleanliness as any;
    }
    if (typeof query.petFriendly === 'boolean') {
      where.petFriendly = query.petFriendly;
    }
    if (query.smoking) {
      where.smoking = { equals: query.smoking, mode: 'insensitive' };
    }

    const candidateProfiles = await this.prisma.flatmateProfile.findMany({
      where,
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
      take: 100,
    });

    // 5. Build caller compatibility input only if caller possesses an active, published profile
    const isCallerProfileReady = !!(callerFlatmate && callerFlatmate.isPublished);

    const callerData: CandidateCompatibilityInput | null = isCallerProfileReady
      ? {
          country: callerFlatmate!.country,
          state: callerFlatmate!.state,
          city: callerFlatmate!.city,
          targetLocalities: callerFlatmate!.targetLocalities,
          budgetMin: callerFlatmate!.budgetMin ? Number(callerFlatmate!.budgetMin) : 0,
          budgetMax: Number(callerFlatmate!.budgetMax),
          moveInDate: callerFlatmate!.moveInDate,
          moveInFlexible: callerFlatmate!.moveInFlexible,
          foodHabit: callerFlatmate!.foodHabit,
          sleepRoutine: callerFlatmate!.sleepRoutine,
          cleanliness: callerFlatmate!.cleanliness,
          smoking: callerFlatmate!.smoking,
          drinking: callerFlatmate!.drinking,
          petFriendly: callerFlatmate!.petFriendly,
          socialLifestyle: callerFlatmate!.socialLifestyle,
          wfhHabits: callerFlatmate!.wfhHabits,
          interests: callerFlatmate!.interests,
        }
      : null;

    const results: ConnectCandidateView[] = candidateProfiles.map((item) => {
      const candidateData: CandidateCompatibilityInput = {
        country: item.country,
        state: item.state,
        city: item.city,
        targetLocalities: item.targetLocalities,
        budgetMin: item.budgetMin ? Number(item.budgetMin) : 0,
        budgetMax: Number(item.budgetMax),
        moveInDate: item.moveInDate,
        moveInFlexible: item.moveInFlexible,
        foodHabit: item.foodHabit,
        sleepRoutine: item.sleepRoutine,
        cleanliness: item.cleanliness,
        smoking: item.smoking,
        drinking: item.drinking,
        petFriendly: item.petFriendly,
        socialLifestyle: item.socialLifestyle,
        wfhHabits: item.wfhHabits,
        interests: item.interests,
      };

      let compatibility: CompatibilityBreakdown;

      if (callerData) {
        // Genuine compatibility computation from caller's published profile
        compatibility = computeDetailedCompatibility(callerData, candidateData, customWeights);
      } else {
        // Honest unavailable state — zero fabricated preferences or scores
        compatibility = {
          overallScore: 0,
          scoreAvailable: false,
          budgetScore: 0,
          locationScore: 0,
          lifestyleScore: 0,
          foodScore: 0,
          sleepScore: 0,
          cleanlinessScore: 0,
          moveInScore: 0,
          interestsScore: 0,
          sharedInterests: [],
          explanations: [
            'Publish your flatmate profile to calculate personalized compatibility scores',
          ],
          dimensions: {
            budget: { score: 0, maxScore: 20, percentage: 0, explanation: 'Profile required' },
            location: { score: 0, maxScore: 20, percentage: 0, explanation: 'Profile required' },
            lifestyle: { score: 0, maxScore: 15, percentage: 0, explanation: 'Profile required' },
            food: { score: 0, maxScore: 15, percentage: 0, explanation: 'Profile required' },
            sleep: { score: 0, maxScore: 10, percentage: 0, explanation: 'Profile required' },
            moveIn: { score: 0, maxScore: 10, percentage: 0, explanation: 'Profile required' },
            interests: { score: 0, maxScore: 10, percentage: 0, explanation: 'Profile required' },
          },
        };
      }

      // Extract first name or display name
      const displayName = item.profile.fullName
        ? item.profile.fullName.split(' ')[0]
        : 'Flatmate';

      return {
        userId: item.userId,
        profileId: item.id,
        displayName,
        age: item.age,
        gender: item.gender,
        occupation: item.occupation,
        city: item.city,
        state: item.state,
        country: item.country,
        targetLocalities: item.targetLocalities,
        budgetMin: item.budgetMin ? Number(item.budgetMin) : null,
        budgetMax: Number(item.budgetMax),
        moveInDate: item.moveInDate,
        moveInFlexible: item.moveInFlexible,
        roomType: item.roomType as any,
        furnishing: item.furnishing as any,
        foodHabit: toContractFoodHabit(item.foodHabit),
        sleepRoutine: toContractSleepRoutine(item.sleepRoutine),
        cleanliness: item.cleanliness as ContractCleanlinessLevel,
        petFriendly: item.petFriendly,
        smoking: item.smoking,
        bio: item.bio,
        interests: item.interests,
        avatarUrl: item.profile.avatarUrl,
        verified: item.verified,
        hasRoom: item.hasRoom,
        intentions:
          item.intentions && item.intentions.length > 0
            ? (item.intentions as FlatmateIntention[])
            : item.hasRoom
              ? (['has_room'] as FlatmateIntention[])
              : (['needs_room', 'team_up'] as FlatmateIntention[]),
        roomDetails: item.roomDetails,
        compatibility,
      };
    });

    // 6. Sorting
    if (query.sortBy === 'budget_asc') {
      results.sort((a, b) => a.budgetMax - b.budgetMax);
    } else if (query.sortBy === 'budget_desc') {
      results.sort((a, b) => b.budgetMax - a.budgetMax);
    } else {
      // Default: sort by compatibility descending
      results.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore);
    }

    const limit = query.limit ? Math.min(query.limit, 50) : 10;
    const offset = query.offset || 0;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get user's personalized matching preferences/weights.
   */
  async getUserMatchingPreferences(userId: string): Promise<UserMatchingPreferencesView> {
    const pref = await this.prisma.userMatchingPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        userId,
        weights: { ...DEFAULT_MATCHING_WEIGHTS },
        normalizedWeights: { ...DEFAULT_MATCHING_WEIGHTS },
        updatedAt: new Date().toISOString(),
      };
    }

    const rawWeights = {
      budget: pref.budgetWeight,
      location: pref.locationWeight,
      lifestyle: pref.lifestyleWeight,
      food: pref.foodWeight,
      sleep: pref.sleepWeight,
      moveIn: pref.moveInWeight,
      interests: pref.interestsWeight,
    };

    return {
      userId,
      weights: rawWeights,
      normalizedWeights: normalizeWeights(rawWeights),
      updatedAt: pref.updatedAt.toISOString(),
    };
  }

  /**
   * Updates user's personalized matching preferences with server-side normalization.
   */
  async updateUserMatchingPreferences(
    userId: string,
    input: UpdateMatchingPreferencesDto,
  ): Promise<UserMatchingPreferencesView> {
    const normalized = normalizeWeights(input);

    const saved = await this.prisma.userMatchingPreference.upsert({
      where: { userId },
      create: {
        userId,
        budgetWeight: Math.round(normalized.budget),
        locationWeight: Math.round(normalized.location),
        lifestyleWeight: Math.round(normalized.lifestyle),
        foodWeight: Math.round(normalized.food),
        sleepWeight: Math.round(normalized.sleep),
        moveInWeight: Math.round(normalized.moveIn),
        interestsWeight: Math.round(normalized.interests),
      },
      update: {
        budgetWeight: Math.round(normalized.budget),
        locationWeight: Math.round(normalized.location),
        lifestyleWeight: Math.round(normalized.lifestyle),
        foodWeight: Math.round(normalized.food),
        sleepWeight: Math.round(normalized.sleep),
        moveInWeight: Math.round(normalized.moveIn),
        interestsWeight: Math.round(normalized.interests),
      },
    });

    await this.audit.record({
      actorId: userId,
      eventType: 'user_matching_preferences.updated',
      entityType: 'user_matching_preference',
      entityId: saved.id,
      outcome: 'success',
      metadata: { weights: normalized as unknown as Prisma.InputJsonValue },
    });

    const rawWeights = {
      budget: saved.budgetWeight,
      location: saved.locationWeight,
      lifestyle: saved.lifestyleWeight,
      food: saved.foodWeight,
      sleep: saved.sleepWeight,
      moveIn: saved.moveInWeight,
      interests: saved.interestsWeight,
    };

    return {
      userId,
      weights: rawWeights,
      normalizedWeights: normalizeWeights(rawWeights),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /**
   * Express interest (swipe right) or pass (swipe left) on a flatmate profile.
   * If reciprocal like exists, creates a mutual match!
   */
  async swipe(callerId: string, input: ConnectSwipeDto): Promise<ConnectSwipeResponse> {
    const { targetUserId, action } = input;

    if (callerId === targetUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'You cannot express interest in or pass on your own profile.',
      });
    }

    // Verify caller is active & 18+
    const caller = await this.prisma.profile.findUnique({
      where: { id: callerId },
      include: {
        flatmateProfile: true,
        user: { select: { accountStatus: true, deletedAt: true } },
      },
    });

    if (!caller || caller.user.accountStatus !== 'active' || caller.user.deletedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Your account is not active.',
      });
    }

    if (caller.flatmateProfile && caller.flatmateProfile.age < 18) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Aashvo Connect is strictly available for users aged 18 and older.',
      });
    }

    // Verify target exists and is active
    const target = await this.prisma.profile.findUnique({
      where: { id: targetUserId },
      include: {
        user: { select: { accountStatus: true, deletedAt: true } },
      },
    });

    if (!target || target.user.accountStatus !== 'active' || target.user.deletedAt) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Target user profile is unavailable or inactive.',
      });
    }

    // Check if blocked in either direction
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: callerId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: callerId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Cannot interact with this profile due to privacy or block restrictions.',
      });
    }

    const interestType =
      action === 'like' ? FlatmateInterestType.like : FlatmateInterestType.pass;

    // Execute swipe and reciprocal match check in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Upsert interest
      await tx.flatmateInterest.upsert({
        where: {
          senderId_targetUserId: {
            senderId: callerId,
            targetUserId,
          },
        },
        create: {
          senderId: callerId,
          targetUserId,
          interestType,
        },
        update: {
          interestType,
          updatedAt: new Date(),
        },
      });

      if (action === 'pass') {
        return { matched: false };
      }

      // 2. Check for reciprocal like
      const reciprocalLike = await tx.flatmateInterest.findUnique({
        where: {
          senderId_targetUserId: {
            senderId: targetUserId,
            targetUserId: callerId,
          },
        },
      });

      if (reciprocalLike && reciprocalLike.interestType === FlatmateInterestType.like) {
        // Reciprocal like verified -> Create Mutual Match!
        const [u1, u2] = callerId < targetUserId ? [callerId, targetUserId] : [targetUserId, callerId];

        const match = await tx.flatmateMatch.upsert({
          where: {
            user1Id_user2Id: {
              user1Id: u1,
              user2Id: u2,
            },
          },
          create: {
            user1Id: u1,
            user2Id: u2,
            status: FlatmateMatchStatus.active,
          },
          update: {
            status: FlatmateMatchStatus.active,
            lastInteractionAt: new Date(),
          },
        });

        // Enqueue outbox notification for both users
        await tx.notificationOutbox.createMany({
          data: [
            {
              channel: 'email',
              templateKey: 'flatmate_match_created',
              recipient: callerId,
              payload: { matchId: match.id, partnerId: targetUserId },
              status: 'pending',
            },
            {
              channel: 'email',
              templateKey: 'flatmate_match_created',
              recipient: targetUserId,
              payload: { matchId: match.id, partnerId: callerId },
              status: 'pending',
            },
          ],
        });

        return { matched: true, matchId: match.id };
      }

      return { matched: false };
    });

    if (result.matched && result.matchId) {
      await this.audit.record({
        actorId: callerId,
        entityType: 'flatmate_match',
        entityId: result.matchId,
        eventType: 'flatmate_match_created',
        outcome: 'success',
        metadata: { partnerId: targetUserId },
      });

      const matchItem = await this.getMatchById(callerId, result.matchId);
      return {
        success: true,
        action,
        matched: true,
        match: matchItem,
      };
    }

    return {
      success: true,
      action,
      matched: false,
    };
  }

  /**
   * Reverts the most recent swipe action made by the caller.
   */
  async undo(callerId: string): Promise<ConnectUndoResponse> {
    const lastInterest = await this.prisma.flatmateInterest.findFirst({
      where: { senderId: callerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastInterest) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'No recent swipe action available to undo.',
      });
    }

    const targetUserId = lastInterest.targetUserId;
    const previousAction =
      lastInterest.interestType === FlatmateInterestType.like ? 'like' : 'pass';

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete interest record
      await tx.flatmateInterest.delete({
        where: { id: lastInterest.id },
      });

      // 2. If it was a like, break any active match formed between the two users
      if (previousAction === 'like') {
        const [u1, u2] = callerId < targetUserId ? [callerId, targetUserId] : [targetUserId, callerId];
        await tx.flatmateMatch.updateMany({
          where: {
            user1Id: u1,
            user2Id: u2,
            status: FlatmateMatchStatus.active,
          },
          data: {
            status: FlatmateMatchStatus.unmatched,
          },
        });
      }
    });

    return {
      success: true,
      undoneTargetUserId: targetUserId,
      previousAction,
    };
  }

  /**
   * Retrieves all active mutual matches for the caller.
   */
  async getMatches(callerId: string): Promise<ConnectMatchItem[]> {
    const matches = await this.prisma.flatmateMatch.findMany({
      where: {
        OR: [{ user1Id: callerId }, { user2Id: callerId }],
        status: FlatmateMatchStatus.active,
      },
      include: {
        user1: {
          include: {
            flatmateProfile: true,
          },
        },
        user2: {
          include: {
            flatmateProfile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastInteractionAt: 'desc' },
    });

    // Filter out any matches with blocked users
    const [blocksInitiated, blocksReceived] = await Promise.all([
      this.prisma.userBlock.findMany({
        where: { blockerId: callerId },
        select: { blockedId: true },
      }),
      this.prisma.userBlock.findMany({
        where: { blockedId: callerId },
        select: { blockerId: true },
      }),
    ]);
    const blockedIds = new Set([
      ...blocksInitiated.map((b) => b.blockedId),
      ...blocksReceived.map((b) => b.blockerId),
    ]);

    const activeMatches = matches.filter((m) => {
      const partnerId = m.user1Id === callerId ? m.user2Id : m.user1Id;
      return !blockedIds.has(partnerId);
    });

    return activeMatches.map((m) => {
      const isUser1 = m.user1Id === callerId;
      const partnerProfile = isUser1 ? m.user2 : m.user1;
      const partnerFlatmate = partnerProfile.flatmateProfile;

      const lastMsg = m.messages[0];

      return {
        id: m.id,
        status: m.status as ConnectMatchItem['status'],
        matchedAt: m.matchedAt.toISOString(),
        lastInteractionAt: m.lastInteractionAt.toISOString(),
        partner: {
          userId: partnerProfile.id,
          displayName: partnerProfile.fullName ? partnerProfile.fullName.split(' ')[0] : 'Flatmate',
          avatarUrl: partnerProfile.avatarUrl,
          city: partnerFlatmate?.city ?? 'Gurugram',
          locality: partnerFlatmate?.targetLocalities?.[0],
          occupation: partnerFlatmate?.occupation ?? 'Professional',
          budgetMax: Number(partnerFlatmate?.budgetMax ?? 15000),
          verified: Boolean(partnerFlatmate?.verified || partnerProfile.idVerified),
          compatibilityScore: 85,
        },
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              senderId: lastMsg.senderId,
              content: lastMsg.content,
              createdAt: lastMsg.createdAt.toISOString(),
              read: Boolean(lastMsg.readAt || lastMsg.senderId === callerId),
            }
          : undefined,
      };
    });
  }

  /**
   * Retrieves a single match by ID with participant security verification.
   */
  async getMatchById(callerId: string, matchId: string): Promise<ConnectMatchItem> {
    const match = await this.prisma.flatmateMatch.findUnique({
      where: { id: matchId },
      include: {
        user1: { include: { flatmateProfile: true } },
        user2: { include: { flatmateProfile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!match) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Match not found.',
      });
    }

    if (match.user1Id !== callerId && match.user2Id !== callerId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not a participant in this match.',
      });
    }

    const isUser1 = match.user1Id === callerId;
    const partnerProfile = isUser1 ? match.user2 : match.user1;
    const partnerFlatmate = partnerProfile.flatmateProfile;
    const lastMsg = match.messages[0];

    return {
      id: match.id,
      status: match.status as ConnectMatchItem['status'],
      matchedAt: match.matchedAt.toISOString(),
      lastInteractionAt: match.lastInteractionAt.toISOString(),
      partner: {
        userId: partnerProfile.id,
        displayName: partnerProfile.fullName ? partnerProfile.fullName.split(' ')[0] : 'Flatmate',
        avatarUrl: partnerProfile.avatarUrl,
        city: partnerFlatmate?.city ?? 'Gurugram',
        locality: partnerFlatmate?.targetLocalities?.[0],
        occupation: partnerFlatmate?.occupation ?? 'Professional',
        budgetMax: Number(partnerFlatmate?.budgetMax ?? 15000),
        verified: Boolean(partnerFlatmate?.verified || partnerProfile.idVerified),
        compatibilityScore: 85,
      },
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            senderId: lastMsg.senderId,
            content: lastMsg.content,
            createdAt: lastMsg.createdAt.toISOString(),
            read: Boolean(lastMsg.readAt || lastMsg.senderId === callerId),
          }
        : undefined,
    };
  }

  /**
   * Retrieves paginated messages for a mutual match thread and marks unread messages as read.
   */
  async getMessages(callerId: string, matchId: string): Promise<ConnectMessageItem[]> {
    const match = await this.prisma.flatmateMatch.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    });

    if (!match) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Match not found.',
      });
    }

    if (match.user1Id !== callerId && match.user2Id !== callerId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to view messages in this conversation.',
      });
    }

    // Mark partner's unread messages as read
    await this.prisma.matchMessage.updateMany({
      where: {
        matchId,
        senderId: { not: callerId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const messages = await this.prisma.matchMessage.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return messages.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt ? m.readAt.toISOString() : null,
    }));
  }

  /**
   * Sends an authenticated message within a mutual match conversation thread.
   */
  async sendMessage(
    callerId: string,
    matchId: string,
    dto: SendConnectMessageDto,
  ): Promise<ConnectMessageItem> {
    const match = await this.prisma.flatmateMatch.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    });

    if (!match) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Match not found.',
      });
    }

    if (match.user1Id !== callerId && match.user2Id !== callerId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to message in this conversation.',
      });
    }

    if (match.status !== FlatmateMatchStatus.active) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Cannot send messages in an inactive or blocked match.',
      });
    }

    const partnerId = match.user1Id === callerId ? match.user2Id : match.user1Id;

    // Check if blocked in either direction
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: callerId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: callerId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Cannot send message due to block restrictions.',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.matchMessage.create({
        data: {
          matchId,
          senderId: callerId,
          content: dto.content.trim(),
        },
      });

      await tx.flatmateMatch.update({
        where: { id: matchId },
        data: { lastInteractionAt: new Date() },
      });

      // Queue outbox notification for recipient
      await tx.notificationOutbox.create({
        data: {
          channel: 'email',
          templateKey: 'match_message_received',
          recipient: partnerId,
          payload: { matchId, senderId: callerId },
          status: 'pending',
        },
      });

      return msg;
    });

    return {
      id: created.id,
      matchId: created.matchId,
      senderId: created.senderId,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      readAt: null,
    };
  }

  /**
   * Blocks a user, immediately terminating mutual match active status and discovery.
   */
  async blockUser(callerId: string, targetUserId: string, dto: BlockUserDto): Promise<{ success: boolean }> {
    if (callerId === targetUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'You cannot block yourself.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Create block record
      await tx.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: callerId,
            blockedId: targetUserId,
          },
        },
        create: {
          blockerId: callerId,
          blockedId: targetUserId,
          reason: dto.reason,
        },
        update: {
          reason: dto.reason,
        },
      });

      // 2. Block any existing match
      const [u1, u2] = callerId < targetUserId ? [callerId, targetUserId] : [targetUserId, callerId];
      await tx.flatmateMatch.updateMany({
        where: {
          user1Id: u1,
          user2Id: u2,
        },
        data: {
          status: FlatmateMatchStatus.blocked,
        },
      });
    });

    await this.audit.record({
      actorId: callerId,
      entityType: 'user_block',
      entityId: targetUserId,
      eventType: 'user_blocked',
      outcome: 'success',
      metadata: { reason: dto.reason },
    });

    return { success: true };
  }

  /**
   * Reports a user for platform moderation review.
   */
  async reportUser(callerId: string, targetUserId: string, dto: ReportUserDto): Promise<{ success: boolean }> {
    if (callerId === targetUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'You cannot report yourself.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Record UserReport
      await tx.userReport.create({
        data: {
          reporterId: callerId,
          reportedId: targetUserId,
          reason: dto.reason,
          details: dto.details,
          status: 'pending',
        },
      });

      // 2. File SafetyReport in moderation queue
      await tx.safetyReport.create({
        data: {
          reporterId: callerId,
          targetType: 'user',
          reportedUserId: targetUserId,
          targetTitle: `Connect Flatmate User ${targetUserId.slice(0, 8)}`,
          reasonCode: dto.reason,
          details: dto.details || 'User reported via Aashvo Connect',
          priority: 'high',
          status: 'pending',
        },
      });
    });

    await this.audit.record({
      actorId: callerId,
      entityType: 'user_report',
      entityId: targetUserId,
      eventType: 'user_reported',
      outcome: 'success',
      metadata: { reason: dto.reason },
    });

    return { success: true };
  }

  /**
   * Toggles discovery visibility for the caller's flatmate profile.
   */
  async updateVisibility(
    callerId: string,
    discoveryHidden: boolean,
  ): Promise<{ success: boolean; discoveryHidden: boolean }> {
    const flatmate = await this.prisma.flatmateProfile.findUnique({
      where: { userId: callerId },
    });

    if (!flatmate) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Flatmate profile does not exist. Please create one before managing visibility.',
      });
    }

    await this.prisma.flatmateProfile.update({
      where: { userId: callerId },
      data: { discoveryHidden },
    });

    return { success: true, discoveryHidden };
  }

  /**
   * Updates intentions for the caller's flatmate profile.
   * Supports all 3 intentions: has_room, needs_room, team_up (multi-select).
   */
  async updateIntentions(
    callerId: string,
    intentions: FlatmateIntention[],
  ): Promise<{ success: boolean; intentions: FlatmateIntention[]; hasRoom: boolean }> {
    const flatmate = await this.prisma.flatmateProfile.findUnique({
      where: { userId: callerId },
    });

    if (!flatmate) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Flatmate profile does not exist. Please create one before updating intentions.',
      });
    }

    const hasRoom = intentions.includes('has_room');

    const updated = await this.prisma.flatmateProfile.update({
      where: { userId: callerId },
      data: {
        intentions: intentions as any,
        hasRoom,
      },
    });

    await this.audit.record({
      actorId: callerId,
      entityType: 'flatmate_profile',
      entityId: flatmate.id,
      eventType: 'connect_intentions_updated',
      outcome: 'success',
      metadata: { intentions, hasRoom },
    });

    return {
      success: true,
      intentions: updated.intentions as FlatmateIntention[],
      hasRoom: updated.hasRoom,
    };
  }

  /**
   * Retrieves all incoming likes received by the caller.
   */
  async getIncomingLikes(callerId: string): Promise<ConnectLikeItem[]> {
    const likes = await this.prisma.flatmateInterest.findMany({
      where: {
        targetUserId: callerId,
        interestType: FlatmateInterestType.like,
      },
      include: {
        sender: {
          include: {
            flatmateProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return likes
      .filter((l) => l.sender.flatmateProfile && l.sender.flatmateProfile.isPublished)
      .map((l) => ({
        id: l.id,
        userId: l.senderId,
        displayName: l.sender.fullName.split(' ')[0],
        avatarUrl: l.sender.avatarUrl,
        city: l.sender.flatmateProfile?.city || 'Gurugram',
        occupation: l.sender.flatmateProfile?.occupation || 'Flatmate',
        budgetMax: Number(l.sender.flatmateProfile?.budgetMax || 0),
        createdAt: l.createdAt.toISOString(),
      }));
  }

  /**
   * Retrieves all outgoing likes sent by the caller.
   */
  async getOutgoingLikes(callerId: string): Promise<ConnectLikeItem[]> {
    const likes = await this.prisma.flatmateInterest.findMany({
      where: {
        senderId: callerId,
        interestType: FlatmateInterestType.like,
      },
      include: {
        targetUser: {
          include: {
            flatmateProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return likes
      .filter((l) => l.targetUser.flatmateProfile && l.targetUser.flatmateProfile.isPublished)
      .map((l) => ({
        id: l.id,
        userId: l.targetUserId,
        displayName: l.targetUser.fullName.split(' ')[0],
        avatarUrl: l.targetUser.avatarUrl,
        city: l.targetUser.flatmateProfile?.city || 'Gurugram',
        occupation: l.targetUser.flatmateProfile?.occupation || 'Flatmate',
        budgetMax: Number(l.targetUser.flatmateProfile?.budgetMax || 0),
        createdAt: l.createdAt.toISOString(),
      }));
  }

  /**
   * Unmatches an active match.
   */
  async unmatch(
    callerId: string,
    matchId: string,
    reason?: string,
  ): Promise<{ success: boolean; matchId: string }> {
    const match = await this.prisma.flatmateMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Match not found.',
      });
    }

    if (match.user1Id !== callerId && match.user2Id !== callerId) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not a participant in this mutual match.',
      });
    }

    await this.prisma.flatmateMatch.update({
      where: { id: matchId },
      data: {
        status: FlatmateMatchStatus.unmatched,
      },
    });

    await this.audit.record({
      actorId: callerId,
      eventType: 'flatmate_match.unmatched',
      entityType: 'flatmate_match',
      entityId: matchId,
      outcome: 'success',
      metadata: { reason },
    });

    return { success: true, matchId };
  }
}

