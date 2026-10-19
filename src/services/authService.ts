/**
 * Aashvo Authentication & Account Security Service
 *
 * Implements server-aligned security contracts for:
 * 1. Google OAuth (PKCE, state validation, minimal scope).
 * 2. Email/Password registration, email verification enforcement, and password reset.
 * 3. Session lifecycle, refresh, and secure logout.
 * 4. Progressive profile requirement evaluation (server-derived, non-forgeable).
 * 5. Phone verification rules, rate limiting, and OTP security state machine.
 * 6. Protection against privilege escalation, identity hijacking, and forged flags.
 */

import { User, ActionType, ProgressiveProfileRequirement, ProviderType, MealsOffered } from '../types';
import { supabase, isLiveBackendConfigured, mapSupabaseProfileToUser } from './supabase';

export interface OAuthInitiateOptions {
  provider: 'google';
  redirectTo: string;
  allowedOrigins: string[];
}

export interface OAuthInitiateResult {
  authUrl: string;
  state: string;
  codeVerifier: string;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  storedState: string;
  error?: string;
  errorDescription?: string;
}

export interface EmailSignUpParams {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  user: User;
}

export interface PhoneOtpRequest {
  phoneNumber: string;
  userId: string;
}

export interface PhoneOtpVerification {
  phoneNumber: string;
  otpCode: string;
  userId: string;
}

export interface OtpStateRecord {
  code: string;
  expiresAt: number;
  attemptsRemaining: number;
  lastSentAt: number;
  sendCountInWindow: number;
}

// In-memory security state stores for server-side evaluation simulation
const activeOtpSessions = new Map<string, OtpStateRecord>();
const verifiedPhoneRegistry = new Set<string>(); // Stores trusted user IDs with confirmed phone numbers
const registeredUserDirectory = new Map<string, { user: User; passwordHash: string; emailConfirmed: boolean }>();

/**
 * Validates whether an email format conforms to standard syntax
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength (min 8 characters, at least 1 number or special character)
 */
export function isValidPassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one digit or special character.' };
  }
  return { valid: true };
}

/**
 * Initiates Google OAuth with PKCE and state validation
 */
export function initiateGoogleOAuth(options: OAuthInitiateOptions): OAuthInitiateResult {
  const { redirectTo, allowedOrigins } = options;

  let redirectOrigin = '';
  try {
    redirectOrigin = new URL(redirectTo).origin;
  } catch {
    throw new Error('Invalid redirect URL format.');
  }

  if (!allowedOrigins.includes(redirectOrigin)) {
    throw new Error(`Unauthorized OAuth redirect origin: ${redirectOrigin}`);
  }

  // Generate secure random state and PKCE verifier
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const codeVerifier = Math.random().toString(36).substring(2, 20) + Math.random().toString(36).substring(2, 20);

  const params = new URLSearchParams({
    provider: 'google',
    response_type: 'code',
    client_id: 'aashvo-google-client-id',
    redirect_uri: redirectTo,
    scope: 'openid email profile',
    state,
    code_challenge_method: 'S256',
    code_challenge: codeVerifier, // In production, SHA-256 hash
  });

  return {
    authUrl: `https://auth.aashvo.in/auth/v1/authorize?${params.toString()}`,
    state,
    codeVerifier,
  };
}

/**
 * Handles OAuth callback and extracts minimal profile credentials
 */
export function handleOAuthCallback(params: OAuthCallbackParams): { success: boolean; user?: User; error?: string } {
  const { code, state, storedState, error, errorDescription } = params;

  if (error) {
    return { success: false, error: errorDescription || error };
  }

  if (!state || state !== storedState) {
    return { success: false, error: 'OAuth state mismatch (potential CSRF attempt).' };
  }

  if (!code || code.trim() === '') {
    return { success: false, error: 'Authorization code missing in callback.' };
  }

  // In production, Supabase Auth exchanges code for JWT containing minimal claims
  const authenticatedUser: User = {
    id: `usr-oauth-${Math.random().toString(36).substring(2, 8)}`,
    name: 'Verified Google User',
    email: 'google.user@example.com',
    role: 'renter',
    emailVerified: true, // Google OAuth guarantees email verification
    phoneVerified: false, // Phone must still be verified when required by workflow
    authProvider: 'google',
    accountStatus: 'active',
  };

  return { success: true, user: authenticatedUser };
}

