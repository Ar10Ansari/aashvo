import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from '../components/auth/AuthModal';
import { Navbar } from '../components/layout/Navbar';
import { DiscoverySection } from '../components/discovery/DiscoverySection';
import { MyActivityModal } from '../components/activity/MyActivityModal';
import { RentalTrustModal } from '../components/rental/RentalTrustModal';
import { AppProvider } from '../context/AppContext';
import { apiClient, ApiError } from '../services/apiClient';

describe('Production Release Readiness & Demo Removal Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Authentication Modal & Persona Decommissioning', () => {
    it('renders only authentic authentication tabs (Sign In, Register) and zero Demo Personas tabs', () => {
      const handleClose = vi.fn();
      render(
        <AppProvider>
          <AuthModal onClose={handleClose} />
        </AppProvider>,
      );

      // Verify authentic tabs exist
      expect(screen.getAllByRole('button', { name: /^sign in$/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /^register$/i })).toBeDefined();

      // Verify Demo Personas tab is completely absent from DOM
      expect(screen.queryByText(/demo personas/i)).toBeNull();
      expect(screen.queryByText(/switch demo persona/i)).toBeNull();
    });

    it('does not display any demo persona credentials or quick-login buttons', () => {
      const handleClose = vi.fn();
      render(
        <AppProvider>
          <AuthModal onClose={handleClose} />
        </AppProvider>,
      );

      // Verify no demo cards exist
      expect(screen.queryByText(/demo renter/i)).toBeNull();
      expect(screen.queryByText(/demo owner/i)).toBeNull();
      expect(screen.queryByText(/demo manager/i)).toBeNull();
      expect(screen.queryByText(/rohan\.v@delhitech\.in/i)).toBeNull();
      expect(screen.queryByText(/anil\.mehra@delhihomes\.org/i)).toBeNull();
      expect(screen.queryByText(/rajesh@urbanstay\.in/i)).toBeNull();
    });

    it('initializes input fields as empty without pre-filled test values', () => {
      const handleClose = vi.fn();
      render(
        <AppProvider>
          <AuthModal onClose={handleClose} />
        </AppProvider>,
      );

      const emailInput = screen.getByPlaceholderText(/rohan@example\.com/i) as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText(/enter your password/i) as HTMLInputElement;

      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });
  });

  describe('2. Navigation Bar & Role Presentation', () => {
    it('does not render "Switch Persona / Login" button anywhere in navigation', () => {
      render(
        <AppProvider>
          <Navbar />
        </AppProvider>,
      );

      expect(screen.queryByText(/switch persona/i)).toBeNull();
      expect(screen.queryByText(/non-privileged demo preview/i)).toBeNull();
    });
  });

  describe('3. Discovery Section Production Empty States', () => {
    it('renders genuine empty state with "List Your Property" CTA when properties inventory is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [] } as any);
      render(
        <AppProvider>
          <DiscoverySection />
        </AppProvider>,
      );

      // Switch to entire flats / property tab
      const entireFlatsTab = screen.getByRole('button', { name: /entire flats/i });
      fireEvent.click(entireFlatsTab);

      await waitFor(() => {
        expect(screen.getByText(/no listings in this area yet/i)).toBeDefined();
        expect(
          screen.getByRole('button', { name: /list your property \(₹0 fee\)/i }),
        ).toBeDefined();
      });
    });

    it('renders genuine empty state with "Launch Aashvo Connect" CTA when flatmates inventory is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [] } as any);
      render(
        <AppProvider>
          <DiscoverySection />
        </AppProvider>,
      );

      // Flatmates is default active tab
      await waitFor(() => {
        expect(screen.getByText(/no flatmate profiles found/i)).toBeDefined();
        const connectButtons = screen.getAllByRole('button', { name: /launch aashvo connect/i });
        expect(connectButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('4. My Activity Viewing Appointments Realism', () => {
    it('renders clean zero-state rather than synthetic demo visits when no appointments are scheduled', async () => {
      render(
        <AppProvider>
          <MyActivityModal isOpen={true} onClose={vi.fn()} initialTab="visits" />
        </AppProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText(/no viewing visits requested/i)).toBeDefined();
      });

      // Assert fake demo visits are never rendered
      expect(screen.queryByText(/vis-demo-1/i)).toBeNull();
      expect(screen.queryByText(/vis-demo-2/i)).toBeNull();
      expect(screen.queryByText(/sunita rao/i)).toBeNull();
    });
  });

  describe('5. Tenancy Agreements & Rental Trust Auth Gate', () => {
    it('prompts unauthenticated visitors to sign in before accessing rental trust records', async () => {
      const handleClose = vi.fn();
      render(
        <AppProvider>
          <RentalTrustModal isOpen={true} onClose={handleClose} currentUser={null} />
        </AppProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText(/sign in to view rental trust/i)).toBeDefined();
        expect(
          screen.getByRole('button', { name: /sign in or register/i }),
        ).toBeDefined();
      });

      // Verify the amber DEMO / EVALUATION banner is completely absent
      expect(screen.queryByText(/demo \/ evaluation mode/i)).toBeNull();
      expect(screen.queryByText(/simulated store/i)).toBeNull();
    });
  });

  describe('6. Unified API Client Resiliency & Normalization', () => {
    it('normalizes base URL ensuring /api/v1 is present and eliminates redundant trailing slashes', () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://aashvo-api.onrender.com');
      expect(apiClient.getBaseUrl()).toBe('https://aashvo-api.onrender.com/api/v1');

      vi.stubEnv('VITE_API_BASE_URL', 'https://aashvo-api.onrender.com/api/v1/');
      expect(apiClient.getBaseUrl()).toBe('https://aashvo-api.onrender.com/api/v1');

      vi.unstubAllEnvs();
    });

    it('transforms network failure / timeout into structured 503 error with server cold-start notice', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiClient.get('/properties')).rejects.toThrow(
        /Unable to connect to Aashvo services. If the server was sleeping, please allow a few seconds for it to wake up and try again./i,
      );

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('NetworkError'));
      try {
        await apiClient.get('/properties');
        expect.unreachable('Should have thrown ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(503);
        expect((err as ApiError).code).toBe('BACKEND_CONNECTIVITY_ERROR');
      }
    });
  });
});
