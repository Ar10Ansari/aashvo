import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      command: 'node apps/api/start-e2e-server.js',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30 * 1000,
    },
    {
      command: 'npm run preview -- --port 4173',
      port: 4173,
      reuseExistingServer: true,
      timeout: 30 * 1000,
    },
  ],
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
    },
  ],
});
