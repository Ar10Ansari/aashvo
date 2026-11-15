import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MAIL_DISPATCH_PORT } from '../src/modules/auth/services/mail-dispatch.port';

class NoopMailer {
  async sendVerificationEmail() {}
  async sendPasswordResetEmail() {}
}

describe('Marketplace Profiles, Progressive Onboarding & Connect Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;

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
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        marketplace_profiles,
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

    // Register User 1
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user1@marketplace.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Dev Sharma',
        accountType: 'renter',
      })
      .expect(201);
    user1Id = res1.body.user.id;
    user1Token = res1.body.accessToken;

    // Register User 2
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user2@marketplace.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Rhea Kapoor',
        accountType: 'renter',
      })
      .expect(201);
    user2Id = res2.body.user.id;
    user2Token = res2.body.accessToken;
  });

  describe('1. Account Role vs Marketplace Profile Separation', () => {
    it('initializes default marketplace profile without altering system UserRole', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profiles/marketplace')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].userId).toBe(user1Id);
      expect(res.body[0].isCurrentActive).toBe(true);

      // Verify system role in users table remains 'renter'
      const userRecord = await prisma.user.findUniqueOrThrow({ where: { id: user1Id } });
      expect(userRecord.role).toBe('renter');
    });

    it('allows creating multiple marketplace profiles under one account', async () => {
      // Create Property Owner profile
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/profiles/marketplace')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          profileType: 'property_owner',
          displayName: 'Dev (Property Owner)',
          metadata: { contactPref: 'email' },
        })
        .expect(201);

      expect(createRes.body.profileType).toBe('property_owner');
      expect(createRes.body.displayName).toBe('Dev (Property Owner)');

      // Fetch all profiles for user
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/profiles/marketplace')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const types = listRes.body.map((p: any) => p.profileType);
      expect(types).toContain('flatmate_seeker');
      expect(types).toContain('property_owner');

      // System role must never be granted admin
      const userRecord = await prisma.user.findUniqueOrThrow({ where: { id: user1Id } });
      expect(userRecord.role).toBe('renter');
    });

    it('supports switching active marketplace profile without logging out', async () => {
      // First ensure both profiles exist
      await request(app.getHttpServer())
        .post('/api/v1/profiles/marketplace')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ profileType: 'family_stay_host', displayName: 'Dev Host' })
        .expect(201);

      // Switch to family_stay_host
      const switchRes = await request(app.getHttpServer())
        .post('/api/v1/profiles/marketplace/switch')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ profileType: 'family_stay_host' })
        .expect(200);

      expect(switchRes.body.profileType).toBe('family_stay_host');
      expect(switchRes.body.isCurrentActive).toBe(true);

      // Verify other profiles have isCurrentActive = false
      const profiles = await request(app.getHttpServer())
        .get('/api/v1/profiles/marketplace')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const activeProfiles = profiles.body.filter((p: any) => p.isCurrentActive);
      expect(activeProfiles).toHaveLength(1);
      expect(activeProfiles[0].profileType).toBe('family_stay_host');
    });
  });

  describe('2. Progressive Multi-Step Onboarding Flow', () => {
    it('saves incomplete profile as draft with dynamic completion breakdown', async () => {
      const onboardingData = {
        fullName: 'Dev Sharma',
        age: 23,
        profession: 'Software Engineer',
        bio: 'Quiet engineer looking for flatmates in Gurugram.',
        city: 'Gurugram',
        targetLocalities: ['DLF Phase 2'],
        budgetMax: 20000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        smoking: 'No',
        petFriendly: true,
        publishImmediately: false, // Save as draft
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(onboardingData)
        .expect(200);

      expect(res.body.marketplaceProfile.status).toBe('draft');
      expect(res.body.completion.totalPercent).toBeGreaterThanOrEqual(70);
      expect(res.body.completion.isPublished).toBe(false);
      expect(res.body.completion.missingFields).toContain('Profile Photo');
    });

    it('rejects onboarding registration when age is under 18', async () => {
      const underageData = {
        fullName: 'Minor User',
        age: 17,
        profession: 'Student',
        bio: 'High school student looking for accommodation.',
        city: 'Gurugram',
        budgetMax: 10000,
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Flexible',
        cleanliness: 'Moderate',
        smoking: 'No',
        petFriendly: false,
        publishImmediately: true,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(underageData)
        .expect(400);

      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.stringContaining('18')]),
      );
    });

    it('publishes profile when minimum required fields are satisfied', async () => {
      const completeData = {
        fullName: 'Dev Sharma',
        avatarUrl: 'https://example.com/dev.jpg',
        age: 23,
        gender: 'male',
        profession: 'Software Engineer',
        collegeOrWorkplace: 'IIT Roorkee',
        bio: 'Calm engineer looking for like-minded roommates in DLF Phase 2.',
        languages: ['English', 'Hindi'],
        interests: ['Tech', 'Running'],
        country: 'India',
        state: 'Haryana',
        city: 'Gurugram',
        targetLocalities: ['DLF Phase 2', 'Cyber City'],
        budgetMin: 15000,
        budgetMax: 25000,
        moveInDate: '2026-12-01',
        moveInFlexible: true,
        roomType: 'private_room',
        furnishing: 'fully_furnished',
        hasRoom: false,
        intentions: ['needs_room', 'team_up'],
        foodHabit: 'Vegetarian',
        sleepRoutine: 'Early Bird',
        cleanliness: 'Spotless',
        smoking: 'No',
        drinking: 'No',
        petFriendly: true,
        socialLifestyle: 'Quiet',
        wfhHabits: 'Hybrid',
        noiseTolerance: 'Low',
        publishImmediately: true,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(completeData)
        .expect(200);

      expect(res.body.marketplaceProfile.status).toBe('active');
      expect(res.body.completion.totalPercent).toBe(100);
      expect(res.body.completion.isComplete).toBe(true);
      expect(res.body.completion.isPublished).toBe(true);
      expect(res.body.completion.missingFields).toHaveLength(0);
    });
  });

  describe('3. Connect Integration & Unpublished Profile Exclusion', () => {
    it('excludes draft and unpublished profiles from Connect discovery', async () => {
      // User 2 saves onboarding as draft (isPublished = false)
      await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          fullName: 'Rhea Kapoor',
          age: 22,
          profession: 'Designer',
          bio: 'Draft profile not ready to be discovered.',
          city: 'Gurugram',
          budgetMax: 20000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'No',
          petFriendly: true,
          publishImmediately: false, // Draft!
        })
        .expect(200);

      // User 1 discovers candidates: User 2 must NOT appear
      const discRes = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const candidateUserIds = discRes.body.map((c: any) => c.userId);
      expect(candidateUserIds).not.toContain(user2Id);

      // User 2 explicitly publishes profile
      await request(app.getHttpServer())
        .post('/api/v1/profiles/publish')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Now User 1 discovers candidates: User 2 MUST appear
      const discResAfter = await request(app.getHttpServer())
        .get('/api/v1/connect/discover')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const candidateUserIdsAfter = discResAfter.body.map((c: any) => c.userId);
      expect(candidateUserIdsAfter).toContain(user2Id);
    });
  });

  describe('4. Incoming / Outgoing Likes & Mutual Unmatching', () => {
    beforeEach(async () => {
      // Ensure both User 1 and User 2 have published profiles
      await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          fullName: 'Dev Sharma',
          age: 23,
          profession: 'Engineer',
          bio: 'Dev profile published for matching.',
          city: 'Gurugram',
          targetLocalities: ['DLF Phase 2'],
          budgetMax: 22000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'No',
          petFriendly: true,
          publishImmediately: true,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/profiles/onboarding')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          fullName: 'Rhea Kapoor',
          age: 22,
          profession: 'Designer',
          bio: 'Rhea profile published for matching.',
          city: 'Gurugram',
          targetLocalities: ['DLF Phase 2'],
          budgetMax: 20000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'No',
          petFriendly: true,
          publishImmediately: true,
        })
        .expect(200);
    });

    it('tracks incoming and outgoing likes before mutual match', async () => {
      // User 1 likes User 2
      await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ targetUserId: user2Id, action: 'like' })
        .expect(201);

      // User 1 outgoing likes has User 2
      const sentRes = await request(app.getHttpServer())
        .get('/api/v1/connect/likes/sent')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
      expect(sentRes.body.map((l: any) => l.userId)).toContain(user2Id);

      // User 2 incoming likes has User 1
      const receivedRes = await request(app.getHttpServer())
        .get('/api/v1/connect/likes/received')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);
      expect(receivedRes.body.map((l: any) => l.userId)).toContain(user1Id);
    });

    it('supports unmatching active mutual match and terminates messaging authorization', async () => {
      // User 1 likes User 2
      await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ targetUserId: user2Id, action: 'like' })
        .expect(201);

      // User 2 reciprocal likes User 1 -> Mutual Match created!
      const matchRes = await request(app.getHttpServer())
        .post('/api/v1/connect/swipe')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ targetUserId: user1Id, action: 'like' })
        .expect(201);

      expect(matchRes.body.matched).toBe(true);
      const matchId = matchRes.body.match.id;

      // User 1 can send message while active
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Hi Rhea, great to match with you!' })
        .expect(201);

      // User 1 unmatches
      const unmatchRes = await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/unmatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reason: 'Found other accommodation' })
        .expect(200);

      expect(unmatchRes.body.success).toBe(true);

      // Messaging after unmatching is now rejected as match is inactive
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Are you still there?' })
        .expect(400);
    });
  });
});
