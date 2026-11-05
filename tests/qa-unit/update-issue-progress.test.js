const {
  END_MARKER,
  START_MARKER,
  renderProgressSection,
  renderProgressSvg,
  replaceProgressSection
} = require('../../scripts/update-issue-progress');

describe('issue progress documentation', () => {
  test('renders an HTML progress bar from open and closed issue counts', () => {
    const section = renderProgressSection({
      openCount: 40,
      closedCount: 47,
      repository: 'Raii-stack/BAIYOGESIC',
      updatedAt: new Date('2026-11-02T00:00:00Z')
    });

    expect(section).toContain('<img src="images/issue-progress.svg"');
    expect(section).toContain('Project issue completion: 54.0% (47 of 87 issues closed)');
    expect(section).toContain('| [47](');
    expect(section).toContain('| [40](');
    expect(section).toContain('November 2, 2026');
  });

  test('renders the current counts as a self-contained SVG progress bar', () => {
    const image = renderProgressSvg({ openCount: 40, closedCount: 47 });

    expect(image).toContain('width="486.2"');
    expect(image).toContain('54.0% complete · 47 of 87 issues closed');
  });

  test('replaces only the marked progress section', () => {
    const document = `before\n${START_MARKER}\nold\n${END_MARKER}\nafter`;
    const section = `${START_MARKER}\nnew\n${END_MARKER}`;

    expect(replaceProgressSection(document, section)).toBe('before\n' + section + '\nafter');
  });

  test('rejects documents without progress markers', () => {
    expect(() => replaceProgressSection('missing', 'section')).toThrow(
      'Issue progress markers are missing or invalid'
    );
  });
});
