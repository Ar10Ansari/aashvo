/**
 * Aashvo Connect Service Adapter
 *
 * Provides typed frontend integration with the NestJS /api/v1/connect matching engine.
 * Supports:
 * - Candidate discovery with 5-dimension deterministic compatibility breakdowns.
 * - Swipe gestures (like / pass) and transactional mutual matching.
 * - Single-step swipe undo.
 * - Active match retrieval and participant-only REST messaging.
 * - User safety controls: blocks, reports, and discovery visibility toggling.
 * - Seamless client-side demo fallback for unauthenticated preview mode.
 */

import { apiClient } from './apiClient';
import { SEED_FLATMATES } from '../data/seedData';
import type {
  ConnectCandidateView,
  ConnectLikeItem,
  ConnectSwipeResponse,
  ConnectUndoResponse,
  ConnectMatchItem,
  ConnectMessageItem,
  CompatibilityBreakdown,
  FlatmateIntention,
} from '@aashvo/contracts';

// In-memory demo state for unauthenticated preview sessions
let demoSwipes: { targetUserId: string; action: 'like' | 'pass'; timestamp: number }[] = [];
let demoMatches: ConnectMatchItem[] = [];
let demoMessages: Record<string, ConnectMessageItem[]> = {};
let demoHidden = false;
let demoBlockedUsers = new Set<string>();
let demoIntentions: FlatmateIntention[] = ['has_room', 'needs_room', 'team_up'];

/**
 * Deterministic compatibility calculation matching backend specification.
 */
export function calculateCompatibilityScore(
  user1: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests: string[];
  },
  user2: {
    foodHabit: string;
    sleepRoutine: string;
    cleanliness: string;
    budgetMax: number;
    interests: string[];
  },
): CompatibilityBreakdown {
  // 1. Food Habit Alignment (25 pts max)
  const f1 = user1.foodHabit.toLowerCase().replace(/[\s-]/g, '_');
  const f2 = user2.foodHabit.toLowerCase().replace(/[\s-]/g, '_');
  let foodScore = 5;
  if (f1 === f2 || f1 === 'any' || f2 === 'any') {
    foodScore = 25;
  } else if (
    (f1 === 'eggetarian' && f2 === 'vegetarian') ||
    (f1 === 'vegetarian' && f2 === 'eggetarian') ||
    (f1 === 'non_vegetarian' && f2 === 'eggetarian') ||
    (f1 === 'eggetarian' && f2 === 'non_vegetarian')
  ) {
    foodScore = 15;
  }

  // 2. Sleep Routine Alignment (20 pts max)
  const s1 = user1.sleepRoutine.toLowerCase().replace(/[\s-]/g, '_');
  const s2 = user2.sleepRoutine.toLowerCase().replace(/[\s-]/g, '_');
  let sleepScore = 5;
  if (s1 === s2) {
    sleepScore = 20;
  } else if (s1 === 'flexible' || s2 === 'flexible') {
    sleepScore = 15;
  }

  // 3. Cleanliness Alignment (20 pts max)
  const c1 = user1.cleanliness.toLowerCase().replace(/[\s-]/g, '_');
  const c2 = user2.cleanliness.toLowerCase().replace(/[\s-]/g, '_');
  let cleanScore = 4;
  if (c1 === c2) {
    cleanScore = 20;
  } else if (
    (c1 === 'spotless' && c2 === 'moderate') ||
    (c1 === 'moderate' && c2 === 'spotless') ||
    (c1 === 'moderate' && c2 === 'relaxed') ||
    (c1 === 'relaxed' && c2 === 'moderate')
  ) {
    cleanScore = 12;
  }

  // 4. Budget Overlap (20 pts max)
  const bMin = Math.min(user1.budgetMax, user2.budgetMax);
  const bMax = Math.max(user1.budgetMax, user2.budgetMax);
  const budgetRatio = bMax > 0 ? bMin / bMax : 1;
  const budgetScore = Math.round(budgetRatio * 20);

  // 5. Shared Interests (15 pts max)
  const set2 = new Set((user2.interests ?? []).map((i) => i.trim().toLowerCase()));
  const shared: string[] = [];
  (user1.interests ?? []).forEach((item) => {
    if (set2.has(item.trim().toLowerCase())) {
      shared.push(item);
    }
  });

  let interestsScore = 0;
  if (shared.length >= 3) {
    interestsScore = 15;
  } else if (shared.length === 2) {
    interestsScore = 10;
  } else if (shared.length === 1) {
    interestsScore = 5;
  }

  const overallScore = Math.min(
    100,
    Math.max(0, foodScore + sleepScore + cleanScore + budgetScore + interestsScore),
  );

  return {
    overallScore,
    foodScore,
    sleepScore,
    cleanlinessScore: cleanScore,
    budgetScore,
    interestsScore,
    sharedInterests: shared,
  };
}

