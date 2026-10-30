import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { verifyMigrations, MIGRATION_REGEX } from './verify-migrations.js';

describe('verify-migrations', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the production repository migrations successfully', () => {
    const result = verifyMigrations();
    expect(result.valid).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(13);
    expect(result.migrations.length).toBe(result.count);
  });

  it('correctly matches valid migration filename formats with regex', () => {
    expect('20261017131926_add_employee_auth.sql').toMatch(MIGRATION_REGEX);
    expect('20261028000001_issue_114_employee_job_history_tracking.sql').toMatch(MIGRATION_REGEX);
    expect('20260101000000_init-schema.sql').toMatch(MIGRATION_REGEX);
  });

  it('rejects invalid migration filename formats', () => {
    expect('add_employee_auth.sql').not.toMatch(MIGRATION_REGEX);
    expect('20261017_short_timestamp.sql').not.toMatch(MIGRATION_REGEX);
    expect('20261017131926-wrong-separator.sql').not.toMatch(MIGRATION_REGEX);
    expect('20261017131926_migration.txt').not.toMatch(MIGRATION_REGEX);
  });

  it('detects timestamp collisions across migration files', () => {
    fs.writeFileSync(path.join(tempDir, '20261020000000_first_migration.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(tempDir, '20261020000000_conflicting_migration.sql'), 'SELECT 2;');

    const result = verifyMigrations(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Timestamp collision detected'))).toBe(true);
  });

  it('fails verification on invalid filename inside directory', () => {
    fs.writeFileSync(path.join(tempDir, 'invalid_name.sql'), 'SELECT 1;');

    const result = verifyMigrations(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid migration filename format'))).toBe(true);
  });

  it('detects empty migration files', () => {
    fs.writeFileSync(path.join(tempDir, '20261020000000_empty.sql'), '');

    const result = verifyMigrations(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('handles empty migrations directory gracefully', () => {
    const result = verifyMigrations(tempDir);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
  });
});
