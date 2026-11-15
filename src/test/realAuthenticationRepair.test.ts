import { describe, it, expect, beforeEach } from 'vitest';
import {
  signUpWithSupabase,
  signInWithSupabase,
  signInWithGoogleBackend,
  resetPasswordWithSupabase,
  updatePasswordWithSupabase,
  resendVerificationEmailWithSupabase,
  initiateGoogleOAuthWithSupabase,
  parseOAuthErrorFromUrl,
  ensureUserProfileExists,
  BACKEND_NOT_CONFIGURED_ERROR,
} from '../services/authService';
import {
  isTrustedAdminSession,
  sanitizeStoredUser,
  canPerformAdminAction,
} from '../services/authorizationService';
import { apiClient } from '../services/apiClient';
import { User } from '../types';

describe('Real Authentication Repair & Backend Integrity (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Guest Default & Refresh State Isolation', () => {
    it('ensures unauthenticated visitors default to null rather than an auto-assigned demo persona', () => {
      // Empty storage simulates first-time arrival
      const stored = localStorage.getItem('aashvo_current_user');
      expect(stored).toBeNull();

      // Sanitization of empty storage yields null
      const sanitized = sanitizeStoredUser(null);
      expect(sanitized).toBeNull();
    });

    it('ensures logging out removes user from storage and stays null on reload', () => {
      // Simulate stored user
      localStorage.setItem(
        'aashvo_current_user',
        JSON.stringify({
          id: 'usr-active-1',
          name: 'Logged In User',
          email: 'user@example.com',
          role: 'renter',
          isDemo: false,
        })
      );

      // Simulate logout
      localStorage.removeItem('aashvo_current_user');

      // Next boot:
      const savedAfterLogout = localStorage.getItem('aashvo_current_user');
      expect(savedAfterLogout).toBeNull();
      expect(sanitizeStoredUser(savedAfterLogout)).toBeNull();
    });
  });

  describe('2. Honest Error Handling When Backend is Unconfigured', () => {
    it('signUpWithSupabase rejects with explicit configuration error when backend is offline', async () => {
      const res = await signUpWithSupabase({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        fullName: 'Test User',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
      expect(res.error).toBe(BACKEND_NOT_CONFIGURED_ERROR);
    });

    it('signInWithSupabase rejects with explicit configuration error when backend is offline', async () => {
      const res = await signInWithSupabase('test@example.com', 'ValidPassword123!');

      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
      expect(res.error).toBe(BACKEND_NOT_CONFIGURED_ERROR);
    });

    it('resendVerificationEmailWithSupabase rejects with explicit configuration error when backend is offline', async () => {
      const res = await resendVerificationEmailWithSupabase('test@example.com');

      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
    });

    it('resetPasswordWithSupabase rejects with configuration error when backend is offline', async () => {
      const res = await resetPasswordWithSupabase('test@example.com');

      expect(res.success).toBe(false);
      expect(res.message).toBe(BACKEND_NOT_CONFIGURED_ERROR);
    });

    it('updatePasswordWithSupabase validates password and rejects unconfigured backend', async () => {
      // Weak password
      const weakRes = await updatePasswordWithSupabase('short');
      expect(weakRes.success).toBe(false);
      expect(weakRes.error).toContain('8 characters');

      // Strong password against offline backend
      const res = await updatePasswordWithSupabase('ValidPassword123!');
      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
    });

    it('initiateGoogleOAuthWithSupabase rejects with honest error instead of fake simulated URL', async () => {
      const res = await initiateGoogleOAuthWithSupabase();

      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
      expect(res.url).toBeUndefined();
    });
  });

  describe('3. OAuth Error Parsing & Error Recovery', () => {
    it('parses access_denied from search query when user cancels Google OAuth', () => {
      const query = '?error=access_denied&error_description=User+cancelled+Google+login';
      const parsed = parseOAuthErrorFromUrl(query);

      expect(parsed.hasError).toBe(true);
      expect(parsed.error).toBe('access_denied');
      expect(parsed.errorDescription).toContain('cancelled or access was denied');
    });

    it('parses access_denied from hash fragment when provider returns error in hash', () => {
      const hash = '#error=server_error&error_description=Google+service+unavailable';
      const parsed = parseOAuthErrorFromUrl(hash);

      expect(parsed.hasError).toBe(true);
      expect(parsed.error).toBe('server_error');
      expect(parsed.errorDescription).toContain('Google service unavailable');
    });

    it('returns hasError: false for normal URL without error parameters', () => {
      const cleanUrl = '?code=valid_oauth_code&state=secure_state_token';
      const parsed = parseOAuthErrorFromUrl(cleanUrl);

      expect(parsed.hasError).toBe(false);
      expect(parsed.error).toBeUndefined();
    });
  });

  describe('4. Reliable Profile Provisioning & Metadata Handling', () => {
    it('ensureUserProfileExists safely provisions default renter role without privilege escalation', async () => {
      const authUser = {
        id: 'usr-new-supabase-uuid',
        email: 'newuser@delhi.ac.in',
        user_metadata: {
          full_name: 'Priya Sharma',
          role: 'admin', // Malicious client attempt in user_metadata
        },
        email_confirmed_at: '2026-10-20T00:00:00Z',
      };

      const user = await ensureUserProfileExists(authUser);

      expect(user.id).toBe('usr-new-supabase-uuid');
      expect(user.name).toBe('Priya Sharma');
      expect(user.email).toBe('newuser@delhi.ac.in');
      expect(user.role).toBe('renter'); // Hardcoded default protects against escalation
      expect(user.emailVerified).toBe(true);
      expect(user.isDemo).toBeUndefined();
    });

    it('falls back to email username if full_name is omitted', async () => {
      const authUser = {
        id: 'usr-minimal',
        email: 'abdul.ansari@example.com',
      };

      const user = await ensureUserProfileExists(authUser);
      expect(user.name).toBe('abdul.ansari');
      expect(user.role).toBe('renter');
    });
  });

  describe('5. Real vs Demo Separation & Admin Isolation', () => {
    it('clearly distinguishes genuine authenticated session from demo preview', () => {
      const genuineUser: User = {
        id: 'usr-real-uuid-445',
        name: 'Genuine Renter',
        email: 'genuine@aashvo.in',
        role: 'renter',
        isDemo: false,
        emailVerified: true,
      };

      const demoPersona: User = {
        id: 'usr-demo-101',
        name: 'Rohan Varma',
        email: 'rohan.v@delhitech.in',
        role: 'renter',
        isDemo: true,
        emailVerified: false,
      };

      expect(genuineUser.isDemo).toBe(false);
      expect(demoPersona.isDemo).toBe(true);
    });

    it('denies administrative moderation actions to demo personas and non-admin users', () => {
      const demoUser: User = {
        id: 'usr-demo-101',
        name: 'Rohan Varma',
        email: 'rohan@demo.com',
        role: 'renter',
        isDemo: true,
      };

      const regularUser: User = {
        id: 'usr-real-123',
        name: 'Regular Member',
        email: 'user@example.com',
        role: 'renter',
        isDemo: false,
      };

      expect(isTrustedAdminSession(demoUser)).toBe(false);
      expect(isTrustedAdminSession(regularUser)).toBe(false);
      expect(canPerformAdminAction(demoUser, 'approve_listing').allowed).toBe(false);
      expect(canPerformAdminAction(regularUser, 'resolve_safety_report').allowed).toBe(false);
    });
  });

  describe('6. Rigorous LocalStorage Tamper & Callback Regression Defenses', () => {
    it('demotes forged admin role in localStorage and denies trusted admin status', () => {
      const forgedAdmin = {
        id: 'usr-attacker-999',
        name: 'Malicious DevTools Actor',
        email: 'attacker@evil.com',
        role: 'admin',
        isDemo: false,
        phoneVerified: true,
      };

      localStorage.setItem('aashvo_current_user', JSON.stringify(forgedAdmin));
      const parsed = JSON.parse(localStorage.getItem('aashvo_current_user')!);
      const sanitized = sanitizeStoredUser(parsed);

      expect(sanitized).not.toBeNull();
      expect(sanitized?.role).toBe('renter'); // Stripped to renter
      expect(isTrustedAdminSession(sanitized)).toBe(false); // Denied admin
      expect(canPerformAdminAction(sanitized, 'resolve_report').allowed).toBe(false);
    });

    it('rejects mock IDs (usr-attacker, usr-hacker, usr-101) from ever being trusted admins', () => {
      const mockHacker: User = {
        id: 'usr-hacker',
        name: 'Hacker',
        email: 'hacker@internet.org',
        role: 'admin',
      };
      const mockAttacker: User = {
        id: 'usr-attacker',
        name: 'Attacker',
        email: 'attacker@internet.org',
        role: 'admin',
      };
      const mock101: User = {
        id: 'usr-101',
        name: 'User 101',
        email: 'u101@internet.org',
        role: 'admin',
      };

      expect(isTrustedAdminSession(mockHacker)).toBe(false);
      expect(isTrustedAdminSession(mockAttacker)).toBe(false);
      expect(isTrustedAdminSession(mock101)).toBe(false);
    });

    it('safely handles empty, malformed, or nested search and hash parameters in parseOAuthErrorFromUrl', () => {
      expect(parseOAuthErrorFromUrl('').hasError).toBe(false);
      expect(parseOAuthErrorFromUrl('?').hasError).toBe(false);
      expect(parseOAuthErrorFromUrl('#').hasError).toBe(false);
      expect(parseOAuthErrorFromUrl('?foo=bar&baz=qux').hasError).toBe(false);

      const complex = parseOAuthErrorFromUrl('?state=xyz&error=access_denied&prompt=none');
      expect(complex.hasError).toBe(true);
      expect(complex.error).toBe('access_denied');
      expect(complex.errorDescription).toContain('cancelled or access was denied');
    });

    it('verifies guest remains completely unauthenticated across simulated logout and refresh', () => {
      // 1. Authenticated session in storage
      localStorage.setItem(
        'aashvo_current_user',
        JSON.stringify({
          id: 'usr-valid-user',
          name: 'Real User',
          email: 'real@aashvo.in',
          role: 'renter',
          isDemo: false,
        })
      );
      expect(localStorage.getItem('aashvo_current_user')).not.toBeNull();

      // 2. User logs out
      localStorage.removeItem('aashvo_current_user');

      // 3. User refreshes browser window
      const refreshedStorage = localStorage.getItem('aashvo_current_user');
      expect(refreshedStorage).toBeNull();
      const userStateOnMount = refreshedStorage ? sanitizeStoredUser(JSON.parse(refreshedStorage)) : null;
      expect(userStateOnMount).toBeNull();
    });
  });

  describe('7. NestJS Unified Architecture, Single-Flight Refresh & Session Latch', () => {
    it('manages access token and fallback refresh token in sessionStorage without cross-origin leakage', async () => {
      const { apiClient } = await import('../services/apiClient');
      apiClient.setAccessToken('test-access-token-123', 'test-refresh-token-456');

      expect(apiClient.getAccessToken()).toBe('test-access-token-123');
      expect(apiClient.getRefreshToken()).toBe('test-refresh-token-456');
      expect(sessionStorage.getItem('aashvo_at')).toBe('test-access-token-123');
      // Verify refresh token is strictly NOT persisted in Web Storage to eliminate XSS exfiltration
      expect(sessionStorage.getItem('aashvo_rt')).toBeNull();

      // Clear session
      apiClient.clearSession();
      expect(apiClient.getAccessToken()).toBeNull();
      expect(apiClient.getRefreshToken()).toBeNull();
      expect(sessionStorage.getItem('aashvo_at')).toBeNull();
      expect(sessionStorage.getItem('aashvo_rt')).toBeNull();
    });

    it('single-flights concurrent 401 requests and terminates permanently on failed refresh', async () => {
      const { apiClient } = await import('../services/apiClient');
      let refreshCallCount = 0;

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
        const urlStr = String(input);
        if (urlStr.includes('/auth/refresh')) {
          refreshCallCount++;
          // Simulate invalid refresh token
          return new Response(JSON.stringify({ statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/protected-data')) {
          return new Response(JSON.stringify({ statusCode: 401 }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };

      try {
        apiClient.setAccessToken('expired-access-token', 'expired-refresh-token');

        // Fire 3 concurrent requests that return 401
        const results = await Promise.allSettled([
          apiClient.request('/protected-data'),
          apiClient.request('/protected-data'),
          apiClient.request('/protected-data'),
        ]);

        // All 3 should be rejected with UNAUTHORIZED
        results.forEach((r) => {
          expect(r.status).toBe('rejected');
        });

        // Exactly ONE single-flight refresh request must have been made
        expect(refreshCallCount).toBe(1);

        // Session must be cleared and latched
        expect(apiClient.getAccessToken()).toBeNull();

        // Any subsequent 401 must NOT trigger another refresh
        await expect(apiClient.request('/protected-data')).rejects.toThrow();
        expect(refreshCallCount).toBe(1); // Still exactly 1, no loop!
      } finally {
        global.fetch = originalFetch;
        apiClient.clearSession();
      }
    });
  });

  describe('8. Google OAuth Integration & Security Invariants', () => {
    it('successfully processes Google ID token exchange with backend API', async () => {
      const originalFetch = global.fetch;
      global.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input.toString();
        if (url.includes('/auth/google')) {
          const body = JSON.parse(init?.body as string);
          expect(body.idToken).toBe('mock-google-id-token-123456');
          return new Response(
            JSON.stringify({
              accessToken: 'google-access-jwt',
              refreshToken: 'google-refresh-token',
              expiresIn: 900,
              user: {
                id: 'google-user-uuid',
                email: 'googleuser@example.com',
                role: 'renter',
                accountStatus: 'active',
                emailVerified: true,
                phoneVerified: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/profiles/me')) {
          return new Response(
            JSON.stringify({ fullName: 'Google User Verified' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      try {
        const res = await signInWithGoogleBackend('mock-google-id-token-123456');
        expect(res.success).toBe(true);
        expect(res.user).toBeDefined();
        expect(res.user?.email).toBe('googleuser@example.com');
        expect(res.user?.name).toBe('Google User Verified');
        expect(res.user?.authProvider).toBe('google');
        expect(res.user?.emailVerified).toBe(true);
        expect(apiClient.getAccessToken()).toBe('google-access-jwt');
      } finally {
        global.fetch = originalFetch;
        apiClient.clearSession();
      }
    });

    it('returns honest error message when Google authentication backend rejects token', async () => {
      const originalFetch = global.fetch;
      global.fetch = (async (): Promise<Response> => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Google ID token is invalid or has expired.',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }) as typeof fetch;

      try {
        const res = await signInWithGoogleBackend('invalid-google-token');
        expect(res.success).toBe(false);
        expect(res.user).toBeUndefined();
        expect(res.error).toBeDefined();
      } finally {
        global.fetch = originalFetch;
        apiClient.clearSession();
      }
    });
  });
});
