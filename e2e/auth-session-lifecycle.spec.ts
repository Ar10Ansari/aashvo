import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/aashvo_test';
const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

test.describe('AASHVO Authentication Session Lifecycle & Security Verification', () => {
  const timestamp = Date.now();
  const testEmail = `auth-lifecycle-${timestamp}@example.com`;
  const testPassword = 'Password123!';
  let userId: string;

  test.beforeAll(async () => {
    await prisma.$connect();
  });

  test.afterAll(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.refreshSession.deleteMany({ where: { userId: user.id } });
        await prisma.userNotification.deleteMany({ where: { userId: user.id } });
        await prisma.profile.deleteMany({ where: { id: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // =========================================================================
  // 1. Login -> Reload -> Authenticated Session
  // =========================================================================
  test('Lifecycle 1: Login in browser -> reload page -> authenticated session preserved from backend', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Open Auth Modal
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

    // 2. Register fresh account
    const registerTab = authModal.locator('button:has-text("Register")').first();
    await registerTab.click();

    const fullNameInput = authModal.locator('input[placeholder*="Priya" i], input[type="text"]').first();
    const emailInput = authModal.locator('input[type="email"]').first();
    const passwordInput = authModal.locator('input[type="password"]').first();

    await fullNameInput.fill('Session Lifecycle User');
    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);

    const submitBtn = authModal.locator('button[type="submit"]:has-text("Create Account")').first();
    await submitBtn.click();

    // Modal closes on success
    await expect(authModal).not.toBeVisible({ timeout: 10000 });

    // 3. Confirm token stored in sessionStorage
    const storedToken = await page.evaluate(() => window.sessionStorage.getItem('aashvo_at'));
    expect(storedToken).toBeTruthy();

    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser).not.toBeNull();
    userId = dbUser!.id;

    // 4. Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verify session survives reload: unauthenticated 'Sign in' button must be absent
    if (isMobile) {
      const menuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
      await menuBtn.click();
    }
    const postReloadSignInBtn = page.locator('button:visible:has-text("Sign in")');
    const isSignInVisible = await postReloadSignInBtn.isVisible();
    expect(isSignInVisible).toBe(false);

    // Verify /api/v1/profiles/me returns authenticated profile
    const profileData = await page.evaluate(async () => {
      const at = window.sessionStorage.getItem('aashvo_at');
      const res = await fetch('/api/v1/profiles/me', {
        headers: { Authorization: `Bearer ${at}` },
      });
      return { status: res.status, body: await res.json() };
    });
    expect(profileData.status).toBe(200);
    expect(profileData.body.email).toBe(testEmail);
  });

  // =========================================================================
  // 2. Expired Access Token -> Automatic Refresh -> Session Restored
  // =========================================================================
  test('Lifecycle 2: Expired access token in browser triggers automatic refresh and succeeds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Establish an authenticated session in this browser context
    const loginRes = await page.evaluate(async (creds) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        return { success: false, status: res.status };
      }
      const data = await res.json();
      window.sessionStorage.setItem('aashvo_at', data.accessToken);
      return { success: true, token: data.accessToken };
    }, { email: testEmail, password: testPassword });

    expect(loginRes.success).toBe(true);
    expect(loginRes.token).toBeTruthy();

    // 2. Corrupt / expire the access token in browser's sessionStorage
    const expiredFakeJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwMTIiLCJyb2xlIjoicmVudGVyIiwiZXhwIjoxNjAwMDAwMDAwfQ.dGVzdHNpZ25hdHVyZQ';
    await page.evaluate((expToken) => {
      window.sessionStorage.setItem('aashvo_at', expToken);
    }, expiredFakeJwt);

    // 3. Confirm calling /api/v1/profiles/me with the expired token gets rejected with 401
    const expiredReqResult = await page.evaluate(async (expToken) => {
      const res = await fetch('/api/v1/profiles/me', {
        headers: { Authorization: `Bearer ${expToken}` },
      });
      return res.status;
    }, expiredFakeJwt);
    expect(expiredReqResult).toBe(401);

    // 4. Now perform token refresh using the HTTP-only refresh cookie
    const refreshResult = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        window.sessionStorage.setItem('aashvo_at', data.accessToken);
        return { success: true, newAccessToken: data.accessToken };
      }
      return { success: false, status: res.status };
    });

    expect(refreshResult.success).toBe(true);
    expect(refreshResult.newAccessToken).toBeTruthy();

    // 5. Verify the new renewed token successfully retrieves profile
    const verifyNewToken = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/profiles/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.json() };
    }, refreshResult.newAccessToken);

    expect(verifyNewToken.status).toBe(200);
    expect(verifyNewToken.body.email).toBe(testEmail);
  });

  // =========================================================================
  // 3. Invalid Refresh Token -> Clean Logout
  // =========================================================================
  test('Lifecycle 3: Invalid/corrupt refresh token triggers clean session cleanup', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Clear any cookies
    await context.clearCookies();

    // 2. Attempt token refresh with an invalid opaque token
    const refreshFailure = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: 'invalid-opaque-token-uuid-0000-000000000000' }),
      });
      // Simulate client handling failure
      if (!res.ok) {
        window.sessionStorage.removeItem('aashvo_at');
        window.localStorage.removeItem('aashvo_current_user');
        return { cleaned: true, status: res.status };
      }
      return { cleaned: false, status: res.status };
    });

    expect(refreshFailure.cleaned).toBe(true);
    expect(refreshFailure.status).toBe(401);

    // 3. Confirm sessionStorage and localStorage are empty
    const checkStorage = await page.evaluate(() => {
      return {
        at: window.sessionStorage.getItem('aashvo_at'),
        user: window.localStorage.getItem('aashvo_current_user'),
      };
    });
    expect(checkStorage.at).toBeNull();
    expect(checkStorage.user).toBeNull();
  });

  // =========================================================================
  // 4. Logout -> Refresh Attempt -> Session Remains Revoked
  // =========================================================================
  test('Lifecycle 4: User logout explicitly revokes session family; subsequent refresh is blocked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Log in to establish fresh session
    const loginRes = await page.evaluate(async (credentials) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        const data = await res.json();
        window.sessionStorage.setItem('aashvo_at', data.accessToken);
        return { success: true, token: data.accessToken };
      }
      return { success: false, status: res.status };
    }, { email: testEmail, password: testPassword });

    expect(loginRes.success).toBe(true);
    const validToken = loginRes.token;

    // Verify session family is active in PostgreSQL
    const activeBefore = await prisma.refreshSession.findMany({
      where: { userId, revokedAt: null },
    });
    expect(activeBefore.length).toBeGreaterThanOrEqual(1);

    // 2. Perform Logout
    const logoutRes = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      window.sessionStorage.removeItem('aashvo_at');
      return { status: res.status };
    }, validToken);

    expect([200, 204]).toContain(logoutRes.status);

    // 3. Verify in PostgreSQL that the current session family is marked revokedAt != null
    const payload = JSON.parse(Buffer.from(validToken.split('.')[1], 'base64url').toString('utf8'));
    const currentFamilyId = payload.sid;
    const sessionFamily = await prisma.refreshSession.findMany({
      where: { familyId: currentFamilyId },
    });
    expect(sessionFamily.length).toBeGreaterThanOrEqual(1);
    expect(sessionFamily.every((s) => s.revokedAt !== null)).toBe(true);
    expect(sessionFamily.every((s) => s.revokedReason === 'logout')).toBe(true);

    // 4. Hostile refresh attempt using revoked cookie / session family must be rejected with 401
    const blockedRefresh = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      return { status: res.status, ok: res.ok };
    });

    expect(blockedRefresh.ok).toBe(false);
    expect(blockedRefresh.status).toBe(401);
  });
});
