// scripts/copilot-pr-review.test.js
import { describe, it, expect } from 'vitest';
import { 
  analyzeDiff, 
  buildReviewReport, 
  extractLinkedIssueNumber, 
  parseIssueRequirements, 
  verifyIssueAlignment 
} from './copilot-pr-review.js';

describe('Copilot PR Review Automated Analysis', () => {
  it('extracts linked issue numbers from titles or PR descriptions', () => {
    expect(extractLinkedIssueNumber({ title: 'feat: add department (Closes #114)' })).toBe(114);
    expect(extractLinkedIssueNumber({ body: 'Fixes #64\nImplementation details...' })).toBe(64);
    expect(extractLinkedIssueNumber({ title: 'Resolves issue: 130' })).toBe(130);
    expect(extractLinkedIssueNumber({ title: 'chore: general updates' })).toBeNull();
  });

  it('parses target files, endpoints, and acceptance criteria from issue body', () => {
    const issueBody = `
### [S3-DEV-06] API: Employee Job History Promotion & Transfer Tracking

## Target Files and Paths
- \`controllers/employee-controller.js\` - Career history controller
- \`routes/employee-routes.js\` - Route definitions

### API Endpoints and Contracts
- \`GET /api/employees/:empno/job-history\` - Returns history
- \`POST /api/employees/:empno/job-history\` - Records promotion

**Acceptance Criteria:**
- [ ] Recording a promotion writes to job_history
- [ ] Promotion event is logged in audit_log
- [ ] Duplicate effective dates return HTTP 400
    `;

    const parsed = parseIssueRequirements(issueBody);
    expect(parsed.targetFiles).toContain('controllers/employee-controller.js');
    expect(parsed.targetFiles).toContain('routes/employee-routes.js');
    expect(parsed.endpoints).toContain('GET /api/employees/:empno/job-history');
    expect(parsed.endpoints).toContain('POST /api/employees/:empno/job-history');
    expect(parsed.criteria).toHaveLength(3);
    expect(parsed.criteria[0]).toContain('Recording a promotion writes to job_history');
  });

  it('verifies alignment between issue requirements and PR changed files', () => {
    const requirements = {
      targetFiles: ['controllers/employee-controller.js', 'routes/employee-routes.js'],
      endpoints: ['GET /api/employees/:empno/job-history'],
      criteria: ['Criterion 1']
    };

    const files = [
      { filename: 'controllers/employee-controller.js', patch: '+function getJobHistory() {}' },
      { filename: 'routes/employee-routes.js', patch: '+router.get("/api/employees/:empno/job-history", getJobHistory)' }
    ];

    const alignment = verifyIssueAlignment(requirements, files);
    expect(alignment.missingFiles).toHaveLength(0);
    expect(alignment.missingEndpoints).toHaveLength(0);
    expect(alignment.criteriaCount).toBe(1);
  });

  it('flags missing target files when PR does not touch required files', () => {
    const requirements = {
      targetFiles: ['controllers/employee-controller.js', 'routes/employee-routes.js'],
      endpoints: [],
      criteria: []
    };

    const files = [
      { filename: 'controllers/employee-controller.js', patch: '' }
    ];

    const alignment = verifyIssueAlignment(requirements, files);
    expect(alignment.missingFiles).toContain('routes/employee-routes.js');
  });

  it('includes linked issue alignment section in the review report', () => {
    const pr = {
      number: 147,
      title: 'feat: implement employee job history (Closes #114)',
      user: { login: 'itsmechloe' },
      base: { ref: 'test' },
      head: { ref: 'issue-114' }
    };

    const analysis = {
      findings: [],
      testFilesModified: 1,
      codeFilesModified: 2,
      hasBlockers: false
    };

    const issueData = {
      issueNumber: 114,
      requirements: {
        targetFiles: ['controllers/employee.js'],
        endpoints: ['GET /api/employees'],
        criteria: ['Crit 1', 'Crit 2']
      },
      alignment: {
        missingFiles: [],
        missingEndpoints: [],
        criteriaCount: 2
      }
    };

    const report = buildReviewReport(pr, analysis, [{ filename: 'controllers/employee.js' }], issueData);
    expect(report).toContain('Linked Issue Alignment (Issue #114)');
    expect(report).toContain('Target Files Check');
    expect(report).toContain('All designated target files were touched');
    expect(report).toContain('2 criteria evaluated from issue description');
  });

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

  it('validates PR title conventions including "new feat", "bug", and standard types', () => {
    const validTitles = [
      'new feat: implement employee job history',
      'new feat(api): add customer export endpoint',
      'bug: resolve payment rounding error',
      'bug fix(auth): prevent session timeout race condition',
      'fix: correct customer status filter',
      'feat: add sales chart',
      'chore: update dependencies',
      'docs: update API documentation',
      'perf: add trigram index on customer name',
      'refactor: clean up permissions middleware',
      'test: add regression tests for sales API',
      'ci: update GitHub Actions workflow',
      'style: adjust table padding for mobile'
    ];

    for (const title of validTitles) {
      const report = buildReviewReport(
        { number: 1, title, user: { login: 'dev' }, base: { ref: 'test' }, head: { ref: 'feature' } },
        { findings: [], testFilesModified: 1, codeFilesModified: 1, hasBlockers: false },
        [{ filename: 'file.js' }]
      );
      expect(report).toContain('| **Conventional Standards** | Passed |');
    }

    const invalidReport = buildReviewReport(
      { number: 2, title: 'random commit title without prefix', user: { login: 'dev' }, base: { ref: 'test' }, head: { ref: 'feature' } },
      { findings: [], testFilesModified: 1, codeFilesModified: 1, hasBlockers: false },
      [{ filename: 'file.js' }]
    );
    expect(invalidReport).toContain('| **Conventional Standards** | Notice |');
    expect(invalidReport).toContain('Title does not match conventional format (e.g. feat: ..., new feat: ..., fix: ..., bug: ...)');
  });
});
