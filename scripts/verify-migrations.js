// scripts/verify-migrations.js
// Validates Supabase migration files for naming convention, timestamp collisions,
// chronological sequence, and schema drift prevention.

const fs = require('fs');
const path = require('path');

// Standard migration filename format: YYYYMMDDHHMMSS_<description>.sql
// Example: 20261017131926_add_employee_auth.sql
const MIGRATION_REGEX = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;

function verifyMigrations(migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const allEntries = fs.readdirSync(migrationsDir);
  const sqlFiles = allEntries.filter((f) => f.endsWith('.sql'));

  if (sqlFiles.length === 0) {
    console.warn(`[WARN] No .sql migration files found in ${migrationsDir}`);
    return { valid: true, count: 0, files: [] };
  }

  console.log(`[INFO] Verifying ${sqlFiles.length} migration files in ${migrationsDir}...`);

  const errors = [];
  const timestamps = new Map();
  const parsedMigrations = [];

  for (const file of sqlFiles) {
    const match = file.match(MIGRATION_REGEX);
    if (!match) {
      errors.push(`Invalid migration filename format: "${file}". Expected format: YYYYMMDDHHMMSS_<description>.sql`);
      continue;
    }

    const timestampStr = match[1];
    const description = match[2];

    // Check collision / duplicate timestamp
    if (timestamps.has(timestampStr)) {
      errors.push(`Timestamp collision detected! Timestamp "${timestampStr}" is used by both "${timestamps.get(timestampStr)}" and "${file}".`);
    } else {
      timestamps.set(timestampStr, file);
    }

    // Check non-empty file
    const filePath = path.join(migrationsDir, file);
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      errors.push(`Migration file is empty: "${file}".`);
    }

    parsedMigrations.push({
      file,
      timestamp: timestampStr,
      description
    });
  }

  // Ensure migrations are in strictly ascending chronological sequence
  for (let i = 1; i < parsedMigrations.length; i++) {
    if (parsedMigrations[i].timestamp <= parsedMigrations[i - 1].timestamp) {
      errors.push(`Non-sequential timestamps detected: "${parsedMigrations[i].file}" (${parsedMigrations[i].timestamp}) does not strictly succeed "${parsedMigrations[i - 1].file}" (${parsedMigrations[i - 1].timestamp}).`);
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Migration Verification Failed:');
    errors.forEach((err) => console.error(`  - ${err}`));
    return { valid: false, count: sqlFiles.length, errors };
  }

  console.log(`✅ All ${sqlFiles.length} migrations verified successfully:`);
  parsedMigrations.forEach((m) => console.log(`   • ${m.timestamp}: ${m.file}`));
  return { valid: true, count: sqlFiles.length, migrations: parsedMigrations };
}

if (require.main === module) {
  try {
    const result = verifyMigrations();
    if (!result.valid) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during migration verification:', err.message);
    process.exit(1);
  }
}

module.exports = {
  verifyMigrations,
  MIGRATION_REGEX
};
