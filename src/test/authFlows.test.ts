import { describe, it, expect } from 'vitest';
import {
  registerWithEmail,
  confirmUserEmail,
  initiateGoogleOAuth,
  handleOAuthCallback,
  requestPasswordReset,
  linkIdentityAccounts,
  evaluateActionEligibility,
  isValidEmail,
  isValidPassword,
} from '../services/authService';
import { User } from '../types';

describe('Aashvo Authentication Flows & Account Security', () => {
  const allowedOrigins = ['http://localhost:5173', 'https://aashvo.in', 'https://staging.aashvo.in'];

  // Test 1: Successful email/password registration
  it('registers a user with email and password in an initial unverified state', () => {
    const validParams = {
      email: 'rohan.tech@example.com',
      password: 'SecurePassword123!',
      fullName: 'Rohan Varma',
    };

    const result = registerWithEmail(validParams);
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe('rohan.tech@example.com');
    expect(result.user?.name).toBe('Rohan Varma');
    expect(result.user?.role).toBe('renter');
    expect(result.user?.emailVerified).toBe(false); // Email verification required
    expect(result.user?.accountStatus).toBe('unverified');
    expect(result.user?.authProvider).toBe('email');

    // Duplicate registration rejection
    const duplicateResult = registerWithEmail(validParams);
    expect(duplicateResult.success).toBe(false);
    expect(duplicateResult.error).toContain('already exists');
  });

  it('rejects registration with weak passwords or invalid email formats', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('rohan@example.com')).toBe(true);

    const weakPassword = isValidPassword('short');
    expect(weakPassword.valid).toBe(false);
    expect(weakPassword.reason).toContain('8 characters');

    const noSpecialOrDigit = isValidPassword('allletterslowercase');
    expect(noSpecialOrDigit.valid).toBe(false);
    expect(noSpecialOrDigit.reason).toContain('digit or special character');
  });

  // Test 2: Rejection of unverified email accounts where verification is required
  it('rejects protected actions for unverified email accounts until verification token confirms email', () => {
    const email = 'priya.student@example.com';
    const regResult = registerWithEmail({
      email,
      password: 'StrongPassword99#',
      fullName: 'Priya Sharma',
    });

    const unverifiedUser = regResult.user!;
    expect(unverifiedUser.emailVerified).toBe(false);

    // Attempting an inquiry with unverified email must be rejected
    const eligibilityBefore = evaluateActionEligibility(unverifiedUser, 'submit_inquiry');
    expect(eligibilityBefore.canPerform).toBe(false);
    expect(eligibilityBefore.missingRequirements).toContain('Email address must be verified.');

    // Confirm email via verification token
    const confirmed = confirmUserEmail(email);
    expect(confirmed).toBe(true);
    expect(unverifiedUser.emailVerified).toBe(true);
    expect(unverifiedUser.accountStatus).toBe('active');
  });

  // Test 3: Google OAuth success and failure handling
  describe('Google OAuth PKCE & Origin Security', () => {
    it('initiates Google OAuth with secure PKCE challenge and state parameter for allowed origins', async () => {
      const redirectUri = 'https://aashvo.in/auth/callback';
      const oauthInit = await initiateGoogleOAuth({
        provider: 'google',
        redirectTo: redirectUri,
        allowedOrigins,
      });

      expect(oauthInit.authUrl).toContain('https://auth.aashvo.in/auth/v1/authorize');
      expect(oauthInit.authUrl).toContain('provider=google');
      expect(oauthInit.authUrl).toContain('scope=openid+email+profile');
      expect(oauthInit.state).toBeDefined();
      expect(oauthInit.state.length).toBeGreaterThanOrEqual(16);
      expect(oauthInit.codeVerifier).toBeDefined();
    });

    it('rejects Google OAuth initiation for unauthorized redirect origins', async () => {
      const maliciousRedirect = 'https://malicious-phishing-site.com/steal-token';
      await expect(initiateGoogleOAuth({
          provider: 'google',
          redirectTo: maliciousRedirect,
          allowedOrigins,
        })).rejects.toThrow('Unauthorized OAuth redirect origin');
    });

    it('handles OAuth callback successfully when state matches and code is valid', () => {
      const storedState = 'secure-state-12345';
      const result = handleOAuthCallback({
        code: 'valid-google-auth-code',
        state: 'secure-state-12345',
        storedState,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.authProvider).toBe('google');
      expect(result.user?.emailVerified).toBe(true); // OAuth email is pre-verified
      expect(result.user?.role).toBe('renter');
    });

    it('rejects OAuth callback on CSRF state mismatch or provider errors', () => {
      // CSRF state mismatch
      const csrfResult = handleOAuthCallback({
        code: 'valid-code',
        state: 'attacker-tampered-state',
        storedState: 'legitimate-session-state',
      });
      expect(csrfResult.success).toBe(false);
      expect(csrfResult.error).toContain('OAuth state mismatch');

      // Provider error response (e.g. user denied consent)
      const errorResult = handleOAuthCallback({
        code: '',
        state: 'state',
        storedState: 'state',
        error: 'access_denied',
        errorDescription: 'User cancelled Google sign in dialog',
      });
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('User cancelled Google sign in');
    });
  });

  // Test 4: Password recovery and session/identity linking behavior
  describe('Password Recovery & Identity Linking Security', () => {
    it('dispatches password reset request with neutral messaging to prevent user enumeration', () => {
      const resExisting = requestPasswordReset('rohan.tech@example.com');
      expect(resExisting.success).toBe(true);
      expect(resExisting.message).toContain('If an account exists');

      const resNonExistent = requestPasswordReset('unknown.user@example.com');
      expect(resNonExistent.success).toBe(true);
      expect(resNonExistent.message).toContain('If an account exists');

      const resInvalid = requestPasswordReset('invalid-email-format');
      expect(resInvalid.success).toBe(false);
    });

    it('rejects automatic account merge of unverified email accounts with Google OAuth (anti-hijack)', () => {
      const unverifiedEmailUser: User = {
        id: 'usr-1',
        name: 'Target User',
        email: 'target@example.com',
        role: 'renter',
        emailVerified: false, // Unverified
        authProvider: 'email',
      };

      // Attacker tries to register Google OAuth with same email to hijack unverified account
      const linkAttempt = linkIdentityAccounts(
        unverifiedEmailUser,
        'google',
        'target@example.com',
        true
      );

      expect(linkAttempt.allowed).toBe(false);
      expect(linkAttempt.reason).toContain('Cannot link OAuth to an unverified email account');
    });

    it('allows identity linking when both email identities are verified and match', () => {
      const verifiedEmailUser: User = {
        id: 'usr-2',
        name: 'Verified User',
        email: 'verified@example.com',
        role: 'renter',
        emailVerified: true,
        authProvider: 'email',
      };

      const linkAttempt = linkIdentityAccounts(
        verifiedEmailUser,
        'google',
        'verified@example.com',
        true
      );

      expect(linkAttempt.allowed).toBe(true);
    });
  });
});
