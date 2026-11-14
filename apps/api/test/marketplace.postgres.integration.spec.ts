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

describe('Marketplace Domain Modules & Security Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let ownerId: string;
  let renterToken: string;
  let renterId: string;
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

    // Seed 3 baseline test users: Owner, Renter, Admin
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'owner@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Vikram Malhotra',
        accountType: 'owner',
      })
      .expect(201);
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    const renterRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'renter@aashvo-test.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Ananya Sharma',
        accountType: 'renter',
      })
      .expect(201);
    renterToken = renterRes.body.accessToken;
    renterId = renterRes.body.user.id;

    // Create admin user directly in DB (public registration cannot create admins)
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin@aashvo-test.in',
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
      .send({ email: 'admin@aashvo-test.in', password: 'Str0ngPassword#2026' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==================== 1. PROFILES ====================
  describe('ProfilesModule Integration', () => {
    test('retrieves authenticated profile with completion % and updates details', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(getRes.body.id).toBe(renterId);
      expect(getRes.body.email).toBe('renter@aashvo-test.in');
      expect(getRes.body.fullName).toBe('Ananya Sharma');
      expect(getRes.body.profileCompletionPercent).toBe(25); // Name only initially

      // Update phone, bio, avatar
      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          phoneNumber: '+919876543210',
          bio: 'Data science postgraduate at IIT Delhi looking for flatmate.',
          avatarUrl: 'https://assets.aashvo.in/user-avatars/ananya.webp',
        })
        .expect(200);

      expect(patchRes.body.phoneNumber).toBe('+919876543210');
      expect(patchRes.body.bio).toContain('IIT Delhi');
      expect(patchRes.body.profileCompletionPercent).toBeGreaterThanOrEqual(85);

      // Verify sanitized public view hides phone and email
      const pubRes = await request(app.getHttpServer())
        .get(`/api/v1/profiles/${renterId}`)
        .expect(200);

      expect(pubRes.body.fullName).toBe('Ananya Sharma');
      expect(pubRes.body.bio).toContain('IIT Delhi');
      expect(pubRes.body.email).toBeUndefined();
      expect(pubRes.body.phoneNumber).toBeUndefined();
      expect(pubRes.body.passwordHash).toBeUndefined();
    });

    test('rejects duplicate phone number across accounts with 409', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phoneNumber: '+919876543210' })
        .expect(200);

      const dupRes = await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ phoneNumber: '+919876543210' })
        .expect(409);

      expect(dupRes.body.error.code).toBe(ERROR_CODES.CONFLICT);
    });
  });

  // ==================== 2. LOCATIONS ====================
  describe('LocationsModule Integration', () => {
    test('returns supported Indian cities and localities with dynamic inventory counts', async () => {
      // Initially zero active properties
      const citiesRes = await request(app.getHttpServer())
        .get('/api/v1/locations/cities?withInventoryOnly=true')
        .expect(200);
      expect(citiesRes.body.cities).toHaveLength(0);

      // All supported cities catalog
      const allCitiesRes = await request(app.getHttpServer())
        .get('/api/v1/locations/cities')
        .expect(200);
      expect(allCitiesRes.body.totalCities).toBeGreaterThanOrEqual(6);
      const gurugram = allCitiesRes.body.cities.find((c: any) => c.name === 'Gurugram');
      expect(gurugram).toBeDefined();
      expect(gurugram.popularLocalities.length).toBeGreaterThan(0);

      // Localities search
      const locRes = await request(app.getHttpServer())
        .get('/api/v1/locations/localities?city=Gurugram&search=Cyber')
        .expect(200);
      expect(locRes.body).toHaveLength(1);
      expect(locRes.body[0].name).toBe('Cyber City');
    });
  });

  // ==================== 3. PROPERTIES & MODERATION ====================
  describe('PropertiesModule Integration', () => {
    test('creates property in pending_review, protects ownership, and exposes only after admin moderation', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Sunny 2BHK in DLF Phase 2 near Cyber Hub',
          description: 'Spacious apartment with modular kitchen and 24/7 security.',
          propertyType: 'apartment',
          roomType: 'entire_flat',
          furnishing: 'fully_furnished',
          locality: 'DLF Phase 2',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '122002',
          addressShort: 'Near Sikanderpur Metro',
          rentAmount: 32000,
          depositAmount: 64000,
          maintenanceCharge: 2500,
          providerType: 'owner',
          availableFrom: 'Immediately',
          amenities: ['Wifi', 'AC', 'Power Backup'],
          photoUrls: [
            { photoUrl: 'https://assets.aashvo.in/property-photos/dlf.webp', isPrimary: true },
          ],
        })
        .expect(201);

      const propId = createRes.body.id;
      expect(createRes.body.status).toBe('pending_review');
      expect(createRes.body.rentAmount).toBe(32000);
      expect(createRes.body.photos).toHaveLength(1);

      // Public search MUST NOT return pending_review listing
      const publicSearch1 = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram')
        .expect(200);
      expect(publicSearch1.body.data.find((p: any) => p.id === propId)).toBeUndefined();

      // Unauthorized user (renter) cannot edit property (403)
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ rentAmount: 25000 })
        .expect(403);

      // Non-owner cannot view pending property directly (404)
      await request(app.getHttpServer())
        .get(`/api/v1/properties/${propId}`)
        .expect(404);

      // Owner can view their own property via mine or direct
      const mineRes = await request(app.getHttpServer())
        .get('/api/v1/properties/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(mineRes.body.find((p: any) => p.id === propId)).toBeDefined();

      // Non-admin attempting to moderate fails (403)
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}/moderate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'active' })
        .expect(403);

      // Admin approves listing
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active', reason: 'Documents and photos verified' })
        .expect(200);

      // Now public search returns the listing!
      const publicSearch2 = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Gurugram&minRent=30000')
        .expect(200);
      expect(publicSearch2.body.data.find((p: any) => p.id === propId)).toBeDefined();

      // Amenities filter matches
      const amenitySearch = await request(app.getHttpServer())
        .get('/api/v1/properties?amenities=Wifi,AC')
        .expect(200);
      expect(amenitySearch.body.data.find((p: any) => p.id === propId)).toBeDefined();
    });
  });

  // ==================== 4. FAMILY STAYS ====================
  describe('FamilyStaysModule Integration', () => {
    test('enforces host family residence check and serves curated discovery', async () => {
      // 1. Ordinary listing masquerading as Family Stay without host residence fails 400
      const invalidRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Fake Family Stay',
          description: 'Ordinary room claiming family stay without family living there.',
          category: 'family_stays',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Hauz Khas',
          city: 'Delhi NCR',
          addressShort: 'Near Deer Park',
          rentAmount: 18000,
          providerType: 'owner',
          availableFrom: 'Immediately',
          familyLivesOnProperty: false, // INVALID!
          mealsOffered: 'included',
        })
        .expect(400);

      expect(invalidRes.body.error.code).toBe(ERROR_CODES.FAMILY_STAY_REQUIREMENT_VIOLATION);

      // 2. Genuine Family Stay with familyLivesOnProperty: true succeeds
      const validRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Homely Stay with Verma Family near IIT Delhi',
          description: 'Peaceful room for students with motherly home-cooked meals included.',
          category: 'family_stays',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Hauz Khas',
          city: 'Delhi NCR',
          addressShort: 'C Block, Hauz Khas',
          rentAmount: 16000,
          providerType: 'owner',
          availableFrom: 'Immediately',
          familyLivesOnProperty: true,
          mealsOffered: 'included',
        })
        .expect(201);

      const familyStayId = validRes.body.id;

      // Admin activates
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${familyStayId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      // Curated discovery via /api/v1/family-stays
      const discoverRes = await request(app.getHttpServer())
        .get('/api/v1/family-stays?city=Delhi NCR&mealsOffered=included')
        .expect(200);

      expect(discoverRes.body.data.length).toBeGreaterThanOrEqual(1);
      const stay = discoverRes.body.data.find((s: any) => s.id === familyStayId);
      expect(stay).toBeDefined();
      expect(stay.verifiedHostFamily).toBe(true);
      expect(stay.mealsOffered).toBe('included');
    });
  });

  // ==================== 5. MEDIA STORAGE ====================
  describe('MediaModule Integration', () => {
    test('enforces file type allowlist, size limits, and isolates private rental documents', async () => {
      // 1. Unsupported MIME type rejected 400
      const badMimeRes = await request(app.getHttpServer())
        .post('/api/v1/media/presigned-upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fileName: 'script.sh',
          contentType: 'application/x-sh',
          sizeBytes: 1024,
          bucket: 'property-photos',
        })
        .expect(400);
      expect(badMimeRes.body.error.code).toBe(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);

      // 2. Oversized image rejected 400
      const largeImgRes = await request(app.getHttpServer())
        .post('/api/v1/media/presigned-upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fileName: 'massive-photo.png',
          contentType: 'image/png',
          sizeBytes: 15 * 1024 * 1024, // 15MB > 10MB
          bucket: 'property-photos',
        })
        .expect(400);
      expect(largeImgRes.body.error.code).toBe(ERROR_CODES.FILE_TOO_LARGE);

      // 3. Public photo upload presign -> publicUrl exists
      const photoPresign = await request(app.getHttpServer())
        .post('/api/v1/media/presigned-upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fileName: 'bedroom.webp',
          contentType: 'image/webp',
          sizeBytes: 800000,
          bucket: 'property-photos',
        })
        .expect(200);
      expect(photoPresign.body.publicUrl).toBeTruthy();

      // 4. Sensitive rental agreement upload -> publicUrl MUST BE NULL
      const leasePresign = await request(app.getHttpServer())
        .post('/api/v1/media/presigned-upload')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          fileName: 'rental_agreement_2026.pdf',
          contentType: 'application/pdf',
          sizeBytes: 3000000,
          bucket: 'rental-documents',
        })
        .expect(200);
      expect(leasePresign.body.publicUrl).toBeNull();
      const docAssetId = leasePresign.body.assetId;

      // Confirm upload
      await request(app.getHttpServer())
        .post('/api/v1/media/confirm')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ assetId: docAssetId })
        .expect(200);

      // 5. Another user (owner) trying to download renter's private agreement receives 403 Forbidden!
      await request(app.getHttpServer())
        .get(`/api/v1/media/${docAssetId}/download`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      // Document owner receives 200 with temporary signed download URL
      const downloadRes = await request(app.getHttpServer())
        .get(`/api/v1/media/${docAssetId}/download`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);
      expect(downloadRes.body.downloadUrl).toContain('/api/v1/media/private-download/rental-documents/');
    });
  });

  // ==================== 6. FLATMATES ====================
  describe('FlatmatesModule Integration', () => {
    test('enforces adult age (>= 18), GIN preference queries, and computes compatibility', async () => {
      // 1. Minor age 17 rejected 400
      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          occupation: 'Student',
          age: 17,
          gender: 'Female',
          targetLocalities: ['Cyber City'],
          city: 'Gurugram',
          budgetMax: 15000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'Non-smoker',
          bio: 'Underage test attempt',
        })
        .expect(400);

      // 2. Adult flatmate profile (Renter: Female, Vegetarian, Early Bird, Spotless, 18000)
      const renterFlatRes = await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          occupation: 'Data Scientist',
          age: 23,
          gender: 'Female',
          targetLocalities: ['Cyber City', 'DLF Phase 2'],
          city: 'Gurugram',
          budgetMax: 18000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'Non-smoker',
          bio: 'Calm professional working in Cyber Hub. Looking for a neat flatmate.',
          interests: ['Badminton', 'Reading', 'Coding'],
        })
        .expect(201);
      const renterFlatId = renterFlatRes.body.id;

      // 3. Second flatmate profile (Owner: Male, Vegetarian, Early Bird, Spotless, 20000)
      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          occupation: 'Frontend Engineer',
          age: 26,
          gender: 'Male',
          targetLocalities: ['Cyber City', 'Sector 48'],
          city: 'Gurugram',
          budgetMax: 20000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          smoking: 'Non-smoker',
          bio: 'Tech enthusiast who loves coffee and coding.',
          interests: ['Coding', 'Badminton', 'Music'],
        })
        .expect(201);

      // Search flatmates with locality filter
      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/flatmates?city=Gurugram&locality=Cyber City')
        .expect(200);
      expect(searchRes.body.data.length).toBe(2);

      // Owner views Renter's flatmate profile -> computes lifestyle compatibility!
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/flatmates/${renterFlatId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(detailRes.body.compatibilityScore).toBeGreaterThanOrEqual(85);
    });
  });

  // ==================== 7. INQUIRIES & ANTI-SPAM ====================
  describe('InquiriesModule Integration', () => {
    test('enforces single target, prevents duplicates, masks phone numbers, and manages workflow', async () => {
      // Create an active property for owner
      const propRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Cozy Studio in Koramangala',
          description: 'Walkable to 5th Block restaurants and Sony World.',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Koramangala',
          city: 'Bengaluru',
          addressShort: 'Near Sony World',
          rentAmount: 15000,
          providerType: 'owner',
          availableFrom: 'Immediately',
        })
        .expect(201);
      const propId = propRes.body.id;

      // 1. Dual target (propertyId AND targetFlatmateId) rejected 400
      await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: propId,
          targetFlatmateId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          senderName: 'Ananya Sharma',
          senderPhone: '+919876543210',
          senderEmail: 'renter@aashvo-test.in',
          message: 'Interested in this property',
        })
        .expect(400);

      // 2. Self-inquiry rejected 400
      await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          propertyId: propId,
          senderName: 'Owner Trying Self',
          senderPhone: '+919876543210',
          senderEmail: 'owner@aashvo-test.in',
          message: 'Self inquiry',
        })
        .expect(400);

      // 3. Valid inquiry from Renter to Owner's property
      const inqRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: propId,
          senderName: 'Ananya Sharma',
          senderPhone: '+919876543210',
          senderEmail: 'renter@aashvo-test.in',
          moveInDate: '2026-12-01',
          message: 'Hi, I would love to visit this studio this weekend!',
        })
        .expect(201);
      const inqId = inqRes.body.id;
      expect(inqRes.body.status).toBe('pending');

      // 4. Duplicate pending inquiry rejected 409
      const dupRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          propertyId: propId,
          senderName: 'Ananya Sharma',
          senderPhone: '+919876543210',
          senderEmail: 'renter@aashvo-test.in',
          message: 'Spamming second inquiry',
        })
        .expect(409);
      expect(dupRes.body.error.code).toBe(ERROR_CODES.DUPLICATE_INQUIRY);

      // 5. Owner checks received inquiries: status is pending, so phone number is masked!
      const receivedPending = await request(app.getHttpServer())
        .get('/api/v1/inquiries/received')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(receivedPending.body).toHaveLength(1);
      expect(receivedPending.body[0].senderPhone).toContain('*****');

      // 6. Unauthorized user (admin or stranger) attempting to update inquiry fails 403
      await request(app.getHttpServer())
        .patch(`/api/v1/inquiries/${inqId}/status`)
        .set('Authorization', `Bearer ${renterToken}`) // Sender cannot accept their own inquiry
        .send({ status: 'accepted' })
        .expect(403);

      // 7. Owner accepts inquiry -> unmasks contact info!
      const acceptRes = await request(app.getHttpServer())
        .patch(`/api/v1/inquiries/${inqId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'accepted' })
        .expect(200);
      expect(acceptRes.body.status).toBe('accepted');
      expect(acceptRes.body.senderPhone).toBe('+919876543210');

      // Verification that outbox logged notification events
      const outbox = await prisma.notificationOutbox.findMany({
        where: { recipient: { in: [ownerId, 'renter@aashvo-test.in'] } },
      });
      expect(outbox.length).toBeGreaterThanOrEqual(2);
    });
  });
});