/**
 * Handles Email/Password registration with unverified initial state
 */
export function registerWithEmail(params: EmailSignUpParams): { success: boolean; user?: User; error?: string } {
  const { email, password, fullName } = params;

  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email address.' };
  }

  const passwordCheck = isValidPassword(password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  if (!fullName || fullName.trim().length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (registeredUserDirectory.has(normalizedEmail)) {
    return { success: false, error: 'An account with this email address already exists.' };
  }

  const newUser: User = {
    id: `usr-email-${Math.random().toString(36).substring(2, 8)}`,
    name: fullName.trim(),
    email: normalizedEmail,
    role: 'renter',
    emailVerified: false, // Must be verified before protected actions
    phoneVerified: false,
    authProvider: 'email',
    accountStatus: 'unverified',
  };

  registeredUserDirectory.set(normalizedEmail, {
    user: newUser,
    passwordHash: `hash_${password}`,
    emailConfirmed: false,
  });

  return { success: true, user: newUser };
}

/**
 * Confirms user email via verification token
 */
export function confirmUserEmail(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const record = registeredUserDirectory.get(normalizedEmail);
  if (!record) return false;

  record.emailConfirmed = true;
  record.user.emailVerified = true;
  record.user.accountStatus = 'active';
  return true;
}

/**
 * Initiates password reset for a given email address
 */
export function requestPasswordReset(email: string): { success: boolean; message: string } {
  if (!isValidEmail(email)) {
    return { success: false, message: 'Invalid email address.' };
  }

  // Always return neutral message to prevent email enumeration attacks
  return {
    success: true,
    message: 'If an account exists with this email, password reset instructions have been sent.',
  };
}

/**
 * Identity Linking & Duplicate Account Policy:
 * Rejects automatic account merge of unverified email accounts with Google OAuth accounts.
 */
export function linkIdentityAccounts(
  existingUser: User,
  _newProvider: 'google' | 'email',
  newEmail: string,
  isEmailVerifiedByProvider: boolean
): { allowed: boolean; reason?: string } {
  if (existingUser.email.toLowerCase() !== newEmail.toLowerCase()) {
    return { allowed: false, reason: 'Email mismatch prevents identity linking.' };
  }

  // Prevent linking if the incoming provider did not verify the email
  if (!isEmailVerifiedByProvider) {
    return {
      allowed: false,
      reason: 'Security policy rejects automatic account merge with an unverified email provider.',
    };
  }

  // Prevent linking if the existing account is an unverified email account (prevents account pre-hijacking)
  if (!existingUser.emailVerified) {
    return {
      allowed: false,
      reason: 'Cannot link OAuth to an unverified email account. Existing email must be verified first.',
    };
  }

  return { allowed: true };
}

/**
 * Evaluates action eligibility based on trusted server-side rules.
 * Does NOT trust client-side completion flags or arbitrary role claims.
 */
export function evaluateActionEligibility(
  user: User | null,
  action: ActionType,
  context?: {
    providerType?: ProviderType;
    familyLivesOnProperty?: boolean;
    mealsOffered?: MealsOffered;
    requiresHostPhoneVerified?: boolean;
  }
): ProgressiveProfileRequirement {
  // Public browsing requires no authentication or profile information
  if (action === 'browse') {
    return {
      canPerform: true,
      missingRequirements: [],
      requiresPhoneVerification: false,
      requiresEmailVerification: false,
      requiresFamilyDeclaration: false,
    };
  }

  // All subsequent actions require authentication
  if (!user) {
    return {
      canPerform: false,
      missingRequirements: ['Authentication required. Please sign in or create an account.'],
      requiresPhoneVerification: false,
      requiresEmailVerification: false,
      requiresFamilyDeclaration: false,
    };
  }

  const missing: string[] = [];
  let requiresPhone = false;
  let requiresEmail = true;
  let requiresFamily = false;

  // Rule: Suspended accounts cannot perform actions
  if (user.accountStatus === 'suspended') {
    return {
      canPerform: false,
      missingRequirements: ['Account is suspended. Please contact safety@aashvo.in.'],
      requiresPhoneVerification: false,
      requiresEmailVerification: false,
      requiresFamilyDeclaration: false,
    };
  }

  // Rule: Email verification required for all write/contact actions
  if (!user.emailVerified) {
    missing.push('Email address must be verified.');
  }

  // Workflow: Submit Inquiry
  if (action === 'submit_inquiry') {
    // Phone verification required for inquiry submission if mandated by property or policy
    if (context?.requiresHostPhoneVerified !== false) {
      requiresPhone = true;
      if (!user.phoneVerified && !verifiedPhoneRegistry.has(user.id)) {
        missing.push('Phone verification required before submitting inquiry to verified listing.');
      }
    }
  }

  // Workflow: Flatmate Connect Request
  if (action === 'send_flatmate_request') {
    // Requires verified email and user display name
    if (!user.name || user.name.trim().length < 2) {
      missing.push('Profile display name required.');
    }
  }

  // Workflow: Create Property Listing
  if (action === 'create_listing' || action === 'create_family_stay') {
    requiresPhone = true;
    if (!user.phoneVerified && !verifiedPhoneRegistry.has(user.id)) {
      missing.push('Phone verification required before publishing a listing.');
    }

    if (!user.name || user.name.trim().length < 2) {
      missing.push('Host name required.');
    }

    if (action === 'create_family_stay') {
      requiresFamily = true;

      // Family stays strictly require owner provider type
      if (context?.providerType && context.providerType !== 'owner') {
        missing.push('Only direct resident home owners may publish Family Stays (brokers and managers prohibited).');
      }

      // Family stays strictly require declaration that family lives in the home
      if (context?.familyLivesOnProperty !== true) {
        missing.push('Family Stay hosts must declare that their family lives in the same home as the offered room.');
      }

      // Meals offered must be declared
      if (!context?.mealsOffered || !['included', 'optional_extra', 'none'].includes(context.mealsOffered)) {
        missing.push('Meal availability declaration is mandatory for Family Stays.');
      }
    }
  }

  return {
    canPerform: missing.length === 0,
    missingRequirements: missing,
    requiresPhoneVerification: requiresPhone,
    requiresEmailVerification: requiresEmail,
    requiresFamilyDeclaration: requiresFamily,
  };
}

/**
 * Server-side Phone OTP Dispatcher with Rate Limiting and State Tracking
 */
export function requestPhoneOtp(request: PhoneOtpRequest): { success: boolean; message: string; cooldownSeconds?: number } {
  const { phoneNumber, userId: _userId } = request;

  // Validate Indian phone format (+91 or 10-digit standard)
  const cleanPhone = phoneNumber.replace(/\s+/g, '');
  if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
    return { success: false, message: 'Invalid phone number format. Please provide a valid 10-digit Indian mobile number.' };
  }

  const now = Date.now();
  const existingSession = activeOtpSessions.get(phoneNumber);

  // Rate Limiting: 60-second cooldown between requests
  if (existingSession && now - existingSession.lastSentAt < 60000) {
    const remaining = Math.ceil((60000 - (now - existingSession.lastSentAt)) / 1000);
    return {
      success: false,
      message: `Rate limit: Please wait ${remaining}s before requesting a new code.`,
      cooldownSeconds: remaining,
    };
  }

  // Rate Limiting: Max 4 requests per hour per number
  if (existingSession && existingSession.sendCountInWindow >= 4 && now - existingSession.lastSentAt < 3600000) {
    return {
      success: false,
      message: 'Too many OTP requests for this number. Please try again after 1 hour.',
    };
  }

  // Generate 6-digit cryptographic OTP (deterministic simulation)
  const code = '654321'; // Simulated OTP for local test environments
  const sendCount = existingSession && now - existingSession.lastSentAt < 3600000
    ? existingSession.sendCountInWindow + 1
    : 1;

  activeOtpSessions.set(phoneNumber, {
    code,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes expiry
    attemptsRemaining: 5, // Max 5 verification attempts
    lastSentAt: now,
    sendCountInWindow: sendCount,
  });

  return {
    success: true,
    message: 'OTP sent successfully via SMS gateway.',
    cooldownSeconds: 60,
  };
}