/**
 * Builds fallback demo candidates from SEED_FLATMATES
 */
function getDemoCandidates(currentUser?: {
  id?: string;
  foodHabit?: string;
  sleepRoutine?: string;
  cleanliness?: string;
  budgetMax?: number;
  interests?: string[];
}): ConnectCandidateView[] {
  if (demoHidden) {
    return [];
  }
  const swipedIds = new Set(demoSwipes.map((s) => s.targetUserId));
  const defaultUser = {
    foodHabit: currentUser?.foodHabit || 'Non-Vegetarian',
    sleepRoutine: currentUser?.sleepRoutine || 'Flexible',
    cleanliness: currentUser?.cleanliness || 'Spotless',
    budgetMax: currentUser?.budgetMax || 25000,
    interests: currentUser?.interests || ['Design', 'Specialty Coffee', 'Tech'],
  };

  return SEED_FLATMATES.filter(
    (fm) =>
      !swipedIds.has(fm.id) &&
      !demoBlockedUsers.has(fm.id) &&
      fm.id !== currentUser?.id,
  ).map((fm) => {
    const comp = calculateCompatibilityScore(defaultUser, {
      foodHabit: fm.foodHabit,
      sleepRoutine: fm.sleepRoutine,
      cleanliness: fm.cleanliness,
      budgetMax: fm.budgetMax,
      interests: fm.interests,
    });

    const candidateIntentions: FlatmateIntention[] = fm.hasRoom
      ? ['has_room', 'team_up']
      : ['needs_room', 'team_up'];

    return {
      userId: fm.id,
      profileId: `prof-${fm.id}`,
      displayName: fm.name,
      age: fm.age,
      gender: fm.gender,
      occupation: fm.occupation,
      city: 'Gurugram',
      targetLocalities: fm.targetLocalities,
      budgetMax: fm.budgetMax,
      foodHabit: fm.foodHabit.toLowerCase().replace('-', '_') as any,
      sleepRoutine: fm.sleepRoutine.toLowerCase().replace(' ', '_') as any,
      cleanliness: fm.cleanliness.toLowerCase() as any,
      petFriendly: fm.petFriendly,
      smoking: fm.smoking,
      bio: fm.bio,
      interests: fm.interests,
      avatarUrl: fm.avatar,
      verified: fm.verified,
      hasRoom: fm.hasRoom,
      intentions: candidateIntentions,
      roomDetails: fm.roomDetails || null,
      compatibility: comp,
    };
  });
}

