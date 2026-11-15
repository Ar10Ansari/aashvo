import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectProfileCard } from '../components/connect/ConnectProfileCard';
import { ConnectProfileSettings } from '../components/connect/ConnectProfileSettings';
import { ConnectSwipeDeck } from '../components/connect/ConnectSwipeDeck';
import { connectService } from '../services/connectService';
import { DEFAULT_MATCHING_WEIGHTS } from '@aashvo/contracts';
import type { ConnectCandidateView, UserMatchingPreferencesView } from '@aashvo/contracts';

describe('Connect Intelligence & Matching UX Integration Tests', () => {
  const sampleCandidate: ConnectCandidateView = {
    userId: 'usr-cand-101',
    profileId: 'prof-cand-101',
    displayName: 'Priya Sharma',
    age: 24,
    gender: 'Female',
    occupation: 'Product Designer',
    city: 'Gurugram',
    state: 'Haryana',
    country: 'India',
    targetLocalities: ['DLF Phase 4', 'Galleria'],
    budgetMin: 18000,
    budgetMax: 22000,
    moveInDate: '2026-12-01',
    moveInFlexible: true,
    roomType: 'private_room',
    furnishing: 'fully_furnished',
    foodHabit: 'Vegetarian',
    sleepRoutine: 'Early Bird',
    cleanliness: 'Spotless',
    petFriendly: true,
    smoking: 'No',
    bio: 'Product designer looking for peaceful shared flat near Galleria.',
    interests: ['Yoga', 'Specialty Coffee', 'Design'],
    avatarUrl: null,
    verified: true,
    hasRoom: true,
    intentions: ['has_room', 'team_up'],
    roomDetails: 'Private room in a 2BHK with balcony',
    compatibility: {
      scoreAvailable: true,
      overallScore: 94,
      budgetScore: 20,
      locationScore: 20,
      lifestyleScore: 20,
      foodScore: 15,
      sleepScore: 10,
      cleanlinessScore: 20,
      moveInScore: 10,
      interestsScore: 5,
      sharedInterests: ['Yoga', 'Specialty Coffee'],
      explanations: [
        'Same neighborhood (DLF Phase 4)',
        'Target rent budget aligns seamlessly',
        'Both prefer vegetarian diet',
        'Target move-in dates aligned (within 1 week)',
      ],
      dimensions: {
        budget: { score: 20, maxScore: 20, percentage: 100, explanation: 'Budget overlap' },
        location: { score: 20, maxScore: 20, percentage: 100, explanation: 'Same neighborhood' },
        lifestyle: { score: 20, maxScore: 20, percentage: 100, explanation: 'Cleanliness alignment' },
        food: { score: 15, maxScore: 15, percentage: 100, explanation: 'Vegetarian diet' },
        sleep: { score: 10, maxScore: 10, percentage: 100, explanation: 'Early Bird' },
        moveIn: { score: 10, maxScore: 10, percentage: 100, explanation: 'Move-in aligned' },
        interests: { score: 5, maxScore: 5, percentage: 100, explanation: '2 shared interests' },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. ConnectProfileCard — 7-Dimension Breakdown & Data Explanations', () => {
    it('renders candidate overview with overall score, move-in badge and why-you-match explanations', () => {
      render(<ConnectProfileCard candidate={sampleCandidate} />);

      expect(screen.getByText('Priya Sharma, 24')).toBeDefined();
      expect(screen.getByText('94%')).toBeDefined();
      expect(screen.getByText('Why You Match')).toBeDefined();
      expect(screen.getByText('Same neighborhood (DLF Phase 4)')).toBeDefined();
      expect(screen.getByText('Both prefer vegetarian diet')).toBeDefined();
      expect(screen.getByText('2026-12-01')).toBeDefined();
    });

    it('toggles 7-dimension score breakdown accordion on click', () => {
      render(<ConnectProfileCard candidate={sampleCandidate} />);

      const toggleBtn = screen.getByRole('button', { name: /view scores/i });
      expect(toggleBtn).toBeDefined();

      // Click to expand
      fireEvent.click(toggleBtn);

      expect(screen.getByText('Budget Alignment')).toBeDefined();
      expect(screen.getByText('Location & Locality')).toBeDefined();
      expect(screen.getByText('Move-in Timeline')).toBeDefined();
      expect(screen.getByText('Shared Interests')).toBeDefined();
    });
  });

  describe('2. ConnectProfileSettings — Personalized Weights & Sliders', () => {
    it('renders 7 matching weight sliders with live normalized percentage', async () => {
      const mockPref: UserMatchingPreferencesView = {
        userId: 'usr-current',
        weights: { ...DEFAULT_MATCHING_WEIGHTS },
        normalizedWeights: { ...DEFAULT_MATCHING_WEIGHTS },
        updatedAt: new Date().toISOString(),
      };
      vi.spyOn(connectService, 'getMatchingPreferences').mockResolvedValue(mockPref);
      const updateSpy = vi.spyOn(connectService, 'updateMatchingPreferences').mockResolvedValue(mockPref);

      render(
        <ConnectProfileSettings
          discoveryHidden={false}
          onToggleVisibility={vi.fn()}
          currentUser={{ name: 'Aarav Sharma', email: 'aarav@aashvo.com' }}
        />,
      );

      expect(screen.getByText('Personalized Matching Weights')).toBeDefined();
      expect(screen.getByText('Budget Alignment')).toBeDefined();
      expect(screen.getByText('Location & Locality')).toBeDefined();

      // Find save button
      const saveBtn = screen.getByRole('button', { name: /save matching weights/i });
      expect(saveBtn).toBeDefined();

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });
    });
  });

  describe('3. ConnectSwipeDeck — Advanced Filter Drawer', () => {
    it('opens advanced filter drawer and calls onApplyFilters', () => {
      const handleApply = vi.fn();
      const handleReset = vi.fn();

      render(
        <ConnectSwipeDeck
          candidates={[sampleCandidate]}
          onSwipe={vi.fn()}
          onUndo={vi.fn()}
          canUndo={false}
          onRefresh={vi.fn()}
          onApplyFilters={handleApply}
          onResetFilters={handleReset}
          currentUser={{ id: 'usr-1', name: 'Test', email: 'test@aashvo.com', role: 'renter' }}
          marketplaceProfiles={[{ id: 'p1', userId: 'usr-1', profileType: 'flatmate_seeker', status: 'active', completionPercent: 100, isPublished: true, createdAt: '', updatedAt: '' } as any]}
          profileCompletion={{
            totalPercent: 100,
            basicInfoPercent: 100,
            locationPercent: 100,
            housingPercent: 100,
            lifestylePercent: 100,
            photoPercent: 100,
            isPublished: true,
            isComplete: true,
            missingFields: [],
          }}
        />,
      );

      // Click Filters button to open drawer
      const filterBtn = screen.getByRole('button', { name: /toggle advanced filters/i });
      fireEvent.click(filterBtn);

      expect(screen.getByText('Advanced Connect Filters')).toBeDefined();
      expect(screen.getByText('Locality / Neighborhood')).toBeDefined();
      expect(screen.getByText('Target Rent Budget (₹/mo)')).toBeDefined();

      // Fill in locality
      const localityInput = screen.getByPlaceholderText(/e\.g\. Koramangala/i);
      fireEvent.change(localityInput, { target: { value: 'DLF Phase 4' } });

      // Click Apply
      const applyBtn = screen.getByRole('button', { name: /apply filters/i });
      fireEvent.click(applyBtn);

      expect(handleApply).toHaveBeenCalledWith(
        expect.objectContaining({
          locality: 'DLF Phase 4',
        }),
      );
    });
  });
});
