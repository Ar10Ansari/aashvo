import { ERROR_CODES, type UserRole, USER_ROLES } from '@aashvo/contracts';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../infrastructure/config/env.schema';

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  sid: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

const PINNED_ALGORITHM = 'RS256' as const;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSafeJwtHeader(token: string): void {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Invalid access token format.',
    });
  }

  let header: Record<string, unknown>;
  try {
    const decoded = Buffer.from(parts[0], 'base64url').toString('utf8');
    header = JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    throw new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Malformed access token header.',
    });
  }

  // Strictly block alg:none, RS256->HS256 confusion, and dynamic key-loading header claims.
  if (header.alg !== PINNED_ALGORITHM) {
    throw new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Unsupported JWT signing algorithm.',
    });
  }

  if ('jku' in header || 'x5u' in header || 'jwk' in header) {
    throw new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Disallowed JWT key-resolution header parameter.',
    });
  }

  if (typeof header.kid === 'string' && /[./\\]/.test(header.kid)) {
    throw new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Invalid JWT key identifier.',
    });
  }
}

@Injectable()
export class JwtTokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly issuer: string;
  private readonly audience: string;
  readonly accessTtlSeconds: number;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.privateKey = configService.get('JWT_SIGNING_PRIVATE_KEY', { infer: true });
    this.publicKey = configService.get('JWT_SIGNING_PUBLIC_KEY', { infer: true });
    this.issuer = configService.get('JWT_ISSUER', { infer: true });
    this.audience = configService.get('JWT_AUDIENCE', { infer: true });
    this.accessTtlSeconds = configService.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  signAccessToken(input: { userId: string; role: UserRole; sessionFamilyId: string }): string {
    return jwt.sign(
      {
        role: input.role,
        sid: input.sessionFamilyId,
      },
      this.privateKey,
      {
        algorithm: PINNED_ALGORITHM,
        subject: input.userId,
        jwtid: randomUUID(),
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.accessTtlSeconds,
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    assertSafeJwtHeader(token);

    let verified: jwt.JwtPayload | string;
    try {
      verified = jwt.verify(token, this.publicKey, {
        algorithms: [PINNED_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
        complete: false,
      });
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired access token.',
      });
    }

    if (typeof verified === 'string' || !verified) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid access token payload.',
      });
    }

    const { sub, role, sid, jti, iss, aud, iat, exp } = verified as Record<string, unknown>;
    if (
      typeof sub !== 'string' ||
      !UUID_V4_PATTERN.test(sub) ||
      typeof sid !== 'string' ||
      !UUID_V4_PATTERN.test(sid) ||
      typeof jti !== 'string' ||
      typeof role !== 'string' ||
      !(USER_ROLES as readonly string[]).includes(role) ||
      typeof exp !== 'number' ||
      typeof iat !== 'number'
    ) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Incomplete or malformed access token claims.',
      });
    }

    return {
      sub,
      role: role as UserRole,
      sid,
      jti,
      iss: String(iss),
      aud: String(aud),
      iat,
      exp,
    };
  }
}

