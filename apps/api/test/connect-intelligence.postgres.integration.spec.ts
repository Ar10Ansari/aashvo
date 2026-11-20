import { DEFAULT_MATCHING_WEIGHTS } from '@aashvo/contracts';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MAIL_DISPATCH_PORT } from '../src/modules/auth/services/mail-dispatch.port';
import { ConnectService } from '../src/modules/connect/connect.service';

class NoopMailer {
  async sendVerificationEmail() {}
  async sendPasswordResetEmail() {}
}

describe('Connect Intelligence & 7-Dimension Matching Engine (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let connectService: ConnectService;

  let userAToken: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_DISPATCH_PORT)
      .useClass(NoopMailer)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    connectService = moduleRef.get(ConnectService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        user_matching_preferences,
        match_messages,
        flatmate_matches,
        flatmate_interests,
        user_blocks,
        user_reports,
        safety_reports,
        notification_outbox,
        audit_logs,
        marketplace_profiles,
        flatmate_profiles,
        verification_tokens,
        refresh_sessions,
        profiles,
        users
      CASCADE`,
    );

    // Register User A (DLF Phase 4, Gurugram, Vegetarian, Early Bird, Spotless, 22000 budget, Move-in 2026-12-01)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userA.intel@aashvo.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Aarav Sharma',
        accountType: 'renter',
      })
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    // Create Active Flatmate Profile for User A
    await prisma.flatmateProfile.create({
      data: {
        userId: userAId,
        age: 25,
        gender: 'Male',
        occupation: 'Software Engineer',
        budgetMin: 15000,
        budgetMax: 22000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early_Bird',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'No',
        intentions: ['has_room', 'team_up'],
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        targetLocalities: ['DLF Phase 4'],
        moveInDate: '2026-12-01',
        moveInFlexible: true,
        roomType: 'private_room',
        interests: ['Yoga', 'Specialty Coffee', 'Coding'],
        bio: 'Tech lead seeking clean and calm flatmates.',
        isPublished: true,
        discoveryHidden: false,
      },
    });

    // Register User B (DLF Phase 4, Gurugram, Vegetarian, Early Bird, Spotless, 21000 budget, Move-in 2026-12-03)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userB.intel@aashvo.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Priya Patel',
        accountType: 'renter',
      })
      .expect(201);
    userBId = resB.body.user.id;

    await prisma.flatmateProfile.create({
      data: {
        userId: userBId,
        age: 24,
        gender: 'Female',
        occupation: 'Product Designer',
        budgetMin: 16000,
        budgetMax: 21000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early_Bird',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'No',
        intentions: ['needs_room', 'team_up'],
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        targetLocalities: ['DLF Phase 4'],
        moveInDate: '2026-12-03',
        moveInFlexible: true,
        roomType: 'private_room',
        interests: ['Yoga', 'Reading', 'Specialty Coffee'],
        bio: 'Product designer looking for peaceful shared flat.',
        isPublished: true,
        discoveryHidden: false,
      },
    });

    // Register User C (Different City: Bengaluru, Non-Vegetarian, Night Owl, Relaxed, Move-in 2027-04-01)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userC.intel@aashvo.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Rohan Mehta',
        accountType: 'renter',
      })
      .expect(201);
    userCId = resC.body.user.id;

    await prisma.flatmateProfile.create({
      data: {
        userId: userCId,
        age: 27,
        gender: 'Male',
        occupation: 'Game Developer',
        budgetMin: 35000,
        budgetMax: 45000,
        foodHabit: 'Non_Vegetarian',
        sleepRoutine: 'Night_Owl',
        cleanliness: 'Relaxed',
        petFriendly: false,
        smoking: 'Yes',
        intentions: ['needs_room'],
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        targetLocalities: ['Koramangala'],
        moveInDate: '2027-04-01',
        moveInFlexible: false,
        roomType: 'shared_room',
        interests: ['Gaming', 'Clubbing'],
        bio: 'Game dev who works late nights.',
        isPublished: true,
        discoveryHidden: false,
      },
    });
  });

  describe('1. 7-Dimension Compatibility Computation', () => {
    it('computes near-perfect 7-dimension score for high-alignment pair (User A & User B)', async () => {
      const candidates = await connectService.discoverCandidates(userAId, {});
      const candidateB = candidates.find((c) => c.userId === userBId);

      expect(candidateB).toBeDefined();
      expect(candidateB?.compatibility).toBeDefined();
      const comp = candidateB!.compatibility!;

      expect(comp.scoreAvailable).toBe(true);
      expect(comp.overallScore).toBeGreaterThanOrEqual(85);
      expect(comp.locationScore).toBe(20); // Exact locality match DLF Phase 4 (20/20 max points)
      expect(comp.dimensions?.location.percentage).toBe(100);
      expect(comp.foodScore).toBe(15); // Both vegetarian (15/15)
      expect(comp.dimensions?.food.percentage).toBe(100);
      expect(comp.sleepScore).toBe(10); // Both Early Bird (10/10)
      expect(comp.cleanlinessScore).toBe(20); // Both Spotless (20/20)
      expect(comp.moveInScore).toBe(10); // Dec 1 vs Dec 3 (10/10)
      expect(comp.sharedInterests).toEqual(expect.arrayContaining(['yoga', 'specialty coffee']));
      expect(comp.explanations.length).toBeGreaterThan(0);
      expect(comp.explanations).toContain('Exact locality match: Dlf phase 4');
      expect(comp.dimensions).toBeDefined();
      expect(comp.dimensions?.location.maxScore).toBe(DEFAULT_MATCHING_WEIGHTS.location);
    });

    it('computes low score and divergence explanations for divergent pair (User A & User C)', async () => {
      const candidates = await connectService.discoverCandidates(userAId, {});
      const candidateC = candidates.find((c) => c.userId === userCId);

      expect(candidateC).toBeDefined();
      const comp = candidateC!.compatibility!;

      expect(comp.overallScore).toBeLessThan(50);
      expect(comp.locationScore).toBeLessThanOrEqual(20); // Gurugram vs Bengaluru
      expect(comp.moveInScore).toBeLessThanOrEqual(30); // Dec 2026 vs Apr 2027
    });
  });

  describe('2. Personalized Matching Preferences Endpoints', () => {
    it('returns default weights when user has not saved custom preferences', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/preferences')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.userId).toBe(userAId);
      expect(res.body.weights.budget).toBe(20);
      expect(res.body.weights.location).toBe(20);
      expect(res.body.weights.lifestyle).toBe(20);
      expect(res.body.weights.food).toBe(15);
      expect(res.body.weights.sleep).toBe(10);
      expect(res.body.weights.moveIn).toBe(10);
      expect(res.body.weights.interests).toBe(5);
      expect(res.body.normalizedWeights.budget).toBe(20);
    });

    it('updates custom matching preferences with live normalization and creates audit log', async () => {
      const customInput = {
        budget: 50, // Heavily prioritize budget
        location: 50,
        lifestyle: 0,
        food: 0,
        sleep: 0,
        moveIn: 0,
        interests: 0,
      };

      const res = await request(app.getHttpServer())
        .put('/api/v1/connect/preferences')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(customInput)
        .expect(200);

      expect(res.body.weights.budget).toBe(50);
      expect(res.body.weights.location).toBe(50);
      // Normalized: each should be 50%
      expect(res.body.normalizedWeights.budget).toBe(50);
      expect(res.body.normalizedWeights.location).toBe(50);
      expect(res.body.normalizedWeights.food).toBe(0);

      // Verify DB record
      const dbPref = await prisma.userMatchingPreference.findUnique({
        where: { userId: userAId },
      });
      expect(dbPref).not.toBeNull();
      expect(dbPref?.budgetWeight).toBe(50);

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: {
          actorId: userAId,
          eventType: 'user_matching_preferences.updated',
        },
      });
      expect(audit).not.toBeNull();
    });

    it('rejects unauthenticated requests to matching preferences', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/connect/preferences')
        .expect(401);

      await request(app.getHttpServer())
        .put('/api/v1/connect/preferences')
        .send({ budget: 30 })
        .expect(401);
    });
  });

  describe('3. Advanced Server-Side Discover Filters', () => {
    it('filters candidates by locality', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?locality=DLF%20Phase%204')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.targetLocalities).toContain('DLF Phase 4');
      }
    });

    it('filters candidates by budget range', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?maxBudget=25000')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.budgetMax).toBeLessThanOrEqual(25000);
      }
    });

    it('sorts candidates by budget ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?sortBy=budget_asc')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].budgetMax).toBeLessThanOrEqual(items[1].budgetMax);
    });

    it('sorts candidates by budget descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?sortBy=budget_desc')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].budgetMax).toBeGreaterThanOrEqual(items[1].budgetMax);
    });

    it('filters candidates by lifestyle criteria (diet: Vegetarian)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?foodHabit=Vegetarian')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.foodHabit.toLowerCase()).toBe('vegetarian');
      }
    });

    it('returns scoreAvailable: false and overallScore: 0 when caller has no published flatmate profile', async () => {
      // Register new user without creating a flatmate profile
      const noProfileRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'noprofile.intel@aashvo.test',
          password: 'Str0ngPassword#2026',
          fullName: 'Kavita Mehta',
          accountType: 'renter',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates')
        .set('Authorization', `Bearer ${noProfileRes.body.accessToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.compatibility.scoreAvailable).toBe(false);
        expect(item.compatibility.overallScore).toBe(0);
        expect(item.compatibility.budgetScore).toBe(0);
        expect(item.compatibility.locationScore).toBe(0);
        expect(item.compatibility.explanations).toContain(
          'Publish your flatmate profile to calculate personalized compatibility scores',
        );
      }
    });

    it('returns scoreAvailable: false when caller profile is unpublished (draft)', async () => {
      // Register user with draft/unpublished profile
      const draftUserRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'draft.intel@aashvo.test',
          password: 'Str0ngPassword#2026',
          fullName: 'Siddharth Roy',
          accountType: 'renter',
        })
        .expect(201);

      await prisma.flatmateProfile.create({
        data: {
          userId: draftUserRes.body.user.id,
          occupation: 'UX Designer',
          age: 26,
          gender: 'Male',
          city: 'Gurugram',
          budgetMax: 20000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Flexible',
          cleanliness: 'Moderate',
          smoking: 'No',
          bio: 'Draft profile in progress',
          isPublished: false, // Unpublished draft!
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates')
        .set('Authorization', `Bearer ${draftUserRes.body.accessToken}`)
        .expect(200);

      const items = res.body;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.compatibility.scoreAvailable).toBe(false);
        expect(item.compatibility.overallScore).toBe(0);
      }
    });
  });
});
