import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Complete Product Workflows & State Transitions (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let ownerUserId: string;
  let renterToken: string;
  let renterUserId: string;
  let adminToken: string;
  let adminUserId: string;

  let testPropertyId: string;
  let familyStayPropertyId: string;

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

    // 1. Setup Owner
    const ownerEmail = `wf-owner-${Date.now()}@example.com`;
    const ownerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: ownerEmail,
        password: 'Password123!',
        fullName: 'Workflow Test Owner',
        accountType: 'owner',
      })
      .expect(HttpStatus.CREATED);
    ownerToken = ownerReg.body.accessToken;
    ownerUserId = ownerReg.body.user.id;

    // 2. Setup Renter
    const renterEmail = `wf-renter-${Date.now()}@example.com`;
    const renterReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: renterEmail,
        password: 'Password123!',
        fullName: 'Workflow Test Renter',
        accountType: 'renter',
      })
      .expect(HttpStatus.CREATED);
    renterToken = renterReg.body.accessToken;
    renterUserId = renterReg.body.user.id;

    // 3. Setup Admin
    const adminEmail = `wf-admin-${Date.now()}@example.com`;
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        fullName: 'Workflow Test Admin',
        accountType: 'renter',
      })
      .expect(HttpStatus.CREATED);
    adminToken = adminReg.body.accessToken;
    adminUserId = adminReg.body.user.id;

    // Elevate admin user to admin role in database
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
    // Re-login as admin to obtain token with admin claims
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Password123!' })
      .expect(HttpStatus.OK);
    adminToken = adminLogin.body.accessToken;

    // 4. Create Standard Property Listing by Owner
    const propRes = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Spacious 2BHK Near Metro Galleria',
        description: 'Sunny apartment with modular kitchen and 24/7 security.',
        category: 'flats_rooms',
        propertyType: 'apartment',
        roomType: 'entire_flat',
        furnishing: 'semi_furnished',
        locality: 'DLF Phase 4',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122002',
        addressShort: 'Near Galleria Market',
        rentAmount: 32000,
        depositAmount: 64000,
        maintenanceCharge: 2000,
        providerType: 'owner',
        genderPreference: 'any',
        bedrooms: 2,
        bathrooms: 2,
        availableFrom: 'Immediately',
        amenities: ['100% Power Backup', 'High-Speed Wi-Fi'],
        photoUrls: [
          { photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c', isPrimary: true, sortOrder: 0 },
        ],
      })
      .expect(HttpStatus.CREATED);
    testPropertyId = propRes.body.id;

    // 5. Create Family Stay Listing by Owner
    const famRes = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Peaceful Family Stay with Home Meals',
        description: 'Private bedroom with resident family. Healthy home-cooked vegetarian meals.',
        category: 'family_stays',
        propertyType: 'villa',
        roomType: 'private_room',
        furnishing: 'fully_furnished',
        locality: 'DLF Phase 2',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122002',
        addressShort: 'Sector 25, Gurugram',
        rentAmount: 18000,
        depositAmount: 36000,
        maintenanceCharge: 1000,
        providerType: 'owner',
        genderPreference: 'any',
        bedrooms: 1,
        bathrooms: 1,
        availableFrom: 'Immediately',
        amenities: ['High-Speed Wi-Fi', 'Home Cooked Meals'],
        familyLivesOnProperty: true,
        mealsOffered: 'included',
        photoUrls: [
          { photoUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267', isPrimary: true, sortOrder: 0 },
        ],
      })
      .expect(HttpStatus.CREATED);
    familyStayPropertyId = famRes.body.id;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (renterUserId) {
        await prisma.savedItem.deleteMany({ where: { userId: renterUserId } });
      }
      const propIds = [testPropertyId, familyStayPropertyId].filter(Boolean);
      if (propIds.length > 0) {
        await prisma.propertyVisit.deleteMany({ where: { propertyId: { in: propIds } } });
        await prisma.propertyPhoto.deleteMany({ where: { propertyId: { in: propIds } } });
        await prisma.property.deleteMany({ where: { id: { in: propIds } } });
      }
      await prisma.safetyReport.deleteMany({ where: { reporterEmail: { contains: 'wf-' } } });
      await prisma.supportTicket.deleteMany({ where: { userEmail: { contains: 'wf-' } } });
      const userIds = [ownerUserId, renterUserId, adminUserId].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('Workflow 1: Saved Items (Shortlist) Persistence & Unsave by Type/Target', () => {
    it('should save a property to user shortlist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/saved')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          itemType: 'property',
          targetId: testPropertyId,
          notes: 'Close to office',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.targetId).toBe(testPropertyId);
      expect(res.body.itemType).toBe('property');

      // Verify persisted in PostgreSQL
      const dbSaved = await prisma.savedItem.findFirst({
        where: { userId: renterUserId, targetId: testPropertyId },
      });
      expect(dbSaved).toBeDefined();
      expect(dbSaved?.targetId).toBe(testPropertyId);
    });

    it('should check saved status and return isSaved: true', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved/check/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.isSaved).toBe(true);
      expect(res.body.savedId).toBeDefined();
    });

    it('should unsave item by targetType and targetId (fixing the 404 defect)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/saved/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.success).toBe(true);

      // Verify removed from PostgreSQL
      const dbSaved = await prisma.savedItem.findFirst({
        where: { userId: renterUserId, targetId: testPropertyId },
      });
      expect(dbSaved).toBeNull();
    });

    it('should return isSaved: false after unsaving', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved/check/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.isSaved).toBe(false);
    });
  });

  describe('Workflow 2: Property Visits & Viewing Scheduling Lifecycle', () => {
    let visitId: string;
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();

    it('should request a property viewing appointment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: testPropertyId,
          scheduledAt: futureDate,
          visitorMessage: 'Would love to see the balcony and kitchen.',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('pending');
      visitId = res.body.id;

      // Verify persisted in PostgreSQL
      const dbVisit = await prisma.propertyVisit.findUnique({ where: { id: visitId } });
      expect(dbVisit).toBeDefined();
      expect(dbVisit?.visitorId).toBe(renterUserId);
    });

    it('should prevent owner from booking visit on their own listing (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          propertyId: testPropertyId,
          scheduledAt: futureDate,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should allow host to confirm the appointment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/visits/${visitId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          action: 'confirm',
          hostNotes: 'See you at the entrance gate.',
        })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('confirmed');
    });

    it('should reschedule visit via POST /visits/:id/reschedule', async () => {
      const newFutureDate = new Date(Date.now() + 86400000 * 3).toISOString();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/visits/${visitId}/reschedule`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          rescheduledAt: newFutureDate,
          reason: 'Work schedule shifted.',
        })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('rescheduled');
    });

    it('should reschedule visit via PATCH /visits/:id/reschedule (dual verb resilience)', async () => {
      const alternateDate = new Date(Date.now() + 86400000 * 4).toISOString();
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/visits/${visitId}/reschedule`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          rescheduledAt: alternateDate,
          reason: 'Host confirmation of alternate slot.',
        })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('rescheduled');
    });
  });

  describe('Workflow 3: Support Tickets & Safety Violation Reports', () => {
    let ticketId: string;

    it('should create authenticated customer support ticket', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          category: 'finding_flatmates',
          subject: 'Compatibility score question',
          description: 'How is the lifestyle score calculated between flatmates?',
          priority: 'medium',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.ticketNumber).toMatch(/^ASH-TKT-/);
      expect(res.body.status).toBe('open');
      ticketId = res.body.id;

      // Verify in PostgreSQL
      const dbTicket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
      expect(dbTicket).toBeDefined();
      expect(dbTicket?.userId).toBe(renterUserId);
    });

    it('should allow user to send reply message to ticket', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/support/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          message: 'Thank you for following up.',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.message).toBe('Thank you for following up.');
      expect(res.body.senderRole).toBe('user');
    });

    it('should submit public safety violation report for property', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets/reports')
        .send({
          targetType: 'listing',
          targetId: testPropertyId,
          targetTitle: 'Spacious 2BHK Near Metro',
          reasonCode: 'scam_fraud',
          details: 'Suspicious advance deposit demand via WhatsApp.',
          reporterEmail: 'safety.reporter@example.com',
          reporterName: 'Concerned Citizen',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeDefined();

      // Verify in PostgreSQL
      const dbReport = await prisma.safetyReport.findUnique({ where: { id: res.body.id } });
      expect(dbReport).toBeDefined();
      expect(dbReport?.reportedPropertyId).toBe(testPropertyId);
      expect(dbReport?.reasonCode).toBe('scam_fraud');
      expect(dbReport?.priority).toBe('high');
      expect(dbReport?.status).toBe('pending');
    });
  });

  describe('Workflow 4: Admin Moderation Pipeline', () => {
    it('should allow admin to moderate and activate pending property listing', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${testPropertyId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'active',
          reason: 'Ownership verification verified successfully.',
        })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('active');

      // Verify in PostgreSQL
      const dbProp = await prisma.property.findUnique({ where: { id: testPropertyId } });
      expect(dbProp?.status).toBe('active');
    });

    it('should reject non-admin users from moderating property (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${testPropertyId}/moderate`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          status: 'active',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should allow admin to pause a property listing', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${testPropertyId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paused',
          reason: 'Temporarily paused during annual maintenance.',
        })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('paused');
    });
  });

  describe('Workflow 5: Family Stays & Meals Verification', () => {
    beforeAll(async () => {
      // Activate family stay listing via admin
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${familyStayPropertyId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active', reason: 'Family stay verified.' });
    });

    it('should search family stays and filter by meals offered', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/family-stays?city=Gurugram&mealsOffered=included')
        .expect(HttpStatus.OK);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((item: any) => item.id === familyStayPropertyId);
      expect(found).toBeDefined();
      expect(found.category).toBe('family_stays');
      expect(found.familyLivesOnProperty).toBe(true);
      expect(found.mealsOffered).toBe('included');
    });
  });
});
