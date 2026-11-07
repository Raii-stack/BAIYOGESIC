const fs = require('fs');
const path = require('path');

const START_MARKER = '<!-- issue-progress:start -->';
const END_MARKER = '<!-- issue-progress:end -->';

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function renderProgressSection({ openCount, closedCount, repository, updatedAt = new Date() }) {
  const total = openCount + closedCount;
  const percent = total === 0 ? 0 : (closedCount / total) * 100;
  const percentText = percent.toFixed(1);
  const issuesUrl = `https://github.com/${repository}/issues?q=is%3Aissue%20state%3A`;

  return `${START_MARKER}
> **Active development · Sprint 4 · Issue completion: ${percentText}% · Not yet release-ready**

### Issue progress

<div align="center">
  <img src="images/issue-progress.svg" alt="Project issue completion: ${percentText}% (${closedCount} of ${total} issues closed)" width="900" />
</div>

| Closed | Open | Total | Completion |
| ---: | ---: | ---: | ---: |
| [${closedCount}](${issuesUrl}closed) | [${openCount}](${issuesUrl}open) | ${total} | **${percentText}%** |

Calculation: ${closedCount} closed ÷ (${closedCount} closed + ${openCount} open) × 100 = ${percentText}%.

Automatically updated from GitHub issue states on **${formatDate(updatedAt)}**. Pull requests are excluded. The percentage includes every repository issue regardless of sprint, priority, or label, so it measures issue closure rather than release readiness.
${END_MARKER}`;
}

function renderProgressSvg({ openCount, closedCount }) {
  const total = openCount + closedCount;
  const percent = total === 0 ? 0 : (closedCount / total) * 100;
  const percentText = percent.toFixed(1);
  const fillWidth = ((percent / 100) * 900).toFixed(1);
  const label = `${percentText}% complete · ${closedCount} of ${total} issues closed`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="44" role="img" aria-label="${label}">
  <rect width="900" height="44" rx="8" fill="#374151"/>
  <rect width="${fillWidth}" height="44" rx="8" fill="#2da44e"/>
  <text x="450" y="28" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="15" font-weight="600">${label}</text>
</svg>
`;
}

function replaceProgressSection(document, section) {
  const start = document.indexOf(START_MARKER);
  const end = document.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Issue progress markers are missing or invalid');
  }
  return document.slice(0, start) + section + document.slice(end + END_MARKER.length);
}

async function getIssueCounts(token, repository) {
  const [owner, name, extra] = repository.split('/');
  if (!owner || !name || extra) throw new Error('GITHUB_REPOSITORY must use owner/name format');

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'hope-erp-issue-progress'
    },
    body: JSON.stringify({
      query: `query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          open: issues(states: OPEN) { totalCount }
          closed: issues(states: CLOSED) { totalCount }
        }
      }`,
      variables: { owner, name }
    })
  });

  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  const result = await response.json();
  if (result.errors?.length || !result.data?.repository) {
    throw new Error(result.errors?.[0]?.message || 'Repository was not found');
  }

  return {
    openCount: result.data.repository.open.totalCount,
    closedCount: result.data.repository.closed.totalCount
  };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'Raii-stack/BAIYOGESIC';
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const documentPath = path.resolve(
    process.env.PROGRESS_DOCUMENT || 'docs/PROJECT_DOCUMENTATION.md'
  );
  const imagePath = path.resolve(
    process.env.PROGRESS_IMAGE || 'docs/images/issue-progress.svg'
  );
  const counts = await getIssueCounts(token, repository);
  const document = fs.readFileSync(documentPath, 'utf8');
  const section = renderProgressSection({ ...counts, repository });
  const updated = replaceProgressSection(document, section);
  const image = renderProgressSvg(counts);

  if (updated !== document) fs.writeFileSync(documentPath, updated);
  if (!fs.existsSync(imagePath) || fs.readFileSync(imagePath, 'utf8') !== image) {
    fs.writeFileSync(imagePath, image);
  }
  console.log(`Issue progress: ${counts.closedCount}/${counts.openCount + counts.closedCount} closed`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  END_MARKER,
  START_MARKER,
  formatDate,
  getIssueCounts,
  renderProgressSection,
  renderProgressSvg,
  replaceProgressSection
};
