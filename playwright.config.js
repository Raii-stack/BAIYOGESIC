require('dotenv').config({ path: '.env.test', quiet: true });
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});