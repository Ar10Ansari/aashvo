import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { marketplaceProfileService } from '../services/marketplaceProfileService';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import { MyProfileModal } from '../components/profile/MyProfileModal';
import { ConnectSwipeDeck } from '../components/connect/ConnectSwipeDeck';
import { ConnectChatThread } from '../components/connect/ConnectChatThread';
import { AppProvider } from '../context/AppContext';
import type {
  MarketplaceProfileView,
  ProfileCompletionBreakdown,
  ConnectCandidateView,
  ConnectMatchItem,
  ConnectMessageItem,
} from '@aashvo/contracts';
import type { User } from '../types';

describe('AASHVO User Profiles, Onboarding & Connect Matching UI Suite', () => {
  beforeEach(() => {
    marketplaceProfileService.resetForTesting();
    vi.clearAllMocks();
  });

  describe('1. Marketplace Profile Service & Persona Management', () => {
    it('initializes with default active flatmate_seeker persona', async () => {
      const profiles = await marketplaceProfileService.getMyMarketplaceProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(1);

      const active = profiles.find((p) => p.isCurrentActive);
      expect(active).toBeDefined();
      expect(active?.profileType).toBe('flatmate_seeker');
      expect(active?.status).toBe('active');
    });

    it('switches active persona atomically and resets other profiles', async () => {
      // First ensure owner persona exists
      await marketplaceProfileService.createMarketplaceProfile('property_owner', 'Rohan Owner');

      // Switch to property_owner
      const switched = await marketplaceProfileService.switchMarketplaceProfile('property_owner');
      expect(switched.profileType).toBe('property_owner');
      expect(switched.isCurrentActive).toBe(true);

      const all = await marketplaceProfileService.getMyMarketplaceProfiles();
      const seeker = all.find((p) => p.profileType === 'flatmate_seeker');
      const owner = all.find((p) => p.profileType === 'property_owner');

      expect(owner?.isCurrentActive).toBe(true);
      expect(seeker?.isCurrentActive).toBe(false);
    });

    it('calculates profile completion breakdown and percentage', async () => {
      const breakdown = await marketplaceProfileService.getProfileCompletion();
      expect(breakdown.totalPercent).toBeGreaterThanOrEqual(0);
      expect(breakdown.totalPercent).toBeLessThanOrEqual(100);
      expect(Array.isArray(breakdown.missingFields)).toBe(true);
    });

    it('pauses and reactivates profile discovery status', async () => {
      const paused = await marketplaceProfileService.pauseProfile();
      expect(paused.isPublished).toBe(false);

      const published = await marketplaceProfileService.publishProfile();
      expect(published.isPublished).toBe(true);
    });

    it('saves draft profile without publishing and recovers draft state', async () => {
      const draftData = {
        fullName: 'Rohan Varma',
        age: 24,
        profession: 'Software Engineer',
        bio: 'Looking for a quiet room in Gurgaon',
        city: 'Gurugram',
        budgetMax: 20000,
        foodHabit: 'Vegetarian' as const,
        sleepRoutine: 'Early Bird' as const,
        cleanliness: 'Spotless' as const,
        smoking: 'No',
        petFriendly: true,
        publishImmediately: false,
      };

      await marketplaceProfileService.saveOnboarding(draftData);

      const local = marketplaceProfileService.getLocalOnboardingData();
      expect(local).toBeDefined();
      expect(local?.fullName).toBe('Rohan Varma');
      expect(local?.city).toBe('Gurugram');
    });
  });

  describe('2. Progressive 5-Step Onboarding Modal Flow', () => {
    it('renders Step 1 (Basic Info) and navigates through steps with draft saving', async () => {
      const onClose = vi.fn();

      render(
        <AppProvider>
          <OnboardingModal
            isOpen={true}
            onClose={onClose}
            initialStep={1}
          />
        </AppProvider>,
      );

      // Verify Step 1 is active
      expect(screen.getByText(/Complete Your Profile/i)).toBeDefined();
      expect(screen.getByText(/Step 1 of 5/i)).toBeDefined();
      expect(screen.getByText(/Full Name/i)).toBeDefined();

      // Enter valid basic info
      const textboxes = screen.getAllByRole('textbox');
      fireEvent.change(textboxes[0], {
        target: { value: 'Rohan Varma' },
      });

      // Click "Save as Draft"
      const draftBtn = screen.getByText(/Save as Draft/i);
      await act(async () => {
        fireEvent.click(draftBtn);
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('validates minimum age requirement (>= 18 years)', async () => {
      render(
        <AppProvider>
          <OnboardingModal
            isOpen={true}
            onClose={vi.fn()}
            initialStep={1}
          />
        </AppProvider>,
      );

      // Fill full name and bio first
      const textboxes = screen.getAllByRole('textbox');
      fireEvent.change(textboxes[0], { target: { value: 'Rohan Varma' } });
      const bioTextarea = screen.getByPlaceholderText(/Share a few words about your daily routine/i);
      fireEvent.change(bioTextarea, { target: { value: 'Friendly professional looking for clean flatmate' } });

      const ageInput = screen.getByDisplayValue('22');
      fireEvent.change(ageInput, { target: { value: '16' } });

      const continueBtn = screen.getByText(/Continue/i);
      fireEvent.click(continueBtn);

      // Error message should appear
      expect(
        screen.getByText(/Aashvo requires all flatmate members to be at least 18 years old./i),
      ).toBeDefined();
    });
  });

  describe('3. My Profile Modal & Completion Overview', () => {
    it('renders profile completion score, status badge, and personas list', () => {
      render(
        <AppProvider>
          <MyProfileModal
            isOpen={true}
            onClose={vi.fn()}
            onOpenOnboarding={vi.fn()}
          />
        </AppProvider>,
      );

      // Verifies completion breakdown and tabs are visible
      expect(screen.getByText(/My Profile & Personas/i)).toBeDefined();
      expect(screen.getAllByText(/Profile Completion/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Overview & Checklist/i)).toBeDefined();

      // Switch to Personas tab
      fireEvent.click(screen.getByText(/Marketplace Personas/i));
      expect(screen.getByText(/Your Activated Personas/i)).toBeDefined();
      expect(screen.getByText(/Add Another Marketplace Persona/i)).toBeDefined();
    });
  });

  describe('4. Connect Swipe Deck Profile Gating & Empty States', () => {
    const mockSwipe = vi.fn().mockResolvedValue({ matched: false, match: null });
    const mockUndo = vi.fn().mockResolvedValue(undefined);
    const mockRefresh = vi.fn();
    const mockOpenOnboarding = vi.fn();
    const mockOpenAuth = vi.fn();

    const sampleCandidate: ConnectCandidateView = {
      userId: 'usr-cand-1',
      profileId: 'prof-cand-1',
      displayName: 'Sneha Patel',
      age: 25,
      gender: 'female',
      occupation: 'UX Designer',
      city: 'Gurugram',
      targetLocalities: ['DLF Cyber City', 'Golf Course Road'],
      budgetMax: 28000,
      foodHabit: 'Eggetarian',
      sleepRoutine: 'Night Owl',
      cleanliness: 'Spotless',
      petFriendly: true,
      smoking: 'no',
      bio: 'Looking for a calm, friendly flatmate near Cyber City.',
      interests: ['Design', 'Specialty Coffee', 'Yoga'],
      avatarUrl: null,
      verified: true,
      hasRoom: false,
      intentions: ['needs_room', 'team_up'],
      roomDetails: null,
      compatibility: {
        scoreAvailable: true,
        overallScore: 88,
        foodScore: 20,
        sleepScore: 20,
        cleanlinessScore: 20,
        budgetScore: 18,
        locationScore: 90,
        lifestyleScore: 88,
        moveInScore: 85,
        interestsScore: 10,
        sharedInterests: ['Design', 'Yoga'],
        explanations: ['Both prefer quiet hours', 'Shared interest in Design and Yoga'],
      },
    };

    const mockUser: User = {
      id: 'usr-test-123',
      name: 'Rohan Varma',
      email: 'rohan@example.com',
      role: 'renter',
      avatar: undefined,
    };

    it('displays Sign In prompt when visitor is unauthenticated', () => {
      render(
        <ConnectSwipeDeck
          candidates={[sampleCandidate]}
          onSwipe={mockSwipe}
          onUndo={mockUndo}
          canUndo={false}
          onRefresh={mockRefresh}
          currentUser={null}
          onOpenAuth={mockOpenAuth}
        />,
      );

      expect(screen.getByText(/Member Sign-in Required/i)).toBeDefined();
      expect(screen.getByText(/Sign In to Access Connect/i)).toBeDefined();

      fireEvent.click(screen.getByText(/Sign In \/ Register/i));
      expect(mockOpenAuth).toHaveBeenCalledWith('signin');
    });

    it('displays "Create Your Flatmate Profile" prompt when user has no flatmate profile', () => {
      const nonFlatmateProfiles: MarketplaceProfileView[] = [
        {
          id: 'mp-1',
          userId: 'usr-test-123',
          profileType: 'property_owner',
          status: 'active',
          isCurrentActive: true,
          displayName: 'Rohan Owner',
          completionPercent: 50,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      render(
        <ConnectSwipeDeck
          candidates={[]}
          onSwipe={mockSwipe}
          onUndo={mockUndo}
          canUndo={false}
          onRefresh={mockRefresh}
          currentUser={mockUser}
          marketplaceProfiles={nonFlatmateProfiles}
          onOpenOnboarding={mockOpenOnboarding}
        />,
      );

      expect(screen.getByText(/Setup Required • 5-Step Flow/i)).toBeDefined();
      expect(screen.getByText(/Create Your Flatmate Profile/i)).toBeDefined();
      expect(screen.getByText(/Zero fake profiles/i)).toBeDefined();

      fireEvent.click(screen.getByText(/Create My Flatmate Profile/i));
      expect(mockOpenOnboarding).toHaveBeenCalledWith(1);
    });

    it('displays "Publish Profile to Start Matching" when flatmate profile is in draft', () => {
      const draftProfiles: MarketplaceProfileView[] = [
        {
          id: 'mp-2',
          userId: 'usr-test-123',
          profileType: 'flatmate_seeker',
          status: 'draft',
          isCurrentActive: true,
          displayName: 'Rohan Seeker',
          completionPercent: 45,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const completion: ProfileCompletionBreakdown = {
        totalPercent: 45,
        basicInfoPercent: 100,
        locationPercent: 80,
        housingPercent: 30,
        lifestylePercent: 0,
        photoPercent: 0,
        missingFields: ['Lifestyle Habits', 'Budget Range', 'Room Type Preference'],
        isComplete: false,
        isPublished: false,
      };

      render(
        <ConnectSwipeDeck
          candidates={[]}
          onSwipe={mockSwipe}
          onUndo={mockUndo}
          canUndo={false}
          onRefresh={mockRefresh}
          currentUser={mockUser}
          marketplaceProfiles={draftProfiles}
          profileCompletion={completion}
          onOpenOnboarding={mockOpenOnboarding}
        />,
      );

      expect(screen.getByText(/Profile in Draft • 45% Complete/i)).toBeDefined();
      expect(screen.getByText(/Publish Profile to Start Matching/i)).toBeDefined();
      expect(screen.getByText(/Lifestyle Habits/i)).toBeDefined();

      fireEvent.click(screen.getByText(/Complete & Publish Profile/i));
      expect(mockOpenOnboarding).toHaveBeenCalledWith(1);
    });

    it('renders candidate card normally when user has active published flatmate profile', () => {
      const activeProfiles: MarketplaceProfileView[] = [
        {
          id: 'mp-3',
          userId: 'usr-test-123',
          profileType: 'flatmate_seeker',
          status: 'active',
          isCurrentActive: true,
          displayName: 'Rohan Seeker',
          completionPercent: 100,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      render(
        <ConnectSwipeDeck
          candidates={[sampleCandidate]}
          onSwipe={mockSwipe}
          onUndo={mockUndo}
          canUndo={false}
          onRefresh={mockRefresh}
          currentUser={mockUser}
          marketplaceProfiles={activeProfiles}
        />,
      );

      expect(screen.getByText(/Sneha Patel/i)).toBeDefined();
      expect(screen.getByText(/UX Designer/i)).toBeDefined();
      expect(screen.getByText(/88%/i)).toBeDefined();
    });

    it('renders "You\'re all caught up!" when candidates queue is exhausted', () => {
      const activeProfiles: MarketplaceProfileView[] = [
        {
          id: 'mp-3',
          userId: 'usr-test-123',
          profileType: 'flatmate_seeker',
          status: 'active',
          isCurrentActive: true,
          displayName: 'Rohan Seeker',
          completionPercent: 100,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      render(
        <ConnectSwipeDeck
          candidates={[]}
          onSwipe={mockSwipe}
          onUndo={mockUndo}
          canUndo={false}
          onRefresh={mockRefresh}
          currentUser={mockUser}
          marketplaceProfiles={activeProfiles}
        />,
      );

      expect(screen.getByText(/You're all caught up!/i)).toBeDefined();
      expect(screen.getByText(/Refresh Discovery/i)).toBeDefined();
    });
  });

  describe('5. Connect Chat Thread Mutual Unmatching', () => {
    const mockMatch: ConnectMatchItem = {
      id: 'match-xyz',
      status: 'active',
      matchedAt: new Date().toISOString(),
      lastInteractionAt: new Date().toISOString(),
      partner: {
        userId: 'usr-partner-1',
        displayName: 'Ananya Roy',
        occupation: 'Brand Strategist',
        city: 'Gurugram',
        locality: 'DLF Phase 5',
        budgetMax: 25000,
        avatarUrl: null,
        verified: true,
        compatibilityScore: 92,
      },
    };

    const mockMessages: ConnectMessageItem[] = [
      {
        id: 'msg-1',
        matchId: 'match-xyz',
        senderId: 'usr-partner-1',
        content: 'Hi! Loved your profile. Are you looking to team up in Gurgaon?',
        createdAt: new Date().toISOString(),
        readAt: null,
      },
    ];

    it('opens options dropdown and triggers unmatch flow with confirmation modal', async () => {
      const mockUnmatch = vi.fn().mockResolvedValue(undefined);
      const mockBack = vi.fn();

      render(
        <ConnectChatThread
          match={mockMatch}
          messages={mockMessages}
          currentUserId="usr-me"
          onSendMessage={vi.fn().mockResolvedValue(undefined)}
          onBack={mockBack}
          onBlockUser={vi.fn().mockResolvedValue(undefined)}
          onReportUser={vi.fn().mockResolvedValue(undefined)}
          onUnmatch={mockUnmatch}
        />,
      );

      expect(screen.getByText(/Ananya Roy/i)).toBeDefined();

      // Open options dropdown
      const optionsBtn = screen.getByLabelText(/Safety and options/i);
      fireEvent.click(optionsBtn);

      // Verify "Unmatch" option appears
      const unmatchOption = screen.getByText(/^Unmatch$/i);
      expect(unmatchOption).toBeDefined();

      // Click Unmatch to open modal
      fireEvent.click(unmatchOption);

      expect(screen.getByText(/Unmatch with Ananya Roy\?/i)).toBeDefined();

      // Confirm unmatch
      const confirmBtn = screen.getByRole('button', { name: /^Unmatch$/i });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockUnmatch).toHaveBeenCalledWith('match-xyz', 'Unmatched by user');
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
