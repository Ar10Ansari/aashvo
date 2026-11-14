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

describe('Master Feature Expansion Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renterToken: string;
  let renterId: string;
  let ownerToken: string;
  let ownerId: string;
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Truncate test tables
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        user_notifications,
        property_verifications,
        property_visits,
        saved_items,
        property_inspections,
        tenancy_agreements,
        property_photos,
        properties,
        flatmate_profiles,
        verification_tokens,
        refresh_sessions,
        oauth_identities,
        audit_logs,
        profiles,
        users
      CASCADE;`,
    );

    // Register Renter
    const rRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'renter.expansion@example.com',
        password: 'Password123!Secure',
        fullName: 'Aarav Sharma',
        accountType: 'renter',
      })
      .expect(201);
    renterToken = rRes.body.accessToken;
    renterId = rRes.body.user.id;

    // Register Owner
    const oRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'owner.expansion@example.com',
        password: 'Password123!Secure',
        fullName: 'Sunita Rao',
        accountType: 'owner',
      })
      .expect(201);
    ownerToken = oRes.body.accessToken;
    ownerId = oRes.body.user.id;

    // Register Admin (first as renter, then elevated via Prisma and logged in)
    const aRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin.expansion@example.com',
        password: 'Password123!Secure',
        fullName: 'Compliance Officer',
        accountType: 'renter',
      })
      .expect(201);
    adminId = aRes.body.user.id;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });

    await prisma.profile.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });

    const aLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.expansion@example.com',
        password: 'Password123!Secure',
      })
      .expect(200);
    adminToken = aLogin.body.accessToken;
  });

  // ==================== 1. SMART LOCATION DISCOVERY ====================
  describe('1. Smart Location Discovery & Verified Landmarks', () => {
    it('returns verified landmarks across Indian cities and computes proximity', async () => {
      // 1. Fetch landmarks in Delhi NCR
      const res = await request(app.getHttpServer())
        .get('/api/v1/locations/landmarks?city=Delhi NCR')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const iit = res.body.find((lm: any) => lm.name.includes('IIT Delhi'));
      expect(iit).toBeDefined();
      expect(iit.category).toBe('university');
      expect(iit.locality).toBe('Hauz Khas');

      // 2. Fetch landmarks with coordinate proximity calculation
      const proxRes = await request(app.getHttpServer())
        .get('/api/v1/locations/landmarks?latitude=28.545&longitude=77.1926')
        .expect(200);

      const closest = proxRes.body[0];
      expect(closest).toBeDefined();
      expect(closest.distanceKm).toBeDefined();
      expect(closest.distanceKm).toBeLessThanOrEqual(5); // Within 5km of Hauz Khas
    });

    it('filters localities by Indian PIN code substring', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/locations/localities?city=Gurugram&pincode=122002')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((loc: any) => {
        expect(loc.pincode).toMatch(/^122002/);
      });
    });
  });

  // ==================== 2. SAVED ITEMS & SHORTLISTS ====================
  describe('2. Saved Items & Shortlists', () => {
    let propertyId: string;

    beforeEach(async () => {
      const prop = await prisma.property.create({
        data: {
          ownerId,
          title: 'DLF Phase 2 Executive 2BHK',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Cyber City',
          city: 'Gurugram',
          rentAmount: new Prisma.Decimal(25000),
          addressShort: 'Near Cyber Hub Gate 3',
          providerType: 'owner',
          availableFrom: new Date().toISOString(),
          status: 'active',
          description: 'Premium master bedroom with attached bathroom',
        },
      });
      propertyId = prop.id;
    });

    it('allows authenticated renter to shortlist a property and check status', async () => {
      // 1. Save property
      const saveRes = await request(app.getHttpServer())
        .post('/api/v1/saved')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          itemType: 'property',
          targetId: propertyId,
          notes: 'Walkable from Cyber Hub office',
        })
        .expect(201);

      expect(saveRes.body.targetId).toBe(propertyId);
      expect(saveRes.body.title).toBe('DLF Phase 2 Executive 2BHK');
      expect(saveRes.body.isAvailable).toBe(true);

      // 2. Check saved existence
      const checkRes = await request(app.getHttpServer())
        .get(`/api/v1/saved/check/property/${propertyId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(checkRes.body.isSaved).toBe(true);
      expect(checkRes.body.savedId).toBe(saveRes.body.id);

      // 3. Retrieve saved list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/saved')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].priceMonthly).toBe(25000);

      // 4. Delete saved item
      await request(app.getHttpServer())
        .delete(`/api/v1/saved/${saveRes.body.id}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      // 5. Verify deleted
      const emptyRes = await request(app.getHttpServer())
        .get('/api/v1/saved')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(emptyRes.body.length).toBe(0);
    });

    it('denies saving one own property or profile', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/saved')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          itemType: 'property',
          targetId: propertyId,
        })
        .expect(400);
    });
  });

  // ==================== 3. PROPERTY VISITS SCHEDULING ====================
  describe('3. Property Viewing Requests & Visit Scheduling', () => {
    let propertyId: string;

    beforeEach(async () => {
      const prop = await prisma.property.create({
        data: {
          ownerId,
          title: 'DLF Phase 1 Studio',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'entire_flat',
          furnishing: 'fully_furnished',
          locality: 'DLF Phase 1',
          city: 'Gurugram',
          rentAmount: new Prisma.Decimal(30000),
          addressShort: 'Near Sikanderpur Metro',
          providerType: 'owner',
          availableFrom: new Date().toISOString(),
          status: 'active',
          description: 'Spacious studio apartment',
        },
      });
      propertyId = prop.id;
    });

    it('completes the full visit lifecycle: request -> confirm -> complete with conflict prevention', async () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days in future

      // 1. Renter requests a visit
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId,
          scheduledAt: futureDate.toISOString(),
          visitorMessage: 'Hi, I work in Cyber City and would like to inspect on Saturday.',
        })
        .expect(201);

      expect(createRes.body.status).toBe('pending');
      expect(createRes.body.scheduledAtIST).toContain('IST');
      expect(createRes.body.hostId).toBe(ownerId);
      const visitId = createRes.body.id;

      // 2. Owner confirms visit
      const confirmRes = await request(app.getHttpServer())
        .patch(`/api/v1/visits/${visitId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          action: 'confirm',
          hostNotes: 'Confirmed. Ring bell 204 at the entrance.',
        })
        .expect(200);

      expect(confirmRes.body.status).toBe('confirmed');
      expect(confirmRes.body.hostNotes).toContain('Ring bell 204');

      // 3. Conflict guard: Another visit at the exact same time cannot be confirmed
      // Register a second renter
      const r2Res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'renter2.expansion@example.com',
          password: 'Password123!Secure',
          fullName: 'Kavita Singh',
          accountType: 'renter',
        })
        .expect(201);

      const r2Visit = await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${r2Res.body.accessToken}`)
        .send({
          propertyId,
          scheduledAt: futureDate.toISOString(), // Same slot
        })
        .expect(201);

      // Attempting to confirm r2's visit at the same slot yields 409 Conflict
      await request(app.getHttpServer())
        .patch(`/api/v1/visits/${r2Visit.body.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'confirm' })
        .expect(409);

      // 4. Host marks visit as completed
      const completeRes = await request(app.getHttpServer())
        .patch(`/api/v1/visits/${visitId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'complete' })
        .expect(200);

      expect(completeRes.body.status).toBe('completed');
    });

    it('rejects scheduling visit to own property', async () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          propertyId,
          scheduledAt: futureDate.toISOString(),
        })
        .expect(400);
    });
  });

  // ==================== 4. PROPERTY VERIFICATION WORKFLOW ====================
  describe('4. Property Verification Workflow', () => {
    let propertyId: string;

    beforeEach(async () => {
      const prop = await prisma.property.create({
        data: {
          ownerId,
          title: 'Verified 3BHK Gated Society',
          category: 'flats_rooms',
          propertyType: 'gated_society',
          roomType: 'entire_flat',
          furnishing: 'semi_furnished',
          locality: 'Sector 54',
          city: 'Gurugram',
          rentAmount: new Prisma.Decimal(55000),
          addressShort: 'Park Place Tower 4',
          providerType: 'owner',
          availableFrom: new Date().toISOString(),
          status: 'active',
          description: 'Luxury 3BHK apartment in gated society',
        },
      });
      propertyId = prop.id;
    });

    it('allows owner to submit verification docs and admin to review & approve', async () => {
      // 1. Owner submits verification documents
      const subRes = await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/verification`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          documentType: 'electricity_bill',
          documentUrl: 'https://assets.aashvo.in/rental-documents/dhbvn-bill-oct2026.pdf',
          ownerIdType: 'aadhaar',
        })
        .expect(201);

      expect(subRes.body.status).toBe('submitted');
      expect(subRes.body.documentType).toBe('electricity_bill');

      // 2. Non-owner cannot submit verification
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/verification`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          documentType: 'property_tax_receipt',
          documentUrl: 'https://assets.aashvo.in/rental-documents/fake.pdf',
          ownerIdType: 'pan',
        })
        .expect(403);

      // 3. Admin reviews and approves
      const revRes = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propertyId}/verification/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          reviewNotes: 'DHBVN electricity bill customer name matches owner profile.',
          expiresInDays: 180,
        })
        .expect(200);

      expect(revRes.body.status).toBe('verified');
      expect(revRes.body.reviewedBy).toBe(adminId);
      expect(revRes.body.expiresAt).toBeDefined();

      // 4. Check verification status endpoint
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/properties/${propertyId}/verification`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(getRes.body.status).toBe('verified');
    });
  });

  // ==================== 5. MOVE-IN CHECKLIST & DIGITAL ACKNOWLEDGEMENT ====================
  describe('5. Move-In Checklist & Rental Trust Engine Integration', () => {
    let agreementId: string;

    beforeEach(async () => {
      const prop = await prisma.property.create({
        data: {
          ownerId,
          title: 'Leased Room in Sushant Lok',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Sushant Lok 1',
          city: 'Gurugram',
          rentAmount: new Prisma.Decimal(20000),
          addressShort: 'Near Galleria Market',
          providerType: 'owner',
          availableFrom: new Date().toISOString(),
          status: 'active',
          description: 'Spacious room',
        },
      });

      const agr = await prisma.tenancyAgreement.create({
        data: {
          propertyId: prop.id,
          landlordId: ownerId,
          tenantId: renterId,
          agreementStatus: 'active',
          monthlyRent: new Prisma.Decimal(20000),
          securityDeposit: new Prisma.Decimal(40000),
          startDate: new Date('2026-12-01'),
          endDate: new Date('2027-11-30'),
          documentUrl: 'https://storage.aashvo.com/agreements/agr-1.pdf',
        },
      });
      agreementId = agr.id;
    });

    it('submits a complete move-in checklist with inventory, meter readings and counterparty acknowledgement', async () => {
      // 1. Landlord creates move-in checklist
      const insRes = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          agreementId,
          inspectionType: 'move_in',
          inspectionDate: '2026-12-01',
          roomName: 'Master Bedroom & Kitchen',
          conditionRating: 5,
          meterReadings: { electricityKwh: 3840.5, waterUnits: 28 },
          keyHandoverConfirmed: true,
          depositConfirmed: true,
          inventory: [
            { name: 'Daikin 1.5 Ton AC', category: 'electrical', condition: 'excellent' },
            { name: 'Havells Geyser 25L', category: 'plumbing', condition: 'good' },
            { name: 'King Size Bed with Mattress', category: 'furniture', condition: 'good' },
          ],
          photoUrls: ['https://assets.aashvo.in/inspections/bed-condition.jpg'],
        })
        .expect(201);

      expect(insRes.body.keyHandoverConfirmed).toBe(true);
      expect(insRes.body.depositConfirmed).toBe(true);
      expect(insRes.body.meterReadings.electricityKwh).toBe(3840.5);
      expect(insRes.body.inventory.length).toBe(3);
      expect(insRes.body.acknowledgedByCounterparty).toBe(false);

      const inspectionId = insRes.body.id;

      // 2. Conductor cannot self-acknowledge
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${inspectionId}/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      // 3. Tenant (counterparty) digitally acknowledges
      const ackRes = await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${inspectionId}/acknowledge`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(ackRes.body.acknowledgedByCounterparty).toBe(true);
      expect(ackRes.body.acknowledgedAt).toBeDefined();
    });
  });

  // ==================== 6. SMART NOTIFICATIONS ====================
  describe('6. Smart In-App Notifications Center', () => {
    it('manages unread counts, mark-read and mark-all-read workflows', async () => {
      // 1. Seed two notifications for renter
      await prisma.userNotification.createMany({
        data: [
          {
            userId: renterId,
            category: 'connect_match',
            title: 'New Mutual Match!',
            body: 'You and Meera Sengupta liked each others profiles.',
            targetUrl: '/connect',
          },
          {
            userId: renterId,
            category: 'visit_update',
            title: 'Visit Confirmed',
            body: 'Your visit for DLF Phase 2 was confirmed.',
            targetUrl: '/my-activity/visits',
          },
        ],
      });

      // 2. Get unread count
      const countRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(countRes.body.unreadCount).toBe(2);

      // 3. Fetch notifications list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(listRes.body.items.length).toBe(2);
      expect(listRes.body.unreadCount).toBe(2);
      const firstId = listRes.body.items[0].id;

      // 4. Mark single notification as read
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${firstId}/read`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      const afterOneRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(afterOneRes.body.unreadCount).toBe(1);

      // 5. Mark all as read
      await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      const finalCountRes = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(finalCountRes.body.unreadCount).toBe(0);
    });
  });
});

