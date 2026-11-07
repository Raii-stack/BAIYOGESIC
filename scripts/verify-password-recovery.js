// All database fixtures and password changes are rolled back; this script never sends email.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const db = require('../db');

async function verify() {
  const client = await db.requirePool().connect();
  const originalPool = db.requirePool;
  const mailPath = require.resolve('../lib/password-reset-email');
  const originalMail = require.cache[mailPath];
  const captured = [];
  let rejectDelivery = false;
  try {
    await client.query('BEGIN');
    await client.query("REVOKE ALL ON TABLE public.password_reset_token FROM PUBLIC, anon, authenticated");
    const security = (await client.query("SELECT relrowsecurity,has_table_privilege('anon',oid,'SELECT') AS anon_read,has_table_privilege('authenticated',oid,'SELECT') AS signed_in_read FROM pg_class WHERE oid='public.password_reset_token'::regclass")).rows[0];
    assert(security.relrowsecurity && !security.anon_read && !security.signed_in_read, 'Reset tokens must stay private to the backend');
    const id = crypto.randomUUID();
    const email = `reset-${id.slice(0, 8)}@example.invalid`;
    await client.query("INSERT INTO public.employee(empno,firstname,lastname,email,gender,hiredate,is_deleted) VALUES ('RP901','Reset','Verification',$1,'M',current_date,false)", [email]);
    await client.query(`INSERT INTO public.app_user(user_id,empno,email,password_hash,role,status,must_change_password)
      VALUES ($1,'RP901',$2,'not-a-login-hash','employee','active',false)`, [id, email]);
    // Controller transaction boundaries become savepoints inside the fixture transaction.
    db.requirePool = () => ({ connect: async () => ({ release() {}, query: (sql, values) => client.query(sql === 'BEGIN' ? 'SAVEPOINT recovery_request' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT recovery_request' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT recovery_request' : sql, values) }) });
    require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: { passwordResetMailer: () => async (recipient, token) => {
      if (rejectDelivery) throw Object.assign(new Error('Simulated delivery failure'), { statusCode: 503 });
      captured.push({ recipient, token });
    } } };
    const { forgotPassword, resetPassword } = require('../controllers/auth-controller');
    const invoke = async (handler, body) => {
      let result, error;
      await handler({ body }, { json: (value) => { result = value; } }, (reason) => { error = reason; });
      return { result, error };
    };
    const request = await invoke(forgotPassword, { email });
    assert(!request.error && !request.result.data.token);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].recipient, email);
    const hash = `email:${crypto.createHash('sha256').update(captured[0].token).digest('hex')}`;
    const record = (await client.query('SELECT token_hash,extract(epoch FROM expires_at-created_at)::int AS lifetime FROM public.password_reset_token WHERE user_id=$1', [id])).rows[0];
    assert.equal(record.token_hash, hash);
    assert.equal(record.lifetime, 900);
    const legacyToken = 'c'.repeat(64);
    await client.query("INSERT INTO public.password_reset_token(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [crypto.createHash('sha256').update(legacyToken).digest('hex'), id]);
    assert.equal((await invoke(resetPassword, { token: legacyToken, password: 'FixturePassword1!' })).error.statusCode, 400, 'Previously exposed demo tokens cannot be redeemed');
    await invoke(forgotPassword, { email });
    assert.equal(captured.length, 1, 'A valid emailed link suppresses duplicate sends');
    await client.query("UPDATE public.password_reset_token SET created_at=now()-interval '16 minutes' WHERE user_id=$1", [id]);
    assert.equal((await invoke(resetPassword, { token: captured[0].token, password: 'FixturePassword1!' })).error.statusCode, 400, 'Reject tokens older than 15 minutes even if legacy expiry is later');
    await client.query('DELETE FROM public.password_reset_token WHERE user_id=$1', [id]);
    rejectDelivery = true;
    assert.equal((await invoke(forgotPassword, { email })).error.statusCode, 503);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM public.password_reset_token WHERE user_id=$1', [id])).rows[0].count, 0, 'Delivery failure rolls back the token');
    rejectDelivery = false;
    await invoke(forgotPassword, { email });
    const token = captured.at(-1).token;
    const reset = await invoke(resetPassword, { token, password: 'FixturePassword1!' });
    assert(!reset.error);
    const updated = (await client.query('SELECT password_hash FROM public.app_user WHERE user_id=$1', [id])).rows[0];
    assert(await bcrypt.compare('FixturePassword1!', updated.password_hash));
    assert.equal((await invoke(resetPassword, { token, password: 'AnotherFixture2!' })).error.statusCode, 400, 'A reset link may be used only once');
    await client.query("UPDATE public.app_user SET status='pending' WHERE user_id=$1", [id]);
    const before = captured.length;
    await invoke(forgotPassword, { email });
    assert.equal(captured.length, before, 'Pending accounts cannot request resets');
    console.log('Verified real token storage, exact 15-minute expiry, age enforcement, duplicate suppression, email failure rollback, password hashing, single use, and pending-account protection. All fixtures rolled back.');
  } finally {
    db.requirePool = originalPool;
    if (originalMail) require.cache[mailPath] = originalMail; else delete require.cache[mailPath];
    await client.query('ROLLBACK'); client.release(); await db.pool.end();
  }
}
verify().catch((error) => { console.error(error.message); process.exitCode = 1; });
