import { describe, it, expect, vi } from 'vitest';
import {
  parsePrerequisiteNumbers,
  parseClosingIssueNumbers,
  formatReadyNotification,
  formatBlockedNotification,
  isBugIssue,
  determineBugAssignee,
  formatBugTriageComment,
  handleBugAssignment,
  STATUS_OPTIONS
} from './project-automation.js';

describe('project-automation', () => {
  it('parses None as empty prerequisites', () => {
    const body = '### Details\n**Prerequisites:** None\n**Estimate:** 2h';
    expect(parsePrerequisiteNumbers(body)).toEqual([]);
  });

  it('parses single prerequisite issue number', () => {
    const body = '### Details\n**Prerequisites:** #56\n**Estimate:** 3h';
    expect(parsePrerequisiteNumbers(body)).toEqual([56]);
  });

  it('parses multiple prerequisite issue numbers with commas/text', () => {
    const body = '### Details\n**Prerequisites:** #13, #14, and #15\n**Estimate:** 5h';
    expect(parsePrerequisiteNumbers(body)).toEqual([13, 14, 15]);
  });

  it('formats ready notification with clean mentions and no emoji', () => {
    const text = formatReadyNotification(['itsmechloe', 'alainmnts']);
    expect(text).toContain('@itsmechloe');
    expect(text).toContain('@alainmnts');
    expect(text).toContain('ready to be picked up');
    expect(text).not.toContain('👋');
  });

  it('formats fallback notification when assignees array is empty', () => {
    const text = formatReadyNotification([]);
    expect(text).toContain('@team');
  });

  it('parses single closing issue number from PR body', () => {
    expect(parseClosingIssueNumbers('## Linked Issues\nCloses #56')).toEqual([56]);
  });

  it('parses multiple closing issue numbers with various keywords', () => {
    expect(parseClosingIssueNumbers('Fixes #12, resolves #34 and Closes #56')).toEqual([12, 34, 56]);
  });

  it('deduplicates closing issue numbers', () => {
    expect(parseClosingIssueNumbers('Closes #56 and fixes #56')).toEqual([56]);
  });

  it('ignores closing keywords inside HTML comments', () => {
    const templateBody = '<!-- Link the issue(s) resolved by this pull request. Example: "Closes #123". -->\nCloses #103';
    expect(parseClosingIssueNumbers(templateBody)).toEqual([103]);
  });

  it('parses issue number from branch name and title if body is empty', () => {
    expect(parseClosingIssueNumbers('', 'issue-103', '[S2-DEV-02a] Task')).toEqual([103]);
    expect(parseClosingIssueNumbers('', 'feature/issue-64', '')).toEqual([64]);
  });

  it('handles empty or missing closing issue text gracefully', () => {
    expect(parseClosingIssueNumbers('')).toEqual([]);
    expect(parseClosingIssueNumbers(null)).toEqual([]);
  });

  it('formats blocked notification with unmet prerequisite numbers', () => {
    const text = formatBlockedNotification([31, 106]);
    expect(text).toContain('#31, #106');
    expect(text).toContain('moved to the **Backlog** column');
    expect(text).toContain('Sprint Plan');
  });

  it('exposes valid Project #5 status option IDs', () => {
    expect(STATUS_OPTIONS.BACKLOG).toBe('f75ad846');
    expect(STATUS_OPTIONS.READY).toBe('61e4505c');
    expect(STATUS_OPTIONS.IN_PROGRESS).toBe('47fc9ee4');
    expect(STATUS_OPTIONS.IN_REVIEW).toBe('df73e18b');
    expect(STATUS_OPTIONS.DONE).toBe('98236657');
  });
});

