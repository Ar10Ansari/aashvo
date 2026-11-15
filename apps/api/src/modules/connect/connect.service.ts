import {
  ERROR_CODES,
  type CleanlinessLevel as ContractCleanlinessLevel,
  type CompatibilityBreakdown,
  type ConnectCandidateView,
  type ConnectLikeItem,
  type ConnectMatchItem,
  type ConnectMessageItem,
  type ConnectSwipeResponse,
  type ConnectUndoResponse,
  type FlatmateIntention,
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
} from './dto/connect.dto';

export function computeDetailedCompatibility(
  caller: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests?: string[];
  },
  candidate: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests?: string[];
  },
): CompatibilityBreakdown {
  let foodScore = 0;
  let sleepScore = 0;
  let cleanlinessScore = 0;
  let budgetScore = 0;
  let interestsScore = 0;

  // 1. Food Habit Alignment (25 pts max)
  if (caller.foodHabit === candidate.foodHabit) {
    foodScore = 25;
  } else if (
    (caller.foodHabit === 'Eggetarian' && candidate.foodHabit === 'Vegetarian') ||
    (caller.foodHabit === 'Vegetarian' && candidate.foodHabit === 'Eggetarian')
  ) {
    foodScore = 15;
  }

  // 2. Sleep Routine Alignment (20 pts max)
  if (caller.sleepRoutine === candidate.sleepRoutine) {
    sleepScore = 20;
  } else if (caller.sleepRoutine === 'Flexible' || candidate.sleepRoutine === 'Flexible') {
    sleepScore = 15;
  }

  // 3. Cleanliness Alignment (20 pts max)
  if (caller.cleanliness === candidate.cleanliness) {
    cleanlinessScore = 20;
  } else if (
    (caller.cleanliness === 'Spotless' && candidate.cleanliness === 'Moderate') ||
    (caller.cleanliness === 'Moderate' && candidate.cleanliness === 'Spotless') ||
    (caller.cleanliness === 'Moderate' && candidate.cleanliness === 'Relaxed')
  ) {
    cleanlinessScore = 12;
  }

  // 4. Budget Overlap (20 pts max)
  const maxB = Math.max(caller.budgetMax, candidate.budgetMax);
  if (maxB > 0) {
    const budgetRatio = Math.min(caller.budgetMax, candidate.budgetMax) / maxB;
    budgetScore = Math.round(budgetRatio * 20);
  }

  // 5. Shared Interests (15 pts max)
  const callerInterests = new Set((caller.interests ?? []).map((i) => i.toLowerCase().trim()));
  const candidateInterests = (candidate.interests ?? []).map((i) => i.toLowerCase().trim());
  const sharedInterests = candidateInterests.filter((i) => callerInterests.has(i));

  if (sharedInterests.length >= 3) {
    interestsScore = 15;
  } else if (sharedInterests.length === 2) {
    interestsScore = 10;
  } else if (sharedInterests.length === 1) {
    interestsScore = 5;
  }

  const overallScore = Math.min(
    100,
    Math.max(0, foodScore + sleepScore + cleanlinessScore + budgetScore + interestsScore),
  );

  return {
    overallScore,
    foodScore,
    sleepScore,
    cleanlinessScore,
    budgetScore,
    interestsScore,
    sharedInterests,
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
   * - Applies deterministic 5-dimension compatibility scoring
   * - Returns sanitized PII only (approximate locality, display name, photo)
   */
  async discoverCandidates(
    callerId: string | null | undefined,
    query: ConnectDiscoverQueryDto,
  ): Promise<ConnectCandidateView[]> {
    let callerFlatmate = null;
    const excludedIds: string[] = [];

    if (callerId) {
      // 1. Fetch caller flatmate profile if available
      callerFlatmate = await this.prisma.flatmateProfile.findUnique({
        where: { userId: callerId },
      });

      // 2. Fetch all blocked user IDs (both directions)
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
      const blockedUserIds = new Set([
        ...blocksInitiated.map((b) => b.blockedId),
        ...blocksReceived.map((b) => b.blockerId),
      ]);

      // 3. Fetch already swiped user IDs by caller
      const existingSwipes = await this.prisma.flatmateInterest.findMany({
        where: { senderId: callerId },
        select: { targetUserId: true },
      });
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
    if (query.gender && query.gender !== 'any') {
      where.gender = { equals: query.gender, mode: 'insensitive' };
    }
    if (query.maxBudget) {
      where.budgetMax = { lte: query.maxBudget };
    }
    if (typeof query.hasRoom === 'boolean') {
      where.hasRoom = query.hasRoom;
    }
    if (query.intention) {
      where.intentions = { has: query.intention as any };
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
      take: 50,
    });

    // 5. Compute compatibility for each candidate
    const callerData = callerFlatmate
      ? {
          foodHabit: callerFlatmate.foodHabit,
          sleepRoutine: callerFlatmate.sleepRoutine,
          cleanliness: callerFlatmate.cleanliness,
          budgetMax: Number(callerFlatmate.budgetMax),
          interests: callerFlatmate.interests,
        }
      : {
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Flexible',
          cleanliness: 'Moderate',
          budgetMax: 15000,
          interests: [],
        };

    const results: ConnectCandidateView[] = candidateProfiles.map((item) => {
      const candidateData = {
        foodHabit: item.foodHabit,
        sleepRoutine: item.sleepRoutine,
        cleanliness: item.cleanliness,
        budgetMax: Number(item.budgetMax),
        interests: item.interests,
      };

      const compatibility = computeDetailedCompatibility(callerData, candidateData);

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
        targetLocalities: item.targetLocalities,
        budgetMax: Number(item.budgetMax),
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

    // Sort by compatibility descending
    results.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore);

    const limit = query.limit ? Math.min(query.limit, 20) : 10;
    return results.slice(0, limit);
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

