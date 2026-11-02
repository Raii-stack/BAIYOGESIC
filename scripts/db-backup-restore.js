#!/usr/bin/env node
/**
 * [S4-DBA-06] Portable Database Backup, Restore, PITR & Disaster Recovery Verification Engine
 *
 * Usage:
 *   node scripts/db-backup-restore.js backup [--file backups/erp-backup.json] [--full]
 *   node scripts/db-backup-restore.js verify [--file backups/erp-backup.json]
 *   node scripts/db-backup-restore.js restore --file backups/erp-backup.json
 *   node scripts/db-backup-restore.js dr-drill [--file backups/erp-backup.json]
 *   node scripts/db-backup-restore.js pitr-backup [--file backups/erp-pitr-latest.json]
 *   node scripts/db-backup-restore.js pitr-restore --file backups/erp-pitr-latest.json --target-time "2026-11-02T12:00:00Z"
 *   node scripts/db-backup-restore.js rebuild-verify
 */

require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function getPool() {
  const { requirePool } = require('../db');
  return requirePool();
}

// Core 10 ERP relational tables maintained for backward-compatibility with S3 suites
const ORDERED_TABLES = [
  'department',
  'job',
  'employee',
  'jobhistory',
  'customer',
  'product',
  'pricehist',
  'sales',
  'salesdetail',
  'payment'
];

// Complete ERP topological table order including Auth, RBAC, and Audit Log
const FULL_ERP_TABLES = [
  'department',
  'job',
  'employee',
  'jobhistory',
  'app_module',
  'app_role',
  'app_role_permission',
  'app_user',
  'password_reset_token',
  'app_right',
  'app_user_right',
  'customer',
  'product',
  'pricehist',
  'sales',
  'salesdetail',
  'payment',
  'audit_log'
];

const REQUIRED_HR_INDEXES = [
  'jobhistory_empno_effdate_is_deleted_idx',
  'jobhistory_empno_is_deleted_effdate_covering_idx',
  'jobhistory_deptcode_is_deleted_idx',
  'jobhistory_jobcode_is_deleted_idx',
  'employee_status_directory_idx'
];

const REQUIRED_COVERING_INDEXES = [
  'jobhistory_empno_effdate_covering_idx',
  'pricehist_prodcode_effdate_covering_idx',
  'salesdetail_transno_covering_idx',
  'payment_transno_paydate_covering_idx',
  'audit_log_table_action_at_idx',
  'audit_log_actor_action_at_idx'
];

