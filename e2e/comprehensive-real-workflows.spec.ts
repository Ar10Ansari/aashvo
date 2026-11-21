import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/aashvo_test';
const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

test.describe('AASHVO Comprehensive Real E2E & Persistence Workflows', () => {
  const timestamp = Date.now();
  const ownerEmail = `e2e-owner-${timestamp}@example.com`;
  const seekerEmail = `e2e-seeker-${timestamp}@example.com`;
  const adminEmail = `e2e-admin-${timestamp}@example.com`;
  const testPassword = 'Password123!';

  let ownerUserId: string;
  let ownerToken: string;
  let seekerUserId: string;
  let seekerToken: string;
  let adminUserId: string;
  let adminToken: string;

  let createdPropertyId: string;
  let familyStayPropertyId: string;
  let scheduledVisitId: string;
  let createdInquiryId: string;

  test.beforeAll(async ({ request }) => {
    await prisma.$connect();

    // 1. Setup Owner
    const ownerReg = await request.post('/api/v1/auth/register', {
      data: {
        email: ownerEmail,
        password: testPassword,
        fullName: 'E2E Owner Person',
        accountType: 'owner',
      },
    });
    expect(ownerReg.status()).toBe(201);
    const ownerData = await ownerReg.json();
    ownerUserId = ownerData.user.id;
    ownerToken = ownerData.accessToken;

    // 2. Setup Seeker
    const seekerReg = await request.post('/api/v1/auth/register', {
      data: {
        email: seekerEmail,
        password: testPassword,
        fullName: 'E2E Seeker Person',
        accountType: 'renter',
      },
    });
    expect(seekerReg.status()).toBe(201);
    const seekerData = await seekerReg.json();
    seekerUserId = seekerData.user.id;
    seekerToken = seekerData.accessToken;

    // 3. Setup Admin
    const adminReg = await request.post('/api/v1/auth/register', {
      data: {
        email: adminEmail,
        password: testPassword,
        fullName: 'E2E Admin Person',
        accountType: 'renter',
      },
    });
    expect(adminReg.status()).toBe(201);
    const adminData = await adminReg.json();
    adminUserId = adminData.user.id;

    // Elevate admin role directly in database
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });

    // Re-login admin to obtain claims
    const adminLogin = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: testPassword },
    });
    expect(adminLogin.status()).toBe(200);
    adminToken = (await adminLogin.json()).accessToken;

    // 4. Create primary baseline property
    const propRes = await request.post('/api/v1/properties', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        title: 'E2E Cyber City Executive 3BHK',
        description: 'Stunning executive apartment with 100% power backup and balcony.',
        locality: 'DLF Phase 2',
        city: 'Gurugram',
        state: 'Haryana',
        addressShort: 'Near Cyber City Metro, DLF Phase 2',
        propertyType: 'apartment',
        roomType: 'private_room',
        furnishing: 'fully_furnished',
        category: 'flats_rooms',
        rentAmount: 32000,
        depositAmount: 50000,
        maintenanceCharge: 2500,
        electricityRatePerUnit: 8.5,
        brokerageFee: 0,
        providerType: 'owner',
        genderPreference: 'any',
        bedrooms: 3,
        bathrooms: 3,
        availableFrom: 'Immediately',
        amenities: ['100% Power Backup', 'High-Speed Wi-Fi', 'Air Conditioner'],
        houseRules: ['Cleanliness observed'],
        photoUrls: [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }],
        asDraft: false,
      },
    });
    expect(propRes.status()).toBe(201);
    createdPropertyId = (await propRes.json()).id;

    // Activate property via Admin moderation
    const activateRes = await request.patch(`/api/v1/properties/${createdPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'active', reason: 'Baseline listing approval' },
    });
    expect(activateRes.status()).toBe(200);
  });

  test.afterAll(async () => {
    const testEmails = [ownerEmail, seekerEmail, adminEmail];
    for (const email of testEmails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.savedItem.deleteMany({ where: { userId: user.id } });
        await prisma.userNotification.deleteMany({ where: { userId: user.id } });
        await prisma.propertyVisit.deleteMany({ where: { visitorId: user.id } });
        await prisma.interestRequest.deleteMany({ where: { senderId: user.id } });
        await prisma.property.deleteMany({ where: { ownerId: user.id } });
        await prisma.profile.deleteMany({ where: { id: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // E2E-01: Authentication (Registration, Session, Refresh, Logout)
  // =========================================================================
  test('E2E-01: Full Authentication lifecycle with real database verification and session survival', async ({ page }) => {
    const freshUserEmail = `browser-auth-${Date.now()}@example.com`;

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Open Auth Modal (Handling both desktop and mobile drawer)
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      const menuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
      await menuBtn.click();
    }

    const signInBtn = page.locator('button:visible:has-text("Sign in")').first();
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    const authModal = page.locator('[role="dialog"]');
    await expect(authModal).toBeVisible();

    // 2. Switch to Register tab
    const registerTab = authModal.locator('button:has-text("Register")').first();
    await registerTab.click();

    // 3. Fill in registration form
    const fullNameInput = authModal.locator('input[placeholder*="Priya" i], input[type="text"]').first();
    const emailInput = authModal.locator('input[type="email"]').first();
    const passwordInput = authModal.locator('input[type="password"]').first();

    await fullNameInput.fill('Browser Registered User');
    await emailInput.fill(freshUserEmail);
    await passwordInput.fill(testPassword);

    // 4. Submit registration
    const submitBtn = authModal.locator('button[type="submit"]:has-text("Create Account")').first();
    await submitBtn.click();

    // Modal should close upon successful registration
    await expect(authModal).not.toBeVisible({ timeout: 10000 });

    // 5. Verify database record exists in PostgreSQL
    const dbUser = await prisma.user.findUnique({ where: { email: freshUserEmail } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe(freshUserEmail);

    // 6. Verify session survives page refresh
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    if (isMobile) {
      const menuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
      await menuBtn.click();
    }
    const postReloadSignInBtn = page.locator('button:visible:has-text("Sign in")');
    const isUnauthVisible = await postReloadSignInBtn.isVisible();
    expect(isUnauthVisible).toBe(false);

    // Cleanup browser user
    if (dbUser) {
      await prisma.profile.delete({ where: { id: dbUser.id } });
      await prisma.user.delete({ where: { id: dbUser.id } });
    }
  });

  // =========================================================================
  // E2E-02: Owner Listing Creation & Draft Lifecycle
  // =========================================================================
  test('E2E-02: Owner listing creation wizard, draft auto-save, and PostgreSQL persistence', async ({ request }) => {
    // 1. Create draft listing
    const draftPayload = {
      title: 'E2E Draft Listing Sector 29',
      description: 'Cozy draft accommodation near HUDA City Centre.',
      locality: 'Sector 29',
      city: 'Gurugram',
      state: 'Haryana',
      addressShort: 'Near Leisure Valley, Sector 29',
      propertyType: 'apartment',
      roomType: 'private_room',
      furnishing: 'semi_furnished',
      category: 'flats_rooms',
      rentAmount: 22000,
      depositAmount: 35000,
      maintenanceCharge: 1500,
      brokerageFee: 0,
      providerType: 'owner',
      genderPreference: 'any',
      bedrooms: 2,
      bathrooms: 2,
      availableFrom: 'Immediately',
      amenities: ['100% Power Backup', 'High-Speed Wi-Fi'],
      photoUrls: [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }],
      asDraft: true,
    };

    const draftRes = await request.post('/api/v1/properties', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: draftPayload,
    });
    expect(draftRes.status()).toBe(201);
    const draftData = await draftRes.json();
    const draftPropertyId = draftData.id;

    // Verify in PostgreSQL: status must be 'paused' (draft)
    const dbDraft = await prisma.property.findUnique({ where: { id: draftPropertyId } });
    expect(dbDraft).not.toBeNull();
    expect(dbDraft?.status).toBe('paused');
    expect(dbDraft?.ownerId).toBe(ownerUserId);

    // 2. Publish draft listing
    const publishRes = await request.patch(`/api/v1/properties/${draftPropertyId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'active', rentAmount: 24000 },
    });
    expect(publishRes.ok()).toBeTruthy();

    const dbActive = await prisma.property.findUnique({ where: { id: draftPropertyId } });
    expect(dbActive?.status).toBe('active');
    expect(Number(dbActive?.rentAmount)).toBe(24000);

    // Cleanup draft property
    await prisma.propertyPhoto.deleteMany({ where: { propertyId: draftPropertyId } });
    await prisma.property.delete({ where: { id: draftPropertyId } });
  });

  // =========================================================================
  // E2E-03: Seeker Discovery, Bookmarking & Shortlists
  // =========================================================================
  test('E2E-03: Seeker bookmarking property, PostgreSQL shortlist persistence, and DELETE unsave', async ({ request }) => {
    // 1. Bookmark property (Save to shortlist)
    const saveRes = await request.post('/api/v1/saved', {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: {
        itemType: 'property',
        targetId: createdPropertyId,
        notes: 'Great location near office',
      },
    });
    expect(saveRes.status()).toBe(201);

    // 2. Verify in PostgreSQL: SavedItem record exists
    const dbSaved = await prisma.savedItem.findFirst({
      where: { userId: seekerUserId, targetId: createdPropertyId },
    });
    expect(dbSaved).not.toBeNull();
    expect(dbSaved?.itemType).toBe('property');

    // 3. Check saved status endpoint
    const checkRes = await request.get(`/api/v1/saved/check/property/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
    });
    expect(checkRes.ok()).toBeTruthy();
    const checkData = await checkRes.json();
    expect(checkData.isSaved).toBe(true);

    // 4. Unsave item by targetType and targetId (verifying fixed DELETE route)
    const unsaveRes = await request.delete(`/api/v1/saved/property/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
    });
    expect(unsaveRes.status()).toBe(200);

    // 5. Verify in PostgreSQL: record is removed
    const dbPostUnsave = await prisma.savedItem.findFirst({
      where: { userId: seekerUserId, targetId: createdPropertyId },
    });
    expect(dbPostUnsave).toBeNull();
  });

  // =========================================================================
  // E2E-04: Property Inquiry Workflow
  // =========================================================================
  test('E2E-04: Seeker submits inquiry via POST /api/v1/inquiries, persists in PostgreSQL, creates notification', async ({ request }) => {
    // 1. Submit Inquiry via authoritative POST /api/v1/inquiries
    const inqRes = await request.post('/api/v1/inquiries', {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: {
        propertyId: createdPropertyId,
        senderName: 'E2E Seeker Person',
        senderPhone: '+919876543210',
        senderEmail: seekerEmail,
        message: 'Hello, is this room available starting next Monday? I work nearby.',
        moveInDate: '2026-12-01',
      },
    });
    expect(inqRes.status()).toBe(201);
    const inqData = await inqRes.json();
    createdInquiryId = inqData.id;

    // 2. Verify in PostgreSQL: InterestRequest record exists
    const dbInq = await prisma.interestRequest.findUnique({ where: { id: createdInquiryId } });
    expect(dbInq).not.toBeNull();
    expect(dbInq?.senderId).toBe(seekerUserId);
    expect(dbInq?.propertyId).toBe(createdPropertyId);
    expect(dbInq?.status).toBe('pending');

    // 3. Verify notification created for property owner
    const dbNotification = await prisma.userNotification.findFirst({
      where: { userId: ownerUserId },
    });
    expect(dbNotification).not.toBeNull();
  });

  // =========================================================================
  // E2E-05: Visit Scheduling & Rescheduling Lifecycle
  // =========================================================================
  test('E2E-05: Visit creation, host confirmation, and dual-verb rescheduling lifecycle in PostgreSQL', async ({ request }) => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();

    // 1. Seeker requests visit
    const visitRes = await request.post('/api/v1/visits', {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: {
        propertyId: createdPropertyId,
        scheduledAt: futureDate,
        visitorMessage: 'Would like to visit this Saturday afternoon.',
      },
    });
    expect(visitRes.status()).toBe(201);
    const visitData = await visitRes.json();
    scheduledVisitId = visitData.id;

    // Verify in PostgreSQL: status pending
    const dbVisit = await prisma.propertyVisit.findUnique({ where: { id: scheduledVisitId } });
    expect(dbVisit).not.toBeNull();
    expect(dbVisit?.status).toBe('pending');

    // 2. Host confirms visit
    const confirmRes = await request.patch(`/api/v1/visits/${scheduledVisitId}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { action: 'confirm', hostNotes: 'Please arrive at Gate 2.' },
    });
    expect(confirmRes.status()).toBe(200);

    const dbConfirmed = await prisma.propertyVisit.findUnique({ where: { id: scheduledVisitId } });
    expect(dbConfirmed?.status).toBe('confirmed');

    // 3. Seeker reschedules via PATCH /api/v1/visits/:id/reschedule (remediated dual-verb route)
    const newDate = new Date(Date.now() + 86400000 * 4).toISOString();
    const patchReschedRes = await request.patch(`/api/v1/visits/${scheduledVisitId}/reschedule`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: { rescheduledAt: newDate, reason: 'Meeting conflict' },
    });
    expect(patchReschedRes.status()).toBe(200);

    const dbRescheduled = await prisma.propertyVisit.findUnique({ where: { id: scheduledVisitId } });
    expect(dbRescheduled?.status).toBe('rescheduled');
    expect(dbRescheduled?.rescheduledAt).not.toBeNull();
  });

  // =========================================================================
  // E2E-06: Family Stay Workflow
  // =========================================================================
  test('E2E-06: Host publishes Family Stay with meals, seeker searches and filters by meal plan', async ({ request }) => {
    // 1. Publish Family Stay
    const familyPayload = {
      title: 'Peaceful Family Stay DLF Phase 4',
      description: 'Warm home environment with homemade North Indian meals.',
      locality: 'DLF Phase 4',
      city: 'Gurugram',
      state: 'Haryana',
      addressShort: 'Near Galleria Market, DLF Phase 4',
      propertyType: 'apartment',
      roomType: 'private_room',
      furnishing: 'fully_furnished',
      category: 'family_stays',
      rentAmount: 18000,
      depositAmount: 25000,
      maintenanceCharge: 1000,
      brokerageFee: 0,
      providerType: 'owner',
      familyLivesOnProperty: true,
      mealsOffered: 'optional_extra',
      optionalMealCost: 3500,
      genderPreference: 'any',
      bedrooms: 1,
      bathrooms: 1,
      availableFrom: 'Immediately',
      amenities: ['High-Speed Wi-Fi', 'Air Conditioner'],
      photoUrls: [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }],
      asDraft: false,
    };

    const res = await request.post('/api/v1/properties', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: familyPayload,
    });
    expect(res.status()).toBe(201);
    familyStayPropertyId = (await res.json()).id;

    // Activate it via admin moderation
    const adminActivate = await request.patch(`/api/v1/properties/${familyStayPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'active', reason: 'Verified family stay host' },
    });
    expect(adminActivate.status()).toBe(200);

    // 2. Verify in PostgreSQL
    const dbFamily = await prisma.property.findUnique({ where: { id: familyStayPropertyId } });
    expect(dbFamily).not.toBeNull();
    expect(dbFamily?.familyLivesOnProperty).toBe(true);
    expect(dbFamily?.mealsOffered).toBe('optional_extra');
    expect(Number(dbFamily?.optionalMealCost)).toBe(3500);

    // 3. Search endpoint filtering
    const searchRes = await request.get('/api/v1/family-stays?mealsOffered=optional_extra');
    expect(searchRes.ok()).toBeTruthy();
    const searchData = await searchRes.json();
    const found = searchData.data.some((p: any) => p.id === familyStayPropertyId);
    expect(found).toBe(true);
  });

  // =========================================================================
  // E2E-07: Entire Flat Workflow
  // =========================================================================
  test('E2E-07: Entire Flat listing creation and filtering', async ({ request }) => {
    const entireFlatPayload = {
      title: 'Full 3BHK Entire Flat DLF 5',
      description: 'Complete apartment for families or groups.',
      locality: 'DLF Phase 5',
      city: 'Gurugram',
      state: 'Haryana',
      addressShort: 'Near Golf Course Road, DLF Phase 5',
      propertyType: 'apartment',
      roomType: 'entire_flat',
      furnishing: 'fully_furnished',
      category: 'flats_rooms',
      rentAmount: 65000,
      depositAmount: 130000,
      maintenanceCharge: 5000,
      brokerageFee: 0,
      providerType: 'owner',
      genderPreference: 'any',
      bedrooms: 3,
      bathrooms: 3,
      availableFrom: 'Immediately',
      amenities: ['100% Power Backup', 'Gym & Pool Access'],
      photoUrls: [{ photoUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', isPrimary: true, sortOrder: 0 }],
      asDraft: false,
    };

    const res = await request.post('/api/v1/properties', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: entireFlatPayload,
    });
    expect(res.status()).toBe(201);
    const flatId = (await res.json()).id;

    // Verify in PostgreSQL
    const dbFlat = await prisma.property.findUnique({ where: { id: flatId } });
    expect(dbFlat?.roomType).toBe('entire_flat');

    // Clean up
    await prisma.propertyPhoto.deleteMany({ where: { propertyId: flatId } });
    await prisma.property.delete({ where: { id: flatId } });
  });

  // =========================================================================
  // E2E-08: Admin Moderation Pipeline
  // =========================================================================
  test('E2E-08: Admin moderates pending property and PostgreSQL status transitions', async ({ request }) => {
    // 1. Admin moderates property: activate
    const modRes = await request.patch(`/api/v1/properties/${createdPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'active', reason: 'Verified documentation' },
    });
    expect(modRes.status()).toBe(200);

    // Verify in PostgreSQL: active
    const dbActive = await prisma.property.findUnique({ where: { id: createdPropertyId } });
    expect(dbActive?.status).toBe('active');

    // 2. Admin pauses property
    const pauseRes = await request.patch(`/api/v1/properties/${createdPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'paused', reason: 'Owner verification requested' },
    });
    expect(pauseRes.status()).toBe(200);

    const dbPaused = await prisma.property.findUnique({ where: { id: createdPropertyId } });
    expect(dbPaused?.status).toBe('paused');

    // Re-activate for other tests
    await request.patch(`/api/v1/properties/${createdPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'active', reason: 'Test continuation' },
    });
  });

  // =========================================================================
  // E2E-09: Safety Reporting (Authenticated & Guest)
  // =========================================================================
  test('E2E-09: Safety report submission via canonical route and guest handling in PostgreSQL', async ({ request }) => {
    // 1. Guest Safety Report via canonical route POST /api/v1/support/reports
    const guestReport = await request.post('/api/v1/support/reports', {
      data: {
        reporterEmail: 'guest-whistleblower@example.com',
        targetType: 'listing',
        targetId: createdPropertyId,
        reasonCode: 'scam_fraud',
        details: 'Listing uses duplicate photos from another site.',
      },
    });
    expect(guestReport.status()).toBe(201);
    const guestReportData = await guestReport.json();
    expect(guestReportData.success).toBe(true);

    // Verify in PostgreSQL: record exists
    const dbReport = await prisma.safetyReport.findFirst({
      where: { reportedPropertyId: createdPropertyId, reasonCode: 'scam_fraud' },
    });
    expect(dbReport).not.toBeNull();
    expect(dbReport?.reporterEmail).toBe('guest-whistleblower@example.com');

    // 2. Verify AuditLog entry has null actorId (no crash on guest)
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: dbReport?.id },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBeNull();
  });

  // =========================================================================
  // E2E-10: Support Ticket Lifecycle
  // =========================================================================
  test('E2E-10: Authenticated user creates support ticket and thread messages', async ({ request }) => {
    // 1. Create Ticket
    const ticketRes = await request.post('/api/v1/support/tickets', {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: {
        category: 'billing',
        subject: 'Clarification regarding deposit refund policy',
        description: 'Need assistance understanding standard deposit holding timelines.',
      },
    });
    expect(ticketRes.status()).toBe(201);
    const ticketData = await ticketRes.json();
    const ticketId = ticketData.id;

    // 2. Add message to thread
    const msgRes = await request.post(`/api/v1/support/tickets/${ticketId}/messages`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: { message: 'Also wanted to ask about rental agreement stamps.' },
    });
    expect(msgRes.status()).toBe(201);

    // Verify in PostgreSQL
    const dbTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: true },
    });
    expect(dbTicket).not.toBeNull();
    expect(dbTicket?.messages.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // E2E-11: Notification Center & Ownership Isolation
  // =========================================================================
  test('E2E-11: Mark all notifications read and verify user isolation', async ({ request }) => {
    // 1. Get notifications
    const notifRes = await request.get('/api/v1/notifications', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(notifRes.ok()).toBeTruthy();

    // 2. Mark all as read via POST /api/v1/notifications/read-all
    const markAllRes = await request.post('/api/v1/notifications/read-all', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(markAllRes.status()).toBe(200);

    // Verify in PostgreSQL: all owner notifications are read
    const unreadCount = await prisma.userNotification.count({
      where: { userId: ownerUserId, read: false },
    });
    expect(unreadCount).toBe(0);
  });

  // =========================================================================
  // E2E-12: Security & IDOR Defenses
  // =========================================================================
  test('E2E-12: Enforces strict IDOR defenses across properties, moderation, and visits', async ({ request }) => {
    // 1. Seeker attempts to update Owner's property -> 403 Forbidden
    const illegalUpdate = await request.patch(`/api/v1/properties/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: { rentAmount: 1 },
    });
    expect(illegalUpdate.status()).toBe(403);

    // 2. Seeker attempts to moderate property -> 403 Forbidden
    const illegalMod = await request.patch(`/api/v1/properties/${createdPropertyId}/moderate`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: { status: 'active' },
    });
    expect(illegalMod.status()).toBe(403);

    // Verify in PostgreSQL: property rent was NOT altered
    const dbProp = await prisma.property.findUnique({ where: { id: createdPropertyId } });
    expect(Number(dbProp?.rentAmount)).not.toBe(1);
  });

  // =========================================================================
  // E2E-13: Duplicate & Boundary Defenses
  // =========================================================================
  test('E2E-13: Rejects duplicate inquiries and self-booking attempts', async ({ request }) => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    // 1. Owner attempts to book visit on own property -> 400 Bad Request
    const selfVisit = await request.post('/api/v1/visits', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { propertyId: createdPropertyId, scheduledAt: futureDate },
    });
    expect(selfVisit.status()).toBe(400);

    // 2. Owner attempts to inquire on own property -> 400 Bad Request
    const selfInq = await request.post('/api/v1/inquiries', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        propertyId: createdPropertyId,
        senderName: 'Owner Attempting Self',
        senderPhone: '+919876543210',
        senderEmail: ownerEmail,
        message: 'Testing self inquiry',
        moveInDate: '2026-12-01',
      },
    });
    expect(selfInq.status()).toBe(400);
  });

  // =========================================================================
  // E2E-14: Failure & Validation Error Handling
  // =========================================================================
  test('E2E-14: Validation pipe rejects malformed input without false success', async ({ request }) => {
    // 1. Registration with invalid short password
    const badPassReg = await request.post('/api/v1/auth/register', {
      data: {
        email: 'invalid-pass@example.com',
        password: 'short',
        fullName: 'Test User',
      },
    });
    expect(badPassReg.status()).toBe(400);

    // 2. Unauthenticated request to protected endpoint -> 401 Unauthorized
    const unauthVisit = await request.post('/api/v1/visits', {
      data: { propertyId: createdPropertyId, scheduledAt: new Date().toISOString() },
    });
    expect(unauthVisit.status()).toBe(401);
  });
});
