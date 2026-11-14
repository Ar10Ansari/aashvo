import { ERROR_CODES } from '@aashvo/contracts';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/common/decorators/roles.decorator';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  type AuthEmailPayload,
  MAIL_DISPATCH_PORT,
  type MailDispatchPort,
} from '../src/modules/auth/services/mail-dispatch.port';

@Controller('api/v1/_test-rbac')
class AdminOnlyProbeController {
  @Get('admin-check')
  @Roles('admin')
  check() {
    return { ok: true };
  }
}

class InMemoryTestMailer implements MailDispatchPort {
  verifications: AuthEmailPayload[] = [];
  resets: AuthEmailPayload[] = [];
  failVerification = false;
  failReset = false;

  async sendVerificationEmail(payload: AuthEmailPayload): Promise<void> {
    if (this.failVerification) {
      throw new Error('Simulated verification email delivery outage');
    }
    this.verifications.push(payload);
  }

  async sendPasswordResetEmail(payload: AuthEmailPayload): Promise<void> {
    if (this.failReset) {
      throw new Error('Simulated password reset email delivery outage');
    }
    this.resets.push(payload);
  }

  clear(): void {
    this.verifications = [];
    this.resets = [];
    this.failVerification = false;
    this.failReset = false;
  }
}

function extractCookieValue(setCookieHeaders: string[] | string | undefined, name: string): string | null {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const raw of list) {
    if (raw.startsWith(`${name}=`)) {
      return raw.slice(name.length + 1).split(';')[0] ?? null;
    }
  }
  return null;
}

