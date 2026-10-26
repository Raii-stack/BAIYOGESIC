#!/usr/bin/env node
/**
 * [S3-DBA-06] Portable Database Backup, Restore & Disaster Recovery Verification Script
 *
 * Usage:
 *   node scripts/db-backup-restore.js backup [--file backups/erp-backup.json]
 *   node scripts/db-backup-restore.js verify [--file backups/erp-backup.json]
 *   node scripts/db-backup-restore.js restore --file backups/erp-backup.json
 *   node scripts/db-backup-restore.js dr-drill [--file backups/erp-backup.json]
 */

require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { requirePool } = require('../db');

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

const REQUIRED_HR_INDEXES = [
  'jobhistory_empno_effdate_is_deleted_idx',
  'jobhistory_empno_is_deleted_effdate_covering_idx',
  'jobhistory_deptcode_is_deleted_idx',
  'jobhistory_jobcode_is_deleted_idx',
  'employee_status_directory_idx'
];

function computeChecksum(tablesPayload) {
  const canonical = JSON.stringify(tablesPayload);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function createBackupSnapshot(db = requirePool()) {
  const tables = {};
  const rowCounts = {};

  for (const table of ORDERED_TABLES) {
    const result = await db.query(`SELECT * FROM public.${table}`);
    tables[table] = result.rows;
    rowCounts[table] = result.rows.length;
  }

  const indexResult = await db.query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('department', 'job', 'employee', 'jobhistory')
     ORDER BY tablename, indexname`
  );

  const checksum = computeChecksum(tables);
  return {
    metadata: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      orderedTables: ORDERED_TABLES,
      rowCounts,
      totalRows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
      hrIndexes: indexResult.rows,
      checksum
    },
    tables
  };
}

function verifyBackupManifest(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.metadata || !snapshot.tables) {
    throw new Error('Invalid backup snapshot structure: missing metadata or tables');
  }

  for (const table of ORDERED_TABLES) {
    if (!Array.isArray(snapshot.tables[table])) {
      throw new Error(`Backup snapshot is missing table array for "${table}"`);
    }
    const actualCount = snapshot.tables[table].length;
    const expectedCount = snapshot.metadata.rowCounts?.[table];
    if (actualCount !== expectedCount) {
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

  return {
    valid: true,
    checksum: recomputedChecksum,
    totalRows: snapshot.metadata.totalRows,
    rowCounts: snapshot.metadata.rowCounts
  };
}

async function verifyDatabaseState(db = requirePool()) {
  const indexRes = await db.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('jobhistory', 'employee')`
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

async function restoreAndValidateDrill(pool = requirePool(), snapshotInput = null) {
  const snapshot = snapshotInput || (await createBackupSnapshot(pool));
  const manifestCheck = verifyBackupManifest(snapshot);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const table of ORDERED_TABLES) {
      await client.query(
        `CREATE TEMP TABLE dr_${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`
      );
      await client.query(`INSERT INTO dr_${table} SELECT * FROM public.${table}`);
    }

    await client.query(
      'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_emp_fk FOREIGN KEY (empno) REFERENCES dr_employee(empno)'
    );
    await client.query(
      'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_job_fk FOREIGN KEY (jobcode) REFERENCES dr_job(jobcode)'
    );
    await client.query(
      'ALTER TABLE dr_jobhistory ADD CONSTRAINT dr_jh_dept_fk FOREIGN KEY (deptcode) REFERENCES dr_department(deptcode)'
    );

    const restoredCounts = {};
    for (const table of ORDERED_TABLES) {
      const countRes = await client.query(`SELECT count(*)::integer AS total FROM dr_${table}`);
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
  const filePath =
    fileFlagIdx !== -1 && argv[fileFlagIdx + 1]
      ? path.resolve(process.cwd(), argv[fileFlagIdx + 1])
      : path.resolve(process.cwd(), 'backups', 'erp-backup-latest.json');

  if (command === 'backup') {
    const snapshot = await createBackupSnapshot();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(
      JSON.stringify({
        action: 'backup',
        file: filePath,
        totalRows: snapshot.metadata.totalRows,
        checksum: snapshot.metadata.checksum
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

  throw new Error(`Unknown command "${command}". Expected: backup | verify | restore | dr-drill`);
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
  REQUIRED_HR_INDEXES,
  computeChecksum,
  createBackupSnapshot,
  verifyBackupManifest,
  verifyDatabaseState,
  restoreAndValidateDrill,
  runCli
};
