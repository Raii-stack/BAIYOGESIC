   module.exports = {
     testEnvironment: 'node',
     testTimeout: 15000,
     globalSetup: './tests/integration/setup/global-setup.js',
     testPathIgnorePatterns: ['/node_modules/', '/tests/qa-unit/'],
   };