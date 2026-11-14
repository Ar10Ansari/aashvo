import { ERROR_CODES, type UserRole } from '@aashvo/contracts';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthTokenPurpose, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type { AuthUserCredentialsRecord, UserProfileView } from './users.types';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

export function mapRecordToUserProfileView(record: {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: 'active' | 'suspended' | 'deleted_pending';
  createdAt: Date;
  profile: {
    fullName: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    idVerified: boolean;
    avatarUrl: string | null;
  } | null;
}): UserProfileView {
  return {
    id: record.id,
    email: record.email,
    fullName: record.profile?.fullName ?? '',
    role: record.role,
    accountStatus: record.accountStatus,
    emailVerified: record.profile?.emailVerified ?? false,
    phoneVerified: record.profile?.phoneVerified ?? false,
    idVerified: record.profile?.idVerified ?? false,
    avatarUrl: record.profile?.avatarUrl ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createUserWithProfile(params: {
    email: string;
    fullName: string;
    passwordHash: string;
    role?: UserRole;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
    ipAddress?: string | null;
    requestId?: string | null;
  }): Promise<UserProfileView> {
    const requestedRole = params.role ?? 'renter';
    if (requestedRole === 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Administrative accounts cannot be created via public registration.',
      });
    }

    const userId = randomUUID();
    const normalizedEmail = params.email.trim().toLowerCase();

    try {
      const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            id: userId,
            email: normalizedEmail,
            passwordHash: params.passwordHash,
            passwordHashAlgorithm: 'argon2id',
            role: requestedRole,
            accountStatus: 'active',
            profile: {
              create: {
                email: normalizedEmail,
                fullName: params.fullName.trim(),
                role: requestedRole,
                emailVerified: false,
                phoneVerified: false,
                idVerified: false,
              },
            },
          },
          include: { profile: true },
        });

        await tx.verificationToken.create({
          data: {
            userId: user.id,
            email: normalizedEmail,
            purpose: AuthTokenPurpose.email_verification,
            tokenHash: params.verificationTokenHash,
            expiresAt: params.verificationExpiresAt,
          },
        });

        await this.audit.record(
          {
            actorId: user.id,
            actorRole: user.role,
            eventType: 'auth.register',
            entityType: 'user',
            entityId: user.id,
            outcome: 'success',
            ipAddress: params.ipAddress,
            requestId: params.requestId,
            metadata: { role: user.role },
          },
          tx,
        );

        return user;
      });

      return mapRecordToUserProfileView(created);
    } catch (err: unknown) {
      if (isPrismaUniqueViolation(err)) {
        throw new ConflictException({
          code: ERROR_CODES.EMAIL_ALREADY_REGISTERED,
          message: 'An account with this email address already exists.',
        });
      }
      throw err;
    }
  }

  async findForLoginByEmail(email: string): Promise<AuthUserCredentialsRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { profile: true },
    });
  }

  async findProfileById(userId: string): Promise<UserProfileView | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return null;
    return mapRecordToUserProfileView(user);
  }

  async findActiveAuthStatus(userId: string): Promise<{
    id: string;
    email: string;
    role: UserRole;
    accountStatus: 'active' | 'suspended' | 'deleted_pending';
  } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, accountStatus: true },
    });
  }

  async recordFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const nextAttempts = currentAttempts + 1;
    const lockedUntil =
      nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + ACCOUNT_LOCKOUT_MS)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextAttempts,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
    });
  }

  async recordSuccessfulLogin(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }
}
