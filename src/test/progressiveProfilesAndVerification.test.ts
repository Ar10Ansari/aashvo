import { describe, it, expect } from 'vitest';
import {
  evaluateActionEligibility,
  requestPhoneOtp,
  verifyPhoneOtp,
  sanitizeUserUpdateRequest,
} from '../services/authService';
import { User } from '../types';

describe('Progressive Profiles & Phone Verification Policy', () => {
  // Test 5: Public browsing without authentication
  it('allows public browsing without authentication or profile creation', () => {
    const anonymousEligibility = evaluateActionEligibility(null, 'browse');
    expect(anonymousEligibility.canPerform).toBe(true);
    expect(anonymousEligibility.missingRequirements).toHaveLength(0);
    expect(anonymousEligibility.requiresPhoneVerification).toBe(false);
    expect(anonymousEligibility.requiresEmailVerification).toBe(false);
  });

  // Test 6: Authenticated inquiry submission
  it('permits inquiry submission for authenticated users with verified credentials', () => {
    const fullyVerifiedUser: User = {
      id: 'usr-verified-1',
      name: 'Ananya Roy',
      email: 'ananya@example.com',
      role: 'renter',
      emailVerified: true,
      phoneVerified: true,
      accountStatus: 'active',
    };

    const eligibility = evaluateActionEligibility(fullyVerifiedUser, 'submit_inquiry', {
      requiresHostPhoneVerified: true,
    });

    expect(eligibility.canPerform).toBe(true);
    expect(eligibility.missingRequirements).toHaveLength(0);
  });

  it('rejects inquiry submission when user is not authenticated', () => {
    const eligibility = evaluateActionEligibility(null, 'submit_inquiry');
    expect(eligibility.canPerform).toBe(false);
    expect(eligibility.missingRequirements).toContain(
      'Authentication required. Please sign in or create an account.'
    );
  });

  // Test 7: Phone verification required by a workflow and rejected when absent
  describe('Phone Verification State Machine & Workflow Gating', () => {
    it('rejects inquiry submission when phone verification is absent on a verified listing', () => {
      const emailOnlyUser: User = {
        id: 'usr-unverified-phone',
        name: 'Sameer Sen',
        email: 'sameer@example.com',
        role: 'renter',
        emailVerified: true,
        phoneVerified: false, // Phone not yet verified
        accountStatus: 'active',
      };

      const eligibility = evaluateActionEligibility(emailOnlyUser, 'submit_inquiry', {
        requiresHostPhoneVerified: true,
      });

      expect(eligibility.canPerform).toBe(false);
      expect(eligibility.requiresPhoneVerification).toBe(true);
      expect(eligibility.missingRequirements).toContain(
        'Phone verification required before submitting inquiry to verified listing.'
      );
    });

    it('rejects listing creation when host has not completed phone verification', () => {
      const unverifiedHost: User = {
        id: 'usr-host-no-phone',
        name: 'Kapil Dev',
        email: 'kapil@example.com',
        role: 'owner',
        emailVerified: true,
        phoneVerified: false,
      };

      const eligibility = evaluateActionEligibility(unverifiedHost, 'create_listing');
      expect(eligibility.canPerform).toBe(false);
      expect(eligibility.requiresPhoneVerification).toBe(true);
      expect(eligibility.missingRequirements).toContain(
        'Phone verification required before publishing a listing.'
      );
    });

    it('dispatches OTP, enforces rate-limiting cooldown, and confirms on valid code', () => {
      const phoneNumber = '+919811122233';
      const userId = 'usr-otp-test-1';

      // 1. Initial OTP request
      const req1 = requestPhoneOtp({ phoneNumber, userId });
      expect(req1.success).toBe(true);
      expect(req1.message).toContain('OTP sent successfully');

      // 2. Immediate second request within 60s cooldown must be rate-limited
      const req2 = requestPhoneOtp({ phoneNumber, userId });
      expect(req2.success).toBe(false);
      expect(req2.message).toContain('Rate limit');
      expect(req2.cooldownSeconds).toBeGreaterThan(0);

      // 3. Invalid code rejection
      const invalidVerify = verifyPhoneOtp({
        phoneNumber,
        otpCode: '000000',
        userId,
      });
      expect(invalidVerify.success).toBe(false);
      expect(invalidVerify.message).toContain('Invalid OTP code');

      // 4. Valid code verification
      const validVerify = verifyPhoneOtp({
        phoneNumber,
        otpCode: '654321', // Matches deterministic simulated OTP
        userId,
      });
      expect(validVerify.success).toBe(true);
      expect(validVerify.message).toContain('verified successfully');

      // 5. Subsequent inquiry submission now succeeds
      const nowVerifiedUser: User = {
        id: userId,
        name: 'OTP Verified User',
        email: 'otp@example.com',
        role: 'renter',
        emailVerified: true,
        phoneVerified: true,
      };
      const postVerifyEligibility = evaluateActionEligibility(nowVerifiedUser, 'submit_inquiry');
      expect(postVerifyEligibility.canPerform).toBe(true);
    });

    it('locks out verification session after maximum failed attempts (brute-force defense)', () => {
      const phoneNumber = '+919876543210';
      const userId = 'usr-brute-test';

      requestPhoneOtp({ phoneNumber, userId });

      // Simulate 5 consecutive incorrect attempts
      for (let i = 0; i < 5; i++) {
        verifyPhoneOtp({ phoneNumber, otpCode: '111111', userId });
      }

      // 6th attempt must be rejected for exceeding attempt limits
      const lockedResult = verifyPhoneOtp({ phoneNumber, otpCode: '654321', userId });
      expect(lockedResult.success).toBe(false);
      expect(lockedResult.message).toContain('exceeded');
    });
  });

  // Test 8: Rejection of forged verification and profile-completion flags
  describe('Server-Side Anti-Forgery Protections', () => {
    it('strips and rejects client attempts to self-grant phoneVerified status', () => {
      const regularUser: User = {
        id: 'usr-regular-1',
        name: 'Arjun',
        email: 'arjun@example.com',
        role: 'renter',
        phoneVerified: false,
        emailVerified: true,
      };

      // Attacker tries to send PATCH /profiles with { phoneVerified: true }
      const forgedUpdate = {
        name: 'Arjun Updated',
        phoneVerified: true, // Forged flag
      };

      const result = sanitizeUserUpdateRequest(regularUser, forgedUpdate, false);
      expect(result.sanitized.name).toBe('Arjun Updated');
      expect(result.sanitized.phoneVerified).toBeUndefined(); // Stripped!
      expect(result.rejectedFields).toContain('phoneVerified (Direct client mutation prohibited)');
    });

    it('strips and rejects client attempts to self-grant admin role or mutate emailVerified', () => {
      const regularUser: User = {
        id: 'usr-regular-2',
        name: 'Vikas',
        email: 'vikas@example.com',
        role: 'renter',
        phoneVerified: false,
        emailVerified: true,
      };

      const forgedUpdate = {
        role: 'admin' as const,
        emailVerified: false,
      };

      const result = sanitizeUserUpdateRequest(regularUser, forgedUpdate, false);
      expect(result.sanitized.role).toBeUndefined();
      expect(result.sanitized.emailVerified).toBeUndefined();
      expect(result.rejectedFields).toContain('role (Privilege escalation prohibited)');
      expect(result.rejectedFields).toContain('emailVerified (Direct client mutation prohibited)');
    });

    it('permits system administrator to update roles and verification fields', () => {
      const regularUser: User = {
        id: 'usr-regular-3',
        name: 'Suresh',
        email: 'suresh@example.com',
        role: 'renter',
        phoneVerified: false,
      };

      const adminUpdate = {
        role: 'owner' as const,
        phoneVerified: true,
      };

      // Admin update flag = true
      const result = sanitizeUserUpdateRequest(regularUser, adminUpdate, true);
      expect(result.sanitized.role).toBe('owner');
      expect(result.sanitized.phoneVerified).toBe(true);
      expect(result.rejectedFields).toHaveLength(0);
    });
  });
});
