// Runs against the configured database; every fixture and schema change is rolled back.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const db = require('../db');

async function verify() {
  const client = await db.requirePool().connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query("SELECT to_regclass('public.app_notification') AS table_name");
    if (!exists.rows[0].table_name) await client.query(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261106163612_employee_settings_and_notifications.sql'), 'utf8'));
    const ids = Array.from({ length: 5 }, () => randomUUID());
    const suffix = randomUUID().slice(0, 8);
    await client.query("SELECT set_config('app.username', 'workspace-verification', true)");
    await client.query("INSERT INTO public.employee(empno, firstname, lastname, email, gender, hiredate, is_deleted) VALUES ('ZX901','Workspace','Check',$1,'M',current_date,false)", [`workspace-employee-${suffix}@example.invalid`]);
    for (let index = 0; index < ids.length; index++) {
      const empno = `ZX90${index + 1}`;
      if (index > 0) await client.query("INSERT INTO public.employee(empno,firstname,lastname,email,gender,hiredate,is_deleted) VALUES ($1,'Workspace','Check',$2,'M',current_date,false)", [empno, `workspace-employee-${suffix}-${index}@example.invalid`]);
      await client.query(`INSERT INTO public.app_user(user_id, empno, email, password_hash, role, status, must_change_password)
        VALUES ($1, $2, $3, 'not-a-login-hash', $4, 'active', false)`, [ids[index], empno, `ws-${suffix}-${index}@example.invalid`, index === 1 ? 'admin' : 'employee']);
    }
    for (const [index, rights] of [[0, ['sales.access','sales.details.view']], [2, ['products.access']], [3, ['hr.access']], [4, ['sales.access']]]) {
      for (const right of rights) await client.query('INSERT INTO public.app_user_right(user_id,right_code) VALUES ($1,$2)', [ids[index], right]);
    }
    await client.query("INSERT INTO public.app_user_preferences(user_id,products) VALUES ($1,false)", [ids[4]]);
    const customer = await client.query('SELECT custno FROM public.customer WHERE NOT is_deleted LIMIT 1');
    assert(customer.rows[0], 'A customer is required for the sale fixture');
    await client.query(`INSERT INTO public.sales(transno,salesdate,custno,empno,is_deleted) VALUES ('ZX9001',current_date,$1,'ZX901',false)`, [customer.rows[0].custno]);
    const notices = async (category) => (await client.query('SELECT user_id,title,message FROM public.app_notification WHERE user_id = ANY($1::uuid[]) AND category=$2', [ids, category])).rows;
    let rows = await notices('sales');
    assert.deepEqual(rows.map((row) => row.user_id).sort(), [ids[0], ids[1]].sort(), 'Sales go only to the assigned employee and manager');
    await client.query('DELETE FROM public.app_notification WHERE user_id=ANY($1::uuid[])', [ids]);
    await client.query("SELECT set_config('app.username', $1, true)", [`ws-${suffix}-0@example.invalid`]);
    await client.query("INSERT INTO public.payment(orno,paydate,amount,transno,is_deleted,payment_method) VALUES ('ZX9001',current_date,1,'ZX9001',false,'Cash')");
    rows = await notices('payments');
    assert.deepEqual(rows.map((row) => row.user_id), [ids[1]], 'Do not notify the actor about their own business action');
    await client.query("INSERT INTO public.product(prodcode,description,unit,is_deleted) VALUES ('ZX9001','Workspace verification','pc',false)");
    await client.query("INSERT INTO public.pricehist(prodcode,effdate,unitprice,is_deleted) VALUES ('ZX9001',current_date + 10,123.45,false)");
    rows = await notices('products');
    assert.deepEqual(rows.map((row) => row.user_id).sort(), [ids[1], ids[2]].sort(), 'Product alerts reach product staff/managers; actor and opted-out sales staff excluded');
    assert(rows.every((row) => row.message.includes('Effective date:')));
    await client.query("UPDATE public.app_user SET password_hash='another-not-a-login-hash' WHERE user_id=$1", [ids[0]]);
    assert.equal((await notices('account')).filter((row) => row.user_id === ids[0]).length, 1, 'Security notices include personal actions');
    const before = (await notices('products')).length;
    await client.query("UPDATE public.pricehist SET unitprice=unitprice WHERE prodcode='ZX9001'");
    assert.equal((await notices('products')).length, before, 'No-op updates must not produce alerts');
    await client.query("SAVEPOINT workspace_rollback");
    await client.query("INSERT INTO public.pricehist(prodcode,effdate,unitprice,is_deleted) VALUES ('ZX9001',current_date + 11,321.00,false)");
    await client.query('ROLLBACK TO SAVEPOINT workspace_rollback');
    assert.equal((await notices('products')).length, before, 'Failed transactions must not leave notifications');
    const job = (await client.query('SELECT jobcode FROM public.job WHERE NOT is_deleted LIMIT 1')).rows[0];
    const department = (await client.query('SELECT deptcode FROM public.department WHERE NOT is_deleted LIMIT 1')).rows[0];
    await client.query(`INSERT INTO public.jobhistory(empno,jobcode,deptcode,effdate,salary,is_deleted)
      VALUES ('ZX901',$1,$2,current_date + 12,12345.67,false)`, [job.jobcode, department.deptcode]);
    const employment = await notices('employment');
    assert.equal(employment.filter((row) => row.user_id === ids[0]).length, 1);
    assert(employment[0].message.includes('Effective date:') && !employment[0].message.includes('12345.67'), 'Employment notices must not contain salary data');
    await client.query(`INSERT INTO public.audit_log(table_name,action,record_key,old_values,new_values,action_by)
      VALUES ('app_user_right','EDIT',$1,'{"rights":[],"role":"employee"}', '{"rights":["hr.access"],"role":"employee"}','workspace-verification')`, [ids[3]]);
    assert((await notices('account')).some((row) => row.user_id === ids[3]), 'Permission changes must notify the affected employee');
    await client.query('DELETE FROM public.app_user_right WHERE user_id=$1', [ids[2]]);
    assert.equal((await client.query("SELECT public.workspace_notice_visible($1,'products') AS visible", [ids[2]])).rows[0].visible, false, 'Revoked access must hide existing business alerts');
    const all = await client.query('SELECT title,message FROM public.app_notification WHERE user_id=ANY($1::uuid[])', [ids]);
    assert(!JSON.stringify(all.rows).includes('not-a-login-hash'), 'Do not expose authentication data');
    const security = await client.query(`SELECT relname,relrowsecurity,has_table_privilege('anon',oid,'SELECT') AS anon_read
      FROM pg_class WHERE oid IN ('public.app_notification'::regclass,'public.app_user_preferences'::regclass)`);
    assert(security.rows.every((row) => row.relrowsecurity && !row.anon_read), 'Workspace data must remain private');
    const originalRequirePool = db.requirePool;
    db.requirePool = () => client;
    try {
      const api = require('../controllers/workspace-controller');
      const invoke = async (handler, userId, extra = {}) => {
        let body, failure;
        await handler({ user: { sub: userId }, query: {}, params: {}, ...extra }, { json: (value) => { body = value; } }, (error) => { failure = error; });
        if (failure) throw failure;
        return body.data;
      };
      await invoke(api.updatePreferences, ids[0], { body: { density: 'compact', motion: false } });
      assert.equal((await invoke(api.getPreferences, ids[0])).preferences.density, 'compact');
      assert.equal((await invoke(api.getPreferences, ids[1])).preferences.density, 'comfortable');
      const personalInbox = await invoke(api.listNotifications, ids[0]);
      const personalNotice = personalInbox.items.find((item) => item.category === 'account');
      assert(personalNotice);
      assert.equal((await invoke(api.openNotification, ids[0], { params: { notificationId: personalNotice.id } })).href, '/settings?section=security');
      await assert.rejects(() => invoke(api.markNotificationRead, ids[1], { params: { notificationId: personalNotice.id } }), { statusCode: 404 });
      await invoke(api.markNotificationRead, ids[0], { params: { notificationId: personalNotice.id } });
      assert((await invoke(api.listNotifications, ids[0])).items.find((item) => item.id === personalNotice.id).readAt);
      const otherUnread = (await invoke(api.listNotifications, ids[1])).unreadCount;
      await invoke(api.markAllRead, ids[0]);
      assert.equal((await invoke(api.listNotifications, ids[0])).unreadCount, 0);
      assert.equal((await invoke(api.listNotifications, ids[1])).unreadCount, otherUnread);
    } finally { db.requirePool = originalRequirePool; }
    await client.query('SAVEPOINT workspace_product_cascade');
    await client.query("DELETE FROM public.app_notification WHERE user_id=ANY($1::uuid[]) AND category='products'", [ids]);
    await client.query("UPDATE public.pricehist SET is_deleted=true WHERE prodcode='ZX9001'");
    await client.query("UPDATE public.product SET is_deleted=true WHERE prodcode='ZX9001'");
    assert((await notices('products')).every((row) => row.title === 'Product archived'), 'Product archive must not duplicate its price-history changes');
    await client.query("UPDATE public.product SET is_deleted=false WHERE prodcode='ZX9001'");
    await client.query("UPDATE public.pricehist SET is_deleted=false WHERE prodcode='ZX9001'");
    assert((await notices('products')).every((row) => row.title === 'Product restored'), 'Product restore must not duplicate its price-history changes');
    await client.query('ROLLBACK TO SAVEPOINT workspace_product_cascade');
    console.log('Verified notification recipients, preferences, self-action suppression, effective dates, no-ops, rollback, access revocation, product cascades, and private tables.');
  } finally {
    await client.query('ROLLBACK'); client.release(); await db.pool.end();
  }
}

verify().catch((error) => { console.error(error.message, error.where || ''); process.exitCode = 1; });
