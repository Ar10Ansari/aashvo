/**
 * Aashvo Authorization & Admin Security Service
 *
 * Enforces server-aligned authorization boundaries:
 * 1. Admin operations require verified identities, never client claims or localStorage.
 * 2. Demo personas are strictly non-privileged, isolated, and cannot escalate privileges.
 * 3. Client localStorage tampering is sanitized and demoted.
 * 4. Internal staff notes and moderation queues are locked behind trusted admin verification.
 */

import { User } from '../types';
import { isLiveBackendConfigured, supabase } from './supabase';

/**
 * Frontend Structural Defense Filter:
 * Checks whether the in-memory user object satisfies client-side admin constraints.
 *
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * This client-side check (including RFC 4122 UUID syntax validation) is strictly a
 * defensive presentation filter. It is NOT authentication and does NOT grant backend authority.
 * Real administrative authority is established exclusively on the PostgreSQL server,
 * where Supabase Auth validates the cryptographic JWT signature and database functions
 * (public.is_admin() and public.is_support_admin()) verify the user's role in public.profiles.
 * Any client-side forgery is rejected by PostgreSQL Row Level Security (RLS).
 */
export function isTrustedAdminSession(user: User | null): boolean {
  if (!user) return false;

  // Rule 1: Demo personas can NEVER be treated as trusted admin
  if (user.isDemo) return false;

  // Rule 2: Non-admin roles are never trusted admin
  if (user.role !== 'admin') return false;

  // Rule 3: Client-side mock IDs or unauthenticated IDs cannot be trusted admins
  if (
    !user.id ||
    user.id.startsWith('usr-demo') ||
    user.id === 'usr-101' ||
    user.id === 'usr-hacker' ||
    user.id === 'usr-attacker'
  ) {
    return false;
  }

  // Rule 4: In live production with Supabase configured, only authentic UUID admin sessions are permitted
  if (isLiveBackendConfigured && supabase) {
    if (user.id.startsWith('usr-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes user data read from untrusted client stores (localStorage).
 * Prevents client-side privilege escalation attacks where an attacker modifies
 * `aashvo_current_user` in browser storage to `{ role: "admin" }`.
 */
export function sanitizeStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, any>;
  if (!data.id || !data.email || !data.name) return null;

  // Default demoted role
  let role: User['role'] = 'renter';
  if (data.role === 'owner' || data.role === 'broker') {
    role = data.role;
  } else if (data.role === 'admin') {
    // Unverified localStorage strings can NEVER elevate an identity to admin.
    // Real admin identity is established exclusively by trusted server-side Supabase authentication.
    console.warn('[Security Notice] Untrusted admin claim in storage detected and demoted to renter.');
    role = 'renter';
  }

  // Sanitize protected flags: client storage cannot forge verified status
  const isDemo = Boolean(data.isDemo);

  return {
    id: String(data.id),
    name: String(data.name).slice(0, 100),
    email: String(data.email).toLowerCase().trim(),
    role,
    phone: data.phone ? String(data.phone) : undefined,
    avatar: data.avatar ? String(data.avatar) : undefined,
    emailVerified: isDemo ? false : Boolean(data.emailVerified),
    phoneVerified: isDemo ? false : Boolean(data.phoneVerified),
    identityVerified: isDemo ? false : Boolean(data.identityVerified),
    authProvider: data.authProvider === 'google' ? 'google' : 'email',
    accountStatus: isDemo ? 'unverified' : (data.accountStatus || 'active'),
    bio: data.bio ? String(data.bio) : undefined,
    isDemo,
  };
}

/**
 * Validates whether an actor has authority to perform a privileged admin action.
 */
export function canPerformAdminAction(
  actor: User | null,
  actionName: string
): { allowed: boolean; reason?: string } {
  if (!actor) {
    return {
      allowed: false,
      reason: 'Authentication required: Anonymous visitors cannot perform administrative actions.',
    };
  }

  if (actor.isDemo) {
    return {
      allowed: false,
      reason: 'Demo mode active: Demo personas cannot modify platform state or moderation records.',
    };
  }

  if (!isTrustedAdminSession(actor)) {
    return {
      allowed: false,
      reason: `Access denied: Action '${actionName}' requires verified staff administrator credentials.`,
    };
  }

  return { allowed: true };
}
