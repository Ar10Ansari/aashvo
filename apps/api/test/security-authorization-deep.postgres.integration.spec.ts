import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { JwtTokenService } from '../src/modules/auth/services/jwt-token.service';

describe('Deep Security & Authorization Verification (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtTokenService: JwtTokenService;

  let ownerToken: string;
  let ownerUserId: string;
  let ownerEmail: string;

  let attackerToken: string;
  let attackerUserId: string;
  let attackerEmail: string;

  let victimPropertyId: string;
  let victimInquiryId: string;
  let victimVisitId: string;
  let victimNotificationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtTokenService = app.get<JwtTokenService>(JwtTokenService);

    const ts = Date.now();
    // 1. Setup Victim Owner
    ownerEmail = `sec-owner-${ts}@example.com`;
    const ownerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: ownerEmail,
        password: 'Password123!',
        fullName: 'Security Target Owner',
        accountType: 'owner',
      })
      .expect(HttpStatus.CREATED);
    ownerToken = ownerReg.body.accessToken;
    ownerUserId = ownerReg.body.user.id;

    // 2. Setup Attacker
    attackerEmail = `sec-attacker-${ts}@example.com`;
    const attackerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: attackerEmail,
        password: 'Password123!',
        fullName: 'Security Malicious Actor',
        accountType: 'renter',
      })
      .expect(HttpStatus.CREATED);
    attackerToken = attackerReg.body.accessToken;
    attackerUserId = attackerReg.body.user.id;

    // 3. Create victim property
    const propRes = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Victim Executive Residence DLF Phase 2',
        description: 'Prime luxury property targeted for IDOR tampering tests.',
        locality: 'DLF Phase 2',
        city: 'Gurugram',
        state: 'Haryana',
        addressShort: 'Cyber City Portal, DLF 2',
        propertyType: 'apartment',
        roomType: 'private_room',
        furnishing: 'fully_furnished',
        category: 'flats_rooms',
        rentAmount: 45000,
        depositAmount: 90000,
        maintenanceCharge: 3000,
        brokerageFee: 0,
        providerType: 'owner',
        genderPreference: 'any',
        bedrooms: 3,
        bathrooms: 3,
        availableFrom: 'Immediately',
        amenities: ['100% Power Backup', 'High-Speed Wi-Fi'],
        photoUrls: [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }],
        asDraft: false,
      })
      .expect(HttpStatus.CREATED);
    victimPropertyId = propRes.body.id;

    // 4. Create victim inquiry (from a 3rd party seeker)
    const thirdPartyEmail = `sec-third-${ts}@example.com`;
    const thirdPartyReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: thirdPartyEmail,
        password: 'Password123!',
        fullName: 'Third Party Seeker',
        accountType: 'renter',
      })
      .expect(HttpStatus.CREATED);
    const thirdPartyToken = thirdPartyReg.body.accessToken;

    const inqRes = await request(app.getHttpServer())
      .post('/api/v1/inquiries')
      .set('Authorization', `Bearer ${thirdPartyToken}`)
      .send({
        propertyId: victimPropertyId,
        senderName: 'Third Party Seeker',
        senderPhone: '+919999888877',
        senderEmail: thirdPartyEmail,
        message: 'Inquiry for security tests',
        moveInDate: '2026-12-01',
      })
      .expect(HttpStatus.CREATED);
    victimInquiryId = inqRes.body.id;

    // 5. Create victim visit
    const visitRes = await request(app.getHttpServer())
      .post('/api/v1/visits')
      .set('Authorization', `Bearer ${thirdPartyToken}`)
      .send({
        propertyId: victimPropertyId,
        scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        visitorMessage: 'Viewing appointment',
      })
      .expect(HttpStatus.CREATED);
    victimVisitId = visitRes.body.id;

    // 6. Find victim notification created for owner
    const notif = await prisma.userNotification.findFirst({
      where: { userId: ownerUserId },
    });
    expect(notif).not.toBeNull();
    victimNotificationId = notif!.id;
  });

  afterAll(async () => {
    const testEmails = [ownerEmail, attackerEmail];
    for (const email of testEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.userNotification.deleteMany({ where: { userId: u.id } });
        await prisma.savedItem.deleteMany({ where: { userId: u.id } });
        await prisma.propertyVisit.deleteMany({ where: { visitorId: u.id } });
        await prisma.propertyVisit.deleteMany({ where: { hostId: u.id } });
        await prisma.interestRequest.deleteMany({ where: { senderId: u.id } });
        await prisma.interestRequest.deleteMany({ where: { propertyId: victimPropertyId } });
        await prisma.propertyPhoto.deleteMany({ where: { propertyId: victimPropertyId } });
        await prisma.property.deleteMany({ where: { ownerId: u.id } });
        await prisma.profile.deleteMany({ where: { id: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    }
    await app.close();
  });

  // 1. Normal user token attempting admin action
  test('Security 1: Normal user token attempting admin moderation action is rejected with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${victimPropertyId}/moderate`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ status: 'active', reason: 'Attacker attempting unauthorized approval' })
      .expect(HttpStatus.FORBIDDEN);

    // Verify database state: status remains pending_review or untouched
    const prop = await prisma.property.findUnique({ where: { id: victimPropertyId } });
    expect(prop?.status).toBe('pending_review');
  });

  // 2. User attempting to modify another user's listing
  test('Security 2: Attacker attempting to alter another owner listing rent is rejected with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${victimPropertyId}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ rentAmount: 100 })
      .expect(HttpStatus.FORBIDDEN);

    // Verify database state: rentAmount remains 45000
    const prop = await prisma.property.findUnique({ where: { id: victimPropertyId } });
    expect(Number(prop?.rentAmount)).toBe(45000);
  });

  // 3. User attempting to update another user's inquiry status
  test('Security 3: Attacker attempting to accept another owner inquiry is rejected with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/inquiries/${victimInquiryId}/status`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ status: 'accepted' })
      .expect(HttpStatus.FORBIDDEN);

    // Verify database state: inquiry status remains pending
    const inq = await prisma.interestRequest.findUnique({ where: { id: victimInquiryId } });
    expect(inq?.status).toBe('pending');
  });

  // 4. User attempting to alter another user's visit
  test('Security 4: Attacker attempting to confirm another host visit is rejected with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/visits/${victimVisitId}/status`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ action: 'confirm', hostNotes: 'Tampered confirmation' })
      .expect(HttpStatus.FORBIDDEN);

    // Verify database state: visit status remains pending
    const visit = await prisma.propertyVisit.findUnique({ where: { id: victimVisitId } });
    expect(visit?.status).toBe('pending');
  });

  // 5. User attempting to alter/mark another user's notifications
  test('Security 5: Attacker attempting to mark another user notification as read is rejected with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${victimNotificationId}/read`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(HttpStatus.FORBIDDEN);

    // Verify database state: notification remains unread
    const notif = await prisma.userNotification.findUnique({ where: { id: victimNotificationId } });
    expect(notif?.read).toBe(false);
  });

  // 6. Forged or manipulated role claims
  test('Security 6: Forged token signed with attacker rogue RSA key is rejected with 401 Unauthorized', async () => {
    const rogueKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const forgedToken = jwt.sign(
      {
        sub: attackerUserId,
        role: 'admin',
        sid: 'rogue-session',
      },
      rogueKeys.privateKey,
      {
        algorithm: 'RS256',
        issuer: 'aashvo-api',
        audience: 'aashvo-app',
        expiresIn: '1h',
      },
    );

    await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${forgedToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  test('Security 6b: Alg:none token is strictly blocked by safe JWT header check', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: attackerUserId, role: 'admin' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${noneToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // 7. Expired token
  test('Security 7: Expired access token is rejected with 401 Unauthorized', async () => {
    const activeSession = await prisma.refreshSession.findFirst({
      where: { userId: attackerUserId },
    });
    expect(activeSession).not.toBeNull();

    const expiredJwt = jwt.sign(
      {
        role: 'renter',
        sid: activeSession!.familyId,
      },
      (jwtTokenService as any).privateKey,
      {
        algorithm: 'RS256',
        subject: attackerUserId,
        issuer: (jwtTokenService as any).issuer,
        audience: (jwtTokenService as any).audience,
        expiresIn: -10, // Expired 10 seconds ago
      },
    );

    await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${expiredJwt}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // 8. Revoked session
  test('Security 8: Logged out / revoked session invalidates access token and returns 401 Unauthorized', async () => {
    // 1. Attacker calls logout
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // 2. Subsequent request using the revoked token must return 401
    await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // 9. Server-side authoritative role lookup
  test('Security 9: Role authorization strictly queries authoritative database row, not client claims', async () => {
    // Elevate in DB
    await prisma.user.update({
      where: { id: ownerUserId },
      data: { role: 'admin' },
    });

    // Owner now succeeds on admin action even with existing token (server reads role from DB)
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${victimPropertyId}/moderate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'active', reason: 'Legitimate admin moderation' })
      .expect(HttpStatus.OK);

    const prop = await prisma.property.findUnique({ where: { id: victimPropertyId } });
    expect(prop?.status).toBe('active');
  });
});
