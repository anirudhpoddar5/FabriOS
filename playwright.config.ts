import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,

  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts|steelman-e2e\.spec\.ts|steelman-full\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'steelman',
      testMatch: /steelman-e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
      },
      dependencies: [],
    },
    {
      name: 'steelman-full',
      testMatch: /steelman-full\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
      dependencies: [],
      timeout: 600000,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 30000,
  },
});