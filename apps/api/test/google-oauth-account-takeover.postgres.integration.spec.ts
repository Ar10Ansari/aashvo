import { ERROR_CODES } from '@aashvo/contracts';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  GOOGLE_TOKEN_VERIFIER_PORT,
  type GoogleTokenVerifierPort,
  type GoogleVerifiedPayload,
} from '../src/modules/auth/services/google-token-verifier.service';
import {
  type AuthEmailPayload,
  MAIL_DISPATCH_PORT,
  type MailDispatchPort,
} from '../src/modules/auth/services/mail-dispatch.port';

class MockGoogleTokenVerifier implements GoogleTokenVerifierPort {
  mockClaims: Record<string, GoogleVerifiedPayload> = {};

  async verify(idToken: string, _expectedAudience: string): Promise<GoogleVerifiedPayload> {
    const claims = this.mockClaims[idToken];
    if (!claims) {
      throw new UnauthorizedException('Invalid Google ID token signature.');
    }
    return claims;
  }
}

class MockMailDispatchAdapter implements MailDispatchPort {
  verifications: AuthEmailPayload[] = [];
  resets: AuthEmailPayload[] = [];

  async sendVerificationEmail(payload: AuthEmailPayload): Promise<void> {
    this.verifications.push(payload);
  }

  async sendPasswordResetEmail(payload: AuthEmailPayload): Promise<void> {
    this.resets.push(payload);
  }
}

