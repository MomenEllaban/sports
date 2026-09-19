import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3102', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev -- --port 3102',
    url: 'http://localhost:3102/ar',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: { PORT: '3102' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
