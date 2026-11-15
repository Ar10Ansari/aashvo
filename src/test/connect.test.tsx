import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  calculateCompatibilityScore,
  connectService,
} from '../services/connectService';
import { ConnectProfileCard } from '../components/connect/ConnectProfileCard';
import { ConnectSwipeDeck } from '../components/connect/ConnectSwipeDeck';
import { ConnectMatchModal } from '../components/connect/ConnectMatchModal';
import { ConnectMatchesList } from '../components/connect/ConnectMatchesList';
import { ConnectChatThread } from '../components/connect/ConnectChatThread';
import { ConnectProfileSettings } from '../components/connect/ConnectProfileSettings';
import type {
  ConnectCandidateView,
  ConnectMatchItem,
  ConnectMessageItem,
} from '@aashvo/contracts';

describe('Aashvo Connect — Compatibility Engine & Service Adapter', () => {
  beforeEach(() => {
    connectService.resetDemoState();
    vi.clearAllMocks();
  });

  describe('1. Deterministic 5-Dimension Compatibility Engine', () => {
    it('calculates 100% compatibility for identical lifestyle profiles', () => {
      const userA = {
        foodHabit: 'vegetarian',
        sleepRoutine: 'early_bird',
        cleanliness: 'spotless',
        budgetMax: 25000,
        interests: ['Yoga', 'Design', 'Reading'],
      };
      const userB = {
        foodHabit: 'vegetarian',
        sleepRoutine: 'early_bird',
        cleanliness: 'spotless',
        budgetMax: 25000,
        interests: ['Yoga', 'Design', 'Reading'],
      };

      const score = calculateCompatibilityScore(userA, userB);
      expect(score.foodScore).toBe(25);
      expect(score.sleepScore).toBe(20);
      expect(score.cleanlinessScore).toBe(20);
      expect(score.budgetScore).toBe(20);
      expect(score.interestsScore).toBe(15);
      expect(score.overallScore).toBe(100);
      expect(score.sharedInterests).toEqual(['Yoga', 'Design', 'Reading']);
    });

    it('applies exact 25/20/20/20/15 points accurately across diverse profiles', () => {
      const userA = {
        foodHabit: 'vegetarian',
        sleepRoutine: 'early_bird',
        cleanliness: 'spotless',
        budgetMax: 20000,
        interests: ['Music', 'Running'],
      };
      const userB = {
        foodHabit: 'non_vegetarian', // 5 pts
        sleepRoutine: 'night_owl',    // 5 pts
        cleanliness: 'moderate',     // 12 pts
        budgetMax: 25000,            // 20000/25000 * 20 = 16 pts
        interests: ['Running', 'Cooking'], // 1 shared = 5 pts
      };

      const score = calculateCompatibilityScore(userA, userB);
      expect(score.foodScore).toBe(5);
      expect(score.sleepScore).toBe(5);
      expect(score.cleanlinessScore).toBe(12);
      expect(score.budgetScore).toBe(16);
      expect(score.interestsScore).toBe(5);
      expect(score.sharedInterests).toEqual(['Running']);
      expect(score.overallScore).toBe(43);
    });

    it('grants 15 pts food alignment for compatible vegetarian/eggetarian pairs', () => {
      const userA = {
        foodHabit: 'vegetarian',
        sleepRoutine: 'flexible',
        cleanliness: 'moderate',
        budgetMax: 20000,
        interests: [],
      };
      const userB = {
        foodHabit: 'eggetarian',
        sleepRoutine: 'flexible',
        cleanliness: 'moderate',
        budgetMax: 20000,
        interests: [],
      };

      const score = calculateCompatibilityScore(userA, userB);
      expect(score.foodScore).toBe(15);
    });
  });

  describe('2. Connect Service Adapter Workflow', () => {
    it('discovers fallback candidate flatmates with complete compatibility metadata', async () => {
      const candidates = await connectService.getCandidates();
      expect(candidates.length).toBeGreaterThanOrEqual(1);

      const first = candidates[0];
      expect(first).toHaveProperty('userId');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('compatibility');
      expect(first.compatibility.overallScore).toBeGreaterThan(0);
      expect(first.compatibility.overallScore).toBeLessThanOrEqual(100);
    });

    it('records a swipe and creates a mutual match when reciprocal interest exists', async () => {
      // Swiping 'like' on Aarav (fm-1) in demo mode generates a mutual match
      const result = await connectService.swipe('fm-1', 'like');
      expect(result.success).toBe(true);
      expect(result.action).toBe('like');
      expect(result.matched).toBe(true);
      expect(result.match).toBeDefined();
      expect(result.match?.partner.displayName).toBe('Aarav Malhotra');

      // Verify match appears in matches list
      const matches = await connectService.getMatches();
      expect(matches.some((m) => m.partner.userId === 'fm-1')).toBe(true);
    });

    it('reverts previous swipe action via single-step undo', async () => {
      await connectService.swipe('fm-4', 'pass');
      const undoResult = await connectService.undo();

      expect(undoResult.success).toBe(true);
      expect(undoResult.undoneTargetUserId).toBe('fm-4');
      expect(undoResult.previousAction).toBe('pass');
    });

    it('supports participant messaging inside mutual match threads', async () => {
      // Create match first
      const swipeRes = await connectService.swipe('fm-1', 'like');
      const matchId = swipeRes.match!.id;

      // Send message
      const msg = await connectService.sendMessage(matchId, 'Hi Aarav, loved your flat in DLF 4!');
      expect(msg.content).toBe('Hi Aarav, loved your flat in DLF 4!');
      expect(msg.matchId).toBe(matchId);

      // Verify thread messages
      const thread = await connectService.getMessages(matchId);
      expect(thread.some((m) => m.content === 'Hi Aarav, loved your flat in DLF 4!')).toBe(true);
    });

    it('blocks a user, purging them from matches and discovery deck', async () => {
      await connectService.swipe('fm-1', 'like');
      const blockRes = await connectService.blockUser('fm-1', 'Unresponsive');
      expect(blockRes.success).toBe(true);

      const matches = await connectService.getMatches();
      expect(matches.some((m) => m.partner.userId === 'fm-1')).toBe(false);

      const candidates = await connectService.getCandidates();
      expect(candidates.some((c) => c.userId === 'fm-1')).toBe(false);
    });

    it('submits safety reports with reason and details', async () => {
      const repRes = await connectService.reportUser('fm-2', 'Misleading flatmate details', 'Room was already taken');
      expect(repRes.success).toBe(true);
      expect(repRes.message).toContain('moderation');
    });

    it('toggles discovery visibility between hidden and discoverable', async () => {
      const res = await connectService.updateVisibility(true);
      expect(res.discoveryHidden).toBe(true);

      // In hidden mode, deck returns 0 candidates
      const candidates = await connectService.getCandidates();
      expect(candidates.length).toBe(0);

      // Restore visibility
      const resRestore = await connectService.updateVisibility(false);
      expect(resRestore.discoveryHidden).toBe(false);
    });

    it('supports multi-select intentions updating and filtering in connect service', async () => {
      // 1. Update intentions to multiple values
      const res = await connectService.updateIntentions(['has_room', 'team_up']);
      expect(res.intentions).toEqual(['has_room', 'team_up']);

      // 2. Discover candidates filtered by intention
      const hasRoomCandidates = await connectService.getCandidates({ intention: 'has_room' });
      expect(hasRoomCandidates.length).toBeGreaterThan(0);
      hasRoomCandidates.forEach((c) => {
        expect(c.intentions).toContain('has_room');
      });

      const teamUpCandidates = await connectService.getCandidates({ intention: 'team_up' });
      expect(teamUpCandidates.length).toBeGreaterThan(0);
      teamUpCandidates.forEach((c) => {
        expect(c.intentions).toContain('team_up');
      });
    });
  });
});