describe('Google OAuth Account Takeover Defense & Account Linking Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockVerifier: MockGoogleTokenVerifier;
  let mockMailer: MockMailDispatchAdapter;

  const TEST_GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';

    mockVerifier = new MockGoogleTokenVerifier();
    mockMailer = new MockMailDispatchAdapter();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_TOKEN_VERIFIER_PORT)
      .useValue(mockVerifier)
      .overrideProvider(MAIL_DISPATCH_PORT)
      .useValue(mockMailer)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test users
    await prisma.oAuthIdentity.deleteMany({
      where: {
        providerEmail: {
          contains: 'google-sec-',
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'google-sec-',
        },
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.oAuthIdentity.deleteMany({
        where: {
          providerEmail: {
            contains: 'google-sec-',
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: 'google-sec-',
          },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Account Takeover Defense: Existing Password Accounts', () => {
    it('rejects Google login for existing password account with verified email (prevents account takeover)', async () => {
      const email = 'google-sec-existing-verified@example.com';
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!Secure',
          fullName: 'Existing Verified User',
        })
        .expect(201);

      const userId = regRes.body.user.id;
      // Mark email as verified
      await prisma.profile.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      // Attacker presents Google ID token with matching email but arbitrary Google sub
      const attackerToken = 'mock-google-id-token-attacker-1';
      mockVerifier.mockClaims[attackerToken] = {
        sub: 'google-sub-attacker-12345',
        email,
        emailVerified: true,
        fullName: 'Attacker Impersonator',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: attackerToken })
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(res.body.error.message).toContain('An account with this email already exists');
      expect(res.body.error.message).toContain('link your Google account in Settings');

      // Assert no OAuth identity was created
      const identities = await prisma.oAuthIdentity.findMany({
        where: { userId },
      });
      expect(identities).toHaveLength(0);
    });

    it('rejects Google login for existing password account with unverified email without altering emailVerified status', async () => {
      const email = 'google-sec-existing-unverified@example.com';
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!Secure',
          fullName: 'Existing Unverified User',
        })
        .expect(201);

      const userId = regRes.body.user.id;
      const initialProfile = await prisma.profile.findUnique({
        where: { id: userId },
      });
      expect(initialProfile?.emailVerified).toBe(false);

      const token = 'mock-google-id-token-attacker-2';
      mockVerifier.mockClaims[token] = {
        sub: 'google-sub-attacker-67890',
        email,
        emailVerified: true,
        fullName: 'Google User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: token })
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);

      // Verify emailVerified status was NOT flipped to true
      const postProfile = await prisma.profile.findUnique({
        where: { id: userId },
      });
      expect(postProfile?.emailVerified).toBe(false);

      // Assert no OAuth identity was created
      const identities = await prisma.oAuthIdentity.findMany({
        where: { userId },
      });
      expect(identities).toHaveLength(0);
    });
  });

  describe('2. Legitimate Google Auth: Existing Identity & New Registration', () => {
    it('creates new account and profile with emailVerified: true on first valid Google login', async () => {
      const email = 'google-sec-brandnew-user@example.com';
      const token = 'mock-google-id-token-brandnew-1';
      const sub = 'google-sub-brandnew-11111';

      mockVerifier.mockClaims[token] = {
        sub,
        email,
        emailVerified: true,
        fullName: 'Brand New Google User',
        avatarUrl: 'https://lh3.googleusercontent.com/avatar-1',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: token })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.emailVerified).toBe(true);

      const dbUser = await prisma.user.findUnique({
        where: { email },
        include: { profile: true, oauthIdentities: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.passwordHash).toBeNull();
      expect(dbUser?.profile?.emailVerified).toBe(true);
      expect(dbUser?.oauthIdentities).toHaveLength(1);
      expect(dbUser?.oauthIdentities[0].provider).toBe('google');
      expect(dbUser?.oauthIdentities[0].providerSubject).toBe(sub);
    });

    it('authenticates normally for existing Google identity and updates lastSignInAt', async () => {
      const email = 'google-sec-brandnew-user@example.com';
      const token = 'mock-google-id-token-brandnew-1';
      const sub = 'google-sub-brandnew-11111';

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: token })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(email);

      const identities = await prisma.oAuthIdentity.findMany({
        where: { provider: 'google', providerSubject: sub },
      });
      expect(identities).toHaveLength(1);
      expect(identities[0].lastSignInAt).toBeDefined();
    });

    it('enforces unique constraint and deterministic mapping for duplicate Google subjects', async () => {
      const sub = 'google-sub-brandnew-11111';
      const tokenWithSameSubDiffName = 'mock-google-token-same-sub';
      mockVerifier.mockClaims[tokenWithSameSubDiffName] = {
        sub,
        email: 'google-sec-brandnew-user@example.com',
        emailVerified: true,
        fullName: 'Updated Name',
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: tokenWithSameSubDiffName })
        .expect(200);

      const identities = await prisma.oAuthIdentity.findMany({
        where: { provider: 'google', providerSubject: sub },
      });
      expect(identities).toHaveLength(1);
    });
  });

  describe('3. Concurrency Safety: Parallel Google Logins', () => {
    it('handles concurrent first-time Google sign-ins gracefully without duplicate user or unhandled crash', async () => {
      const email = 'google-sec-concurrent-user@example.com';
      const sub = 'google-sub-concurrent-99999';
      const token = 'mock-google-concurrent-token';

      mockVerifier.mockClaims[token] = {
        sub,
        email,
        emailVerified: true,
        fullName: 'Concurrent User',
      };

      // Send 5 concurrent requests
      const promises = Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post('/api/v1/auth/google')
          .send({ idToken: token }),
      );

      const results = await Promise.all(promises);

      // All 5 must succeed with 200 OK
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.body.accessToken).toBeDefined();
      }

      // Exactly 1 user and 1 oauth identity created
      const dbUsers = await prisma.user.findMany({ where: { email } });
      expect(dbUsers).toHaveLength(1);

      const dbIdentities = await prisma.oAuthIdentity.findMany({
        where: { provider: 'google', providerSubject: sub },
      });
      expect(dbIdentities).toHaveLength(1);
    });
  });

  describe('4. Authorized Account Linking (/api/v1/auth/google/link)', () => {
    let authUserToken: string;
    let authUserId: string;
    const authUserEmail = 'google-sec-link-target@example.com';

    beforeAll(async () => {
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: authUserEmail,
          password: 'Password123!Secure',
          fullName: 'Linking Target User',
        })
        .expect(201);

      authUserId = reg.body.user.id;
      authUserToken = reg.body.accessToken;
    });

    it('rejects account linking when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .send({ idToken: 'some-token' })
        .expect(401);
    });

    it('rejects account linking when Google email does not match account email', async () => {
      const mismatchedToken = 'mock-google-mismatched-token';
      mockVerifier.mockClaims[mismatchedToken] = {
        sub: 'google-sub-mismatch-1',
        email: 'other-different-email@example.com',
        emailVerified: true,
        fullName: 'Mismatched User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${authUserToken}`)
        .send({ idToken: mismatchedToken })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
      expect(res.body.error.message).toContain('does not match your AASHVO account email');
    });

    it('rejects account linking if Google identity is already linked to another account', async () => {
      // Sub belongs to brandnew user created in test 2
      const alreadyLinkedToken = 'mock-google-already-linked-token';
      mockVerifier.mockClaims[alreadyLinkedToken] = {
        sub: 'google-sub-brandnew-11111',
        email: authUserEmail,
        emailVerified: true,
        fullName: 'Linking Target User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${authUserToken}`)
        .send({ idToken: alreadyLinkedToken })
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(res.body.error.message).toContain('already linked to another AASHVO account');
    });

    it('successfully links Google account when user is authenticated with matching verified email', async () => {
      const validLinkToken = 'mock-google-valid-link-token';
      const validSub = 'google-sub-authorized-link-22222';
      mockVerifier.mockClaims[validLinkToken] = {
        sub: validSub,
        email: authUserEmail,
        emailVerified: true,
        fullName: 'Linking Target User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${authUserToken}`)
        .send({ idToken: validLinkToken })
        .expect(200);

      expect(res.body.message).toContain('Google account linked successfully');

      // Confirm identity exists in DB
      const identity = await prisma.oAuthIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: 'google',
            providerSubject: validSub,
          },
        },
      });
      expect(identity).not.toBeNull();
      expect(identity?.userId).toBe(authUserId);

      // Now loginWithGoogle for this sub must succeed directly!
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: validLinkToken })
        .expect(200);

      expect(loginRes.body.user.id).toBe(authUserId);
      expect(loginRes.body.accessToken).toBeDefined();
    });
  });
});
