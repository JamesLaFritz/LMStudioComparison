import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './Space_Invaders/tests',
  testMatch: '**/*.spec.js',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium' } },
    {
      name: 'narrow-chromium',
      use: { browserName: 'chromium', viewport: { width: 720, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
