import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthModal } from '../components/auth/AuthModal';
import { AppProvider } from '../context/AppContext';
import { apiClient } from '../services/apiClient';

describe('Aashvo AuthModal — Google OAuth State Matrix', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).google;
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.remove();
    }
  });

  afterEach(() => {
    delete (window as any).google;
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.remove();
    }
  });

  it('1. Missing-Configuration Case: displays actionable error when VITE_GOOGLE_CLIENT_ID is not set', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    const handleClose = vi.fn();
    render(
      <AppProvider>
        <AuthModal onClose={handleClose} />
      </AppProvider>,
    );

    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Google OAuth is not configured in this environment \(missing VITE_GOOGLE_CLIENT_ID\)/i,
        ),
      ).toBeDefined();
    });
    expect(handleClose).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('2. Enabled Case: initializes GIS and logs user in when valid Google credential is provided', async () => {
    const fakeClientId = '1234567890-test.apps.googleusercontent.com';
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', fakeClientId);

    let gsiCallback: ((res: { credential?: string }) => void) | null = null;

    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn((config: { client_id: string; callback: any }) => {
            gsiCallback = config.callback;
          }),
          prompt: vi.fn(),
        },
      },
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      accessToken: 'test-google-jwt-access-token',
      expiresIn: 900,
      user: {
        id: 'usr-google-1',
        email: 'tester.google@example.com',
        role: 'renter',
        accountStatus: 'active',
        emailVerified: true,
        phoneVerified: false,
      },
    });

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      fullName: 'Google Authenticated User',
    });

    const handleClose = vi.fn();
    render(
      <AppProvider>
        <AuthModal onClose={handleClose} />
      </AppProvider>,
    );

    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleBtn);

    expect((window as any).google.accounts.id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: fakeClientId,
      }),
    );
    expect((window as any).google.accounts.id.prompt).toHaveBeenCalled();

    // Trigger credential callback
    expect(gsiCallback).toBeTypeOf('function');
    await act(async () => {
      await gsiCallback!({ credential: 'valid.mocked.google.id.token' });
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/google', {
        idToken: 'valid.mocked.google.id.token',
      });
      expect(handleClose).toHaveBeenCalled();
    });

    postSpy.mockRestore();
    getSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('3. Disabled / Unregistered Origin Case: shows helpful error if GIS origin is not authorized', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');

    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          prompt: vi.fn((notifyFn: any) => {
            notifyFn({
              isNotDisplayed: () => true,
              getNotDisplayedReason: () => 'unregistered_origin',
              isSkippedMoment: () => false,
              isDismissedMoment: () => false,
            });
          }),
        },
      },
    };

    const handleClose = vi.fn();
    render(
      <AppProvider>
        <AuthModal onClose={handleClose} />
      </AppProvider>,
    );

    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Google Sign-In failed: This origin is not authorized in Google Cloud Console/i,
        ),
      ).toBeDefined();
    });
    expect(handleClose).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('4. Invalid-Token Case: displays error and keeps modal open when backend rejects token', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');

    let gsiCallback: ((res: { credential?: string }) => void) | null = null;
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn((config: any) => {
            gsiCallback = config.callback;
          }),
          prompt: vi.fn(),
        },
      },
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new Error('Google ID token is invalid or has expired.'),
    );

    const handleClose = vi.fn();
    render(
      <AppProvider>
        <AuthModal onClose={handleClose} />
      </AppProvider>,
    );

    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await act(async () => {
      await gsiCallback!({ credential: 'expired-or-tampered-id-token' });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Google ID token is invalid or has expired./i),
      ).toBeDefined();
    });
    expect(handleClose).not.toHaveBeenCalled();

    postSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
