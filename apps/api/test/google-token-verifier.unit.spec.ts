import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleTokenVerifierService } from '../src/modules/auth/services/google-token-verifier.service';

describe('GoogleTokenVerifierService (Unit)', () => {
  let service: GoogleTokenVerifierService;
  const configuredAudience = 'test-aashvo-google-client-id.apps.googleusercontent.com';

  beforeEach(() => {
    service = new GoogleTokenVerifierService();
    jest.restoreAllMocks();
  });

  it('rejects empty, short, or invalid-type ID tokens with BadRequestException', async () => {
    await expect(service.verify('', configuredAudience)).rejects.toThrow(BadRequestException);
    await expect(service.verify('short', configuredAudience)).rejects.toThrow(BadRequestException);
    await expect(service.verify(null as any, configuredAudience)).rejects.toThrow(BadRequestException);
  });

  it('rejects unconfigured Google audience with ServiceUnavailableException', async () => {
    await expect(service.verify('a-valid-token-length-string-12345', '')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects invalid RSA signatures with UnauthorizedException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockRejectedValueOnce(
      new Error('Invalid token signature'),
    );

    await expect(
      service.verify('invalid-signature-token-string-12345678', configuredAudience),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired Google ID tokens with UnauthorizedException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockRejectedValueOnce(
      new Error('Token used too late, 1700000000 < 1700003600'),
    );

    await expect(
      service.verify('expired-google-token-string-12345678', configuredAudience),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects wrong audience tokens with UnauthorizedException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-sub-123456',
        aud: 'malicious-or-wrong-client-id.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'user@example.com',
        email_verified: true,
      }),
    });

    await expect(
      service.verify('wrong-audience-token-string-12345678', configuredAudience),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unverified Google emails with BadRequestException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-sub-unverified-123',
        aud: configuredAudience,
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'attacker@unverified-domain.com',
        email_verified: false,
      }),
    });

    await expect(
      service.verify('unverified-email-token-string-12345678', configuredAudience),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing subject claim with UnauthorizedException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockResolvedValueOnce({
      getPayload: () => ({
        aud: configuredAudience,
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'user@example.com',
        email_verified: true,
      }),
    });

    await expect(
      service.verify('missing-sub-token-string-12345678', configuredAudience),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid issuer with UnauthorizedException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-sub-invalid-iss',
        aud: configuredAudience,
        iss: 'https://fake-accounts.rogue.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'user@example.com',
        email_verified: true,
      }),
    });

    await expect(
      service.verify('invalid-issuer-token-string-12345678', configuredAudience),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('handles Google JWKS / network failure with ServiceUnavailableException', async () => {
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockRejectedValueOnce(
      new Error('fetch failed: getaddrinfo ENOTFOUND www.googleapis.com'),
    );

    await expect(
      service.verify('network-failure-token-string-12345678', configuredAudience),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('successfully extracts verified claims and stable subject for valid token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.SpyInstance).mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-stable-sub-9988776655',
        aud: configuredAudience,
        iss: 'https://accounts.google.com',
        exp: nowSeconds + 3600,
        email: 'genuine.renter@gmail.com',
        email_verified: true,
        name: 'Genuine Renter',
        picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
      }),
    });

    const verified = await service.verify('genuine-valid-token-string-12345678', configuredAudience);
    expect(verified.sub).toBe('google-stable-sub-9988776655');
    expect(verified.email).toBe('genuine.renter@gmail.com');
    expect(verified.emailVerified).toBe(true);
    expect(verified.fullName).toBe('Genuine Renter');
    expect(verified.avatarUrl).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
    expect(verified.rawPayload).toBeDefined();
  });
});
