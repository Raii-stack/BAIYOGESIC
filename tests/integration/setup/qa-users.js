const bcrypt = require('bcrypt');

const QA_PASSWORD = 'QaTest#12345';

const QA_USERS = {
  standard:   { empno: 'QA001', email: 'qa.standard@hope.inc',   role: 'employee',      status: 'active',  mustChange: false },
  admin:      { empno: 'QA002', email: 'qa.admin@hope.inc',      role: 'employee', status: 'active',  mustChange: false },
  superadmin: { empno: 'QA003', email: 'qa.superadmin@hope.inc', role: 'superadmin', status: 'active',  mustChange: false },
  firstLogin: { empno: 'QA004', email: 'qa.firstlogin@hope.inc', role: 'employee',      status: 'active',  mustChange: true  },
  pending:    { empno: 'QA005', email: 'qa.pending@hope.inc',    role: 'employee',      status: 'pending', mustChange: false },
  pwChange:   { empno: 'QA006', email: 'qa.pwchange@hope.inc',   role: 'employee',      status: 'active',  mustChange: false },
};

// Updates the row if the empno exists, otherwise inserts it
async function save(db, table, row) {
  const found = await db.from(table).select('empno').eq('empno', row.empno).maybeSingle();
  if (found.error) throw found.error;
  const result = found.data
    ? await db.from(table).update(row).eq('empno', row.empno)
    : await db.from(table).insert(row);
  if (result.error) throw result.error;
}

async function ensureQaUsers(db) {
  const hash = await bcrypt.hash(QA_PASSWORD, 10);
  for (const u of Object.values(QA_USERS)) {
    await save(db, 'employee', {
      empno: u.empno, lastname: 'Tester', firstname: 'QA', email: u.email, is_deleted: false,
    });
    await save(db, 'app_user', {
      empno: u.empno, email: u.email, password_hash: hash,
      status: u.status, role: u.role, must_change_password: u.mustChange,
    });
  }
}

module.exports = { QA_PASSWORD, QA_USERS, ensureQaUsers };