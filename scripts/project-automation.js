// scripts/project-automation.js
// Automates Project #5 status transitions:
// - PR opened / review requested with linked issue -> In review
// - PR merged with linked issue -> Done
// - Issue closed -> Checks dependent issues; if all prerequisites are closed -> Ready

const PROJECT_ID = 'PVT_kwHOCu4u2c4Bm3EV';
const STATUS_FIELD_ID = 'PVTSSF_lAHOCu4u2c4Bm3EVzhleT70';
const STATUS_OPTIONS = {
  BACKLOG: 'f75ad846',
  READY: '61e4505c',
  IN_PROGRESS: '47fc9ee4',
  IN_REVIEW: 'df73e18b',
  DONE: '98236657'
};

async function graphql(token, query, variables = {}) {
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Action-Automation'
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }
  return data.data;
}

async function updateItemStatus(token, itemId, statusOptionId) {
  const mutation = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item { id }
    }
  }`;
  await graphql(token, mutation, {
    input: {
      projectId: PROJECT_ID,
      itemId,
      fieldId: STATUS_FIELD_ID,
      value: { singleSelectOptionId: statusOptionId }
    }
  });
}

function parsePrerequisiteNumbers(body) {
  if (!body) return [];
  const match = body.match(/\*\*Prerequisites:\*\*\s*(.*)/i);
  if (!match) return [];
  const line = match[1];
  if (/none/i.test(line)) return [];
  const issueNums = [];
  const regex = /#(\d+)/g;
  let m;
  while ((m = regex.exec(line)) !== null) {
    issueNums.push(Number(m[1]));
  }
  return issueNums;
}

async function handleEvent() {
  const token = process.env.PROJECT_PAT || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('No token provided via PROJECT_PAT or GITHUB_TOKEN');
    process.exit(1);
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPayload = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(require('fs').readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : {};

  console.log(`Processing event: ${eventName}, action: ${eventPayload.action}`);

  // Fetch all items from Project #5
  const projectQuery = `query {
    user(login: "Raii-stack") {
      projectV2(number: 5) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                id
                number
                title
                state
                body
              }
              ... on PullRequest {
                id
                number
                title
                state
                merged
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const projData = await graphql(token, projectQuery);
  const items = projData.user.projectV2.items.nodes;

  const itemByIssueNum = new Map();
  const closedIssueNums = new Set();

  for (const it of items) {
    if (it.content && it.content.number) {
      itemByIssueNum.set(it.content.number, it);
      if (it.content.state === 'CLOSED') {
        closedIssueNums.add(it.content.number);
      }
    }
  }

  // 1. Pull Request Events
  if (eventName === 'pull_request') {
    const pr = eventPayload.pull_request;
    const action = eventPayload.action;
    console.log(`PR #${pr.number} action: ${action}, merged: ${pr.merged}`);

    // Parse closing issue numbers from PR body
    const closingIssues = [];
    const prBody = pr.body || '';
    const closeRegex = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
    let match;
    while ((match = closeRegex.exec(prBody)) !== null) {
      closingIssues.push(Number(match[1]));
    }

    if (action === 'closed' && pr.merged) {
      // PR merged -> move linked issue to Done
      for (const issueNum of closingIssues) {
        const it = itemByIssueNum.get(issueNum);
        if (it) {
          console.log(`Setting Issue #${issueNum} -> Done (merged via PR #${pr.number})`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.DONE);
          closedIssueNums.add(issueNum);
        }
      }
    } else if (['opened', 'reopened', 'ready_for_review'].includes(action)) {
      // PR opened -> move linked issue to In Review
      for (const issueNum of closingIssues) {
        const it = itemByIssueNum.get(issueNum);
        if (it) {
          console.log(`Setting Issue #${issueNum} -> In Review (PR #${pr.number} opened)`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.IN_REVIEW);
        }
      }
    }
  }

  // 2. Check Prerequisites for all items in Backlog
  // If all prerequisites are closed, promote to Ready
  for (const it of items) {
    if (!it.content || !it.content.number) continue;
    const issueNum = it.content.number;
    const isClosed = it.content.state === 'CLOSED';
    if (isClosed) continue;

    const statusVal = it.fieldValues.nodes.find(f => f.field && f.field.name === 'Status');
    const currentStatus = statusVal ? statusVal.name : 'Backlog';

    if (currentStatus === 'Backlog' || !statusVal) {
      const prereqs = parsePrerequisiteNumbers(it.content.body);
      if (prereqs.length > 0) {
        const allMet = prereqs.every(req => closedIssueNums.has(req));
        if (allMet) {
          console.log(`All prerequisites [${prereqs.join(', ')}] met for Issue #${issueNum}! Moving to Ready.`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.READY);
        }
      }
    }
  }

  console.log('Project automation check complete.');
}

if (require.main === module) {
  handleEvent().catch((err) => {
    console.error('Automation error:', err);
    process.exit(1);
  });
}

module.exports = { handleEvent, parsePrerequisiteNumbers };
