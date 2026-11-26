// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const auditLogRoutes = require('./audit-log-routes');
const { errorHandler } = require('../middleware/error-handler');

const superadminId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/audit-logs', auditLogRoutes);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/audit-log-routes ([S4-DBA-04 & S4-DBA-05])', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('mounts GET / and GET /:auditId and blocks unauthenticated or non-superadmin callers', async () => {
    const paths = auditLogRoutes.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).toEqual(['/', '/:auditId']);

    const app = makeApp();
    expect((await request(app).get('/api/audit-logs')).status).toBe(401);

    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: adminId, empno: '00002', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
    });
    expect((await request(app).get('/api/audit-logs').set('Cookie', authCookie(adminId, 'admin'))).status).toBe(403);
  });

  test('allows superadmin audit log list query through route middleware', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: superadminId, empno: '00001', email: 'sa@hope.inc', role: 'superadmin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
      })
      .mockResolvedValueOnce({
        rows: [{ auditId: 10n, tableName: 'sales', action: 'DELETE', recordKey: 'TR1001', actionBy: 'sa@hope.inc', actionAt: '2026-11-02' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(makeApp())
      .get('/api/audit-logs?tableName=sales')
      .set('Cookie', authCookie(superadminId, 'superadmin'));
    expect(res.status).toBe(200);
    expect(res.body.data.logs[0].auditId).toBe('10');
  });
});
