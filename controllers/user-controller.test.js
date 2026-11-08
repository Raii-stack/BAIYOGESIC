// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const client = { query: vi.fn(), release: vi.fn() };
const pool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(client),
};

let sendApproval;
let sendRejection;

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

require.cache[require.resolve('../lib/password-reset-email')] = {
  id: require.resolve('../lib/password-reset-email'),
  filename: require.resolve('../lib/password-reset-email'),
  loaded: true,
  exports: {
    rejectionEmailMailer: () => sendRejection,
    approvalEmailMailer: () => sendApproval,
    passwordResetMailer: vi.fn(),
    registrationCodeMailer: vi.fn(),
  },
};

const {
  approveUser,
  rejectUser,
  reReviewUser,
  deleteUserPermanently,
  listUsers,
} = require('./user-controller');

const superadmin = { sub: '00000000-0000-0000-0000-000000000001', role: 'superadmin', email: 'admin@hope.inc' };
const admin = { sub: '00000000-0000-0000-0000-000000000002', role: 'admin', email: 'admin2@hope.inc' };
const employee = { sub: '00000000-0000-0000-0000-000000000003', role: 'employee', email: 'emp@hope.inc' };
const targetUserId = '11111111-1111-1111-1111-111111111111';

async function invoke(handler, extra = {}) {
  let body, error, statusCode = 200;
  const res = {
    statusCode: 200,
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: superadmin, params: {}, query: {}, ...extra },
    res,
    (err) => { error = err; }
  );
  return { body, error, statusCode };
}

beforeEach(() => {
  client.query.mockReset();
  client.release.mockReset();
  pool.query.mockReset();
  pool.connect.mockReset().mockResolvedValue(client);
  sendApproval = vi.fn().mockResolvedValue(undefined);
  sendRejection = vi.fn().mockResolvedValue(undefined);
});

test('approving a pending user sets status to active and sends approval email', async () => {
  client.query.mockImplementation(async (sql) => {
    if (sql.includes('SELECT user_id, role, status, is_blocked FROM public.app_user')) {
      return { rows: [{ user_id: targetUserId, role: 'employee', status: 'pending', is_blocked: false }] };
    }
    if (sql.includes('UPDATE public.app_user')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT') && sql.includes('FROM public.app_user u')) {
      return { rows: [{ userId: targetUserId, email: 'applicant@hope.inc', name: 'John Doe', role: 'employee', status: 'active' }] };
    }
    return { rows: [] };
  });

  const { body, error } = await invoke(approveUser, {
    params: { userId: targetUserId },
    user: admin,
  });

  expect(error).toBeUndefined();
  expect(body.data.user.status).toBe('active');
  expect(sendApproval).toHaveBeenCalledWith('applicant@hope.inc', 'John Doe');
});

test('re-reviewing a rejected user changes status to pending', async () => {
  client.query.mockImplementation(async (sql) => {
    if (sql.includes('SELECT user_id, role, status, is_blocked FROM public.app_user')) {
      return { rows: [{ user_id: targetUserId, role: 'employee', status: 'disabled', is_blocked: false }] };
    }
    if (sql.includes('UPDATE public.app_user')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT') && sql.includes('FROM public.app_user u')) {
      return { rows: [{ userId: targetUserId, email: 'rejected@hope.inc', name: 'Jane Doe', role: 'employee', status: 'pending' }] };
    }
    return { rows: [] };
  });

  const { body, error } = await invoke(reReviewUser, {
    params: { userId: targetUserId },
    user: admin,
  });

  expect(error).toBeUndefined();
  expect(body.data.user.status).toBe('pending');
  const updateCall = client.query.mock.calls.find(([sql]) => sql.includes('UPDATE public.app_user'));
  expect(updateCall[0]).toContain("status = 'pending'");
});

test('re-reviewing fails if user is not in disabled status', async () => {
  client.query.mockImplementation(async (sql) => {
    if (sql.includes('SELECT user_id, role, status, is_blocked FROM public.app_user')) {
      return { rows: [{ user_id: targetUserId, role: 'employee', status: 'active', is_blocked: false }] };
    }
    return { rows: [] };
  });

  const { error } = await invoke(reReviewUser, {
    params: { userId: targetUserId },
    user: admin,
  });

  expect(error.statusCode).toBe(409);
  expect(error.message).toContain('Only rejected accounts can be moved to re-review');
});

test('permanently deleting an account removes dependent rows, user row, and records audit log', async () => {
  client.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM public.app_user WHERE user_id = $1::uuid FOR UPDATE')) {
      return { rows: [{ user_id: targetUserId, empno: '00005', email: 'rejected@hope.inc', role: 'employee', status: 'disabled' }] };
    }
    return { rows: [] };
  });

  const { body, error } = await invoke(deleteUserPermanently, {
    params: { userId: targetUserId },
    user: superadmin,
  });

  expect(error).toBeUndefined();
  expect(body.success).toBe(true);
  expect(body.data.message).toBe('Account permanently deleted');

  const queries = client.query.mock.calls.map(([sql]) => sql);
  expect(queries.some((sql) => sql.includes('DELETE FROM public.password_reset_token'))).toBe(true);
  expect(queries.some((sql) => sql.includes('DELETE FROM public.app_user WHERE user_id'))).toBe(true);
  expect(queries.some((sql) => sql.includes('INSERT INTO public.audit_log') && sql.includes("'DELETE'"))).toBe(true);
});

test('non-superadmin cannot permanently delete accounts', async () => {
  const { error } = await invoke(deleteUserPermanently, {
    params: { userId: targetUserId },
    user: admin,
  });

  expect(error.statusCode).toBe(403);
  expect(error.message).toContain('Only superadmins can permanently delete accounts');
  expect(client.query).not.toHaveBeenCalled();
});

test('superadmin cannot delete their own account', async () => {
  const { error } = await invoke(deleteUserPermanently, {
    params: { userId: superadmin.sub },
    user: superadmin,
  });

  expect(error.statusCode).toBe(400);
  expect(error.message).toContain('cannot delete your own account');
});

test('cannot delete an active account', async () => {
  client.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM public.app_user WHERE user_id = $1::uuid FOR UPDATE')) {
      return { rows: [{ user_id: targetUserId, empno: '00005', email: 'active@hope.inc', role: 'employee', status: 'active' }] };
    }
    return { rows: [] };
  });

  const { error } = await invoke(deleteUserPermanently, {
    params: { userId: targetUserId },
    user: superadmin,
  });

  expect(error.statusCode).toBe(409);
  expect(error.message).toContain('Only rejected or pending accounts can be permanently deleted');
});

test('listUsers allows filtering by disabled/rejected status', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const { error } = await invoke(listUsers, {
    query: { status: 'rejected' },
    user: superadmin,
  });

  expect(error).toBeUndefined();
  expect(pool.query.mock.calls[0][0]).toContain("u.status = 'disabled'");
});
