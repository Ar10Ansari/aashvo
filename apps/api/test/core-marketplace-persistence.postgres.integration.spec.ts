import { ERROR_CODES } from '@aashvo/contracts';
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

describe('Core Marketplace Persistence & P0 Remediation Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let ownerId: string;
  let renterToken: string;
  let renterId: string;
  let otherUserToken: string;
  let adminToken: string;
  let adminId: string;

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

  beforeEach(async () => {
    // Truncate domain tables cleanly
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        audit_logs,
        user_notifications,
        notification_outbox,
        verification_tokens,
        refresh_sessions,
        interest_requests,
        property_photos,
        properties,
        flatmate_profiles,
        media_assets,
        profiles,
        users
      CASCADE`,
    );

    // 1. Owner user
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'vikram.owner@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Vikram Malhotra',
        accountType: 'owner',
      })
      .expect(201);
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // 2. Renter user
    const renterRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'ananya.renter@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Ananya Sharma',
        accountType: 'renter',
      })
      .expect(201);
    renterToken = renterRes.body.accessToken;
    renterId = renterRes.body.user.id;

    // 3. Third independent user
    const otherRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'kabir.other@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Kabir Mehta',
        accountType: 'renter',
      })
      .expect(201);
    otherUserToken = otherRes.body.accessToken;

    // 4. Admin user
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin.platform@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Aashvo Admin',
      })
      .expect(201);
    adminId = adminReg.body.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin.platform@aashvo-test.in', password: 'Str0ngPassword#2026' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==========================================================================
  // P0-01: PROPERTY LISTING CREATION & LIFECYCLE PERSISTENCE
  // ==========================================================================
  describe('P0-01: Property Listing Creation & Persistence', () => {
    const validPropertyPayload = {
      title: 'Spacious 2BHK in DLF Phase 4 near Galleria',
      description: 'Fully furnished luxury apartment with 100% power backup and modular kitchen.',
      category: 'flats_rooms',
      propertyType: 'apartment',
      roomType: 'entire_flat',
      furnishing: 'fully_furnished',
      locality: 'DLF Phase 4',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002',
      addressShort: 'Near Galleria Market',
      rentAmount: 35000,
      depositAmount: 70000,
      maintenanceCharge: 3000,
      electricityRatePerUnit: 8.5,
      brokerageFee: 0,
      providerType: 'owner',
      genderPreference: 'any',
      bedrooms: 2,
      bathrooms: 2,
      availableFrom: 'Immediately',
      amenities: ['100% Power Backup', 'High-Speed Wi-Fi', 'Air Conditioner'],
      houseRules: ['No smoking indoors', 'Co-living harmony'],
      photoUrls: [
        { photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c', isPrimary: true, sortOrder: 0 },
        { photoUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267', isPrimary: false, sortOrder: 1 },
      ],
    };

    test('authenticates owner and creates listing in pending_review status when published', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validPropertyPayload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe(validPropertyPayload.title);
      expect(res.body.rentAmount).toBe(35000);
      expect(res.body.status).toBe('pending_review');
      expect(res.body.photos).toHaveLength(2);
      expect(res.body.owner.id).toBe(ownerId);

      // Verify direct PostgreSQL persistence
      const dbProp = await prisma.property.findUnique({
        where: { id: res.body.id },
        include: { photos: true },
      });
      expect(dbProp).not.toBeNull();
      expect(dbProp!.ownerId).toBe(ownerId);
      expect(dbProp!.status).toBe('pending_review');
      expect(dbProp!.photos).toHaveLength(2);
    });

    test('creates listing in paused status when saved as draft (asDraft: true)', async () => {
      const draftRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ...validPropertyPayload, asDraft: true })
        .expect(201);

      expect(draftRes.body.status).toBe('paused');

      const dbProp = await prisma.property.findUnique({ where: { id: draftRes.body.id } });
      expect(dbProp!.status).toBe('paused');
    });

    test('rejects unauthenticated listing creation with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/properties')
        .send(validPropertyPayload)
        .expect(401);
    });

    test('rejects invalid payload with missing mandatory fields (400 Bad Request)', async () => {
      const badRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Short' }) // Missing rent, description, locality, city, etc.
        .expect(400);

      expect(badRes.body.error).toBeDefined();
    });

    test('persists and retrieves listing on query and refresh via /properties/mine and /properties/:id', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validPropertyPayload)
        .expect(201);

      const propId = createRes.body.id;

      // Owner retrieves own properties across all statuses
      const mineRes = await request(app.getHttpServer())
        .get('/api/v1/properties/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(mineRes.body.some((p: any) => p.id === propId)).toBe(true);

      // Owner retrieves direct property details
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(detailRes.body.id).toBe(propId);
      expect(detailRes.body.title).toBe(validPropertyPayload.title);
    });

    test('strictly hides pending_review and paused listings from anonymous public search', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validPropertyPayload)
        .expect(201);

      const propId = createRes.body.id;

      // Anonymous public search
      const publicSearch = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);

      expect(publicSearch.body.data.some((p: any) => p.id === propId)).toBe(false);

      // Admin activates listing
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active', reason: 'Verified documentation' })
        .expect(200);

      // Now public search returns the listing
      const publicSearchAfter = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);

      expect(publicSearchAfter.body.data.some((p: any) => p.id === propId)).toBe(true);
    });

    test('prevents unauthorized users from updating or deleting owner listings (403 Forbidden)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validPropertyPayload)
        .expect(201);

      const propId = createRes.body.id;

      // Other user attempts to update rent
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ rentAmount: 10000 })
        .expect(403);

      // Other user attempts to delete property
      await request(app.getHttpServer())
        .delete(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    test('allows owner to update details, pause listing, and re-activate / confirm availability', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validPropertyPayload)
        .expect(201);

      const propId = createRes.body.id;

      // Activate via admin
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      // Owner pauses listing
      const pauseRes = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(pauseRes.body.status).toBe('paused');

      // Owner unpauses listing back to active (availability restored)
      const unpauseRes = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(unpauseRes.body.status).toBe('active');

      // Owner deletes property
      await request(app.getHttpServer())
        .delete(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const dbCheck = await prisma.property.findUnique({ where: { id: propId } });
      expect(dbCheck).toBeNull();
    });
  });

  // ==========================================================================
  // P0-02: PROPERTY INQUIRIES & PERSISTENCE
  // ==========================================================================
  describe('P0-02: Property Inquiries & Lifecycle Persistence', () => {
    let testPropertyId: string;

    beforeEach(async () => {
      // Create and activate a property
      const p = await prisma.property.create({
        data: {
          ownerId,
          title: 'Sunlit Studio in Sector 54',
          description: 'Compact and cozy studio near rapid metro station.',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Sector 54',
          city: 'Gurugram',
          state: 'Haryana',
          addressShort: 'Near Suncity',
          rentAmount: 18000,
          providerType: 'owner',
          availableFrom: 'Immediately',
          status: 'active',
        },
      });
      testPropertyId = p.id;
    });

    test('persists inquiry in PostgreSQL and delivers in-app user notification to property owner', async () => {
      const inquiryPayload = {
        propertyId: testPropertyId,
        senderName: 'Ananya Sharma',
        senderPhone: '+919876543210',
        senderEmail: 'ananya.renter@aashvo-test.in',
        moveInDate: '2026-12-01',
        message: 'Hi Vikram, I am interested in renting this studio. Can we schedule a visit this weekend?',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(inquiryPayload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.senderId).toBe(renterId);
      expect(res.body.propertyId).toBe(testPropertyId);
      expect(res.body.status).toBe('pending');
      expect(res.body.message).toContain('schedule a visit');

      // Verify PostgreSQL persistence
      const dbInq = await prisma.interestRequest.findUnique({
        where: { id: res.body.id },
      });
      expect(dbInq).not.toBeNull();
      expect(dbInq!.senderId).toBe(renterId);
      expect(dbInq!.propertyId).toBe(testPropertyId);

      // Verify owner received in-app notification in user_notifications table
      const ownerNotifs = await prisma.userNotification.findMany({
        where: { userId: ownerId },
      });
      expect(ownerNotifs.length).toBeGreaterThanOrEqual(1);
      const inqNotif = ownerNotifs.find((n) => n.category === 'property_inquiry');
      expect(inqNotif).toBeDefined();
      expect(inqNotif!.title).toBe('New Property Inquiry');
      expect(inqNotif!.body).toContain('Ananya Sharma');
      expect(inqNotif!.read).toBe(false);
    });

    test('rejects self-inquiry when owner attempts to inquire on own listing (400 Bad Request)', async () => {
      const selfInquiryRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          propertyId: testPropertyId,
          senderName: 'Vikram Malhotra',
          senderPhone: '+919810123456',
          senderEmail: 'vikram.owner@aashvo-test.in',
          message: 'Can I rent my own property?',
        })
        .expect(400);

      expect(selfInquiryRes.body.error).toBeDefined();
    });

    test('rejects duplicate pending inquiry for the same property from same user (409 Conflict)', async () => {
      const inquiryPayload = {
        propertyId: testPropertyId,
        senderName: 'Ananya Sharma',
        senderPhone: '+919876543210',
        senderEmail: 'ananya.renter@aashvo-test.in',
        message: 'First inquiry submission.',
      };

      await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(inquiryPayload)
        .expect(201);

      // Second identical pending inquiry
      const dupRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(inquiryPayload)
        .expect(409);

      expect(dupRes.body.error.code).toBe(ERROR_CODES.DUPLICATE_INQUIRY);
    });

    test('allows owner to retrieve received inquiries and renter to retrieve sent inquiries', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: testPropertyId,
          senderName: 'Ananya Sharma',
          senderPhone: '+919876543210',
          senderEmail: 'ananya.renter@aashvo-test.in',
          message: 'Viewing inquiry message.',
        })
        .expect(201);

      // Owner retrieves received inquiries
      const receivedRes = await request(app.getHttpServer())
        .get('/api/v1/inquiries/received')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(receivedRes.body.length).toBeGreaterThanOrEqual(1);
      expect(receivedRes.body[0].propertyId).toBe(testPropertyId);

      // Renter retrieves sent inquiries
      const sentRes = await request(app.getHttpServer())
        .get('/api/v1/inquiries/sent')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(sentRes.body.length).toBeGreaterThanOrEqual(1);
      expect(sentRes.body[0].propertyId).toBe(testPropertyId);
    });

    test('enforces owner-only status update and strict state transitions (pending -> accepted -> no flip-flop)', async () => {
      const inqRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: testPropertyId,
          senderName: 'Ananya Sharma',
          senderPhone: '+919876543210',
          senderEmail: 'ananya.renter@aashvo-test.in',
          message: 'Acceptance test message.',
        })
        .expect(201);

      const inqId = inqRes.body.id;

      // Unauthorized user cannot update status (403)
      await request(app.getHttpServer())
        .patch(`/api/v1/inquiries/${inqId}/status`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ status: 'accepted' })
        .expect(403);

      // Owner accepts inquiry
      const acceptRes = await request(app.getHttpServer())
        .patch(`/api/v1/inquiries/${inqId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'accepted' })
        .expect(200);

      expect(acceptRes.body.status).toBe('accepted');

      // Verify notification created for requester
      const renterNotifs = await prisma.userNotification.findMany({
        where: { userId: renterId },
      });
      expect(renterNotifs.some((n) => n.title.includes('Accepted'))).toBe(true);

      // Attempting to transition already accepted inquiry throws 400 Bad Request
      await request(app.getHttpServer())
        .patch(`/api/v1/inquiries/${inqId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'declined' })
        .expect(400);
    });
  });

  // ==========================================================================
  // P0-03: NOTIFICATION ENDPOINTS & ROUTE CONSISTENCY
  // ==========================================================================
  describe('P0-03: Notification Endpoints & Route Consistency', () => {
    let notif1Id: string;

    beforeEach(async () => {
      // Create 2 test notifications for renter
      const n1 = await prisma.userNotification.create({
        data: {
          userId: renterId,
          category: 'property_inquiry',
          title: 'First Notification',
          body: 'Your inquiry was received.',
          read: false,
        },
      });
      notif1Id = n1.id;

      await prisma.userNotification.create({
        data: {
          userId: renterId,
          category: 'visit_request',
          title: 'Second Notification',
          body: 'Visit appointment confirmed.',
          read: false,
        },
      });
    });

    test('retrieves user notifications and unread count', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(listRes.body.items).toHaveLength(2);
      expect(listRes.body.unreadCount).toBe(2);

      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.unreadCount).toBe(2);
    });

    test('marks single notification as read and updates unread count', async () => {
      const markRes = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(markRes.body.read).toBe(true);

      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.unreadCount).toBe(1);
    });

    test('prevents unauthorized user from marking another user notification as read (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    test('marks all notifications read via POST /api/v1/notifications/read-all', async () => {
      const readAllRes = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(readAllRes.body.success).toBe(true);
      expect(readAllRes.body.markedCount).toBe(2);

      // Verify unread count is 0
      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.unreadCount).toBe(0);

      // Verify PostgreSQL persistence
      const dbNotifs = await prisma.userNotification.findMany({
        where: { userId: renterId },
      });
      expect(dbNotifs.every((n) => n.read === true)).toBe(true);
      expect(dbNotifs.every((n) => n.readAt !== null)).toBe(true);
    });

    test('marks all notifications read via legacy POST /api/v1/notifications/mark-all-read (backwards compatibility)', async () => {
      const markAllRes = await request(app.getHttpServer())
        .post('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(markAllRes.body.success).toBe(true);
      expect(markAllRes.body.markedCount).toBe(2);
    });
  });
});
