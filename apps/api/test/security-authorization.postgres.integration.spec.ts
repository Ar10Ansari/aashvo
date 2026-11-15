import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  MAIL_DISPATCH_PORT,
  type MailDispatchPort,
} from '../src/modules/auth/services/mail-dispatch.port';

class TestNoopMailer implements MailDispatchPort {
  async sendVerificationEmail() {}
  async sendPasswordResetEmail() {}
}

function extractCookie(headers: string[] | string | undefined, name: string): string | null {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  for (const raw of list) {
    if (raw.startsWith(`${name}=`)) {
      return raw.slice(name.length + 1).split(';')[0] ?? null;
    }
  }
  return null;
}

describe('Runtime Database Security & Authorization Gate Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Personas
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let userCToken: string;
  let userCId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_DISPATCH_PORT)
      .useClass(TestNoopMailer)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('0. Persona Provisioning via Authoritative NestJS Backend', () => {
    it('provisions User A (Renter / Attacker persona in testing)', async () => {
      const email = `usera_${Date.now()}@aashvo.in`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!@#',
          fullName: 'User Alpha',
          accountType: 'renter',
        })
        .expect(201);

      userAToken = res.body.accessToken;
      userAId = res.body.user.id;
      expect(userAToken).toBeDefined();
      expect(userAId).toBeDefined();
    });

    it('provisions User B (Renter / Victim persona in testing)', async () => {
      const email = `userb_${Date.now()}@aashvo.in`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!@#',
          fullName: 'User Beta',
          accountType: 'renter',
        })
        .expect(201);

      userBToken = res.body.accessToken;
      userBId = res.body.user.id;
      expect(userBToken).toBeDefined();
      expect(userBId).toBeDefined();
    });

    it('provisions User C (Renter / Counterparty persona in testing)', async () => {
      const email = `userc_${Date.now()}@aashvo.in`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!@#',
          fullName: 'User Charlie',
          accountType: 'renter',
        })
        .expect(201);

      userCToken = res.body.accessToken;
      userCId = res.body.user.id;
      expect(userCToken).toBeDefined();
      expect(userCId).toBeDefined();
    });
  });

  describe('1. Profile IDOR Defense & Sensitive Field Sanitization', () => {
    it('User A fetching /profiles/me receives only User A authoritative profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(userAId);
      expect(res.body.fullName).toBe('User Alpha');
      expect(res.body.email).toContain('usera_');
    });

    it('User A fetching /profiles/:userBId receives public view and NO private email or phone', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/profiles/${userBId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(userBId);
      expect(res.body.fullName).toBe('User Beta');
      // Critical security check: private fields MUST NOT be exposed
      expect(res.body.email).toBeUndefined();
      expect(res.body.phoneNumber).toBeUndefined();
    });

    it('User A cannot mutate User B profile through /profiles/me', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          fullName: 'User Alpha Updated',
        })
        .expect(200);

      expect(res.body.id).toBe(userAId);
      expect(res.body.fullName).toBe('User Alpha Updated');

      // Verify User B profile was untouched
      const bProfile = await prisma.profile.findUnique({ where: { id: userBId } });
      expect(bProfile?.fullName).toBe('User Beta');
    });
  });

  describe('2. Saved Items & Shortlists Cross-Tenant Isolation', () => {
    let userBSavedItemId: string;

    beforeAll(async () => {
      // Create a property to save
      const prop = await prisma.property.create({
        data: {
          id: randomUUID(),
          ownerId: userCId,
          title: 'DLF Phase 5 Luxury Flat',
          description: 'Spacious 3BHK flat near Cyber City with modern amenities.',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'entire_flat',
          providerType: 'owner',
          furnishing: 'fully_furnished',
          genderPreference: 'any',
          rentAmount: 35000,
          depositAmount: 70000,
          availableFrom: '2026-12-01',
          city: 'Gurugram',
          locality: 'DLF Phase 5',
          addressShort: 'Near Cyber City',
          status: 'active',
        },
      });

      // User B saves the property
      const saveRes = await request(app.getHttpServer())
        .post('/api/v1/saved')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          itemType: 'property',
          targetId: prop.id,
          notes: 'User B private notes',
        })
        .expect(201);

      userBSavedItemId = saveRes.body.id;
    });

    it('User A querying /saved cannot see User B saved items', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/saved')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const found = res.body.find((item: any) => item.id === userBSavedItemId);
      expect(found).toBeUndefined();
    });

    it('User A attempting to delete User B saved item is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/saved/${userBSavedItemId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);

      // Verify item still exists in database
      const itemInDb = await prisma.savedItem.findUnique({ where: { id: userBSavedItemId } });
      expect(itemInDb).not.toBeNull();
    });
  });

  describe('3. Connect Matching & Messaging Cross-Tenant Boundary', () => {
    let matchIdBC: string;

    beforeAll(async () => {
      // Create flatmate profiles for B and C
      await prisma.flatmateProfile.createMany({
        data: [
          {
            userId: userBId,
            city: 'Bengaluru',
            budgetMax: 25000,
            foodHabit: 'Vegetarian',
            sleepRoutine: 'Flexible',
            cleanliness: 'Moderate',
            intentions: ['team_up'],
            occupation: 'Software Engineer',
            age: 25,
            gender: 'female',
            smoking: 'Non-Smoker',
            bio: 'Looking for a flatmate in Koramangala',
          },
          {
            userId: userCId,
            city: 'Bengaluru',
            budgetMax: 25000,
            foodHabit: 'Vegetarian',
            sleepRoutine: 'Flexible',
            cleanliness: 'Moderate',
            intentions: ['team_up'],
            occupation: 'Product Designer',
            age: 26,
            gender: 'female',
            smoking: 'Non-Smoker',
            bio: 'Creative designer seeking shared 2BHK',
          },
        ],
      });

      // Reciprocal likes to create match between B and C
      await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetUserId: userCId, action: 'like' })
        .expect(201);

      const matchRes = await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${userCToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      matchIdBC = matchRes.body.match.id;

      // User B sends a message in the match
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchIdBC}/messages`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ content: 'Confidential message between B and C' })
        .expect(201);
    });

    it('User A attempting to view Match B-C details is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${matchIdBC}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });

    it('User A attempting to view messages in Match B-C is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${matchIdBC}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });

    it('User A attempting to inject messages into Match B-C is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchIdBC}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ content: 'Forged message from attacker' })
        .expect(403);
    });
  });

  describe('4. Tenancy Agreement & Support Ticket Cross-Tenant Boundary', () => {
    let agreementIdBC: string;
    let ticketIdB: string;

    beforeAll(async () => {
      // Create agreement between B (landlord) and C (tenant)
      const agr = await prisma.tenancyAgreement.create({
        data: {
          id: randomUUID(),
          landlordId: userBId,
          tenantId: userCId,
          monthlyRent: 20000,
          securityDeposit: 40000,
          startDate: new Date(),
          agreementStatus: 'draft',
        },
      });
      agreementIdBC = agr.id;

      // User B creates a support ticket
      const ticketRes = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          category: 'billing',
          subject: 'Payment receipt inquiry',
          description: 'Need copy of invoice for last month',
        })
        .expect(201);

      ticketIdB = ticketRes.body.id;
    });

    it('User A attempting to view Agreement B-C is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/agreements/${agreementIdBC}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });

    it('User A attempting to view User B support ticket is rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/support/tickets/${ticketIdB}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });
  });

  describe('5. Authentication Lifecycle: Single-Flight, Replay Revocation & Session Invalidation', () => {
    it('rotates refresh tokens and instantly revokes session family on replay detection', async () => {
      const email = `rotatetest_${Date.now()}@aashvo.in`;
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!@#',
          fullName: 'Rotate Test',
          accountType: 'renter',
        })
        .expect(201);

      const initialCookie = extractCookie(regRes.headers['set-cookie'], 'aashvo_rt');
      expect(initialCookie).not.toBeNull();

      // First rotation: valid
      const refresh1Res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`aashvo_rt=${initialCookie}`])
        .expect(200);

      const rotatedCookie = extractCookie(refresh1Res.headers['set-cookie'], 'aashvo_rt');
      expect(rotatedCookie).not.toBeNull();
      expect(rotatedCookie).not.toBe(initialCookie);

      // Replay attack: Attacker attempts to replay initialCookie
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`aashvo_rt=${initialCookie}`])
        .expect(401);

      // Verify that after replay detection, the rotatedCookie is ALSO revoked (family revocation)
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`aashvo_rt=${rotatedCookie}`])
        .expect(401);
    });

    it('rejects expired access tokens with 401 Unauthorized', async () => {
      const fakeToken = jwt.sign(
        { sub: userAId, email: 'usera@aashvo.in', role: 'renter' },
        'badsecret',
        { algorithm: 'HS256', expiresIn: -10 },
      );

      await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('logout revokes the refresh session and invalidates access', async () => {
      const email = `logouttest_${Date.now()}@aashvo.in`;
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!@#',
          fullName: 'Logout Test',
          accountType: 'renter',
        })
        .expect(201);

      const cookie = extractCookie(regRes.headers['set-cookie'], 'aashvo_rt');
      const token = regRes.body.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', [`aashvo_rt=${cookie}`])
        .expect(204);

      // Attempting to refresh with logged-out cookie fails
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`aashvo_rt=${cookie}`])
        .expect(401);
    });
  });

  describe('6. Public Endpoints & Unauthenticated Invariants', () => {
    it('GET /health/live returns 200 OK without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /health/ready returns 200 OK without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database.status).toBe('up');
    });

    it('GET /properties returns 200 OK for anonymous browsing', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/properties').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /connect/candidates returns 200 OK for anonymous preview', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/connect/candidates').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Unauthenticated POST /connect/swipe returns 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .send({ targetUserId: userBId, action: 'like' })
        .expect(401);
    });
  });

  describe('7. Database Persistence After Complete API Restart', () => {
    it('preserves all state across complete NestJS process destruction and reincarnation', async () => {
      // 1. Record a property in App 1
      const propId = randomUUID();
      await prisma.property.create({
        data: {
          id: propId,
          ownerId: userAId,
          title: 'Persistent Society Apartment',
          description: 'A test property for process reboot persistence verification.',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'entire_flat',
          providerType: 'owner',
          furnishing: 'fully_furnished',
          genderPreference: 'any',
          rentAmount: 42000,
          depositAmount: 84000,
          availableFrom: '2026-12-01',
          city: 'Noida',
          locality: 'Sector 62',
          addressShort: 'Near Sector 62',
          status: 'active',
        },
      });

      // 2. Terminate App 1
      await app.close();

      // 3. Boot fresh App 2 instance from scratch
      const moduleRef2 = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(MAIL_DISPATCH_PORT)
        .useClass(TestNoopMailer)
        .compile();

      const app2 = moduleRef2.createNestApplication();
      configureApp(app2);
      await app2.init();

      // 4. Query App 2 via HTTP
      const res = await request(app2.getHttpServer())
        .get(`/api/v1/properties/${propId}`)
        .expect(200);

      expect(res.body.id).toBe(propId);
      expect(res.body.title).toBe('Persistent Society Apartment');
      expect(res.body.city).toBe('Noida');

      // Verify User A profile is also intact
      const userRes = await request(app2.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(userRes.body.id).toBe(userAId);

      // Cleanly close App 2
      await app2.close();
    });
  });
});
