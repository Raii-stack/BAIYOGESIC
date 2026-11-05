module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  globalSetup: './tests/integration/setup/global-setup.js',
  testMatch: [
    '<rootDir>/tests/integration/auth.test.js',
    '<rootDir>/tests/integration/rbac.test.js',
    '<rootDir>/tests/integration/schema.test.js',
    '<rootDir>/tests/integration/seed.test.js',
  ],
};