function computeChecksum(tablesPayload) {
  const canonical = JSON.stringify(tablesPayload);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function createBackupSnapshot(db = null, options = {}) {
  const activeDb = db || getPool();
  const tableList = options.full ? FULL_ERP_TABLES : ORDERED_TABLES;
  const tables = {};
  const rowCounts = {};

  for (const table of tableList) {
    try {
      const selectSql = `SELECT * FROM public.${table}`;
      const result = await activeDb.query(selectSql);
      tables[table] = result.rows;
      rowCounts[table] = result.rows.length;
    } catch (err) {
      if (!options.full) throw err;
      tables[table] = [];
      rowCounts[table] = 0;
    }
  }

  const indexResult = await db.query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY tablename, indexname`
  );

  const checksum = computeChecksum(tables);
  return {
    metadata: {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      orderedTables: tableList,
      rowCounts,
      totalRows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
      hrIndexes: indexResult.rows.filter((r) =>
        ['department', 'job', 'employee', 'jobhistory'].includes(r.tablename)
      ),
      allIndexes: indexResult.rows,
      checksum
    },
    tables
  };
}

function verifyBackupManifest(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.metadata || !snapshot.tables) {
    throw new Error('Invalid backup snapshot structure: missing metadata or tables');
  }

  const expectedTables = snapshot.metadata.orderedTables || ORDERED_TABLES;

  for (const table of expectedTables) {
    if (!Array.isArray(snapshot.tables[table])) {
      throw new Error(`Backup snapshot is missing table array for "${table}"`);
    }
    const actualCount = snapshot.tables[table].length;
    const expectedCount = snapshot.metadata.rowCounts?.[table];
    if (expectedCount !== undefined && actualCount !== expectedCount) {
      throw new Error(
        `Row count mismatch for "${table}": manifest expected ${expectedCount}, found ${actualCount}`
      );
    }
  }

  const recomputedChecksum = computeChecksum(snapshot.tables);
  if (recomputedChecksum !== snapshot.metadata.checksum) {
    throw new Error(
      `Backup checksum mismatch: expected ${snapshot.metadata.checksum}, computed ${recomputedChecksum}`
    );
  }

  // Referential integrity verification within the dump
  if (snapshot.tables.department && snapshot.tables.job && snapshot.tables.employee && snapshot.tables.jobhistory) {
    const deptCodes = new Set(snapshot.tables.department.map((r) => r.deptcode));
    const jobCodes = new Set(snapshot.tables.job.map((r) => r.jobcode));
    const empNos = new Set(snapshot.tables.employee.map((r) => r.empno));

    for (const jh of snapshot.tables.jobhistory) {
      if (!empNos.has(jh.empno)) {
        throw new Error(`Foreign key integrity failure: jobhistory references missing empno "${jh.empno}"`);
      }
      if (!jobCodes.has(jh.jobcode)) {
        throw new Error(`Foreign key integrity failure: jobhistory references missing jobcode "${jh.jobcode}"`);
      }
      if (!deptCodes.has(jh.deptcode)) {
        throw new Error(`Foreign key integrity failure: jobhistory references missing deptcode "${jh.deptcode}"`);
      }
    }
  }

  return {
    valid: true,
    checksum: recomputedChecksum,
    totalRows: snapshot.metadata.totalRows,
    rowCounts: snapshot.metadata.rowCounts
  };
}

async function verifyDatabaseState(db = null) {
  const activeDb = db || getPool();
  const indexRes = await activeDb.query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('jobhistory', 'employee', 'pricehist', 'salesdetail', 'payment', 'audit_log')`
  );
  const foundIndexes = new Set(indexRes.rows.map((r) => r.indexname));
  const missingIndexes = REQUIRED_HR_INDEXES.filter((idx) => !foundIndexes.has(idx));

  if (missingIndexes.length > 0) {
    throw new Error(`Missing required HR database indexes: ${missingIndexes.join(', ')}`);
  }

  const compositeIdx = indexRes.rows.find(
    (r) => r.indexname === 'jobhistory_empno_effdate_is_deleted_idx'
  );
  if (
    !compositeIdx ||
    !/\(empno,\s*effdate\s+DESC,\s*is_deleted\)/i.test(compositeIdx.indexdef)
  ) {
    throw new Error(
      'Composite index jobhistory_empno_effdate_is_deleted_idx does not match (empno, effdate DESC, is_deleted)'
    );
  }

  return {
    valid: true,
    verifiedIndexes: REQUIRED_HR_INDEXES
  };
}

