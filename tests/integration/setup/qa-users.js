const bcrypt = require('bcrypt');

const QA_USERS = {
  standard:   { empno: 'QA001', email: 'qa.standard@hope.inc',   role: 'employee',      status: 'active',  mustChange: false },
  firstLogin: { empno: 'QA004', email: 'qa.firstlogin@hope.inc', role: 'employee',      status: 'active',  mustChange: true  },
  pending:    { empno: 'QA005', email: 'qa.pending@hope.inc',    role: 'employee',      status: 'pending', mustChange: false },
  pwChange:   { empno: 'QA006', email: 'qa.pwchange@hope.inc',   role: 'employee',      status: 'active',  mustChange: false },
};

function qaPassword() {
  if (process.env.ALLOW_QA_USER_SEED !== 'true') {
    throw new Error('Set ALLOW_QA_USER_SEED=true only for a non-production test database');
  }
  if (typeof process.env.QA_PASSWORD !== 'string' || process.env.QA_PASSWORD.length < 12) {
    throw new Error('QA_PASSWORD must be at least 12 characters');
  }
  return process.env.QA_PASSWORD;
}

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
  const hash = await bcrypt.hash(qaPassword(), 10);
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

module.exports = { QA_USERS, ensureQaUsers };