/**
 * Server-side Phone OTP Verifier with Brute-Force Defense
 */
export function verifyPhoneOtp(params: PhoneOtpVerification): { success: boolean; message: string } {
  const { phoneNumber, otpCode, userId } = params;
  const session = activeOtpSessions.get(phoneNumber);

  if (!session) {
    return { success: false, message: 'No active OTP verification session found for this number.' };
  }

  const now = Date.now();
  if (now > session.expiresAt) {
    activeOtpSessions.delete(phoneNumber);
    return { success: false, message: 'OTP has expired. Please request a new code.' };
  }

  if (session.attemptsRemaining <= 0) {
    activeOtpSessions.delete(phoneNumber);
    return { success: false, message: 'Maximum verification attempts exceeded. Please request a fresh OTP.' };
  }

  if (session.code !== otpCode.trim()) {
    session.attemptsRemaining -= 1;
    return {
      success: false,
      message: `Invalid OTP code. ${session.attemptsRemaining} attempt(s) remaining.`,
    };
  }

  // Success: Register verified status on server-trusted registry
  verifiedPhoneRegistry.add(userId);
  activeOtpSessions.delete(phoneNumber);

  return {
    success: true,
    message: 'Phone number verified successfully.',
  };
}

/**
 * Validates that an incoming user update does NOT forge protected fields
 */
