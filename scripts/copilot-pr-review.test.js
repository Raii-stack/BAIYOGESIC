// scripts/copilot-pr-review.test.js
import { describe, it, expect } from 'vitest';
import { analyzeDiff, buildReviewReport } from './copilot-pr-review.js';

describe('Copilot PR Review Automated Analysis', () => {
  it('detects committed private keys as critical blocker', () => {
    const files = [
      {
        filename: 'src/config/auth.js',
        status: 'modified',
        patch: '@@ -1,3 +1,4 @@\n+// some comment\n+const KEY = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowI...";\n'
      }
    ];

    const result = analyzeDiff(files);
    expect(result.hasBlockers).toBe(true);
    expect(result.findings.some(f => f.type === 'Secret Leak')).toBe(true);
  });

  it('detects hardcoded personal access tokens as critical blocker', () => {
    const files = [
      {
        filename: 'lib/github-client.js',
        status: 'modified',
        patch: '@@ -1,2 +1,3 @@\n+const token = "ghp_1234567890abcdef1234567890abcdef1234";\n'
      }
    ];

    const result = analyzeDiff(files);
    expect(result.hasBlockers).toBe(true);
    expect(result.findings.some(f => f.message.includes('GitHub Personal/OAuth Token'))).toBe(true);
  });

  it('detects dangerous SQL template injection as high severity', () => {
    const files = [
      {
        filename: 'controllers/data-controller.js',
        status: 'modified',
        patch: '@@ -10,3 +10,4 @@\n+const res = await query(`SELECT * FROM users WHERE id = ${userId}`);\n'
      }
    ];

    const result = analyzeDiff(files);
    expect(result.hasBlockers).toBe(true);
    expect(result.findings.some(f => f.type === 'Dangerous Pattern')).toBe(true);
  });

  it('passes cleanly on standard safe code and counts test files', () => {
    const files = [
      {
        filename: 'controllers/user-controller.js',
        status: 'modified',
        patch: '@@ -5,3 +5,6 @@\n+function sanitizeName(name) {\n+  return String(name || "").trim();\n+}\n'
      },
      {
        filename: 'tests/integration/user.test.js',
        status: 'modified',
        patch: '@@ -1,2 +1,5 @@\n+it("trims user name correctly", () => {\n+  expect(sanitizeName(" test ")).toBe("test");\n+});\n'
      }
    ];

    const result = analyzeDiff(files);
    expect(result.hasBlockers).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.codeFilesModified).toBe(1);
    expect(result.testFilesModified).toBe(1);
  });

  it('builds an APPROVE review for non-owner PR when checks pass', () => {
    const pr = {
      number: 42,
      title: 'feat: add department filter support',
      user: { login: 'itsmechloe' },
      base: { ref: 'test' },
      head: { ref: 'feature/dept-filter' },
      additions: 25,
      deletions: 2
    };

    const analysis = {
      findings: [],
      testFilesModified: 1,
      codeFilesModified: 1,
      hasBlockers: false
    };

    const report = buildReviewReport(pr, analysis, [{ filename: 'controllers/dept.js' }]);
    expect(report).toContain('✅ **Approved**');
    expect(report).toContain('Approval granted on behalf of `@Raii-stack` (Code Owner)');
    expect(report).toContain('Secret Leak Guard');
    expect(report).toContain('Conventional Standards');
  });

  it('builds a REQUEST_CHANGES review when blockers exist', () => {
    const pr = {
      number: 43,
      title: 'feat: add quick credentials',
      user: { login: 'collaborator' },
      base: { ref: 'test' },
      head: { ref: 'feature/creds' }
    };

    const analysis = {
      findings: [
        { severity: 'CRITICAL', type: 'Secret Leak', file: 'keys.js', message: 'Potential Private Key detected.' }
      ],
      testFilesModified: 0,
      codeFilesModified: 1,
      hasBlockers: true
    };

    const report = buildReviewReport(pr, analysis, [{ filename: 'keys.js' }]);
    expect(report).toContain('❌ **Changes Requested**');
    expect(report).toContain('Potential Private Key detected.');
  });
});
