import type { AccountStatus, UserRole } from '@aashvo/contracts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  sessionFamilyId: string;
}

export interface UserProfileView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthUserCredentialsRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  passwordHashAlgorithm: string | null;
  passwordResetRequired: boolean;
  role: UserRole;
  accountStatus: AccountStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  profile: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    emailVerified: boolean;
    phoneVerified: boolean;
    idVerified: boolean;
    avatarUrl: string | null;
    createdAt: Date;
  } | null;
}