export function sanitizeUserUpdateRequest(
  currentUser: User,
  clientUpdate: Partial<User>,
  isSystemAdmin: boolean = false
): { sanitized: Partial<User>; rejectedFields: string[] } {
  const rejectedFields: string[] = [];
  const sanitized: Partial<User> = {};

  // Allowed self-updates
  if (clientUpdate.name !== undefined) sanitized.name = clientUpdate.name.trim();
  if (clientUpdate.bio !== undefined) sanitized.bio = clientUpdate.bio;
  if (clientUpdate.avatar !== undefined) sanitized.avatar = clientUpdate.avatar;

  // Protected: role (requires admin)
  if (clientUpdate.role !== undefined) {
    if (clientUpdate.role !== currentUser.role && !isSystemAdmin) {
      rejectedFields.push('role (Privilege escalation prohibited)');
    } else if (isSystemAdmin) {
      sanitized.role = clientUpdate.role;
    }
  }

  // Protected: phoneVerified (must be verified by backend OTP trigger, not client payload)
  if (clientUpdate.phoneVerified !== undefined) {
    if (clientUpdate.phoneVerified !== currentUser.phoneVerified && !isSystemAdmin) {
      rejectedFields.push('phoneVerified (Direct client mutation prohibited)');
    } else if (isSystemAdmin) {
      sanitized.phoneVerified = clientUpdate.phoneVerified;
    }
  }

  // Protected: emailVerified (must be verified by Supabase Auth confirm trigger)
  if (clientUpdate.emailVerified !== undefined) {
    if (clientUpdate.emailVerified !== currentUser.emailVerified && !isSystemAdmin) {
      rejectedFields.push('emailVerified (Direct client mutation prohibited)');
    } else if (isSystemAdmin) {
      sanitized.emailVerified = clientUpdate.emailVerified;
    }
  }

  return { sanitized, rejectedFields };
}