describe('Aashvo Connect — UI Components Rendering & Interaction', () => {
  const sampleCandidate: ConnectCandidateView = {
    userId: 'usr-sample-1',
    profileId: 'prof-sample-1',
    displayName: 'Priya Sharma',
    age: 26,
    gender: 'female',
    occupation: 'Software Engineer @ Cyber City',
    city: 'Gurugram',
    targetLocalities: ['DLF Phase 4', 'Galleria'],
    budgetMax: 22000,
    foodHabit: 'vegetarian' as any,
    sleepRoutine: 'early_bird' as any,
    cleanliness: 'spotless' as any,
    petFriendly: true,
    smoking: 'No',
    bio: 'Looking for a clean, calm flatmate to share a 2BHK near Galleria.',
    interests: ['Yoga', 'Reading', 'Specialty Coffee'],
    avatarUrl: null,
    verified: true,
    hasRoom: true,
    intentions: ['has_room', 'team_up'],
    roomDetails: 'Private room in a 2BHK with balcony',
    compatibility: {
      scoreAvailable: true,
      overallScore: 92,
      foodScore: 100,
      sleepScore: 90,
      cleanlinessScore: 95,
      budgetScore: 85,
      locationScore: 95,
      lifestyleScore: 95,
      moveInScore: 88,
      interestsScore: 90,
      sharedInterests: ['Yoga', 'Specialty Coffee'],
      explanations: ['Both prefer vegetarian diet', 'Shared passion for Yoga'],
    },
  };

  const sampleMatch: ConnectMatchItem = {
    id: 'match-test-1',
    status: 'active' as any,
    matchedAt: new Date().toISOString(),
    lastInteractionAt: new Date().toISOString(),
    partner: {
      userId: 'usr-sample-1',
      displayName: 'Priya Sharma',
      avatarUrl: null,
      city: 'Gurugram',
      locality: 'DLF Phase 4',
      occupation: 'Software Engineer',
      budgetMax: 22000,
      verified: true,
      compatibilityScore: 92,
    },
    lastMessage: {
      id: 'msg-1',
      senderId: 'usr-sample-1',
      content: 'Hey there! Are you looking around DLF Phase 4?',
      createdAt: new Date().toISOString(),
      read: false,
    },
  };

  it('renders ConnectProfileCard with lifestyle pills, verified badge, and compatibility breakdown', () => {
    render(<ConnectProfileCard candidate={sampleCandidate} isTop={true} />);

    expect(screen.getByText(/Priya Sharma, 26/i)).toBeDefined();
    expect(screen.getByText(/Software Engineer @ Cyber City/i)).toBeDefined();
    expect(screen.getByText('92%')).toBeDefined();
    expect(screen.getByText(/Has a Room/i)).toBeDefined();

    // Toggle full breakdown
    const toggleBtn = screen.getByText(/View Scores/i);
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Location & Locality')).toBeDefined();
    expect(screen.getByText('Lifestyle & Cleanliness')).toBeDefined();
    expect(screen.getByText(/Shared: Yoga, Specialty Coffee/i)).toBeDefined();
  });

  it('renders ConnectSwipeDeck with action buttons and keyboard navigation hints', () => {
    const handleSwipe = vi.fn().mockResolvedValue({ success: true, action: 'like', matched: false });
    const handleUndo = vi.fn().mockResolvedValue(undefined);
    const handleRefresh = vi.fn();

    render(
      <ConnectSwipeDeck
        candidates={[sampleCandidate]}
        onSwipe={handleSwipe}
        onUndo={handleUndo}
        canUndo={true}
        onRefresh={handleRefresh}
      />,
    );

    expect(screen.getByLabelText(/Pass on this flatmate/i)).toBeDefined();
    expect(screen.getByLabelText(/Interested in teaming up with this flatmate/i)).toBeDefined();
    expect(screen.getByLabelText(/Undo last swipe/i)).toBeDefined();

    // Click Interested button
    const interestedBtn = screen.getByLabelText(/Interested in teaming up with this flatmate/i);
    fireEvent.click(interestedBtn);
    expect(handleSwipe).toHaveBeenCalledWith('usr-sample-1', 'like');
  });

  it('renders ConnectMatchModal with mutual match celebration and actions', () => {
    const handleClose = vi.fn();
    const handleStartChat = vi.fn();

    render(
      <ConnectMatchModal
        match={sampleMatch}
        onClose={handleClose}
        onStartChat={handleStartChat}
      />,
    );

    expect(screen.getByText(/It's a Mutual Match!/i)).toBeDefined();
    expect(screen.getByText(/92% Compatibility/i)).toBeDefined();

    const startChatBtn = screen.getByRole('button', { name: /Send a Message/i });
    fireEvent.click(startChatBtn);
    expect(handleStartChat).toHaveBeenCalledWith(sampleMatch);
  });

  it('renders ConnectMatchesList with partner details and unread message indicators', () => {
    const handleSelect = vi.fn();
    const handleDiscover = vi.fn();

    render(
      <ConnectMatchesList
        matches={[sampleMatch]}
        onSelectMatch={handleSelect}
        onGoToDiscover={handleDiscover}
      />,
    );

    expect(screen.getByText('Priya Sharma')).toBeDefined();
    expect(screen.getByText(/Hey there! Are you looking around DLF Phase 4\?/i)).toBeDefined();

    fireEvent.click(screen.getByText('Priya Sharma'));
    expect(handleSelect).toHaveBeenCalledWith(sampleMatch);
  });

  it('renders ConnectChatThread and submits new messages', async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    const handleBack = vi.fn();
    const handleBlock = vi.fn().mockResolvedValue(undefined);
    const handleReport = vi.fn().mockResolvedValue(undefined);

    const messages: ConnectMessageItem[] = [
      {
        id: 'msg-1',
        matchId: 'match-test-1',
        senderId: 'usr-sample-1',
        content: 'Hi! Let us connect for flatmate teaming.',
        createdAt: new Date().toISOString(),
        readAt: null,
      },
    ];

    render(
      <ConnectChatThread
        match={sampleMatch}
        messages={messages}
        currentUserId="usr-me"
        onSendMessage={handleSend}
        onBack={handleBack}
        onBlockUser={handleBlock}
        onReportUser={handleReport}
      />,
    );

    expect(screen.getByText(/Hi! Let us connect for flatmate teaming./i)).toBeDefined();

    const input = screen.getByPlaceholderText(/Message Priya Sharma.../i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hi Priya, sounds great!' } });
      const sendBtn = screen.getByLabelText(/Send message/i);
      fireEvent.click(sendBtn);
    });

    expect(handleSend).toHaveBeenCalledWith('Hi Priya, sounds great!');
  });

  it('renders ConnectProfileSettings with visibility switch', async () => {
    const handleToggle = vi.fn().mockResolvedValue(undefined);

    render(
      <ConnectProfileSettings
        discoveryHidden={false}
        onToggleVisibility={handleToggle}
        currentUser={{ name: 'Vikram Seth', email: 'vikram@example.com' }}
      />,
    );

    expect(screen.getByText(/Discovery Visibility/i)).toBeDefined();
    expect(screen.getByText(/Actively Discoverable/i)).toBeDefined();

    const toggleBtn = screen.getByRole('switch');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('renders dynamic intention badges (Has a Room, Rent Together) on ConnectProfileCard', () => {
    render(<ConnectProfileCard candidate={sampleCandidate} isTop={true} />);

    expect(screen.getByText('Has a Room')).toBeDefined();
    expect(screen.getByText('Rent Together')).toBeDefined();
  });

  it('renders ConnectProfileSettings with all 3 flatmate intentions and supports multi-select', async () => {
    const handleToggle = vi.fn().mockResolvedValue(undefined);
    const handleIntentionsChange = vi.fn();

    render(
      <ConnectProfileSettings
        discoveryHidden={false}
        onToggleVisibility={handleToggle}
        currentUser={{ name: 'Vikram Seth', email: 'vikram@example.com' }}
        initialIntentions={['has_room', 'team_up']}
        onIntentionsChange={handleIntentionsChange}
      />,
    );

    // Verify all 3 intention labels exist
    expect(screen.getByText(/Has a room and needs a flatmate/i)).toBeDefined();
    expect(screen.getByText(/Needs a room and wants a compatible flatmate/i)).toBeDefined();
    expect(screen.getByText(/Find compatible people to rent an entire flat together/i)).toBeDefined();

    // Toggle the 2nd intention ('needs_room') to select all three
    const needsRoomOption = screen.getByText(/Needs a room and wants a compatible flatmate/i);
    await act(async () => {
      fireEvent.click(needsRoomOption);
    });

    expect(handleIntentionsChange).toHaveBeenCalledWith(['has_room', 'team_up', 'needs_room']);
  });

  it('renders ConnectSwipeDeck with intention filter chips and triggers onSelectIntention', () => {
    const handleSwipe = vi.fn();
    const handleUndo = vi.fn();
    const handleRefresh = vi.fn();
    const handleSelectIntention = vi.fn();

    render(
      <ConnectSwipeDeck
        candidates={[sampleCandidate]}
        onSwipe={handleSwipe}
        onUndo={handleUndo}
        canUndo={false}
        onRefresh={handleRefresh}
        selectedIntention="all"
        onSelectIntention={handleSelectIntention}
      />,
    );

    expect(screen.getByRole('button', { name: 'All Intentions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Has Room' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Needs Room' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rent Together' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Rent Together' }));
    expect(handleSelectIntention).toHaveBeenCalledWith('team_up');
  });
});
