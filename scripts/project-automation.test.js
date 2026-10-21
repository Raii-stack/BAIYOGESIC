import { describe, it, expect } from 'vitest';
import { parsePrerequisiteNumbers } from './project-automation.js';

describe('project-automation', () => {
  it('parses None as empty prerequisites', () => {
    expect(parsePrerequisiteNumbers('**Prerequisites:** None (Foundation Task)')).toEqual([]);
  });

  it('parses single prerequisite issue number', () => {
    expect(parsePrerequisiteNumbers('**Prerequisites:** #13 (Design System & Base Components)')).toEqual([13]);
  });

  it('parses multiple prerequisite issue numbers', () => {
    expect(
      parsePrerequisiteNumbers('**Prerequisites:** #13, #14 (Wireframes & Design System), #23 (User Auth API)')
    ).toEqual([13, 14, 23]);
  });

  it('handles empty or missing prerequisites gracefully', () => {
    expect(parsePrerequisiteNumbers('')).toEqual([]);
    expect(parsePrerequisiteNumbers(null)).toEqual([]);
  });
});