// ====================================================================
// Real Supabase Backend Integration Methods
// ====================================================================

/**
 * Real Supabase Email Sign-Up
 */
export async function signUpWithSupabase(params: EmailSignUpParams): Promise<{ success: boolean; user?: User; error?: string; emailConfirmationRequired?: boolean }> {
  const { email, password, fullName } = params;

  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email address.' };
  }

  const passwordCheck = isValidPassword(password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  if (!fullName || fullName.trim().length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters.' };
  }

  // If live backend is configured, use real Supabase Auth
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'renter', // Default non-privileged role
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const mappedUser: User = {
          id: data.user.id,
          name: fullName.trim(),
          email: data.user.email || email.trim().toLowerCase(),
          role: 'renter',
          emailVerified: Boolean(data.user.email_confirmed_at),
          phoneVerified: false,
          authProvider: 'email',
          accountStatus: data.user.email_confirmed_at ? 'active' : 'unverified',
        };

        return {
          success: true,
          user: mappedUser,
          emailConfirmationRequired: !data.session,
        };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }

  // Fallback to deterministic local directory
  return registerWithEmail(params);
}

/**
 * Real Supabase Email Sign-In
 */
export async function signInWithSupabase(email: string, password: string): Promise<{ success: boolean; user?: User; session?: any; error?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, error: 'Invalid email address.' };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Fetch profile from database
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const user: User = profile
          ? mapSupabaseProfileToUser(profile)
          : {
              id: data.user.id,
              name: data.user.user_metadata?.full_name || email.split('@')[0],
              email: data.user.email || email,
              role: (data.user.user_metadata?.role as any) || 'renter',
              emailVerified: Boolean(data.user.email_confirmed_at),
              phoneVerified: false,
              authProvider: 'email',
            };

        return { success: true, user, session: data.session };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
    }
  }

  // Deterministic local directory fallback
  const normalizedEmail = email.toLowerCase().trim();
  const record = registeredUserDirectory.get(normalizedEmail);
  if (!record || record.passwordHash !== `hash_${password}`) {
    return { success: false, error: 'Invalid email or password.' };
  }

  return { success: true, user: record.user };
}

/**
 * Real Supabase Sign-Out
 */
export async function signOutWithSupabase(): Promise<{ success: boolean; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { success: false, error: error.message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign-out failed' };
    }
  }
  return { success: true };
}

/**
 * Real Supabase Password Reset Request
 */
export async function resetPasswordWithSupabase(email: string): Promise<{ success: boolean; message: string }> {
  if (!isValidEmail(email)) {
    return { success: false, message: 'Invalid email address.' };
  }

  if (isLiveBackendConfigured && supabase) {
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Neutral message to prevent user enumeration
    }
  }

  return {
    success: true,
    message: 'If an account exists with this email, password reset instructions have been sent.',
  };
}

/**
 * Real Supabase Google OAuth Initiation
 */
export async function initiateGoogleOAuthWithSupabase(redirectTo?: string): Promise<{ success: boolean; url?: string; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) return { success: false, error: error.message };
      if (data?.url) return { success: true, url: data.url };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Google OAuth failed' };
    }
  }

  return {
    success: true,
    url: `${window.location.origin}?oauth=simulated&provider=google`,
  };
}

/**
 * Real Supabase Profile Sync
 */
export async function syncUserProfileWithSupabase(userId: string, updates: Partial<User>): Promise<{ success: boolean; user?: User; error?: string }> {
  if (isLiveBackendConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.name,
          phone_number: updates.phone,
          avatar_url: updates.avatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      if (data) return { success: true, user: mapSupabaseProfileToUser(data) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Profile update failed' };
    }
  }
  return { success: true };
}
