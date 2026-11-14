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

describe('Rental Trust Engine & Dispute Resolution (PostgreSQL 16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let landlordToken: string;
  let landlordId: string;
  let tenantToken: string;
  let tenantId: string;
  let outsiderToken: string;
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
    await app?.close();
  });

  beforeEach(async () => {
    // Truncate all trust engine & related tables cleanly
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
        audit_logs,
        notification_outbox,
        ticket_audit_events,
        ticket_messages,
        support_tickets,
        rental_disputes,
        tenancy_reviews,
        property_inspections,
        rent_payment_records,
        tenancy_agreements,
        interest_requests,
        property_photos,
        properties,
        flatmate_profiles,
        media_assets,
        verification_tokens,
        refresh_sessions,
        profiles,
        users
      CASCADE`,
    );

    // Seed 4 test users: Landlord, Tenant, Outsider, Admin
    const landlordRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'landlord@aashvo-trust.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Rajesh Mehta',
        accountType: 'owner',
      })
      .expect(201);
    landlordToken = landlordRes.body.accessToken;
    landlordId = landlordRes.body.user.id;

    const tenantRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'tenant@aashvo-trust.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Priya Sen',
        accountType: 'renter',
      })
      .expect(201);
    tenantToken = tenantRes.body.accessToken;
    tenantId = tenantRes.body.user.id;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'outsider@aashvo-trust.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Amitabh Roy',
        accountType: 'renter',
      })
      .expect(201);
    outsiderToken = outsiderRes.body.accessToken;

    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin@aashvo-trust.in',
        password: 'Str0ngPassword#2026',
        fullName: 'Aashvo Admin',
        accountType: 'renter',
      })
      .expect(201);
    adminToken = adminRes.body.accessToken;
    adminId = adminRes.body.user.id;

    // Elevate admin
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
  });

  describe('Tenancy Agreements & Rent Payments', () => {
    it('creates a draft agreement, validates distinct parties and dates', async () => {
      // 1. Same party returns 400
      const selfRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId: landlordId,
          monthlyRent: 30000,
          securityDeposit: 60000,
          startDate: '2026-12-01',
        })
        .expect(400);
      expect(selfRes.body.error.message).toContain('distinct parties');

      // 2. End date before start date returns 400
      const badDateRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId,
          monthlyRent: 30000,
          securityDeposit: 60000,
          startDate: '2026-12-01',
          endDate: '2026-11-01',
        })
        .expect(400);
      expect(badDateRes.body.error.message).toContain('End date must be on or after start date');

      // 3. Valid creation
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId,
          monthlyRent: 30000,
          securityDeposit: 60000,
          startDate: '2026-12-01',
          endDate: '2027-10-31',
          termsSummary: 'Standard 11-month lease agreement',
        })
        .expect(201);

      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.agreementStatus).toBe('draft');
      expect(createRes.body.monthlyRent).toBe(30000);
      const agreementId = createRes.body.id;

      // 4. Outsider cannot access agreement
      await request(app.getHttpServer())
        .get(`/api/v1/agreements/${agreementId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);

      // 5. Tenant can access agreement
      const tenantViewRes = await request(app.getHttpServer())
        .get(`/api/v1/agreements/${agreementId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);
      expect(tenantViewRes.body.id).toBe(agreementId);

      // 6. Update status to active
      const activateRes = await request(app.getHttpServer())
        .patch(`/api/v1/agreements/${agreementId}/status`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ agreementStatus: 'active' })
        .expect(200);
      expect(activateRes.body.agreementStatus).toBe('active');

      // 7. Record rent payment
      const paymentRes = await request(app.getHttpServer())
        .post(`/api/v1/agreements/${agreementId}/payments`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          payerId: tenantId,
          recipientId: landlordId,
          amount: 30000,
          paymentCategory: 'monthly_rent',
          paymentDate: '2026-12-05',
          transactionReference: 'UPI-TEST-998877',
        })
        .expect(201);
      expect(paymentRes.body.amount).toBe(30000);

      // 8. List payments
      const listPaymentsRes = await request(app.getHttpServer())
        .get(`/api/v1/agreements/${agreementId}/payments`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .expect(200);
      expect(listPaymentsRes.body).toHaveLength(1);
    });
  });

  describe('Property Inspections', () => {
    it('creates inspection, restricts rating 1-5, and enables counterparty acknowledgement', async () => {
      // Create agreement
      const agrRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId,
          monthlyRent: 25000,
          securityDeposit: 50000,
          startDate: '2026-12-01',
        })
        .expect(201);
      const agreementId = agrRes.body.id;

      // 1. Rating > 5 rejected
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          agreementId,
          inspectionType: 'move_in',
          inspectionDate: '2026-12-01',
          roomName: 'Living Room',
          conditionRating: 6,
        })
        .expect(400);

      // 2. Valid move-in inspection created by landlord
      const inspRes = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          agreementId,
          inspectionType: 'move_in',
          inspectionDate: '2026-12-01',
          roomName: 'Living Room',
          conditionRating: 4,
          damageNotes: 'Clean with small paint chip near window',
          photoUrls: ['https://storage.aashvo.com/test/window.jpg'],
        })
        .expect(201);

      const inspectionId = inspRes.body.id;
      expect(inspRes.body.acknowledgedByCounterparty).toBe(false);

      // 3. Conductor cannot self-acknowledge
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${inspectionId}/acknowledge`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .expect(403);

      // 4. Counterparty (tenant) acknowledges
      const ackRes = await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${inspectionId}/acknowledge`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(ackRes.body.acknowledgedByCounterparty).toBe(true);
      expect(ackRes.body.acknowledgedAt).toBeDefined();
    });
  });

  describe('Tenancy Reviews & Ratings', () => {
    it('enforces verified tenancy, prevents duplicates, and allows public reading', async () => {
      // Create agreement
      const agrRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId,
          monthlyRent: 22000,
          securityDeposit: 44000,
          startDate: '2026-12-01',
        })
        .expect(201);
      const agreementId = agrRes.body.id;

      // 1. Outsider cannot submit review
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          agreementId,
          revieweeId: landlordId,
          reviewerRole: 'tenant',
          communicationRating: 5,
          maintenanceRating: 5,
          propertyCareRating: 5,
          agreementClarityRating: 5,
          reviewContent: 'Great experience',
        })
        .expect(403);

      // 2. Tenant submits review for Landlord
      const reviewRes = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          agreementId,
          revieweeId: landlordId,
          reviewerRole: 'tenant',
          communicationRating: 5,
          maintenanceRating: 4,
          propertyCareRating: 5,
          agreementClarityRating: 4,
          reviewTitle: 'Highly Recommended Landlord',
          reviewContent: 'Very prompt in handling plumbing maintenance and transparent lease terms.',
        })
        .expect(201);

      expect(reviewRes.body.overallRating).toBe(4.5);
      expect(reviewRes.body.moderationStatus).toBe('approved');

      // 3. Duplicate review by same reviewer returns 409 Conflict
      const dupRes = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          agreementId,
          revieweeId: landlordId,
          reviewerRole: 'tenant',
          communicationRating: 5,
          maintenanceRating: 5,
          propertyCareRating: 5,
          agreementClarityRating: 5,
          reviewContent: 'Another review',
        })
        .expect(409);
      expect(dupRes.body.error.code).toBe(ERROR_CODES.DUPLICATE_REVIEW);

      // 4. Public profile reviews retrieval
      const pubRes = await request(app.getHttpServer())
        .get(`/api/v1/reviews/profile/${landlordId}`)
        .expect(200);
      expect(pubRes.body).toHaveLength(1);
      expect(pubRes.body[0].reviewTitle).toBe('Highly Recommended Landlord');
    });
  });

  describe('Rental Disputes & Partial Unique Constraint', () => {
    it('creates dispute, enforces single active dispute per type constraint (409), and admin resolves', async () => {
      // Create agreement
      const agrRes = await request(app.getHttpServer())
        .post('/api/v1/agreements')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          tenantId,
          monthlyRent: 20000,
          securityDeposit: 40000,
          startDate: '2026-12-01',
        })
        .expect(201);
      const agreementId = agrRes.body.id;

      // 1. Tenant files deposit deduction dispute
      const disputeRes = await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          agreementId,
          disputeType: 'deposit_deduction',
          disputedAmount: 15000,
          title: 'Unfair painting charges',
          description: 'Landlord deducted Rs. 15,000 for regular wear and tear painting.',
        })
        .expect(201);

      expect(disputeRes.body.disputeNumber).toMatch(/^DSP-\d{6}-[A-Z0-9]+$/);
      expect(disputeRes.body.status).toBe('open');
      const disputeId = disputeRes.body.id;

      // 2. Attempting second active dispute of same type returns 409 Conflict (PostgreSQL partial unique index)
      const secondDisputeRes = await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          agreementId,
          disputeType: 'deposit_deduction',
          disputedAmount: 5000,
          title: 'Another deposit dispute',
          description: 'Trying to open a duplicate active dispute',
        })
        .expect(409);

      expect(secondDisputeRes.body.error.code).toBe(ERROR_CODES.DUPLICATE_ACTIVE_DISPUTE);

      // 3. Admin resolves the dispute
      const resolveRes = await request(app.getHttpServer())
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved_tenant',
          resolutionSummary: 'Move-in inspection confirms wear and tear. Rs. 15,000 refund ordered.',
        })
        .expect(200);

      expect(resolveRes.body.status).toBe('resolved_tenant');
      expect(resolveRes.body.resolutionSummary).toContain('Rs. 15,000 refund ordered');
    });
  });

  describe('Customer Support Tickets & Guest Access', () => {
    it('creates authenticated ticket, adds message thread, and handles guest tickets', async () => {
      // 1. Authenticated user creates ticket
      const ticketRes = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          category: 'lease_signing',
          subject: 'Question on digital lease verification',
          description: 'How do I download the counter-signed PDF copy?',
          priority: 'medium',
        })
        .expect(201);

      expect(ticketRes.body.ticketNumber).toMatch(/^ASH-TKT-[A-Z0-9]+$/);
      expect(ticketRes.body.status).toBe('open');
      expect(ticketRes.body.messages).toHaveLength(1);
      const ticketId = ticketRes.body.id;

      // 2. Add reply message
      const msgRes = await request(app.getHttpServer())
        .post(`/api/v1/support/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          message: 'Also, does the digital signature include the timestamp?',
        })
        .expect(201);
      expect(msgRes.body.message).toContain('digital signature include the timestamp');

      // 3. Guest ticket (unauthenticated public endpoint)
      const guestRes = await request(app.getHttpServer())
        .post('/api/v1/support/tickets/guest')
        .send({
          userName: 'Rohan Gupta',
          userEmail: 'rohan.gupta@example.in',
          category: 'general_inquiry',
          subject: 'Is brokerage charged for student rooms?',
          description: 'Hi, I want to know if Aashvo is zero brokerage for students.',
        })
        .expect(201);

      expect(guestRes.body.ticketNumber).toMatch(/^ASH-TKT-[A-Z0-9]+$/);
      expect(guestRes.body.userId).toBeNull();
      expect(guestRes.body.userEmail).toBe('rohan.gupta@example.in');

      // 4. Admin updates ticket status to resolved
      const statusRes = await request(app.getHttpServer())
        .patch(`/api/v1/support/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect(statusRes.body.status).toBe('resolved');
      expect(statusRes.body.resolvedAt).toBeDefined();
    });
  });
});