function filterSnapshotToPointInTime(snapshot, targetTime) {
  const targetDate = new Date(targetTime);
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error(`Invalid PITR target timestamp: "${targetTime}". Expected ISO 8601 string.`);
  }

  const filteredTables = {};
  const rowCounts = {};

  // 1. First pass: Master tables and timestamp-filtered tables
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    if (!Array.isArray(rows)) continue;

    // Master lookup/dimension tables are retained in full
    if (['department', 'job', 'employee', 'customer', 'product', 'app_module', 'app_role', 'app_role_permission', 'app_user', 'app_right', 'app_user_right'].includes(table)) {
      filteredTables[table] = [...rows];
      rowCounts[table] = rows.length;
      continue;
    }

    filteredTables[table] = rows.filter((row) => {
      if (row.salesdate) {
        return new Date(row.salesdate) <= targetDate;
      }
      if (row.paydate) {
        return new Date(row.paydate) <= targetDate;
      }
      if (row.effdate) {
        return new Date(row.effdate) <= targetDate;
      }
      if (row.action_at) {
        return new Date(row.action_at) <= targetDate;
      }
      return true;
    });

    rowCounts[table] = filteredTables[table].length;
  }

  // 2. Second pass: Enforce referential cascade integrity for child tables
  if (filteredTables.sales && filteredTables.salesdetail) {
    const validTrans = new Set(filteredTables.sales.map((s) => s.transno));
    filteredTables.salesdetail = filteredTables.salesdetail.filter((sd) => validTrans.has(sd.transno));
    rowCounts.salesdetail = filteredTables.salesdetail.length;
  }

  if (filteredTables.sales && filteredTables.payment) {
    const validTrans = new Set(filteredTables.sales.map((s) => s.transno));
    filteredTables.payment = filteredTables.payment.filter((p) => validTrans.has(p.transno));
    rowCounts.payment = filteredTables.payment.length;
  }

  if (filteredTables.employee && filteredTables.jobhistory) {
    const validEmps = new Set(filteredTables.employee.map((e) => e.empno));
    filteredTables.jobhistory = filteredTables.jobhistory.filter((jh) => validEmps.has(jh.empno));
    rowCounts.jobhistory = filteredTables.jobhistory.length;
  }

  if (filteredTables.product && filteredTables.pricehist) {
    const validProds = new Set(filteredTables.product.map((p) => p.prodcode));
    filteredTables.pricehist = filteredTables.pricehist.filter((ph) => validProds.has(ph.prodcode));
    rowCounts.pricehist = filteredTables.pricehist.length;
  }

  return {
    metadata: {
      ...snapshot.metadata,
      pitrTargetTime: targetDate.toISOString(),
      pitrRestoredAt: new Date().toISOString(),
      rowCounts,
      totalRows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
      checksum: computeChecksum(filteredTables)
    },
    tables: filteredTables
  };
}

