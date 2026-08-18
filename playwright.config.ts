import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';

// Load .env.test (gitignored) so credentials never have to be exported by hand.
// Deliberately not using dotenv — it isn't a dependency and this is four lines.
if (fs.existsSync('.env.test')) {
  for (const line of fs.readFileSync('.env.test', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

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
      // qa-full.spec.ts is excluded here (see the dedicated 'qa-full' project below) — its
      // final test bulk-deletes every row scoped to the shared demo company's company_id.
      // Running it in the same worker pool as the seed-heavy specs in this project is a real
      // hazard: it can delete rows another spec just seeded, depending on execution order.
      name: 'chromium',
      testIgnore: /auth\.setup\.ts|qa-full\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Isolated on purpose: this file's own final test wipes 22 tables for the current
      // company_id. Not included in the default `chromium` run — invoke explicitly with
      // `npx playwright test --project=qa-full` only when you intend that cleanup to happen,
      // and never in the same invocation as other specs relying on live seeded data.
      name: 'qa-full',
      testMatch: /qa-full\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      fullyParallel: false,
      workers: 1,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 30000,
  },
});