describe('PostgreSQL Schema Constraints & Authentication Security Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mailer = new InMemoryTestMailer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminOnlyProbeController],
    })
      .overrideProvider(MAIL_DISPATCH_PORT)
      .useValue(mailer)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    mailer.clear();
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        audit_logs,
        notification_outbox,
        phone_otp_challenges,
        verification_tokens,
        refresh_sessions,
        oauth_identities,
        ticket_audit_events,
        ticket_messages,
        support_tickets,
        safety_reports,
        listing_reports,
        rental_disputes,
        tenancy_reviews,
        property_inspections,
        rent_payment_records,
        tenancy_agreements,
        interest_requests,
        property_photos,
        properties,
        flatmate_profiles,
        media_assets,
        profiles,
        users
      CASCADE`,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('verifies all domain tables (32 including Master Feature Expansion) and enforces DB CHECK constraints at PostgreSQL layer', async () => {
    const tableRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
    );
    expect(Number(tableRows[0]?.count)).toBe(32);

    const ownerId = randomUUID();
    await prisma.user.create({
      data: {
        id: ownerId,
        email: 'constraint-host@example.com',
        role: 'owner',
        profile: {
          create: {
            email: 'constraint-host@example.com',
            fullName: 'Constraint Host',
            role: 'owner',
          },
        },
      },
    });

    // Family Stay without family_lives_on_property=true must fail PostgreSQL chk_family_stay_eligibility
    await expect(
      prisma.property.create({
        data: {
          ownerId,
          title: 'Invalid Family Stay',
          description: 'Missing family declaration',
          category: 'family_stays',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Hauz Khas',
          addressShort: 'Near Park',
          rentAmount: 18000,
          providerType: 'owner',
          availableFrom: 'Immediately',
          familyLivesOnProperty: false,
          mealsOffered: 'included',
        },
      }),
    ).rejects.toThrow(/chk_family_stay_eligibility/);

    // Flatmate < 18 years must fail PostgreSQL chk_flatmate_adult_age
    await expect(
      prisma.flatmateProfile.create({
        data: {
          userId: ownerId,
          occupation: 'Student',
          age: 17,
          gender: 'Female',
          budgetMax: 15000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early_Bird',
          cleanliness: 'Moderate',
          smoking: 'Non-smoker',
          bio: 'Minor age constraint check',
        },
      }),
    ).rejects.toThrow(/chk_flatmate_adult_age/);
  });

  test('registers user + 1:1 profile with Argon2id hash, httpOnly cookie, and prevents case-insensitive duplicates', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'Ananya.Sharma@Example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Ananya Sharma',
        accountType: 'renter',
      })
      .expect(201);

    expect(regRes.body.accessToken).toBeTruthy();
    expect(regRes.body.refreshToken).toBeUndefined();
    expect(regRes.body.user).toMatchObject({
      email: 'ananya.sharma@example.com',
      fullName: 'Ananya Sharma',
      role: 'renter',
      emailVerified: false,
    });
    expect(regRes.body.user.passwordHash).toBeUndefined();

    const setCookie = regRes.headers['set-cookie'];
    const cookieLine = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie ?? '');
    expect(cookieLine).toContain('aashvo_rt=');
    expect(cookieLine).toContain('HttpOnly');
    expect(cookieLine).toContain('SameSite=Lax');

    const dbUser = await prisma.user.findUnique({
      where: { id: regRes.body.user.id },
      include: { profile: true },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.id).toBe(dbUser!.profile!.id);
    expect(dbUser!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(dbUser!.passwordHashAlgorithm).toBe('argon2id');

    // Duplicate email (mixed case) must return 409 EMAIL_ALREADY_REGISTERED
    const dupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'ananya.sharma@example.com',
        password: 'AnotherPassword#2026',
        fullName: 'Duplicate User',
      })
      .expect(409);
    expect(dupRes.body.error.code).toBe(ERROR_CODES.EMAIL_ALREADY_REGISTERED);

    // Mass assignment / admin escalation rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'attacker@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Attacker',
        accountType: 'admin',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'attacker2@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Attacker Two',
        role: 'admin',
      })
      .expect(400);
  });

  test('rotates opaque refresh tokens and revokes entire session family on replay detection', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'session.user@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Session User',
      })
      .expect(201);

    const rt1 = extractCookieValue(reg.headers['set-cookie'], 'aashvo_rt');
    expect(rt1).toBeTruthy();

    // Legitimate rotation RT1 -> RT2 via cookie
    const rotRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${rt1}`])
      .set('Origin', 'http://localhost:5173')
      .send({})
      .expect(200);

    const rt2 = extractCookieValue(rotRes.headers['set-cookie'], 'aashvo_rt');
    expect(rt2).toBeTruthy();
    expect(rt2).not.toBe(rt1);

    // Cross-origin cookie CSRF rejected 403
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${rt2}`])
      .set('Origin', 'https://evil.example.com')
      .send({})
      .expect(403);

    // Replay leaked RT1 -> 401 REFRESH_TOKEN_REUSE_DETECTED + kills entire family including RT2
    const replayRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${rt1}`])
      .send({})
      .expect(401);
    expect(replayRes.body.error.code).toBe(ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED);

    // Subsequent use of valid RT2 must ALSO fail 401 because family was revoked!
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${rt2}`])
      .send({})
      .expect(401);

    // And existing access JWT linked to that session family is immediately rejected!
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rotRes.body.accessToken}`)
      .expect(401);

    const audit = await prisma.auditLog.findFirst({
      where: { eventType: 'auth.refresh_replay_detected' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.outcome).toBe('denied');
  });

  test('logout immediately invalidates both refresh session and access JWT', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'logout.test@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Logout User',
      })
      .expect(201);

    const rt = extractCookieValue(reg.headers['set-cookie'], 'aashvo_rt');

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`aashvo_rt=${rt}`])
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${rt}`])
      .send({})
      .expect(401);
  });

  test('rejects alg:none, RS256->HS256 key confusion, rogue keys, header injections, and non-admin RBAC', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'jwt.hardening@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'JWT Hardening User',
      })
      .expect(201);

    const realToken: string = reg.body.accessToken;
    const decoded = jwt.decode(realToken, { complete: true }) as unknown as {
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
    };

    const encodeB64 = (obj: object) =>
      Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');

    // 1. alg:none attack
    const algNoneToken = `${encodeB64({ alg: 'none', typ: 'JWT' })}.${encodeB64({
      ...decoded.payload,
      role: 'admin',
    })}.`;
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${algNoneToken}`)
      .expect(401);

    // 2. RS256 -> HS256 key confusion using server's public key as HMAC secret
    const hs256Token = jwt.sign(
      { role: 'admin', sid: decoded.payload.sid },
      process.env.JWT_SIGNING_PUBLIC_KEY!,
      {
        algorithm: 'HS256',
        subject: reg.body.user.id,
        jwtid: randomUUID(),
        issuer: 'https://api.aashvo.in',
        audience: 'aashvo-clients',
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${hs256Token}`)
      .expect(401);

    // 3. Rogue RSA private key signature
    const rogueKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const rogueToken = jwt.sign(
      { role: 'admin', sid: decoded.payload.sid },
      rogueKeys.privateKey,
      {
        algorithm: 'RS256',
        subject: reg.body.user.id,
        jwtid: randomUUID(),
        issuer: 'https://api.aashvo.in',
        audience: 'aashvo-clients',
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rogueToken}`)
      .expect(401);

    // 4. Renter token hitting @Roles('admin') route must fail 403 FORBIDDEN
    const rbacRes = await request(app.getHttpServer())
      .get('/api/v1/_test-rbac/admin-check')
      .set('Authorization', `Bearer ${realToken}`)
      .expect(403);
    expect(rbacRes.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  test('verifies email, locks out brute-force login, resets password, and revokes pre-reset sessions', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'recovery.user@example.com',
        password: 'InitialPassword#2026',
        fullName: 'Recovery User',
      })
      .expect(201);

    expect(mailer.verifications).toHaveLength(1);
    const verifyToken = mailer.verifications[0]!.rawToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken })
      .expect(200);

    // Single-use token replay fails 400
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyToken })
      .expect(400);

    const meVerified = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(200);
    expect(meVerified.body.emailVerified).toBe(true);

    // 5 failed logins trigger ACCOUNT_LOCKED
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'recovery.user@example.com', password: 'WrongPassword!' })
        .expect(401);
    }
    const lockedRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'recovery.user@example.com', password: 'InitialPassword#2026' })
      .expect(401);
    expect(lockedRes.body.error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);

    // Forgot password returns identical 202 for unknown and known email
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody.nonexistent@example.com' })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'recovery.user@example.com' })
      .expect(202);

    expect(mailer.resets).toHaveLength(1);
    const resetToken = mailer.resets[0]!.rawToken;

    // Reset password unlocks account, sets new Argon2id password, and revokes pre-reset session
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'BrandNewPassword#2026' })
      .expect(200);

    // Pre-reset token now fails 401
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(401);

    // Native mobile client header returns explicit refreshToken in JSON
    const newLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'ios')
      .send({ email: 'recovery.user@example.com', password: 'BrandNewPassword#2026' })
      .expect(200);
    expect(newLogin.body.accessToken).toBeTruthy();
    expect(newLogin.body.refreshToken).toBeTruthy();
  });

  test('strictly complies with RFC 6265bis __Host- cookie requirements (Secure, Path=/, no Domain)', async () => {
    const configService = app.get(ConfigService);
    const secureModuleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, opts?: any) => {
          if (key === 'COOKIE_SECURE') return true;
          return configService.get(key as any, opts);
        },
      })
      .overrideProvider(MAIL_DISPATCH_PORT)
      .useValue(mailer)
      .compile();

    const secureApp = secureModuleRef.createNestApplication();
    configureApp(secureApp);
    await secureApp.init();

    try {
      const regRes = await request(secureApp.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'hostcookie.user@example.com',
          password: 'Str0ngPassword#2026',
          fullName: 'Host Cookie User',
        })
        .expect(201);

      const setCookie = regRes.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieLine = Array.isArray(setCookie) ? setCookie[0]! : String(setCookie);

      // RFC 6265bis Section 5.2.2 requirements for __Host- prefix:
      // 1. Name must start with __Host-
      expect(cookieLine).toMatch(/^__Host-aashvo_rt=/);
      // 2. Must contain Secure attribute
      expect(cookieLine.toLowerCase()).toContain('secure');
      // 3. Must contain Path=/
      expect(cookieLine).toContain('Path=/');
      // 4. Must NOT contain Domain attribute (RFC 6265bis forbids Domain for __Host- cookies)
      expect(cookieLine.toLowerCase()).not.toContain('domain=');
      // 5. Must contain HttpOnly
      expect(cookieLine.toLowerCase()).toContain('httponly');
      // 6. SameSite Lax
      expect(cookieLine.toLowerCase()).toContain('samesite=lax');
    } finally {
      process.env.COOKIE_SECURE = 'false';
      await secureApp.close();
    }
  });

  test('logout-all revokes all active session families across web and mobile platforms', async () => {
    // 1. Register user (Session 1: web)
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'logoutall.user@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Logout All User',
      })
      .expect(201);

    const webRt = extractCookieValue(regRes.headers['set-cookie'], 'aashvo_rt')!;
    const webAccessToken = regRes.body.accessToken;

    // 2. Sign in from mobile (Session 2: ios)
    const mobileLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'ios')
      .send({
        email: 'logoutall.user@example.com',
        password: 'Str0ngPassword#2026',
      })
      .expect(200);

    const mobileRt = mobileLoginRes.body.refreshToken;
    const mobileAccessToken = mobileLoginRes.body.accessToken;

    // Both sessions work
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${webAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${mobileAccessToken}`)
      .expect(200);

    // Call logout-all using mobile session
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${mobileAccessToken}`)
      .expect(204);

    // Both refresh tokens are now revoked!
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`aashvo_rt=${webRt}`])
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: mobileRt })
      .expect(401);

    // Both access tokens are rejected
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${webAccessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${mobileAccessToken}`)
      .expect(401);
  });

  test('verifies email verification token SHA-256 hashing, expiration, and single-use in DB', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'hashing.email@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Hash Email User',
      })
      .expect(201);

    expect(mailer.verifications).toHaveLength(1);
    const rawToken = mailer.verifications[0]!.rawToken;

    // 1. Verify token in DB is hashed using SHA-256 and raw token is NOT stored
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    const dbToken = await prisma.verificationToken.findFirst({
      where: { email: 'hashing.email@example.com', purpose: 'email_verification' },
    });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.tokenHash).toBe(expectedHash);
    expect(dbToken!.tokenHash).not.toBe(rawToken);

    // 2. Expire the token by moving expiresAt 1 hour into the past
    await prisma.verificationToken.update({
      where: { id: dbToken!.id },
      data: { expiresAt: new Date(Date.now() - 3600000) },
    });

    const expRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken })
      .expect(400);
    expect(expRes.body.error.code).toBe(ERROR_CODES.INVALID_OR_EXPIRED_TOKEN);

    // 3. Resend verification creates a new unexpired token
    await request(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'hashing.email@example.com' })
      .expect(202);

    expect(mailer.verifications).toHaveLength(2);
    const newRawToken = mailer.verifications[1]!.rawToken;
    expect(newRawToken).not.toBe(rawToken);

    // Verify successfully
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: newRawToken })
      .expect(200);

    // Replay fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: newRawToken })
      .expect(400);
  });

  test('verifies password reset token SHA-256 hashing, expiration, and single-use in DB', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'hashing.pw@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Hash PW User',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'hashing.pw@example.com' })
      .expect(202);

    expect(mailer.resets).toHaveLength(1);
    const rawResetToken = mailer.resets[0]!.rawToken;

    const expectedHash = createHash('sha256').update(rawResetToken).digest('hex');
    const dbToken = await prisma.verificationToken.findFirst({
      where: { email: 'hashing.pw@example.com', purpose: 'password_reset' },
    });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.tokenHash).toBe(expectedHash);
    expect(dbToken!.tokenHash).not.toBe(rawResetToken);

    // Expire token
    await prisma.verificationToken.update({
      where: { id: dbToken!.id },
      data: { expiresAt: new Date(Date.now() - 3600000) },
    });

    const expRes = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, newPassword: 'NewPassword#2026' })
      .expect(400);
    expect(expRes.body.error.code).toBe(ERROR_CODES.INVALID_OR_EXPIRED_TOKEN);
  });

  test('allows login after lockout period expires and resets failed login counters', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'lockout.expiry@example.com',
        password: 'CorrectPassword#2026',
        fullName: 'Lockout Expiry User',
      })
      .expect(201);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'lockout.expiry@example.com', password: 'WrongPassword!' })
        .expect(401);
    }

    // 6th attempt is locked
    const lockedRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lockout.expiry@example.com', password: 'CorrectPassword#2026' })
      .expect(401);
    expect(lockedRes.body.error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);

    // Fast-forward lockout expiration by setting lockedUntil 1 minute into the past
    await prisma.user.update({
      where: { email: 'lockout.expiry@example.com' },
      data: { lockedUntil: new Date(Date.now() - 60000) },
    });

    // Now login succeeds and resets failure count
    const okRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lockout.expiry@example.com', password: 'CorrectPassword#2026' })
      .expect(200);
    expect(okRes.body.accessToken).toBeTruthy();

    const dbUser = await prisma.user.findUnique({
      where: { email: 'lockout.expiry@example.com' },
    });
    expect(dbUser!.failedLoginAttempts).toBe(0);
    expect(dbUser!.lockedUntil).toBeNull();
  });

  test('resiliently handles email delivery outage during registration without failing user creation', async () => {
    mailer.failVerification = true;

    // Registration should succeed despite mail outage
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'mailfail.user@example.com',
        password: 'Str0ngPassword#2026',
        fullName: 'Mail Fail User',
      })
      .expect(201);

    expect(regRes.body.accessToken).toBeTruthy();

    // Audit log records delivery failure
    const audit = await prisma.auditLog.findFirst({
      where: {
        eventType: 'auth.email_dispatch_failed',
        entityId: regRes.body.user.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.outcome).toBe('failure');

    // Once mail provider recovers, user requests resend verification
    mailer.failVerification = false;
    await request(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'mailfail.user@example.com' })
      .expect(202);

    expect(mailer.verifications).toHaveLength(1);
    const token = mailer.verifications[0]!.rawToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(200);
  });

  test('verifies zero raw secrets or passwords in audit logs or database tokens table', async () => {
    const auditEntries = await prisma.auditLog.findMany();
    for (const entry of auditEntries) {
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain('Str0ngPassword#2026');
      expect(serialized).not.toContain('BrandNewPassword#2026');
      expect(serialized).not.toContain('CorrectPassword#2026');
    }

    const tokens = await prisma.verificationToken.findMany();
    for (const t of tokens) {
      // Must be 64-char hex SHA-256
      expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

