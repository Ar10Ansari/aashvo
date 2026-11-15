import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleVerifiedPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
  avatarUrl?: string;
  rawPayload?: Record<string, unknown>;
}

export const GOOGLE_TOKEN_VERIFIER_PORT = Symbol('GOOGLE_TOKEN_VERIFIER_PORT');

export interface GoogleTokenVerifierPort {
  verify(idToken: string, expectedAudience: string): Promise<GoogleVerifiedPayload>;
}

@Injectable()
export class GoogleTokenVerifierService implements GoogleTokenVerifierPort {
  private readonly logger = new Logger(GoogleTokenVerifierService.name);
  private client: OAuth2Client | null = null;
  private currentAudience: string | null = null;

  private getClient(expectedAudience: string): OAuth2Client {
    if (!this.client || this.currentAudience !== expectedAudience) {
      this.client = new OAuth2Client(expectedAudience);
      this.currentAudience = expectedAudience;
    }
    return this.client;
  }

  async verify(idToken: string, expectedAudience: string): Promise<GoogleVerifiedPayload> {
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length < 16) {
      throw new BadRequestException('Google ID token is required and must be a valid string.');
    }

    if (!expectedAudience || typeof expectedAudience !== 'string') {
      throw new ServiceUnavailableException('Google OAuth audience is not configured.');
    }

    const trimmedToken = idToken.trim();
    const client = this.getClient(expectedAudience);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: trimmedToken,
        audience: expectedAudience,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Google verifyIdToken failed: ${message}`);

      if (
        message.includes('ENOTFOUND') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ECONNREFUSED') ||
        message.includes('fetch failed')
      ) {
        throw new ServiceUnavailableException(
          'Google authentication verification service is temporarily unreachable.',
        );
      }

      throw new UnauthorizedException(`Google ID token verification failed: ${message}`);
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Google ID token payload could not be decoded.');
    }

    // 1. Audience verification
    if (payload.aud !== expectedAudience) {
      throw new UnauthorizedException('Google token audience does not match configured client ID.');
    }

    // 2. Issuer verification
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      throw new UnauthorizedException('Google token issuer is invalid.');
    }

    // 3. Expiration verification
    const expSeconds = Number(payload.exp);
    if (!expSeconds || expSeconds * 1000 <= Date.now()) {
      throw new UnauthorizedException('Google token has expired.');
    }

    // 4. Email verification
    if (!payload.email || payload.email_verified !== true) {
      throw new BadRequestException(
        'Google account email is missing or not verified by Google. Unverified accounts cannot be used.',
      );
    }

    // 5. Subject verification
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Google token subject (sub) is missing.');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: true,
      fullName: payload.name || undefined,
      avatarUrl: payload.picture || undefined,
      rawPayload: payload as unknown as Record<string, unknown>,
    };
  }
}
