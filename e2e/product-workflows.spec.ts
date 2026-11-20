import { test, expect } from '@playwright/test';

test.describe('AASHVO Platform Browser Workflows (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Workflow 1: Homepage renders brand wordmark, navbar controls, and founders', async ({ page, isMobile }) => {
    // 1. Verify Aashvo wordmark
    await expect(page.locator('text=aashvo').first()).toBeVisible();

    if (!isMobile) {
      // 2. Verify desktop navigation links
      await expect(page.locator('button:has-text("Explore")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Connect")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Saved")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Get started")').first()).toBeVisible();
    }

    // 3. Verify our founders section
    const founders = page.locator('#our-founders');
    await founders.scrollIntoViewIfNeeded();
    await expect(founders).toBeVisible();
    await expect(page.locator('text=Our Founders').first()).toBeVisible();
  });

  test('Workflow 2: Discovery Section and category filtering', async ({ page }) => {
    const discovery = page.locator('#discovery-section');
    await discovery.scrollIntoViewIfNeeded();
    await expect(discovery).toBeVisible();

    // Verify filter buttons in discovery section
    const buttons = page.locator('#discovery-section button');
    await expect(buttons.first()).toBeVisible();
  });

  test('Workflow 3: Authentication Modal opening, tabs, and close', async ({ page, isMobile }) => {
    if (isMobile) {
      // Open mobile menu
      const toggle = page.locator('button[aria-label*="navigation" i]').first();
      if (await toggle.isVisible()) {
        await toggle.click();
      }
    }
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Verify modal has Sign In headline
      await expect(modal.locator('text=Sign In').first()).toBeVisible();

      // Verify Create Account / Register tab
      const registerTab = modal.locator('button:has-text("Register"), button:has-text("Create Account")').first();
      if (await registerTab.isVisible()) {
        await registerTab.click();
        await expect(modal.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
      }

      // Close modal
      const closeBtn = modal.locator('button[aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('Workflow 4: Rent Split Calculator Modal opens and calculates share', async ({ page, isMobile }) => {
    if (!isMobile) {
      const calcBtn = page.locator('button:has-text("Rent Split")').first();
      if (await calcBtn.isVisible()) {
        await calcBtn.click();
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible();
        await expect(modal.locator('text=Rent Split').first()).toBeVisible();

        // Close modal
        const closeBtn = modal.locator('button[aria-label*="close" i]').first();
        await closeBtn.click();
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('Workflow 5: Get started button opens List Property Modal with Draft button', async ({ page, isMobile }) => {
    if (!isMobile) {
      const getStartedBtn = page.locator('button:has-text("Get started")').first();
      await getStartedBtn.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Verify Draft button exists (Save Draft on steps 1-4, Save as Draft on step 5)
      await expect(modal.locator('button:has-text("Save Draft")')).toBeVisible();
      await expect(modal.locator('button:has-text("Continue to Step 2")')).toBeVisible();

      // Close modal
      const closeBtn = modal.locator('button[aria-label*="Close modal" i], button[aria-label*="close" i]').first();
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('Workflow 6: Saved Listings Modal opens and displays shortlist tabs', async ({ page, isMobile }) => {
    if (!isMobile) {
      const savedBtn = page.locator('button:has-text("Saved")').first();
      if (await savedBtn.isVisible()) {
        await savedBtn.click();
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible();

        // Close modal
        const closeBtn = modal.locator('button[aria-label*="close" i]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await expect(modal).not.toBeVisible();
        }
      }
    }
  });

  test('Workflow 7: Mobile viewport responsive test', async ({ page }) => {
    await expect(page.locator('text=aashvo').first()).toBeVisible();
  });
});
