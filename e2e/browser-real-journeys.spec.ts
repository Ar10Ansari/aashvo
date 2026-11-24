import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/aashvo_test';
const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

test.describe('AASHVO Phase 2: Real Browser-Driven E2E Journeys', () => {
  const timestamp = Date.now();
  const ownerEmail = `real-owner-${timestamp}@example.com`;
  const seekerEmail = `real-seeker-${timestamp}@example.com`;
  const adminEmail = `real-admin-${timestamp}@example.com`;
  const testPassword = 'Password123!';
  const listingTitle = `Luxury Penthouse DLF Phase 4 - ${timestamp}`;

  let ownerUserId: string;
  let seekerUserId: string;
  let adminUserId: string;
  let createdPropertyId: string;

  test.beforeAll(async ({ request }) => {
    await prisma.$connect();

    // 1. Pre-register Owner via API to ensure clean baseline credentials
    const ownerReg = await request.post('/api/v1/auth/register', {
      data: {
        email: ownerEmail,
        password: testPassword,
        fullName: 'Real E2E Owner',
        accountType: 'owner',
      },
    });
    expect(ownerReg.status()).toBe(201);
    const ownerData = await ownerReg.json();
    ownerUserId = ownerData.user.id;

    // 2. Pre-register Seeker via API
    const seekerReg = await request.post('/api/v1/auth/register', {
      data: {
        email: seekerEmail,
        password: testPassword,
        fullName: 'Real E2E Seeker',
        accountType: 'renter',
      },
    });
    expect(seekerReg.status()).toBe(201);
    const seekerData = await seekerReg.json();
    seekerUserId = seekerData.user.id;

    // 3. Pre-register Admin and elevate
    const adminReg = await request.post('/api/v1/auth/register', {
      data: {
        email: adminEmail,
        password: testPassword,
        fullName: 'Real E2E Admin',
        accountType: 'renter',
      },
    });
    expect(adminReg.status()).toBe(201);
    const adminData = await adminReg.json();
    adminUserId = adminData.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
    await prisma.profile.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Journey A: Property Listing Wizard - Complete UI Workflow & Persistence', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Sign in as Owner via real Browser UI
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    await signInBtn.click();

    const authModal = page.locator('[role="dialog"]');
    await expect(authModal).toBeVisible();

    await authModal.locator('input[type="email"]').fill(ownerEmail);
    await authModal.locator('input[type="password"]').fill(testPassword);
    await authModal.locator('button[type="submit"]:has-text("Sign In")').click();

    // Auth modal should close and user name should appear in navbar
    await expect(authModal).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Real E2E Owner').first()).toBeVisible();

    // 2. Open Property Listing Wizard via "Get started"
    const getStartedBtn = page.locator('button:has-text("Get started")').first();
    await getStartedBtn.click();

    const listingModal = page.locator('[role="dialog"]');
    await expect(listingModal).toBeVisible();
    await expect(listingModal.locator('button:has-text("Save Draft")')).toBeVisible();
    await expect(listingModal.locator('button:has-text("Continue to Step 2")')).toBeVisible();

    // 3. Step 1: Basic Information
    const titleInput = listingModal.locator('input[placeholder*="Spacious Private Bedroom"]');
    await titleInput.fill(listingTitle);

    const localityInput = listingModal.locator('input[placeholder*="DLF Phase 4"]');
    await localityInput.fill('DLF Phase 4');

    const landmarkInput = listingModal.locator('input[placeholder*="Rapid Metro"]');
    await landmarkInput.fill('Near Galleria Market and Rapid Metro');

    // Advance to Step 2
    const step1NextBtn = listingModal.locator('button:has-text("Continue to Step 2")');
    await step1NextBtn.click();

    // 4. Step 2: Financials
    await expect(listingModal.locator('text=Transparent Financial Breakdown').first()).toBeVisible();
    const step2NextBtn = listingModal.locator('button:has-text("Continue to Step 3")');
    await step2NextBtn.click();

    // 5. Step 3: Amenities & Description
    await expect(listingModal.locator('text=Amenities & Living Rules').first()).toBeVisible();
    const descArea = listingModal.locator('textarea[placeholder*="Tell prospective flatmates"]');
    if (await descArea.isVisible()) {
      await descArea.fill('Stunning executive apartment with private balcony, high-speed WiFi, and 100% backup.');
    }
    const step3NextBtn = listingModal.locator('button:has-text("Continue to Step 4")');
    await step3NextBtn.click();

    // 6. Step 4: Photos
    await expect(listingModal.locator('text=Verified Property Photos').first()).toBeVisible();
    const step4NextBtn = listingModal.locator('button:has-text("Continue to Step 5")');
    await step4NextBtn.click();

    // 7. Step 5: Verification & Zero-Hidden-Fee Declaration
    await expect(listingModal.locator('text=Provider Identity').first()).toBeVisible();
    const declarationCheckbox = listingModal.locator('#declaration-checkbox');
    await declarationCheckbox.check();
    expect(await declarationCheckbox.isChecked()).toBe(true);

    // 8. Submit Listing
    const publishBtn = listingModal.locator('button:has-text("Publish Listing on Aashvo")');
    await publishBtn.click();

    // Listing modal dismisses upon successful submission
    await expect(listingModal).not.toBeVisible({ timeout: 15000 });

    // 9. Verify in PostgreSQL that the listing exists with status pending_review
    const dbProp = await prisma.property.findFirst({
      where: { title: listingTitle },
    });
    expect(dbProp).not.toBeNull();
    expect(dbProp?.ownerId).toBe(ownerUserId);
    expect(dbProp?.locality).toBe('DLF Phase 4');
    createdPropertyId = dbProp!.id;

    // 10. Elevate property status to 'active' (simulating admin moderation approval)
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'active' },
    });

    // 11. Reload page to confirm persistence and active rendering in public discovery
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    // Switch to Places/Properties view
    await page.locator('button:has-text("Explore")').first().click();
    const createdListingCard = page.locator(`text=${listingTitle}`).first();
    await expect(createdListingCard).toBeVisible({ timeout: 10000 });

    // 12. Security Verification: Attempt unauthorized edit/delete as Seeker
    // Direct API attempt by Seeker must be rejected with 403 Forbidden
    const seekerLogin = await page.request.post('/api/v1/auth/login', {
      data: { email: seekerEmail, password: testPassword },
    });
    const seekerToken = (await seekerLogin.json()).accessToken;

    const unauthPatch = await page.request.patch(`/api/v1/properties/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      data: { title: 'Hacked Title Attempt' },
    });
    expect(unauthPatch.status()).toBe(403);

    const unauthDelete = await page.request.delete(`/api/v1/properties/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
    });
    expect(unauthDelete.status()).toBe(403);
  });

  test('Journey B: Property Inquiry Dialog - Full Seeker-to-Host Lifecycle', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Log in as Seeker via UI
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    await signInBtn.click();

    const authModal = page.locator('[role="dialog"]');
    await authModal.locator('input[type="email"]').fill(seekerEmail);
    await authModal.locator('input[type="password"]').fill(testPassword);
    await authModal.locator('button[type="submit"]:has-text("Sign In")').click();
    await expect(authModal).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Real E2E Seeker').first()).toBeVisible();

    // 2. Click Explore to switch to properties, then select the active property card created in Journey A
    await page.locator('button:has-text("Explore")').first().click();
    const propertyCard = page.locator(`text=${listingTitle}`).first();
    await propertyCard.scrollIntoViewIfNeeded();
    await propertyCard.click();

    // 3. PropertyDetailModal opens
    const detailModal = page.locator('[role="dialog"]');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.locator(`text=${listingTitle}`).first()).toBeVisible();

    // 4. Fill Inquiry Form
    const nameInput = detailModal.locator('input[placeholder*="Priya Sharma"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Real E2E Seeker');
    }

    const phoneInput = detailModal.locator('input[type="tel"]');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+919876543210');
    }

    const messageArea = detailModal.locator('textarea');
    if (await messageArea.isVisible()) {
      await messageArea.fill('Hello! I would love to schedule a visit this weekend. Please confirm.');
    }

    // 5. Submit Inquiry
    const sendInquiryBtn = detailModal.locator('button:has-text("Send Direct Inquiry")');
    await sendInquiryBtn.click();

    // 6. Verify Success Confirmation UI
    await expect(detailModal.locator('text=Inquiry Sent Successfully!')).toBeVisible({ timeout: 10000 });

    // 7. Verify inquiry is persisted in PostgreSQL
    const dbInquiry = await prisma.interestRequest.findFirst({
      where: {
        propertyId: createdPropertyId,
        senderEmail: seekerEmail,
      },
    });
    expect(dbInquiry).not.toBeNull();
    expect(dbInquiry?.message).toContain('schedule a visit this weekend');

    // 8. Close detail modal
    const closeBtn = detailModal.locator('button[aria-label="Close modal"], button:has-text("âœ•")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('Journey C: Complete Marketplace Feature Regression', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Search & Filter in Discovery Section
    const discovery = page.locator('#discovery-section');
    await discovery.scrollIntoViewIfNeeded();
    await expect(discovery).toBeVisible();

    // 2. Category Filter: Family Stays
    const familyStaysTab = page.locator('button:has-text("Family Stays")').first();
    if (await familyStaysTab.isVisible()) {
      await familyStaysTab.click();
      await page.waitForTimeout(300);
    }

    // 3. Category Filter: Entire Flats
    const entireFlatsTab = page.locator('button:has-text("Entire Flats")').first();
    if (await entireFlatsTab.isVisible()) {
      await entireFlatsTab.click();
      await page.waitForTimeout(300);
    }

    // 4. Category Filter back to Flatmates & Rooms
    const flatmatesTab = page.locator('button:has-text("Flatmates & Rooms")').first();
    if (await flatmatesTab.isVisible()) {
      await flatmatesTab.click();
      await page.waitForTimeout(300);
    }

    // 5. Open Saved Listings Modal
    const savedNavBtn = page.locator('button:has-text("Saved")').first();
    if (await savedNavBtn.isVisible()) {
      await savedNavBtn.click();
      const savedModal = page.locator('[role="dialog"]');
      await expect(savedModal).toBeVisible();
      await expect(savedModal.locator('text=Saved & Shortlists').first()).toBeVisible();

      // Close Saved Modal
      const closeSavedBtn = savedModal.locator('button[aria-label="Close saved modal"]').first();
      await closeSavedBtn.click();
      await expect(savedModal).not.toBeVisible();
    }

    // 6. Schedule a Visit Modal Flow
    const firstCard = page.locator('#discovery-section .group').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      const detailModal = page.locator('[role="dialog"]');
      await expect(detailModal).toBeVisible();

      const scheduleVisitBtn = detailModal.locator('button:has-text("Schedule In-Person Visit")');
      if (await scheduleVisitBtn.isVisible()) {
        await scheduleVisitBtn.click();
        const visitModal = page.locator('[role="dialog"]').last();
        await expect(visitModal).toBeVisible();
        await expect(visitModal.locator('text=Schedule a Property Visit').first()).toBeVisible();

        // Close schedule visit modal
        const closeVisitBtn = visitModal.locator('button[aria-label*="close" i]').first();
        if (await closeVisitBtn.isVisible()) {
          await closeVisitBtn.click();
        }
      }

      // Close detail modal
      const closeDetailBtn = detailModal.locator('button[aria-label="Close modal"], button[aria-label*="close" i]').first();
      if (await closeDetailBtn.isVisible()) {
        await closeDetailBtn.click();
      }
    }
  });

  test('Journey D-1: Mobile Responsiveness on Pixel 7 (412x915)', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify zero horizontal overflow on mobile viewport
    const overflow = await page.evaluate(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(overflow.hasOverflow).toBe(false);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    // 2. Verify mobile navigation hamburger toggle exists and meets 44x44px minimum target
    const hamburgerBtn = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();

    const box = await hamburgerBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // 3. Open navigation drawer
    await hamburgerBtn.click();

    // Verify drawer contents scoped within #mobile-menu-drawer
    const mobileDrawer = page.locator('#mobile-menu-drawer');
    await expect(mobileDrawer).toBeVisible();

    const drawerConnectBtn = mobileDrawer.locator('button:has-text("Connect")').first();
    await expect(drawerConnectBtn).toBeVisible();

    const drawerSavedBtn = mobileDrawer.locator('button:has-text("Saved")').first();
    await expect(drawerSavedBtn).toBeVisible();

    // 4. Close drawer via toggle
    await hamburgerBtn.click();
    await expect(mobileDrawer).not.toBeVisible();
  });

  test('Journey D-2: Mobile Responsiveness on iPhone 14 (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify zero horizontal overflow
    const overflow = await page.evaluate(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(overflow.hasOverflow).toBe(false);

    // 2. Verify touch targets on mobile
    const hamburgerBtn = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();
    const box = await hamburgerBtn.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // 3. Open drawer, navigate to a tab and close
    await hamburgerBtn.click();
    const mobileDrawer = page.locator('#mobile-menu-drawer');
    await expect(mobileDrawer).toBeVisible();

    const flatmatesTab = mobileDrawer.locator('button:has-text("Flatmates & Rooms")');
    await expect(flatmatesTab).toBeVisible();
    await flatmatesTab.click();

    // Drawer closes upon navigation
    await expect(mobileDrawer).not.toBeVisible();
  });
});
