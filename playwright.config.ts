import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {...devices['Desktop Chrome']},
  }],
  webServer: {
    command: 'npm run start:a11y -- --port 8787',
    url: 'http://127.0.0.1:8787/market',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
