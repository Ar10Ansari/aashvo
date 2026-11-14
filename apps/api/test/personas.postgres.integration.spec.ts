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

describe('End-to-End User Personas Integration (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Personas tokens and IDs
  let aaravToken: string;
  let aaravId: string;
  let bhavnaToken: string;
  let bhavnaId: string;
  let chiragToken: string;
  let chiragId: string;
  let divyaToken: string;
  let divyaId: string;
  let eshaanToken: string;
  let eshaanId: string;
  let farhanToken: string;
  let farhanId: string;
  let gayatriToken: string;
  let gayatriId: string;

  // Shared entity IDs across flows
  let farhanPropertyId: string;
  let bhavnaPropertyId: string;
  let familyStayPropertyId: string;
  let aaravVisitId: string;
  let chiragDivyaMatchId: string;
  let tenancyAgreementId: string;
  let tenancyDisputeId: string;
  let supportTicketId: string;

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

  beforeAll(async () => {
    // Truncate all relevant tables cleanly before beginning personas flow
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        ticket_audit_events,
        ticket_messages,
        support_tickets,
        rental_disputes,
        tenancy_reviews,
        property_inspections,
        tenancy_agreements,
        user_notifications,
        property_verifications,
        property_visits,
        saved_items,
        match_messages,
        flatmate_matches,
        flatmate_interests,
        interest_requests,
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
  });

  // =========================================================================
  // PERSONA 1 & 5: SETUP & LISTING CREATION (Aarav, Bhavna, Farhan)
  // =========================================================================
  describe('Persona Registration & Onboarding', () => {
    it('registers Persona 1: Aarav (Student Renter, Age 21, Gurugram)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'aarav.student@aashvo.test',
          password: 'Password123!Aarav',
          fullName: 'Aarav Sharma',
          accountType: 'renter',
        })
        .expect(201);

      aaravToken = res.body.accessToken;
      aaravId = res.body.user.id;
      expect(aaravToken).toBeDefined();

      // Create Aarav's flatmate profile via API
      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          occupation: 'Computer Science Student',
          age: 21,
          gender: 'male',
          city: 'Gurugram',
          targetLocalities: ['Sector 54', 'DLF Phase 5'],
          budgetMax: 14000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Night Owl',
          cleanliness: 'Moderate',
          petFriendly: true,
          smoking: 'Non-smoker',
          bio: 'Third-year CS undergrad looking for clean shared room near Rapid Metro.',
          interests: ['coding', 'gaming', 'badminton'],
        })
        .expect(201);
    });

    it('registers Persona 2: Bhavna (Professional with room, Age 25, DLF Phase 4)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'bhavna.dev@aashvo.test',
          password: 'Password123!Bhavna',
          fullName: 'Bhavna Menon',
          accountType: 'owner',
        })
        .expect(201);

      bhavnaToken = res.body.accessToken;
      bhavnaId = res.body.user.id;
      expect(bhavnaId).toBeDefined();

      // Bhavna creates flatmate profile with room details
      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${bhavnaToken}`)
        .send({
          occupation: 'Senior Frontend Engineer',
          age: 25,
          gender: 'female',
          city: 'Gurugram',
          targetLocalities: ['DLF Phase 4'],
          budgetMax: 22000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          petFriendly: false,
          smoking: 'Non-smoker',
          bio: 'Tech professional working in Cyber City. Quiet, hygienic household.',
          interests: ['yoga', 'reading', 'cooking'],
        })
        .expect(201);

      // Bhavna lists her property
      const pRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${bhavnaToken}`)
        .send({
          title: 'Private Room in Premium 3BHK Apartment - DLF Phase 4',
          description: 'Fully furnished private room with attached bathroom in gated society.',
          category: 'flats_rooms',
          propertyType: 'apartment',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'DLF Phase 4',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '122002',
          addressShort: 'Ridgewood Estate, DLF Phase 4, Gurugram',
          rentAmount: 22000,
          depositAmount: 44000,
          maintenanceCharge: 2000,
          providerType: 'tenant_flatmate',
          genderPreference: 'female_only',
          bedrooms: 3,
          bathrooms: 3,
          availableFrom: new Date().toISOString(),
          photoUrls: [{ photoUrl: 'https://storage.aashvo.in/photos/bhavna-room.webp', isPrimary: true }],
        })
        .expect(201);

      bhavnaPropertyId = pRes.body.id;
      expect(bhavnaPropertyId).toBeDefined();
    });

    it('registers Persona 5: Farhan (Property Owner in Delhi NCR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'farhan.owner@aashvo.test',
          password: 'Password123!Farhan',
          fullName: 'Farhan Zaidi',
          accountType: 'owner',
        })
        .expect(201);

      farhanToken = res.body.accessToken;
      farhanId = res.body.user.id;

      // Farhan lists a 2BHK flat in Hauz Khas
      const pRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          title: 'Sunlit 2BHK Floor near Hauz Khas Metro',
          description: 'Spacious independent floor, walking distance to metro and green park.',
          category: 'flats_rooms',
          propertyType: 'builder_floor',
          roomType: 'entire_flat',
          furnishing: 'semi_furnished',
          locality: 'Hauz Khas',
          city: 'Delhi NCR',
          state: 'Delhi',
          pincode: '110016',
          addressShort: 'Block C, Hauz Khas, New Delhi',
          rentAmount: 35000,
          depositAmount: 70000,
          maintenanceCharge: 1500,
          providerType: 'owner',
          genderPreference: 'any',
          bedrooms: 2,
          bathrooms: 2,
          availableFrom: new Date().toISOString(),
          photoUrls: [{ photoUrl: 'https://storage.aashvo.in/photos/farhan-flat.webp', isPrimary: true }],
        })
        .expect(201);

      farhanPropertyId = pRes.body.id;
      expect(farhanPropertyId).toBeDefined();
    });

    it('registers Persona 6: Gayatri (Compliance & Trust Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'gayatri.admin@aashvo.test',
          password: 'Password123!Gayatri',
          fullName: 'Gayatri Joshi',
          accountType: 'renter',
        })
        .expect(201);

      gayatriId = res.body.user.id;

      // Elevate Gayatri to admin
      await prisma.user.update({
        where: { id: gayatriId },
        data: { role: 'admin' },
      });
      await prisma.profile.update({
        where: { id: gayatriId },
        data: { role: 'admin' },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'gayatri.admin@aashvo.test',
          password: 'Password123!Gayatri',
        })
        .expect(200);

      gayatriToken = loginRes.body.accessToken;
      expect(gayatriToken).toBeDefined();
    });
  });

  // =========================================================================
  // PERSONA 5 & 6: PROPERTY VERIFICATION & MODERATION (Farhan & Gayatri)
  // =========================================================================
  describe('Persona 5 & 6: Property Verification Lifecycle', () => {
    it('Farhan submits electricity bill verification for his Hauz Khas property', async () => {
      const vRes = await request(app.getHttpServer())
        .post(`/api/v1/properties/${farhanPropertyId}/verification`)
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          documentType: 'electricity_bill',
          documentUrl: 'https://private.storage.aashvo.in/docs/farhan_bses_bill.pdf',
          ownerIdType: 'pan',
        })
        .expect(201);

      expect(vRes.body.status).toBe('submitted');
      expect(vRes.body.documentType).toBe('electricity_bill');
    });

    it('Gayatri (Admin) reviews and approves Farhan property verification', async () => {
      const reviewRes = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${farhanPropertyId}/verification/review`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          action: 'approve',
          reviewNotes: 'Electricity bill matches owner name and registered property address.',
          expiresInDays: 180,
        })
        .expect(200);

      expect(reviewRes.body.status).toBe('verified');
      expect(reviewRes.body.reviewedBy).toBe(gayatriId);

      // Verify the property verification status endpoint
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/properties/${farhanPropertyId}/verification`)
        .set('Authorization', `Bearer ${farhanToken}`)
        .expect(200);

      expect(getRes.body.status).toBe('verified');

      // Admin activates the property listing
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${farhanPropertyId}/moderate`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          status: 'active',
          reason: 'Verified ownership and passed content moderation.',
        })
        .expect(200);
    });
  });

  // =========================================================================
  // PERSONA 1: SEARCH, SAVED ITEMS & VISIT SCHEDULING (Aarav)
  // =========================================================================
  describe('Persona 1: Aarav Discovery, Shortlist & Visit Scheduling', () => {
    it('Aarav searches properties and saves Farhan verified property to his shortlist', async () => {
      // 1. Search properties in Delhi NCR
      const sRes = await request(app.getHttpServer())
        .get('/api/v1/properties?city=Delhi NCR')
        .expect(200);

      expect(sRes.body.data.length).toBeGreaterThanOrEqual(1);

      // 2. Save Farhan's property
      const saveRes = await request(app.getHttpServer())
        .post('/api/v1/saved')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          itemType: 'property',
          targetId: farhanPropertyId,
          notes: 'Great location near metro station, verified owner.',
        })
        .expect(201);

      expect(saveRes.body.targetId).toBe(farhanPropertyId);

      // 3. Confirm listed in Aarav's saved items
      const listSaved = await request(app.getHttpServer())
        .get('/api/v1/saved')
        .set('Authorization', `Bearer ${aaravToken}`)
        .expect(200);

      expect(listSaved.body.some((item: any) => item.targetId === farhanPropertyId)).toBe(true);
    });

    it('Aarav schedules an in-person visit for Farhan property, Farhan confirms it', async () => {
      const scheduledTime = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 days ahead

      // 1. Aarav requests visit
      const vRes = await request(app.getHttpServer())
        .post('/api/v1/visits')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          propertyId: farhanPropertyId,
          scheduledAt: scheduledTime,
          visitorMessage: 'Hello Farhan, I would like to visit this Saturday around 11:30 AM.',
        })
        .expect(201);

      aaravVisitId = vRes.body.id;
      expect(vRes.body.status).toBe('pending');
      expect(vRes.body.propertyId).toBe(farhanPropertyId);

      // 2. Farhan lists host visits and sees the request
      const fVisits = await request(app.getHttpServer())
        .get('/api/v1/visits')
        .set('Authorization', `Bearer ${farhanToken}`)
        .expect(200);

      expect(fVisits.body.some((v: any) => v.id === aaravVisitId)).toBe(true);

      // 3. Farhan confirms the visit
      const confirmRes = await request(app.getHttpServer())
        .patch(`/api/v1/visits/${aaravVisitId}/status`)
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          action: 'confirm',
          hostNotes: 'Confirmed! Please bring your college ID card.',
        })
        .expect(200);

      expect(confirmRes.body.status).toBe('confirmed');
      expect(confirmRes.body.hostNotes).toContain('Confirmed');
    });

    it('Aarav sends an independent direct property inquiry to Farhan without requiring Connect match', async () => {
      const inqRes = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          propertyId: farhanPropertyId,
          senderName: 'Aarav Sharma',
          senderEmail: 'aarav.student@aashvo.test',
          senderPhone: '+919876543210',
          message: 'Interested in the 2BHK flat. Are maintenance charges included in the rent?',
          moveInDate: '2026-12-01',
        })
        .expect(201);

      expect(inqRes.body.propertyId).toBe(farhanPropertyId);
      expect(inqRes.body.senderName).toBe('Aarav Sharma');
      expect(inqRes.body.status).toBe('pending');
    });
  });

  // =========================================================================
  // PERSONA 3: TEAM-UP DISCOVERY, MUTUAL MATCH & MESSAGING (Chirag & Divya)
  // =========================================================================
  describe('Persona 3: Chirag & Divya Team-Up Matching & Messaging', () => {
    it('registers Chirag (Wants to team up in Bengaluru, budget ₹30,000)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'chirag.teamup@aashvo.test',
          password: 'Password123!Chirag',
          fullName: 'Chirag Patel',
          accountType: 'renter',
        })
        .expect(201);

      chiragToken = res.body.accessToken;
      chiragId = res.body.user.id;

      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${chiragToken}`)
        .send({
          occupation: 'Product Manager',
          age: 26,
          gender: 'male',
          city: 'Bengaluru',
          targetLocalities: ['Indiranagar', 'Koramangala'],
          budgetMax: 30000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          petFriendly: true,
          smoking: 'Non-smoker',
          bio: 'Looking for a flatmate to rent a 3BHK together in Indiranagar/Koramangala.',
          interests: ['Fintech', 'Running', 'Coffee'],
        })
        .expect(201);
    });

    it('registers Divya (Wants to team up in Bengaluru, budget ₹30,000)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'divya.teamup@aashvo.test',
          password: 'Password123!Divya',
          fullName: 'Divya Nambiar',
          accountType: 'renter',
        })
        .expect(201);

      divyaToken = res.body.accessToken;
      divyaId = res.body.user.id;

      await request(app.getHttpServer())
        .post('/api/v1/flatmates/me')
        .set('Authorization', `Bearer ${divyaToken}`)
        .send({
          occupation: 'UX Designer',
          age: 25,
          gender: 'female',
          city: 'Bengaluru',
          targetLocalities: ['Indiranagar', 'Domlur'],
          budgetMax: 30000,
          foodHabit: 'Vegetarian',
          sleepRoutine: 'Early Bird',
          cleanliness: 'Spotless',
          petFriendly: true,
          smoking: 'Non-smoker',
          bio: 'Looking to find compatible folks to furnish and rent a cozy 3BHK.',
          interests: ['Design', 'Plants', 'Running'],
        })
        .expect(201);
    });

    it('Chirag discovers Divya in Connect discover feed with high compatibility', async () => {
      const dRes = await request(app.getHttpServer())
        .get('/api/v1/connect/discover?city=Bengaluru')
        .set('Authorization', `Bearer ${chiragToken}`)
        .expect(200);

      expect(Array.isArray(dRes.body)).toBe(true);
      const divyaCard = dRes.body.find((c: any) => c.userId === divyaId);
      expect(divyaCard).toBeDefined();
      expect(divyaCard.compatibility.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('Chirag expresses interest (swipes right) on Divya: no match yet', async () => {
      const iRes = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${chiragToken}`)
        .send({
          targetUserId: divyaId,
          action: 'like',
        })
        .expect(201);

      expect(iRes.body.success).toBe(true);
      expect(iRes.body.matched).toBe(false);
    });

    it('Divya expresses interest (swipes right) on Chirag: MUTUAL MATCH unlocked', async () => {
      const iRes = await request(app.getHttpServer())
        .post('/api/v1/connect/interests')
        .set('Authorization', `Bearer ${divyaToken}`)
        .send({
          targetUserId: chiragId,
          action: 'like',
        })
        .expect(201);

      expect(iRes.body.success).toBe(true);
      expect(iRes.body.matched).toBe(true);
      expect(iRes.body.match.id).toBeDefined();
      chiragDivyaMatchId = iRes.body.match.id;
    });

    it('Chirag and Divya exchange messages within their mutual match conversation', async () => {
      // 1. Chirag sends first message
      const msg1 = await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${chiragDivyaMatchId}/messages`)
        .set('Authorization', `Bearer ${chiragToken}`)
        .send({ content: 'Hi Divya! Are you looking at 3BHKs in Indiranagar near 12th Main?' })
        .expect(201);

      expect(msg1.body.content).toContain('Indiranagar');
      expect(msg1.body.senderId).toBe(chiragId);

      // 2. Divya replies
      const msg2 = await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${chiragDivyaMatchId}/messages`)
        .set('Authorization', `Bearer ${divyaToken}`)
        .send({ content: 'Hey Chirag! Yes, that area is perfect. We can visit listings this weekend.' })
        .expect(201);

      expect(msg2.body.senderId).toBe(divyaId);

      // 3. Both see the conversation history
      const hist = await request(app.getHttpServer())
        .get(`/api/v1/connect/matches/${chiragDivyaMatchId}/messages`)
        .set('Authorization', `Bearer ${chiragToken}`)
        .expect(200);

      expect(hist.body.length).toBe(2);

      // 4. Unauthorized third party (Aarav) cannot send message to Chirag & Divya match
      await request(app.getHttpServer())
        .post(`/api/v1/connect/matches/${chiragDivyaMatchId}/messages`)
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({ content: 'Unauthorized injection' })
        .expect(403);
    });
  });

  // =========================================================================
  // PERSONA 4: FAMILY STAY GUEST & DIRECT INQUIRY (Eshaan)
  // =========================================================================
  describe('Persona 4: Eshaan Family Stay Discovery & Inquiry', () => {
    it('creates a verified Family Stay listing with host family and home-cooked meals', async () => {
      // Farhan creates a dedicated Family Stay property
      const pRes = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          title: 'Heritage Villa Homestay with Authentic North Indian Meals',
          description: 'Peaceful accommodation with resident host family, home-cooked vegetarian meals and garden.',
          category: 'family_stays',
          propertyType: 'villa',
          roomType: 'private_room',
          furnishing: 'fully_furnished',
          locality: 'Greater Kailash 1',
          city: 'Delhi NCR',
          state: 'Delhi',
          pincode: '110048',
          addressShort: 'M-Block, GK-1, New Delhi',
          rentAmount: 28000,
          depositAmount: 28000,
          maintenanceCharge: 0,
          providerType: 'owner',
          familyLivesOnProperty: true,
          mealsOffered: 'included',
          optionalMealCost: 3500,
          genderPreference: 'any',
          bedrooms: 1,
          bathrooms: 1,
          availableFrom: new Date().toISOString(),
          photoUrls: [{ photoUrl: 'https://storage.aashvo.in/photos/family-stay-villa.webp', isPrimary: true }],
        })
        .expect(201);

      familyStayPropertyId = pRes.body.id;
      expect(familyStayPropertyId).toBeDefined();

      // Ensure property is verified and active so it shows in search
      await request(app.getHttpServer())
        .patch(`/api/v1/properties/${familyStayPropertyId}/moderate`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          status: 'active',
          reason: 'Verified family stay listing.',
        })
        .expect(200);
    });

    it('registers Eshaan (Family Stay guest moving with family)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'eshaan.family@aashvo.test',
          password: 'Password123!Eshaan',
          fullName: 'Eshaan Verma',
          accountType: 'renter',
        })
        .expect(201);

      eshaanToken = res.body.accessToken;
      eshaanId = res.body.user.id;
      expect(eshaanId).toBeDefined();
      expect(eshaanToken).toBeDefined();
    });

    it('Eshaan searches /family-stays and finds verified listings with meals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/family-stays?city=Delhi NCR&mealsOffered=included')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const fs = res.body.data.find((item: any) => item.id === familyStayPropertyId);
      expect(fs).toBeDefined();
      expect(fs.familyLivesOnProperty).toBe(true);
      expect(fs.mealsOffered).toBe('included');
    });

    it('Eshaan submits direct inquiry to family stay host without Connect match', async () => {
      const inq = await request(app.getHttpServer())
        .post('/api/v1/inquiries')
        .set('Authorization', `Bearer ${eshaanToken}`)
        .send({
          propertyId: familyStayPropertyId,
          senderName: 'Eshaan Verma',
          senderEmail: 'eshaan.family@aashvo.test',
          senderPhone: '+919812345678',
          message: 'Hello, looking for comfortable homestay with home-cooked meals for 6 months.',
          moveInDate: '2026-12-01',
        })
        .expect(201);

      expect(inq.body.propertyId).toBe(familyStayPropertyId);
      expect(inq.body.senderName).toBe('Eshaan Verma');
      expect(inq.body.status).toBe('pending');
    });
  });

  // =========================================================================
  // PERSONA 6 & 7: AGREEMENTS, DISPUTE & SUPPORT (Gayatri & Harsh/Aarav)
  // =========================================================================
  describe('Tenancy Agreement, Move-in Checklist & Dispute Lifecycle', () => {
    it('Farhan creates a tenancy agreement draft with Aarav as tenant', async () => {
      const agr = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          tenantId: aaravId,
          propertyId: farhanPropertyId,
          monthlyRent: 35000,
          securityDeposit: 70000,
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2027-11-30T00:00:00.000Z',
          termsSummary: 'Standard 11-month residential tenancy agreement with 5% annual escalation.',
        })
        .expect(201);

      tenancyAgreementId = agr.body.id;
      expect(agr.body.agreementStatus).toBe('draft');
      expect(agr.body.landlordId).toBe(farhanId);
      expect(agr.body.tenantId).toBe(aaravId);
    });

    it('Farhan activates the tenancy agreement', async () => {
      const act = await request(app.getHttpServer())
        .patch(`/api/v1/agreements/${tenancyAgreementId}/status`)
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          agreementStatus: 'active',
        })
        .expect(200);

      expect(act.body.agreementStatus).toBe('active');
    });

    it('Farhan records an initial move-in inspection checklist', async () => {
      const insp = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${farhanToken}`)
        .send({
          agreementId: tenancyAgreementId,
          inspectionType: 'move_in',
          inspectionDate: '2026-12-01',
          roomName: 'Master Bedroom & Living Room',
          conditionRating: 5,
          damageNotes: 'Minor scuff on living room door jamb.',
          photoUrls: ['https://storage.aashvo.in/photos/inspection-living.webp'],
          meterReadings: {
            electricityKwh: 4520.5,
            waterKl: 120.0,
            recordedAt: new Date().toISOString(),
          },
          inventory: [
            { item: 'Split AC 1.5 Ton', quantity: 2, condition: 'working_clean' },
            { item: 'Geyser 25L', quantity: 2, condition: 'working_clean' },
          ],
          keyHandoverConfirmed: true,
          depositConfirmed: true,
        })
        .expect(201);

      expect(insp.body.inspectionType).toBe('move_in');
      expect(insp.body.agreementId).toBe(tenancyAgreementId);

      // Aarav acknowledges the inspection
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${insp.body.id}/acknowledge`)
        .set('Authorization', `Bearer ${aaravToken}`)
        .expect(200);
    });

    it('Aarav files a rental dispute regarding utility meter deduction', async () => {
      const dRes = await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          agreementId: tenancyAgreementId,
          disputeType: 'deposit_deduction',
          disputedAmount: 4500,
          title: 'Incorrect power meter tariff calculation',
          description: 'Sub-meter reading applied commercial tariff rate instead of residential tariff.',
          evidenceUrls: ['https://storage.aashvo.in/evidence/bill-calculation.pdf'],
        })
        .expect(201);

      tenancyDisputeId = dRes.body.id;
      expect(dRes.body.status).toBe('open');
      expect(dRes.body.initiatorId).toBe(aaravId);
    });

    it('Gayatri (Admin) mediates and resolves the rental dispute with binding decision', async () => {
      const rRes = await request(app.getHttpServer())
        .patch(`/api/v1/disputes/${tenancyDisputeId}/resolve`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          status: 'resolved_tenant',
          resolutionSummary: 'Verified residential tariff table. Landlord instructed to credit ₹1,850 to next month rent.',
        })
        .expect(200);

      expect(rRes.body.status).toBe('resolved_tenant');
      expect(rRes.body.resolutionSummary).toContain('credit');
    });
  });

  // =========================================================================
  // PERSONA 7: SUPPORT TICKET LIFECYCLE (Harsh / Aarav & Support Staff)
  // =========================================================================
  describe('Persona 7: Support Ticket Lifecycle & Resolution', () => {
    it('Aarav submits a support ticket regarding rent split calculator', async () => {
      const tRes = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', `Bearer ${aaravToken}`)
        .send({
          category: 'rent_calculator',
          subject: 'How to export 3-way utility split breakdown',
          description: 'Need assistance exporting custom room size rent calculation to WhatsApp text summary.',
          priority: 'medium',
        })
        .expect(201);

      supportTicketId = tRes.body.id;
      expect(tRes.body.ticketNumber).toMatch(/^ASH-TKT-/);
      expect(tRes.body.status).toBe('open');
      expect(tRes.body.category).toBe('rent_calculator');
    });

    it('Gayatri (Staff/Admin) responds to support ticket with resolution steps', async () => {
      const mRes = await request(app.getHttpServer())
        .post(`/api/v1/support/tickets/${supportTicketId}/messages`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          message: 'Hello Aarav! In the Rent Split Calculator modal, click "Share on WhatsApp" or "Copy Summary" to generate a formatted breakdown for all flatmates.',
        })
        .expect(201);

      expect(mRes.body.senderRole).toBe('admin');
      expect(mRes.body.message).toContain('WhatsApp');

      // Gayatri updates status to resolved
      const sRes = await request(app.getHttpServer())
        .patch(`/api/v1/support/tickets/${supportTicketId}/status`)
        .set('Authorization', `Bearer ${gayatriToken}`)
        .send({
          status: 'resolved',
        })
        .expect(200);

      expect(sRes.body.status).toBe('resolved');
    });

    it('Aarav views his resolved support tickets under /support/tickets/mine', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/support/tickets/mine')
        .set('Authorization', `Bearer ${aaravToken}`)
        .expect(200);

      expect(list.body.some((t: any) => t.id === supportTicketId)).toBe(true);
    });
  });
});