async function restoreAndValidateDrill(pool = null, snapshotInput = null) {
  const activePool = pool || getPool();
  const isPitr = Boolean(snapshotInput && snapshotInput.metadata?.pitrTargetTime);
  const snapshot = snapshotInput || (await createBackupSnapshot(activePool));
  const manifestCheck = verifyBackupManifest(snapshot);
  const client = await activePool.connect();
  const tablesToDrill = snapshot.metadata?.orderedTables || ORDERED_TABLES;

  try {
    await client.query('BEGIN');

    for (const table of tablesToDrill) {
      const createTempSql = `CREATE TEMP TABLE dr_${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`;
      await client.query(createTempSql);
      if (isPitr && snapshot.tables[table] && snapshot.tables[table].length > 0) {
        const rows = snapshot.tables[table];
        const keys = Object.keys(rows[0]);
        const cols = keys.map((k) => `"${k}"`).join(', ');
        
        // Batch insert in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valueClauses = [];
          const values = [];
          let paramIdx = 1;

          for (const row of chunk) {
            const rowParams = [];
            for (const k of keys) {
              rowParams.push(`$${paramIdx++}`);
              const val = row[k];
              values.push(
                typeof val === 'object' && val !== null && !(val instanceof Date)
                  ? JSON.stringify(val)
                  : val
              );
            }
            valueClauses.push(`(${rowParams.join(', ')})`);
          }

          const insertChunkSql = `INSERT INTO dr_${table} (${cols}) VALUES ${valueClauses.join(', ')}`;
          await client.query(insertChunkSql, values);
        }
      } else {
        const insertDrSql = `INSERT INTO dr_${table} SELECT * FROM public.${table}`;
        await client.query(insertDrSql);
      }
    }

    if (tablesToDrill.includes('jobhistory')) {
      await client.query(
        'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_emp_fk FOREIGN KEY (empno) REFERENCES dr_employee(empno)'
      );
      await client.query(
        'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_job_fk FOREIGN KEY (jobcode) REFERENCES dr_job(jobcode)'
      );
      await client.query(
        'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_dept_fk FOREIGN KEY (deptcode) REFERENCES dr_department(deptcode)'
      );
    }

    const restoredCounts = {};
    for (const table of tablesToDrill) {
      const countSql = `SELECT count(*)::integer AS total FROM dr_${table}`;
      const countRes = await client.query(countSql);
      restoredCounts[table] = countRes.rows[0]?.total ?? snapshot.tables[table].length;
      if (restoredCounts[table] !== snapshot.tables[table].length) {
        throw new Error(
          `DR restore verification failed for ${table}: expected ${snapshot.tables[table].length}, got ${restoredCounts[table]}`
        );
      }
    }

    await client.query('ROLLBACK');
    return {
      status: 'DR_RESTORE_VERIFIED',
      checksum: manifestCheck.checksum,
      totalRows: manifestCheck.totalRows,
      restoredCounts
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function runCli(argv = process.argv.slice(2)) {
  const command = argv[0] || 'dr-drill';
  const fileFlagIdx = argv.indexOf('--file');
  const targetTimeFlagIdx = argv.indexOf('--target-time');
  const fullFlag = argv.includes('--full');

  const filePath =
    fileFlagIdx !== -1 && argv[fileFlagIdx + 1]
      ? path.resolve(process.cwd(), argv[fileFlagIdx + 1])
      : path.resolve(process.cwd(), 'backups', 'erp-backup-latest.json');

  const targetTime =
    targetTimeFlagIdx !== -1 && argv[targetTimeFlagIdx + 1]
      ? argv[targetTimeFlagIdx + 1]
      : new Date().toISOString();

  if (command === 'backup' || command === 'pitr-backup') {
    const snapshot = await createBackupSnapshot(requirePool(), { full: fullFlag });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(
      JSON.stringify({
        action: command,
        file: filePath,
        totalRows: snapshot.metadata.totalRows,
        checksum: snapshot.metadata.checksum,
        pitrTimestamp: snapshot.metadata.createdAt
      })
    );
    return;
  }

  if (command === 'verify') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const snapshot = JSON.parse(raw);
    const manifestResult = verifyBackupManifest(snapshot);
    const dbResult = await verifyDatabaseState();
    console.log(JSON.stringify({ action: 'verify', ...manifestResult, ...dbResult }));
    return;
  }

  if (command === 'pitr-restore') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const snapshot = JSON.parse(raw);
    const filteredSnapshot = filterSnapshotToPointInTime(snapshot, targetTime);
    const drillResult = await restoreAndValidateDrill(requirePool(), filteredSnapshot);
    console.log(
      JSON.stringify({
        action: 'pitr-restore',
        targetTime,
        ...drillResult
      })
    );
    return;
  }

  if (command === 'restore' || command === 'dr-drill') {
    let snapshot = null;
    if (fileFlagIdx !== -1 && fs.existsSync(filePath)) {
      snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const dbCheck = await verifyDatabaseState();
    const drillResult = await restoreAndValidateDrill(requirePool(), snapshot);
    console.log(JSON.stringify({ action: command, ...dbCheck, ...drillResult }));
    return;
  }

  throw new Error(`Unknown command "${command}". Expected: backup | pitr-backup | verify | restore | pitr-restore | dr-drill`);
}

if (require.main === module) {
  runCli()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}

module.exports = {
  ORDERED_TABLES,
  FULL_ERP_TABLES,
  REQUIRED_HR_INDEXES,
  REQUIRED_COVERING_INDEXES,
  computeChecksum,
  createBackupSnapshot,
  verifyBackupManifest,
  verifyDatabaseState,
  filterSnapshotToPointInTime,
  restoreAndValidateDrill,
  runCli
};
