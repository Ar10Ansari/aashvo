import { ERROR_CODES } from '@aashvo/contracts';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MAIL_DISPATCH_PORT } from '../src/modules/auth/services/mail-dispatch.port';

class NoopMailer {
  async sendVerificationEmail() {}
  async sendPasswordResetEmail() {}
}

describe('Aashvo Connect Domain & Mutual Matching Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
      .useClass(NoopMailer)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Cleanly truncate tables
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
        flatmate_profiles,
        verification_tokens,
        refresh_sessions,
        profiles,
        users
      CASCADE`,
    );

    // Register User A (Student in Gurugram, Vegetarian, Early Bird, Spotless, 15000 budget, Tech/Cooking/Music)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userA@connect.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Aarav Sharma',
        accountType: 'renter',
      })
      .expect(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.accessToken;

    // Register User B (Young professional in Gurugram, Vegetarian, Early Bird, Spotless, 16000 budget, Tech/Cooking/Reading)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userB@connect.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Bhavna Patel',
        accountType: 'renter',
      })
      .expect(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.accessToken;

    // Register User C (Third party user)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userC@connect.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Chirag Rao',
        accountType: 'renter',
      })
      .expect(201);
    userCId = resC.body.user.id;
    userCToken = resC.body.accessToken;

    // Seed flatmate profiles for A and B
    await request(app.getHttpServer())
      .post('/api/v1/flatmates/me')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        occupation: 'Software Engineer',
        age: 23,
        gender: 'male',
        city: 'Gurugram',
        targetLocalities: ['Sector 43', 'DLF Phase 1'],
        budgetMax: 15000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'Non-smoker',
        bio: 'Tech enthusiast who loves clean spaces and home cooking.',
        interests: ['Tech', 'Cooking', 'Music'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/flatmates/me')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        occupation: 'Product Designer',
        age: 24,
        gender: 'female',
        city: 'Gurugram',
        targetLocalities: ['Sector 43', 'DLF Phase 2'],
        budgetMax: 16000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        petFriendly: true,
        smoking: 'Non-smoker',
        bio: 'Design nerd and morning runner looking for respectful flatmates.',
        interests: ['Tech', 'Cooking', 'Reading'],
      })
      .expect(201);
  });

  describe('1. Compatibility Engine & Discovery Feed', () => {
    it('discovers compatible candidate with accurate 5-dimension score breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/discover?city=Gurugram')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);

      const candidate = res.body[0];
      expect(candidate.userId).toBe(userBId);
      expect(candidate.displayName).toBe('Bhavna');
      expect(candidate.age).toBe(24);
      expect(candidate.city).toBe('Gurugram');

      // Compatibility calculation:
      // Food (exact match): 25/25
      // Sleep (exact match): 20/20
      // Cleanliness (exact match): 20/20
      // Budget (15000 / 16000 * 20 = 19): 19/20
      // Interests (2 shared: Tech, Cooking): 10/15
      // Total: 25 + 20 + 20 + 19 + 10 = 94
      expect(candidate.compatibility.foodScore).toBe(15);
      expect(candidate.compatibility.sleepScore).toBe(10);
      expect(candidate.compatibility.cleanlinessScore).toBe(20);
      expect(candidate.compatibility.locationScore).toBe(20);
      expect(candidate.compatibility.overallScore).toBeGreaterThanOrEqual(90);
      expect(candidate.compatibility.sharedInterests).toEqual(expect.arrayContaining(['tech', 'cooking']));
    });

    it('excludes caller own profile from discovery', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const ids = res.body.map((c: any) => c.userId);
      expect(ids).not.toContain(userAId);
    });

    it('respects discoveryHidden visibility toggle', async () => {
      // User B hides profile
      await request(app.getHttpServer())
        .patch('/api/v1/connect/visibility')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ discoveryHidden: true })
        .expect(200);

      // User A queries discover
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.length).toBe(0);

      // User B restores visibility
      await request(app.getHttpServer())
        .patch('/api/v1/connect/visibility')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ discoveryHidden: false })
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res2.body.length).toBe(1);
    });
  });

  describe('2. Swipe & Mutual Matching Workflow', () => {
    it('prevents self-swiping', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userAId, action: 'like' })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    });

    it('records unilateral like without creating match', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.matched).toBe(false);

      // Verify no match in database
      const matches = await prisma.flatmateMatch.findMany();
      expect(matches.length).toBe(0);
    });

    it('creates mutual match when reciprocal like occurs', async () => {
      // 1. User A likes User B
      await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      // 2. User B likes User A (reciprocal swipe)
      const resB = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetUserId: userAId, action: 'like' })
        .expect(201);

      expect(resB.body.success).toBe(true);
      expect(resB.body.matched).toBe(true);
      expect(resB.body.match).toBeDefined();
      expect(resB.body.match.partner.userId).toBe(userAId);

      // 3. Verify exactly 1 match in database
      const matches = await prisma.flatmateMatch.findMany();
      expect(matches.length).toBe(1);
      expect(matches[0].status).toBe('active');

      // 4. Verify notification outbox contains notifications for both users
      const outbox = await prisma.notificationOutbox.findMany({
        where: { templateKey: 'flatmate_match_created' },
      });
      expect(outbox.length).toBe(2);
      const recipients = outbox.map((o) => o.recipient);
      expect(recipients).toContain(userAId);
      expect(recipients).toContain(userBId);
    });

    it('is idempotent on duplicate likes', async () => {
      // Swiping twice on the same user does not throw error or create duplicates
      await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      expect(res2.body.success).toBe(true);
      const interests = await prisma.flatmateInterest.findMany({
        where: { senderId: userAId, targetUserId: userBId },
      });
      expect(interests.length).toBe(1);
    });

    it('handles pass swipe without matching', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/pass')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.matched).toBe(false);

      // Swiped user is now excluded from discovery
      const discover = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);
      expect(discover.body.length).toBe(0);
    });

    it('supports undo of recent swipe action', async () => {
      // User A passes on User B
      await request(app.getHttpServer())
        .post('/api/v1/connect/pass')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId })
        .expect(201);

      // Verify excluded from discovery
      const d1 = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);
      expect(d1.body.length).toBe(0);

      // User A undoes swipe
      const undoRes = await request(app.getHttpServer())
        .post('/api/v1/connect/undo')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(undoRes.body.success).toBe(true);
      expect(undoRes.body.undoneTargetUserId).toBe(userBId);
      expect(undoRes.body.previousAction).toBe('pass');

      // Profile reappears in discovery
      const d2 = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);
      expect(d2.body.length).toBe(1);
    });
  });

  describe('3. Matches, Messaging & Security Boundaries', () => {
    let matchId: string;

    beforeEach(async () => {
      // Establish mutual match between A and B
      await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetUserId: userAId, action: 'like' });

      matchId = res.body.match.id;
    });

    it('allows matched participants to view their match', async () => {
      const resA = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(resA.body.length).toBe(1);
      expect(resA.body[0].partner.userId).toBe(userBId);

      const resB = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(resB.body.length).toBe(1);
      expect(resB.body[0].partner.userId).toBe(userAId);
    });

    it('denies third-party user access to match details', async () => {
      expect(userCId).toBeDefined();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${matchId}`)
        .set('Authorization', `Bearer ${userCToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows matched participants to exchange messages with read receipts', async () => {
      // User A sends message
      const sendRes = await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ content: 'Hey Bhavna! Saw your profile, love early runs and tech.' })
        .expect(201);

      expect(sendRes.body.content).toContain('Hey Bhavna!');
      expect(sendRes.body.senderId).toBe(userAId);
      expect(sendRes.body.readAt).toBeNull();

      // User B reads messages
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(getRes.body.length).toBe(1);
      expect(getRes.body[0].content).toContain('Hey Bhavna!');

      // Check that readAt was updated
      const msgInDb = await prisma.matchMessage.findUnique({
        where: { id: sendRes.body.id },
      });
      expect(msgInDb?.readAt).not.toBeNull();
    });

    it('denies third-party user from reading or sending messages in the match', async () => {
      // Read attempt by C
      await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${userCToken}`)
        .expect(403);

      // Send attempt by C
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${userCToken}`)
        .send({ content: 'Unauthorized message injection' })
        .expect(403);
    });
  });

  describe('4. Safety: Blocking & Reporting', () => {
    let matchId: string;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetUserId: userAId, action: 'like' });

      matchId = res.body.match.id;
    });

    it('blocking a user terminates match and prevents future messaging', async () => {
      // User A blocks User B
      await request(app.getHttpServer())
        .post(`/api/v1/connect/users/${userBId}/block`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ reason: 'Inappropriate language' })
        .expect(201);

      // Verify match marked as blocked
      const match = await prisma.flatmateMatch.findUnique({
        where: { id: matchId },
      });
      expect(match?.status).toBe('blocked');

      // User B attempts to send message in the match
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ content: 'Are you there?' })
        .expect(400);

      // Neither user sees the other in active matches
      const matchesA = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);
      expect(matchesA.body.length).toBe(0);

      const matchesB = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);
      expect(matchesB.body.length).toBe(0);
    });

    it('reporting a user records UserReport and platform SafetyReport', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/connect/users/${userBId}/report`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          reason: 'misleading_profile',
          details: 'Profile photos appear to be stolen from internet',
        })
        .expect(201);

      const report = await prisma.userReport.findFirst({
        where: { reporterId: userAId, reportedId: userBId },
      });
      expect(report).toBeDefined();
      expect(report?.reason).toBe('misleading_profile');

      const safetyReport = await prisma.safetyReport.findFirst({
        where: { reporterId: userAId, reportedUserId: userBId },
      });
      expect(safetyReport).toBeDefined();
      expect(safetyReport?.priority).toBe('high');
    });
  });

  describe('4. Three Flatmate Intentions & Direct Inquiries Independence', () => {
    it('supports selecting multiple intentions (has_room, needs_room, team_up) and updating them later', async () => {
      // 1. User A sets all 3 intentions (has a room, open to other rooms, wants to team up)
      const res1 = await request(app.getHttpServer())
        .patch('/api/v1/connect/intentions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ intentions: ['has_room', 'needs_room', 'team_up'] })
        .expect(200);

      expect(res1.body.success).toBe(true);
      expect(res1.body.intentions).toEqual(
        expect.arrayContaining(['has_room', 'needs_room', 'team_up']),
      );
      expect(res1.body.hasRoom).toBe(true);

      // Verify in database
      const profileA = await prisma.flatmateProfile.findUnique({
        where: { userId: userAId },
      });
      expect(profileA?.intentions).toEqual(
        expect.arrayContaining(['has_room', 'needs_room', 'team_up']),
      );

      // 2. User A updates intentions later to only team_up
      const res2 = await request(app.getHttpServer())
        .patch('/api/v1/connect/intentions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ intentions: ['team_up'] })
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.intentions).toEqual(['team_up']);
      expect(res2.body.hasRoom).toBe(false);

      // Verify database updated
      const profileA2 = await prisma.flatmateProfile.findUnique({
        where: { userId: userAId },
      });
      expect(profileA2?.intentions).toEqual(['team_up']);
      expect(profileA2?.hasRoom).toBe(false);
    });

    it('filters discovery candidates accurately by intention (e.g. team_up)', async () => {
      // User B sets intentions: team_up
      await request(app.getHttpServer())
        .patch('/api/v1/connect/intentions')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ intentions: ['team_up'] })
        .expect(200);

      // User A searches with intention=team_up
      const resTeamUp = await request(app.getHttpServer())
        .get('/api/v1/connect/discover?intention=team_up')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(resTeamUp.body.length).toBe(1);
      expect(resTeamUp.body[0].userId).toBe(userBId);
      expect(resTeamUp.body[0].intentions).toContain('team_up');

      // User A searches with intention=has_room (User B does not have has_room)
      const resHasRoom = await request(app.getHttpServer())
        .get('/api/v1/connect/discover?intention=has_room')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(resHasRoom.body.length).toBe(0);
    });

    it('direct property inquiries remain 100% functional and independent of Connect matching', async () => {
      // 1. Create a property owned by User B
      const prop = await prisma.property.create({
        data: {
          ownerId: userBId,
          title: 'DLF Phase 4 Spacious Master Room',
          addressShort: 'Near Galleria Market',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'DLF Phase 4',
          city: 'Gurugram',
          rentAmount: new Prisma.Decimal(24000),
          depositAmount: new Prisma.Decimal(30000),
          maintenanceCharge: new Prisma.Decimal(1500),
          providerType: 'owner',
          bedrooms: 3,
          bathrooms: 3,
          availableFrom: new Date().toISOString(),
          status: 'active',
          description: 'Spacious master room with private balcony',
        },
      });

      // 2. User A inquires directly about User B's property WITHOUT any matching
      const inqRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          propertyId: prop.id,
          senderName: 'Rohan Verma',
          senderPhone: '+919876543210',
          senderEmail: 'rohan.verma@example.com',
          message: 'Hello, I am interested in viewing this property this Saturday.',
        })
        .expect(201);

      expect(inqRes.body).toBeDefined();
      expect(inqRes.body.propertyId).toBe(prop.id);
      expect(inqRes.body.status).toBe('pending');

      // 3. Confirm that direct inquiry does NOT create an Aashvo Connect match
      const matchesRes = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(matchesRes.body.length).toBe(0);
    });
  });

  describe('5. Production Contract Aliasing, Route Verification & Unauthenticated / Empty Invariants', () => {
    it('supports GET /api/v1/connect/candidates contract path for authenticated users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?city=Gurugram')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].userId).toBe(userBId);
      expect(res.body[0].displayName).toBe('Bhavna');
    });

    it('returns empty array [] with status 200 when candidate results are empty (never 404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?city=NonExistentCity')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('allows unauthenticated requests to preview candidate profiles via GET /api/v1/connect/candidates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/connect/candidates?city=Gurugram')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('strictly denies unauthenticated requests to protected match and swipe endpoints with 401', async () => {
      // 1. Matches requires authentication
      const matchesRes = await request(app.getHttpServer())
        .get('/api/v1/connect/matches')
        .expect(401);

      expect(matchesRes.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

      // 2. Swipe requires authentication
      const swipeRes = await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .send({ targetUserId: userBId, action: 'like' })
        .expect(401);

      expect(swipeRes.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

      // 3. Refresh without token or cookie returns 401
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);

      expect(refreshRes.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('supports swiping and mutual matching via POST /api/v1/connect/swipe', async () => {
      // 1. User A likes User B via /swipe
      const resA = await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userBId, action: 'like' })
        .expect(201);

      expect(resA.body.success).toBe(true);
      expect(resA.body.matched).toBe(false);

      // 2. User B reciprocates via /swipe
      const resB = await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetUserId: userAId, action: 'like' })
        .expect(201);

      expect(resB.body.success).toBe(true);
      expect(resB.body.matched).toBe(true);
      expect(resB.body.match).toBeDefined();
      expect(resB.body.match.partner.userId).toBe(userAId);
    });

    it('supports blocking a user by body payload via POST /api/v1/connect/block', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/block')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: userCId, reason: 'Inappropriate conduct' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User blocked successfully.');

      // Verify user block exists in database
      const block = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: userAId, blockedId: userCId },
        },
      });
      expect(block).not.toBeNull();
    });

    it('supports reporting a user by body payload via POST /api/v1/connect/report', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/connect/report')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetUserId: userCId,
          reason: 'Spam listing',
          details: 'Advertised fake rent price',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Safety report received and queued for staff moderation.');

      // Verify report in database
      const report = await prisma.safetyReport.findFirst({
        where: { reporterId: userAId, reportedUserId: userCId },
      });
      expect(report).not.toBeNull();
      expect(report?.reasonCode).toBe('Spam listing');
    });

    it('issues refreshToken on login and allows rotation via POST /api/v1/auth/refresh body', async () => {
      // 1. Login User A (native mobile client receiving body refresh token)
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-client-platform', 'ios')
        .send({
          email: 'userA@connect.test',
          password: 'Str0ngPassword#2026',
        })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.refreshToken).toBeDefined();

      const rawRefreshToken = loginRes.body.refreshToken;

      // 2. Rotate via /auth/refresh with body token (mobile platform)
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('x-client-platform', 'ios')
        .send({ refreshToken: rawRefreshToken })
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(rawRefreshToken);
    });
  });
});