describe('automated bug triage & assignment', () => {
  it('detects bug issues by label or title', () => {
    expect(isBugIssue({ labels: [{ name: 'bug' }], title: 'Something broken' })).toBe(true);
    expect(isBugIssue({ labels: [], title: '[BUG-001] Fix Registration API 503' })).toBe(true);
    expect(isBugIssue({ labels: [], title: '[BUG]: Modal closes unexpectedly' })).toBe(true);
    expect(isBugIssue({ labels: [], title: 'BUG: Dropdown not working' })).toBe(true);
    expect(isBugIssue({ labels: [{ name: 'feature' }], title: '[S2-DEV-01] New Sales UI' })).toBe(false);
    expect(isBugIssue(null)).toBe(false);
  });

  it('assigns by explicit handle mention with alias mapping', () => {
    const issue1 = {
      title: '[BUG-001] Defect',
      body: '**Assignee:** @KathrynChloe\n**Role:** BackEnd Engineer',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(issue1)).toEqual({
      dev: 'itsmechloe',
      reason: 'explicit_assignee',
      label: null
    });

    const issue2 = {
      title: '[BUG-002] Defect',
      body: '**Assignee:** @AlainDeiniel\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(issue2)).toEqual({
      dev: 'alainmnts',
      reason: 'explicit_assignee',
      label: null
    });

    const issue3 = {
      title: '[BUG-003] Defect',
      body: '**Assignee:** @PrinceNelson\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(issue3)).toEqual({
      dev: 'princeaguinaldo',
      reason: 'explicit_assignee',
      label: null
    });
  });

  it('assigns by GitHub Issue Form dropdown / explicit component', () => {
    const backendFormIssue = {
      title: '[BUG]: Endpoint fails on empty payload',
      body: '### Affected Component / Area\n\nBackend / API (Express, Endpoints, Auth, Controllers)\n\n### Defect Description\nFails with 500',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(backendFormIssue)).toEqual({
      dev: 'itsmechloe',
      reason: 'explicit_role',
      label: 'backend'
    });

    const frontendFormIssue = {
      title: '[BUG]: Button misalignment in table header',
      body: '### Affected Component / Area\n\nFrontend / UI/UX (React, UI Components, Styling, Responsive Layouts)\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(frontendFormIssue)).toEqual({
      dev: 'alainmnts',
      reason: 'explicit_role',
      label: 'frontend'
    });

    const dbFormIssue = {
      title: '[BUG]: Missing foreign key index',
      body: '### Affected Component / Area\n\nDatabase / DB Admin (Supabase, PostgreSQL, Migrations, Schemas, Triggers)\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(dbFormIssue)).toEqual({
      dev: 'itsmechloe',
      reason: 'explicit_role',
      label: 'db-admin'
    });

    const devsecopsFormIssue = {
      title: '[BUG]: Vercel build environment variable missing',
      body: '### Affected Component / Area\n\nDevSecOps / CI/CD (Vercel, Deployment, GitHub Actions, Security, SSL)\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(devsecopsFormIssue)).toEqual({
      dev: 'Polygonic',
      reason: 'explicit_role',
      label: 'devsecops'
    });

    const qaFormIssue = {
      title: '[BUG]: Flaky regression test in customer suite',
      body: '### Affected Component / Area\n\nTesting / QA (Playwright, Vitest, Test Cases, Regressions)\n',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(qaFormIssue)).toEqual({
      dev: 'princeaguinaldo',
      reason: 'explicit_role',
      label: 'tests'
    });
  });

  it('assigns by issue labels when present', () => {
    expect(determineBugAssignee({ title: '[BUG] Defect', body: '', labels: [{ name: 'bug' }, { name: 'frontend' }] })).toEqual({
      dev: 'alainmnts',
      reason: 'label',
      label: 'frontend'
    });

    expect(determineBugAssignee({ title: '[BUG] Defect', body: '', labels: [{ name: 'bug' }, { name: 'devsecops' }] })).toEqual({
      dev: 'Polygonic',
      reason: 'label',
      label: 'devsecops'
    });

    expect(determineBugAssignee({ title: '[BUG] Defect', body: '', labels: [{ name: 'bug' }, { name: 'tests' }] })).toEqual({
      dev: 'princeaguinaldo',
      reason: 'label',
      label: 'tests'
    });
  });

  it('uses keyword heuristic classification for free-text bugs', () => {
    const uiBug = {
      title: '[BUG]: Customer table modal input styling broken on mobile screen',
      body: 'The dialog and buttons in the responsive layout overlap and do not render properly.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(uiBug)).toEqual({
      dev: 'alainmnts',
      reason: 'keyword_match',
      label: 'frontend'
    });

    const backendBug = {
      title: '[BUG]: 500 internal server error in auth login controller route',
      body: 'When posting invalid jwt token to endpoint, express middleware crashes.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(backendBug)).toEqual({
      dev: 'itsmechloe',
      reason: 'keyword_match',
      label: 'backend'
    });

    const dbBug = {
      title: '[BUG]: PostgreSQL migration deadlock on audit_log trigger',
      body: 'Supabase schema constraint fails on cascade soft delete.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(dbBug)).toEqual({
      dev: 'itsmechloe',
      reason: 'keyword_match',
      label: 'db-admin'
    });

    const vercelBug = {
      title: '[BUG]: Production build failed in GitHub Action workflow',
      body: 'Vercel deploy step failed with missing secret and CORS error.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(vercelBug)).toEqual({
      dev: 'Polygonic',
      reason: 'keyword_match',
      label: 'devsecops'
    });

    const testBug = {
      title: '[BUG]: Playwright E2E test locator timeout in regression suite',
      body: 'Vitest assertion failed on customer creation test case.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(testBug)).toEqual({
      dev: 'princeaguinaldo',
      reason: 'keyword_match',
      label: 'tests'
    });
  });

  it('falls back to Scrum Master for ambiguous bugs', () => {
    const vagueBug = {
      title: '[BUG]: Something is weird',
      body: 'Please investigate as soon as possible.',
      labels: [{ name: 'bug' }]
    };
    expect(determineBugAssignee(vagueBug)).toEqual({
      dev: 'Raii-stack',
      reason: 'fallback_triage',
      label: null
    });
  });

  it('formats clean bug triage confirmation comment', () => {
    const comment = formatBugTriageComment('itsmechloe', 'explicit_role', 'backend');
    expect(comment).toContain('@itsmechloe');
    expect(comment).toContain('backend');
    expect(comment).toContain('Automated Bug Triage');
  });

  it('skips auto-assignment if issue already has assignees', async () => {
    const issue = {
      number: 140,
      title: '[BUG]: Issue already handled',
      body: 'Some description',
      assignees: [{ login: 'itsmechloe' }],
      labels: [{ name: 'bug' }]
    };
    const result = await handleBugAssignment('dummy-token', issue, new Map());
    expect(result).toBe(false);
  });
});
