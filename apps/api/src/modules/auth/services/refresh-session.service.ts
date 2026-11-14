import { ERROR_CODES, type UserRole } from '@aashvo/contracts';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../infrastructure/config/env.schema';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../audit/audit.module';

export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

@Injectable()
export class RefreshSessionService {
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.refreshTtlDays = configService.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
  }

  private buildExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  async createSession(params: {
    userId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    clientPlatform?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<{ rawRefreshToken: string; familyId: string; expiresAt: Date }> {
    const client = params.tx ?? this.prisma;
    const rawRefreshToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const familyId = randomUUID();
    const expiresAt = this.buildExpiryDate();

    await client.refreshSession.create({
      data: {
        userId: params.userId,
        familyId,
        tokenHash,
        userAgent: params.userAgent?.slice(0, 500) ?? null,
        ipAddress: params.ipAddress ?? null,
        clientPlatform: params.clientPlatform ?? 'web',
        expiresAt,
      },
    });

    return { rawRefreshToken, familyId, expiresAt };
  }

  async rotateSession(params: {
    rawRefreshToken: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    clientPlatform?: string;
    requestId?: string | null;
  }): Promise<{
    userId: string;
    role: UserRole;
    familyId: string;
    newRefreshToken: string;
    expiresAt: Date;
  }> {
    const presentedHash = hashOpaqueToken(params.rawRefreshToken);

    const existing = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: presentedHash },
      include: {
        user: {
          select: { id: true, role: true, accountStatus: true },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid refresh session.',
      });
    }

    // Reuse detection: any replay of an already-rotated or revoked token kills the whole family.
    if (existing.revokedAt !== null || existing.replacedByHash !== null) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.refreshSession.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: 'refresh_token_reuse_detected',
          },
        });

        await this.audit.record(
          {
            actorId: existing.userId,
            actorRole: existing.user.role,
            eventType: 'auth.refresh_replay_detected',
            entityType: 'refresh_session',
            entityId: existing.familyId,
            outcome: 'denied',
            ipAddress: params.ipAddress,
            requestId: params.requestId,
          },
          tx,
        );
      });

      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED,
        message: 'Session invalidated due to refresh token reuse.',
      });
    }

    if (existing.expiresAt <= new Date()) {
      await this.prisma.refreshSession.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), revokedReason: 'expired' },
      });
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Refresh session expired.',
      });
    }

    if (existing.user.accountStatus !== 'active') {
      await this.revokeAllForUser(existing.userId, 'account_inactive');
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Account is not active.',
      });
    }

    const newRefreshToken = generateOpaqueToken();
    const newHash = hashOpaqueToken(newRefreshToken);
    const expiresAt = this.buildExpiryDate();

    const rotatedCount = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.refreshSession.updateMany({
        where: { id: existing.id, revokedAt: null, replacedByHash: null },
        data: {
          revokedAt: new Date(),
          replacedByHash: newHash,
          revokedReason: 'rotated',
        },
      });

      if (updated.count === 0) {
        return 0;
      }

      await tx.refreshSession.create({
        data: {
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: newHash,
          userAgent: params.userAgent?.slice(0, 500) ?? existing.userAgent,
          ipAddress: params.ipAddress ?? existing.ipAddress,
          clientPlatform: params.clientPlatform ?? existing.clientPlatform,
          expiresAt,
        },
      });

      return 1;
    });

    if (rotatedCount === 0) {
      await this.revokeFamilyById(existing.familyId, 'refresh_token_reuse_detected');
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED,
        message: 'Session invalidated due to concurrent refresh reuse.',
      });
    }

    return {
      userId: existing.userId,
      role: existing.user.role,
      familyId: existing.familyId,
      newRefreshToken,
      expiresAt,
    };
  }

  async revokeFamilyByToken(rawRefreshToken: string, reason = 'logout'): Promise<string | null> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: { familyId: true, userId: true },
    });
    if (!session) return null;

    await this.prisma.refreshSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    return session.userId;
  }

  async revokeFamilyById(familyId: string, reason = 'logout'): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason = 'logout_all',
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async isSessionFamilyActive(familyId: string): Promise<boolean> {
    const active = await this.prisma.refreshSession.findFirst({
      where: {
        familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    return Boolean(active);
  }
}
