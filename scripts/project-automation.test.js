import { describe, it, expect } from 'vitest';
import {
  parsePrerequisiteNumbers,
  parseClosingIssueNumbers,
  formatReadyNotification,
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

  it('exposes valid Project #5 status option IDs', () => {
    expect(STATUS_OPTIONS.IN_PROGRESS).toBe('47fc9ee4');
    expect(STATUS_OPTIONS.IN_REVIEW).toBe('df73e18b');
    expect(STATUS_OPTIONS.DONE).toBe('98236657');
  });
});
