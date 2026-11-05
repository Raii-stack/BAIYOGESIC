const { ensureQaUsers, QA_USERS } = require('../integration/setup/qa-users');

afterEach(() => {
  delete process.env.ALLOW_QA_USER_SEED;
  delete process.env.QA_PASSWORD;
});

test('QA fixtures do not create privileged users', () => {
  expect(Object.values(QA_USERS).every((user) => user.role === 'employee')).toBe(true);
});

test('QA seeding requires an explicit non-production opt-in', async () => {
  process.env.QA_PASSWORD = 'a-random-test-password';
  await expect(ensureQaUsers({})).rejects.toThrow('ALLOW_QA_USER_SEED=true');
});

test('QA seeding rejects a missing or weak password', async () => {
  process.env.ALLOW_QA_USER_SEED = 'true';
  process.env.QA_PASSWORD = 'short';
  await expect(ensureQaUsers({})).rejects.toThrow('QA_PASSWORD must be at least 12 characters');
});