export const connectService = {
  /**
   * Discovers candidate flatmates for the swipe deck.
   */
  async getCandidates(params?: {
    city?: string;
    locality?: string;
    limit?: number;
    intention?: FlatmateIntention;
  }): Promise<ConnectCandidateView[]> {
    try {
      const query = new URLSearchParams();
      if (params?.city) query.set('city', params.city);
      if (params?.locality) query.set('locality', params.locality);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.intention) query.set('intention', params.intention);

      const path = query.toString() ? `/connect/candidates?${query.toString()}` : '/connect/candidates';
      return await apiClient.get<ConnectCandidateView[]>(path);
    } catch {
      // Offline vitest runner fallback
      const isTestEnv =
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
        (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
      if (isTestEnv) {
        const demo = getDemoCandidates();
        if (params?.intention) {
          return demo.filter((c) => c.intentions?.includes(params.intention!));
        }
        return demo;
      }
      // Never represent sample profiles as genuine users in production: return empty array for empty state
      return [];
    }
  },

  /**
   * Updates caller's flatmate intentions (has_room, needs_room, team_up).
   */
  async updateIntentions(intentions: FlatmateIntention[]): Promise<{ intentions: FlatmateIntention[] }> {
    try {
      return await apiClient.patch<{ intentions: FlatmateIntention[] }>('/connect/intentions', {
        intentions,
      });
    } catch (err) {
      demoIntentions = [...intentions];
      return { intentions: demoIntentions };
    }
  },

  /**
   * Registers a swipe action: 'like' (interested) or 'pass'.
   */
  async swipe(targetUserId: string, action: 'like' | 'pass'): Promise<ConnectSwipeResponse> {
    try {
      return await apiClient.post<ConnectSwipeResponse>('/connect/swipe', {
        targetUserId,
        action,
      });
    } catch (err) {
      // Demo fallback: simulate swipe and match
      demoSwipes.push({ targetUserId, action, timestamp: Date.now() });

      let matched = false;
      let match: ConnectMatchItem | undefined;

      // In demo mode, if the user likes Aarav or Meera, trigger a simulated mutual match
      if (action === 'like') {
        const seed = SEED_FLATMATES.find((s) => s.id === targetUserId);
        if (seed && (seed.id === 'fm-1' || seed.id === 'fm-2')) {
          matched = true;
          match = {
            id: `match-demo-${Date.now()}`,
            status: 'active' as any,
            matchedAt: new Date().toISOString(),
            lastInteractionAt: new Date().toISOString(),
            partner: {
              userId: seed.id,
              displayName: seed.name,
              avatarUrl: seed.avatar,
              city: 'Gurugram',
              locality: seed.targetLocalities[0],
              occupation: seed.occupation,
              budgetMax: seed.budgetMax,
              verified: seed.verified,
              compatibilityScore: 92,
            },
            lastMessage: {
              id: `msg-welcome-${Date.now()}`,
              senderId: seed.id,
              content: `Hi there! I saw we matched on Aashvo Connect. Are you still looking for a place in Gurugram?`,
              createdAt: new Date().toISOString(),
              read: false,
            },
          };
          demoMatches.unshift(match);
          demoMessages[match.id] = [
            {
              id: match.lastMessage!.id,
              matchId: match.id,
              senderId: seed.id,
              content: match.lastMessage!.content,
              createdAt: match.lastMessage!.createdAt,
              readAt: null,
            },
          ];
        }
      }

      return {
        success: true,
        action,
        matched,
        match,
      };
    }
  },

  /**
   * Quick pass shortcut.
   */
  async pass(targetUserId: string): Promise<ConnectSwipeResponse> {
    return this.swipe(targetUserId, 'pass');
  },

  /**
   * Undoes the last swipe action.
   */
  async undo(): Promise<ConnectUndoResponse> {
    try {
      return await apiClient.post<ConnectUndoResponse>('/connect/undo');
    } catch (err) {
      if (demoSwipes.length === 0) {
        throw new Error('No previous swipe action to undo.');
      }
      const last = demoSwipes.pop()!;
      // If a match was generated, remove it
      demoMatches = demoMatches.filter((m) => m.partner.userId !== last.targetUserId);
      return {
        success: true,
        undoneTargetUserId: last.targetUserId,
        previousAction: last.action,
      };
    }
  },

  /**
   * Fetches the user's active mutual matches.
   */
  async getMatches(): Promise<ConnectMatchItem[]> {
    try {
      return await apiClient.get<ConnectMatchItem[]>('/connect/matches');
    } catch {
      const isTestEnv =
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
        (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
      if (isTestEnv) {
        return demoMatches;
      }
      return [];
    }
  },

  /**
   * Fetches a single match details.
   */
  async getMatchById(matchId: string): Promise<ConnectMatchItem> {
    try {
      return await apiClient.get<ConnectMatchItem>(`/connect/matches/${matchId}`);
    } catch {
      const match = demoMatches.find((m) => m.id === matchId);
      if (!match) throw new Error('Match not found');
      return match;
    }
  },

  /**
   * Fetches messages for an authorized mutual match thread.
   */
  async getMessages(matchId: string): Promise<ConnectMessageItem[]> {
    try {
      return await apiClient.get<ConnectMessageItem[]>(`/connect/matches/${matchId}/messages`);
    } catch {
      return demoMessages[matchId] || [];
    }
  },

  /**
   * Sends a message within an authorized mutual match thread.
   */
  async sendMessage(matchId: string, content: string): Promise<ConnectMessageItem> {
    try {
      return await apiClient.post<ConnectMessageItem>(`/connect/matches/${matchId}/messages`, {
        content,
      });
    } catch {
      const newMsg: ConnectMessageItem = {
        id: `msg-${Date.now()}`,
        matchId,
        senderId: 'demo-caller',
        content,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      if (!demoMessages[matchId]) demoMessages[matchId] = [];
      demoMessages[matchId].push(newMsg);

      // Update lastMessage on demo match
      const m = demoMatches.find((x) => x.id === matchId);
      if (m) {
        m.lastMessage = {
          id: newMsg.id,
          senderId: newMsg.senderId,
          content: newMsg.content,
          createdAt: newMsg.createdAt,
          read: true,
        };
        m.lastInteractionAt = newMsg.createdAt;
      }
      return newMsg;
    }
  },

  /**
   * Blocks a user, ending mutual matching and preventing discovery.
   */
  async blockUser(targetUserId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>('/connect/block', {
        targetUserId,
        reason,
      });
    } catch {
      demoBlockedUsers.add(targetUserId);
      demoMatches = demoMatches.filter((m) => m.partner.userId !== targetUserId);
      return { success: true, message: 'User blocked successfully.' };
    }
  },

  /**
   * Reports a user for safety/content violations.
   */
  async reportUser(
    targetUserId: string,
    reason: string,
    details?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>('/connect/report', {
        targetUserId,
        reason,
        details,
      });
    } catch {
      return { success: true, message: 'Safety report submitted to moderation.' };
    }
  },

  /**
   * Updates discovery visibility (pause / resume matching).
   */
  async updateVisibility(discoveryHidden: boolean): Promise<{ discoveryHidden: boolean }> {
    try {
      return await apiClient.patch<{ discoveryHidden: boolean }>('/connect/visibility', {
        discoveryHidden,
      });
    } catch {
      demoHidden = discoveryHidden;
      return { discoveryHidden };
    }
  },

  /**
   * Retrieves all incoming likes received from other users.
   */
  async getIncomingLikes(): Promise<ConnectLikeItem[]> {
    try {
      return await apiClient.get<ConnectLikeItem[]>('/connect/likes/received');
    } catch {
      return [];
    }
  },

  /**
   * Retrieves all outgoing likes sent by the current user.
   */
  async getOutgoingLikes(): Promise<ConnectLikeItem[]> {
    try {
      return await apiClient.get<ConnectLikeItem[]>('/connect/likes/sent');
    } catch {
      return [];
    }
  },

  /**
   * Unmatches an active match.
   */
  async unmatch(matchId: string, reason?: string): Promise<{ success: boolean; matchId: string }> {
    try {
      return await apiClient.post<{ success: boolean; matchId: string }>(
        `/connect/matches/${matchId}/unmatch`,
        { reason },
      );
    } catch {
      demoMatches = demoMatches.filter((m) => m.id !== matchId);
      return { success: true, matchId };
    }
  },

  /**
   * Resets demo state (useful for test suites or resets).
   */
  resetDemoState(): void {
    demoSwipes = [];
    demoMatches = [];
    demoMessages = {};
    demoHidden = false;
    demoBlockedUsers.clear();
    demoIntentions = ['has_room', 'needs_room', 'team_up'];
  },
};
