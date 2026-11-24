import { test, expect } from '@playwright/test';

const PREVIEW_URL = process.env.STAGING_PREVIEW_URL || 'https://aashvo-d5p98ri5p-abdul-rehman-ansari-s-projects.vercel.app';
const BYPASS_SECRET = process.env.VERCEL_PROTECTION_BYPASS || '';

function getTargetUrl(path: string = '/'): string {
  const base = `${PREVIEW_URL}${path}`;
  if (!BYPASS_SECRET) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${BYPASS_SECRET}`;
}

test.describe('AASHVO Phase 3: Staging Preview Smoke Tests', () => {
  test.use({
    extraHTTPHeaders: BYPASS_SECRET ? { 'x-vercel-protection-bypass': BYPASS_SECRET } : {},
  });

  test('Smoke 01: Preview Homepage renders brand, title, and initial DOM correctly', async ({ page }) => {
    await page.goto(getTargetUrl('/'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Aashvo/);
    await expect(page.locator('button:has-text("aashvo")').first()).toBeVisible();
    await expect(page.locator('h1:has-text("Affordable living starts with the right people")').first()).toBeVisible();
    await expect(page.locator('text=Made for moving, anywhere in India').first()).toBeVisible();
  });

  test('Smoke 02: Discovery Section category tabs and filters mount on staging preview', async ({ page }) => {
    await page.goto(getTargetUrl('/'));
    await page.waitForLoadState('domcontentloaded');

    const discovery = page.locator('#discovery-section');
    await expect(discovery).toBeVisible();

    // Verify search bar controls
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('button:has-text("Search")').first()).toBeVisible();

    // Verify category tabs with counts
    await expect(discovery.locator('button:has-text("Flatmates")').first()).toBeVisible();
    await expect(discovery.locator('button:has-text("Family Stays")').first()).toBeVisible();
    await expect(discovery.locator('button:has-text("Entire Flats")').first()).toBeVisible();
  });

  test('Smoke 03: Modals render smoothly in preview environment', async ({ page }) => {
    await page.goto(getTargetUrl('/'));
    await page.waitForLoadState('domcontentloaded');

    // 1. Auth Modal
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    await signInBtn.click();
    const authDialog = page.locator('[role="dialog"]');
    await expect(authDialog).toBeVisible({ timeout: 10000 });
    await expect(authDialog.locator('text=Welcome Back').first()).toBeVisible();
    await authDialog.locator('button:has(.lucide-x)').first().click();
    await expect(authDialog).not.toBeVisible();

    // 2. Saved Listings Modal
    const savedBtn = page.locator('button:has-text("Saved")').first();
    await savedBtn.click();
    const savedDialog = page.locator('[role="dialog"]');
    await expect(savedDialog).toBeVisible({ timeout: 10000 });
    await expect(savedDialog.locator('text=Saved & Shortlists').first()).toBeVisible();
    await savedDialog.locator('button[aria-label="Close saved modal"]').click();
    await expect(savedDialog).not.toBeVisible();
  });

  test('Smoke 04: Mobile responsive view on staging preview', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(getTargetUrl('/'));
    await page.waitForLoadState('domcontentloaded');

    // Verify zero horizontal overflow on mobile
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // Verify mobile hamburger button with exact aria-label
    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]').first();
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const drawer = page.locator('#mobile-menu-drawer');
    await expect(drawer).toBeVisible();
  });
});
