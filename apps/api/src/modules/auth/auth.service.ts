import { ERROR_CODES, type UserRole } from '@aashvo/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, type Prisma } from '@prisma/client';
import type { AppConfig } from '../../infrastructure/config/env.schema';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { UsersService, mapRecordToUserProfileView } from '../users/users.service';
import type { UserProfileView } from '../users/users.types';
import { JwtTokenService } from './services/jwt-token.service';
import { MAIL_DISPATCH_PORT, type MailDispatchPort } from './services/mail-dispatch.port';
import { PasswordService } from './services/password.service';
import {
  RefreshSessionService,
  generateOpaqueToken,
  hashOpaqueToken,
} from './services/refresh-session.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  clientPlatform: 'web' | 'ios' | 'android';
}

export interface IssuedAuthSession {
  accessToken: string;
  expiresIn: number;
  rawRefreshToken: string;
  refreshExpiresAt: Date;
  user: UserProfileView;
}

@Injectable()
export class AuthService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly audit: AuditService,
    @Inject(MAIL_DISPATCH_PORT) private readonly mailDispatch: MailDispatchPort,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.webAppUrl = configService.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  async register(
    input: {
      email: string;
      password: string;
      fullName: string;
      accountType?: 'renter' | 'owner' | 'broker';
    },
    meta: RequestMetadata,
  ): Promise<IssuedAuthSession> {
    const passwordHash = await this.passwordService.hashPassword(input.password);
    const rawVerificationToken = generateOpaqueToken();
    const verificationTokenHash = hashOpaqueToken(rawVerificationToken);
    const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    const user = await this.usersService.createUserWithProfile({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      role: input.accountType ?? 'renter',
      verificationTokenHash,
      verificationExpiresAt,
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });

    try {
      await this.mailDispatch.sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        rawToken: rawVerificationToken,
        expiresAt: verificationExpiresAt,
        actionUrl: `${this.webAppUrl}/auth/verify-email`,
      });
    } catch (mailErr) {
      await this.audit.record({
        actorId: user.id,
        actorRole: user.role,
        eventType: 'auth.email_dispatch_failed',
        entityType: 'user',
        entityId: user.id,
        outcome: 'failure',
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        metadata: {
          purpose: 'email_verification',
          recipient: user.email,
          error: mailErr instanceof Error ? mailErr.message : 'unknown',
        },
      });
    }

    const session = await this.refreshSessions.createSession({
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      clientPlatform: meta.clientPlatform,
    });

    const accessToken = this.jwtTokenService.signAccessToken({
      userId: user.id,
      role: user.role,
      sessionFamilyId: session.familyId,
    });

    return {
      accessToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      rawRefreshToken: session.rawRefreshToken,
      refreshExpiresAt: session.expiresAt,
      user,
    };
  }

  async login(
    input: { email: string; password: string },
    meta: RequestMetadata,
  ): Promise<IssuedAuthSession> {
    const userRecord = await this.usersService.findForLoginByEmail(input.email);

    if (!userRecord || !userRecord.passwordHash) {
      await this.passwordService.consumeDummyVerify(input.password);
      await this.audit.record({
        eventType: 'auth.login',
        entityType: 'user',
        outcome: 'failure',
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    if (userRecord.accountStatus !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Account is suspended or inactive.',
      });
    }

    if (userRecord.lockedUntil && userRecord.lockedUntil > new Date()) {
      await this.audit.record({
        actorId: userRecord.id,
        actorRole: userRecord.role,
        eventType: 'auth.login',
        entityType: 'user',
        entityId: userRecord.id,
        outcome: 'denied',
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        metadata: { reason: 'account_locked' },
      });
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'Too many failed login attempts. Please try again later.',
      });
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      userRecord.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      await this.usersService.recordFailedLogin(userRecord.id, userRecord.failedLoginAttempts);
      await this.audit.record({
        actorId: userRecord.id,
        actorRole: userRecord.role,
        eventType: 'auth.login',
        entityType: 'user',
        entityId: userRecord.id,
        outcome: 'failure',
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    const { session, userView } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await this.usersService.recordSuccessfulLogin(userRecord.id, tx);

        const createdSession = await this.refreshSessions.createSession({
          userId: userRecord.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          clientPlatform: meta.clientPlatform,
          tx,
        });

        await this.audit.record(
          {
            actorId: userRecord.id,
            actorRole: userRecord.role,
            eventType: 'auth.login',
            entityType: 'user',
            entityId: userRecord.id,
            outcome: 'success',
            ipAddress: meta.ipAddress,
            requestId: meta.requestId,
          },
          tx,
        );

        return {
          session: createdSession,
          userView: mapRecordToUserProfileView(userRecord),
        };
      },
    );

    const accessToken = this.jwtTokenService.signAccessToken({
      userId: userRecord.id,
      role: userRecord.role,
      sessionFamilyId: session.familyId,
    });

    return {
      accessToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      rawRefreshToken: session.rawRefreshToken,
      refreshExpiresAt: session.expiresAt,
      user: userView,
    };
  }

  async refresh(rawRefreshToken: string, meta: RequestMetadata): Promise<IssuedAuthSession> {
    const rotated = await this.refreshSessions.rotateSession({
      rawRefreshToken,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      clientPlatform: meta.clientPlatform,
      requestId: meta.requestId,
    });

    const user = await this.usersService.findProfileById(rotated.userId);
    if (!user || user.accountStatus !== 'active') {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'User account is unavailable.',
      });
    }

    const accessToken = this.jwtTokenService.signAccessToken({
      userId: user.id,
      role: rotated.role,
      sessionFamilyId: rotated.familyId,
    });

    return {
      accessToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      rawRefreshToken: rotated.newRefreshToken,
      refreshExpiresAt: rotated.expiresAt,
      user,
    };
  }

  async logout(params: {
    rawRefreshToken?: string;
    accessToken?: string;
    meta: RequestMetadata;
  }): Promise<void> {
    let actorId: string | null = null;

    if (params.rawRefreshToken) {
      actorId = await this.refreshSessions.revokeFamilyByToken(params.rawRefreshToken, 'logout');
    }

    if (params.accessToken) {
      try {
        const claims = this.jwtTokenService.verifyAccessToken(params.accessToken);
        actorId ??= claims.sub;
        await this.refreshSessions.revokeFamilyById(claims.sid, 'logout');
      } catch {
        // Ignore expired/invalid bearer tokens during logout cleanup.
      }
    }

    if (actorId) {
      await this.audit.record({
        actorId,
        eventType: 'auth.logout',
        entityType: 'refresh_session',
        outcome: 'success',
        ipAddress: params.meta.ipAddress,
        requestId: params.meta.requestId,
      });
    }
  }

  async logoutAll(userId: string, role: UserRole, meta: RequestMetadata): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.refreshSessions.revokeAllForUser(userId, 'logout_all', tx);
      await this.audit.record(
        {
          actorId: userId,
          actorRole: role,
          eventType: 'auth.logout_all',
          entityType: 'user',
          entityId: userId,
          outcome: 'success',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
        tx,
      );
    });
  }

  async verifyEmail(rawToken: string, meta: RequestMetadata): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();

    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true, expiresAt: true, consumedAt: true },
    });

    if (
      !record ||
      record.purpose !== AuthTokenPurpose.email_verification ||
      !record.userId ||
      record.consumedAt !== null ||
      record.expiresAt <= now
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
        message: 'Verification token is invalid or has expired.',
      });
    }

    const userId = record.userId;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.verificationToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });

      if (claimed.count === 0) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
          message: 'Verification token has already been used.',
        });
      }

      await tx.profile.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      await this.audit.record(
        {
          actorId: userId,
          eventType: 'auth.verify_email',
          entityType: 'user',
          entityId: userId,
          outcome: 'success',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
        tx,
      );
    });
  }

  async resendVerification(email: string): Promise<void> {
    const userRecord = await this.usersService.findForLoginByEmail(email);
    if (!userRecord || userRecord.accountStatus !== 'active' || userRecord.profile?.emailVerified) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.verificationToken.updateMany({
        where: {
          userId: userRecord.id,
          purpose: AuthTokenPurpose.email_verification,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      await tx.verificationToken.create({
        data: {
          userId: userRecord.id,
          email: userRecord.email,
          purpose: AuthTokenPurpose.email_verification,
          tokenHash,
          expiresAt,
        },
      });
    });

    try {
      await this.mailDispatch.sendVerificationEmail({
        email: userRecord.email,
        fullName: userRecord.profile?.fullName ?? '',
        rawToken,
        expiresAt,
        actionUrl: `${this.webAppUrl}/auth/verify-email`,
      });
    } catch (mailErr) {
      await this.audit.record({
        actorId: userRecord.id,
        actorRole: userRecord.role,
        eventType: 'auth.email_dispatch_failed',
        entityType: 'user',
        entityId: userRecord.id,
        outcome: 'failure',
        metadata: {
          purpose: 'email_verification_resend',
          recipient: userRecord.email,
          error: mailErr instanceof Error ? mailErr.message : 'unknown',
        },
      });
    }
  }

  async requestPasswordReset(email: string, meta: RequestMetadata): Promise<void> {
    const userRecord = await this.usersService.findForLoginByEmail(email);
    if (!userRecord || userRecord.accountStatus !== 'active') {
      return;
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.verificationToken.updateMany({
        where: {
          userId: userRecord.id,
          purpose: AuthTokenPurpose.password_reset,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      await tx.verificationToken.create({
        data: {
          userId: userRecord.id,
          email: userRecord.email,
          purpose: AuthTokenPurpose.password_reset,
          tokenHash,
          expiresAt,
        },
      });

      await this.audit.record(
        {
          actorId: userRecord.id,
          actorRole: userRecord.role,
          eventType: 'auth.forgot_password_requested',
          entityType: 'user',
          entityId: userRecord.id,
          outcome: 'success',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
        tx,
      );
    });

    try {
      await this.mailDispatch.sendPasswordResetEmail({
        email: userRecord.email,
        fullName: userRecord.profile?.fullName ?? '',
        rawToken,
        expiresAt,
        actionUrl: `${this.webAppUrl}/auth/reset-password`,
      });
    } catch (mailErr) {
      await this.audit.record({
        actorId: userRecord.id,
        actorRole: userRecord.role,
        eventType: 'auth.email_dispatch_failed',
        entityType: 'user',
        entityId: userRecord.id,
        outcome: 'failure',
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        metadata: {
          purpose: 'password_reset',
          recipient: userRecord.email,
          error: mailErr instanceof Error ? mailErr.message : 'unknown',
        },
      });
    }
  }

  async resetPassword(input: { token: string; newPassword: string }, meta: RequestMetadata): Promise<void> {
    const tokenHash = hashOpaqueToken(input.token);
    const now = new Date();

    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true, expiresAt: true, consumedAt: true },
    });

    if (
      !record ||
      record.purpose !== AuthTokenPurpose.password_reset ||
      !record.userId ||
      record.consumedAt !== null ||
      record.expiresAt <= now
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
        message: 'Password reset token is invalid or has expired.',
      });
    }

    const newHash = await this.passwordService.hashPassword(input.newPassword);
    const userId = record.userId;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.verificationToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });

      if (claimed.count === 0) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
          message: 'Password reset token has already been used.',
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          passwordHashAlgorithm: 'argon2id',
          passwordResetRequired: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Kill every active session family so stolen tokens cannot survive password reset.
      await this.refreshSessions.revokeAllForUser(userId, 'password_reset', tx);

      await this.audit.record(
        {
          actorId: userId,
          eventType: 'auth.password_reset',
          entityType: 'user',
          entityId: userId,
          outcome: 'success',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
        tx,
      );
    });
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    meta: RequestMetadata,
  ): Promise<void> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, passwordHash: true },
    });

    if (!userRecord || !userRecord.passwordHash) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Password change is unavailable for this account.',
      });
    }

    const verified = await this.passwordService.verifyPassword(
      userRecord.passwordHash,
      input.currentPassword,
    );
    if (!verified) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Current password is incorrect.',
      });
    }

    const newHash = await this.passwordService.hashPassword(input.newPassword);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          passwordHashAlgorithm: 'argon2id',
          passwordResetRequired: false,
        },
      });

      await this.refreshSessions.revokeAllForUser(userId, 'password_changed', tx);

      await this.audit.record(
        {
          actorId: userId,
          actorRole: userRecord.role,
          eventType: 'auth.password_changed',
          entityType: 'user',
          entityId: userId,
          outcome: 'success',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
        tx,
      );
    });
  }

  async getCurrentProfile(userId: string): Promise<UserProfileView> {
    const user = await this.usersService.findProfileById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'User account was not found.',
      });
    }
    return user;
  }
}
