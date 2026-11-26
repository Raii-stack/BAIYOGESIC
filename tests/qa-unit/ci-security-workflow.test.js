const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #123: CI Dependency Vulnerability & Secret Scanning Guardrails', () => {
  const ciPath = path.join(ROOT, '.github', 'workflows', 'ci.yml');
  const enforcePath = path.join(ROOT, '.github', 'workflows', 'enforce-test-branch.yml');
  const auditDocPath = path.join(ROOT, 'docs', 'security', 'dependency-audit.md');
  const pkgPath = path.join(ROOT, 'package.json');

  const ciYml = fs.readFileSync(ciPath, 'utf8').replace(/\r\n/g, '\n');
  const enforceYml = fs.readFileSync(enforcePath, 'utf8').replace(/\r\n/g, '\n');
  const auditDoc = fs.readFileSync(auditDocPath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  test('CI workflow executes dependency CVE auditing on pushes and PRs to main and test', () => {
    expect(ciYml).toContain('branches:\n      - main\n      - test');
    expect(ciYml).toContain('npm audit --audit-level=critical');
    expect(ciYml).toContain('npm run lint');
    expect(ciYml).toContain('node scripts/verify-migrations.js');
  });

  test('CI workflow enforces TruffleHog secret scanning with full history fetch', () => {
    expect(ciYml).toContain('secret-scan:');
    expect(ciYml).toContain('fetch-depth: 0');
    expect(ciYml).toContain('trufflesecurity/trufflehog@');
    expect(ciYml).toContain('--only-verified');
  });

  test('branch protection workflow restricts main promotions to test branch', () => {
    expect(enforceYml).toContain('github.head_ref');
    expect(enforceYml).toContain('test');
  });

  test('package.json maintains hardened transitive security overrides', () => {
    expect(pkg.overrides).toBeDefined();
    expect(pkg.overrides['form-data']).toMatch(/^>=2\.5\.6/);
    expect(pkg.overrides['tough-cookie']).toMatch(/^>=4\.1\.3/);
    expect(pkg.overrides.uuid).toMatch(/^>=11\.1\.1/);
  });

  test('dependency audit policy document records runtime posture and CI controls', () => {
    expect(auditDoc).toContain('npm audit --omit=dev --json');
    expect(auditDoc).toContain('npm audit --audit-level=critical');
    expect(auditDoc).toContain('trufflesecurity/trufflehog');
  });
});
