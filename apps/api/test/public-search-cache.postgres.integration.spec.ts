import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MAIL_DISPATCH_PORT } from '../src/modules/auth/services/mail-dispatch.port';
import { PropertiesService } from '../src/modules/properties/properties.service';
import { FlatmatesService } from '../src/modules/flatmates/flatmates.service';

class NoopMailer {
  async sendVerificationEmail() {}
  async sendPasswordResetEmail() {}
}

describe('Public Search Cache Isolation & Hardening (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let propertiesService: PropertiesService;
  let flatmatesService: FlatmatesService;

  let ownerToken: string;
  let adminToken: string;
  let adminId: string;
  let propertyId: string;

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
    propertiesService = moduleRef.get(PropertiesService);
    flatmatesService = moduleRef.get(FlatmatesService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        property_verifications,
        property_photos,
        properties,
        flatmate_profiles,
        verification_tokens,
        refresh_sessions,
        profiles,
        users
      CASCADE`,
    );

    propertiesService.clearSearchCache();
    flatmatesService.clearSearchCache();

    // Register Owner
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'cache.owner@aashvo.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Rajesh Khanna',
        accountType: 'owner',
      })
      .expect(201);
    ownerToken = ownerRes.body.accessToken;

    // Register Admin (first as renter, then elevated in DB)
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'cache.admin@aashvo.test',
        password: 'Str0ngPassword#2026',
        fullName: 'Admin User',
        accountType: 'renter',
      })
      .expect(201);
    adminId = adminRes.body.user.id;
    // Upgrade to admin role in database
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    // Log back in to get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'cache.admin@aashvo.test',
        password: 'Str0ngPassword#2026',
      })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Create an active property
    const propRes = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Luxury 2BHK in DLF Cyber City',
        description: 'Fully furnished spacious apartment',
        category: 'flats_rooms',
        propertyType: 'apartment',
        roomType: 'private_room',
        furnishing: 'fully_furnished',
        locality: 'DLF Phase 2',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122002',
        addressShort: 'DLF Phase 2 near Cyber Hub',
        rentAmount: 35000,
        depositAmount: 70000,
        maintenanceCharge: 3000,
        providerType: 'owner',
        genderPreference: 'any',
        bedrooms: 2,
        bathrooms: 2,
        availableFrom: '2026-12-01',
      })
      .expect(201);
    propertyId = propRes.body.id;

    // Approve the property via admin moderation so it is active
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${propertyId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'active',
        reason: 'Approved listing',
      })
      .expect(200);
  });

  describe('Properties Public Search Cache', () => {
    it('caches public search results and normalizes query parameter order', async () => {
      // First search query: ?city=Gurugram&locality=DLF
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram&locality=DLF')
        .expect(200);
      expect(res1.body.data.length).toBe(1);

      // Mutate database directly to verify search hits the memory cache
      await prisma.property.update({
        where: { id: propertyId },
        data: { title: 'Direct DB Mutation Bypassing Service' },
      });

      // Second search query with reversed query params: ?locality=DLF&city=Gurugram
      const res2 = await request(app.getHttpServer())
        .get('/api/v1/properties?locality=DLF&city=Gurugram')
        .expect(200);

      // Must return cached title because of query parameter normalization!
      expect(res2.body.data[0].title).toBe('Luxury 2BHK in DLF Cyber City');
    });

    it('invalidates cache immediately when property is updated via service', async () => {
      // Warm up cache
      await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);

      // Update property through official API
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propertyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Renovated 2BHK with Modern Kitchen',
        })
        .expect(200);

      // Re-query: cache was invalidated, must see updated title!
      const resAfter = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);

      expect(resAfter.body.data[0].title).toBe('Renovated 2BHK with Modern Kitchen');
    });

    it('invalidates cache when property verification is reviewed and approved', async () => {
      // Warm up search cache
      const initialSearch = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);
      expect(initialSearch.body.data[0].title).toBe('Luxury 2BHK in DLF Cyber City');

      // Submit verification
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/verification`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          documentType: 'electricity_bill',
          documentUrl: 'https://documents.aashvo.test/bill.pdf',
          ownerIdType: 'aadhaar',
        })
        .expect(201);

      // Directly mutate title in database without going through cache invalidation
      await prisma.property.update({
        where: { id: propertyId },
        data: { title: 'Verified DLF Penthouse Suite' },
      });

      // Admin reviews and approves verification (must clear the search cache!)
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propertyId}/verification/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          reviewNotes: 'Valid bill verified',
          expiresInDays: 365,
        })
        .expect(200);

      // Re-query: because reviewPropertyVerification invalidated the cache,
      // it must re-read from DB and show the updated title!
      const afterReviewSearch = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);
      expect(afterReviewSearch.body.data[0].title).toBe('Verified DLF Penthouse Suite');
    });

    it('never leaks paused, pending, or rejected properties into public search', async () => {
      // Pause property
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propertyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'paused',
        })
        .expect(200);

      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);

      expect(searchRes.body.data.length).toBe(0);
    });
  });

  describe('Flatmates Public Search Cache & Visibility', () => {
    let publishedFlatmateId: string;
    let draftFlatmateId: string;

    beforeEach(async () => {
      // Create user 1 with published flatmate profile
      const user1Res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'flatmate1@aashvo.test',
          password: 'Str0ngPassword#2026',
          fullName: 'Ananya Verma',
          accountType: 'renter',
        })
        .expect(201);

      const f1 = await prisma.flatmateProfile.create({
        data: {
          userId: user1Res.body.user.id,
          occupation: 'Data Scientist',
          age: 25,
          gender: 'Female',
          city: 'Gurugram',
          budgetMax: 28000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early_Bird',
          cleanliness: 'Spotless',
          smoking: 'No',
          bio: 'Clean and quiet professional',
          isPublished: true,
          discoveryHidden: false,
        },
      });
      publishedFlatmateId = f1.id;

      // Create user 2 with unpublished/draft flatmate profile
      const user2Res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'flatmate2@aashvo.test',
          password: 'Str0ngPassword#2026',
          fullName: 'Hidden Draft User',
          accountType: 'renter',
        })
        .expect(201);

      const f2 = await prisma.flatmateProfile.create({
        data: {
          userId: user2Res.body.user.id,
          occupation: 'Student',
          age: 22,
          gender: 'Male',
          city: 'Gurugram',
          budgetMax: 15000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Flexible',
          cleanliness: 'Moderate',
          smoking: 'No',
          bio: 'Draft not yet published',
          isPublished: false, // Must be hidden from search!
          discoveryHidden: false,
        },
      });
      draftFlatmateId = f2.id;
    });

    it('returns only published flatmate profiles in public search', async () => {
      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/flatmates?city=Gurugram')
        .expect(200);

      const ids = searchRes.body.data.map((item: any) => item.id);
      expect(ids).toContain(publishedFlatmateId);
      expect(ids).not.toContain(draftFlatmateId);
    });

    it('does NOT use the public cache for authenticated personalized queries', async () => {
      // Warm up public cache
      await request(app.getHttpServer())
        .get('/api/v1/flatmates?city=Gurugram')
        .expect(200);

      // Authenticated search query
      const authRes = await request(app.getHttpServer())
        .get('/api/v1/flatmates?city=Gurugram')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(authRes.body.data.length).toBe(1);
    });
  });
});
