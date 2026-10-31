// scripts/project-automation.js
// Automates Project #5 status transitions, developer notifications & automated bug triage:
// - PR opened / edited / ready_for_review with linked issue -> Auto-links issue via GraphQL & moves to In Review
// - PR merged with linked issue -> Auto-links issue, closes issue via API & moves to Done
// - Issue opened / labeled / edited (bug) -> Automatically classifies area and assigns responsible developer
// - Issue reopened -> Moves back to In Progress
// - Issue closed -> Ensures Done, checks dependent issues; if all prerequisites are closed -> moves to Ready & notifies assigned developer

const PROJECT_ID = 'PVT_kwHOCu4u2c4Bm3EV';
const STATUS_FIELD_ID = 'PVTSSF_lAHOCu4u2c4Bm3EVzhleT70';
const STATUS_OPTIONS = {
  BACKLOG: 'f75ad846',
  READY: '61e4505c',
  IN_PROGRESS: '47fc9ee4',
  IN_REVIEW: 'df73e18b',
  DONE: '98236657'
};

const DEV_ALIASES = {
  // Kathryn Chloe -> itsmechloe (Backend / DB Admin)
  kathrynchloe: 'itsmechloe',
  itsmechloe: 'itsmechloe',
  chloe: 'itsmechloe',
  kathryn: 'itsmechloe',

  // Alain Deiniel -> alainmnts (UI/UX / Frontend)
  alaindeiniel: 'alainmnts',
  alainmnts: 'alainmnts',
  alain: 'alainmnts',

  // Prince Nelson -> princeaguinaldo (QA / Test Engineer)
  princenelson: 'princeaguinaldo',
  princeaguinaldo: 'princeaguinaldo',
  prince: 'princeaguinaldo',

  // Marron Beroy -> Polygonic (DevSecOps)
  marronberoy: 'Polygonic',
  polygonic: 'Polygonic',
  marron: 'Polygonic',

  // Ryan James -> Raii-stack (Scrum Master / Admin)
  ryanjames: 'Raii-stack',
  'raii-stack': 'Raii-stack',
  raiistack: 'Raii-stack',
  ryan: 'Raii-stack'
};

const ROLE_TO_DEV = {
  frontend: { dev: 'alainmnts', label: 'frontend' },
  'ui/ux': { dev: 'alainmnts', label: 'frontend' },
  'ui-ux': { dev: 'alainmnts', label: 'frontend' },
  ui: { dev: 'alainmnts', label: 'frontend' },
  ux: { dev: 'alainmnts', label: 'frontend' },
  'ui/ux developer': { dev: 'alainmnts', label: 'frontend' },
  'frontend developer': { dev: 'alainmnts', label: 'frontend' },

  backend: { dev: 'itsmechloe', label: 'backend' },
  api: { dev: 'itsmechloe', label: 'backend' },
  'backend engineer': { dev: 'itsmechloe', label: 'backend' },

  database: { dev: 'itsmechloe', label: 'db-admin' },
  db: { dev: 'itsmechloe', label: 'db-admin' },
  'db admin': { dev: 'itsmechloe', label: 'db-admin' },
  'db-admin': { dev: 'itsmechloe', label: 'db-admin' },
  dba: { dev: 'itsmechloe', label: 'db-admin' },
  supabase: { dev: 'itsmechloe', label: 'db-admin' },
  postgres: { dev: 'itsmechloe', label: 'db-admin' },
  postgresql: { dev: 'itsmechloe', label: 'db-admin' },

  devsecops: { dev: 'Polygonic', label: 'devsecops' },
  devops: { dev: 'Polygonic', label: 'devsecops' },
  security: { dev: 'Polygonic', label: 'security' },
  'devsecops engineer': { dev: 'Polygonic', label: 'devsecops' },
  ci: { dev: 'Polygonic', label: 'devsecops' },
  'ci/cd': { dev: 'Polygonic', label: 'devsecops' },
  deployment: { dev: 'Polygonic', label: 'devsecops' },

  'test engineer': { dev: 'princeaguinaldo', label: 'tests' },
  testing: { dev: 'princeaguinaldo', label: 'tests' },
  tests: { dev: 'princeaguinaldo', label: 'tests' },
  test: { dev: 'princeaguinaldo', label: 'tests' },
  qa: { dev: 'princeaguinaldo', label: 'tests' },

  'scrum master': { dev: 'Raii-stack', label: null }
};

const KEYWORDS = {
  frontend: {
    dev: 'alainmnts',
    label: 'frontend',
    words: [
      'css', 'tailwind', 'button', 'modal', 'navbar', 'dropdown', 'table', 'form',
      'input', 'ui', 'ux', 'frontend', 'react', 'layout', 'responsive', 'mobile',
      'breakpoint', 'display', 'view', 'styling', 'render', 'toast', 'spinner',
      'icon', 'dialog', 'header', 'footer', 'tab', 'pagination', 'vite', 'component'
    ]
  },
  database: {
    dev: 'itsmechloe',
    label: 'db-admin',
    words: [
      'supabase', 'postgres', 'postgresql', 'migration', 'database', 'foreign key',
      'foreign-key', 'schema', 'trigger', 'rls', 'sql', 'deadlock', 'cascade',
      'soft delete', 'app_user', 'audit_log', 'pooler', 'database connection'
    ]
  },
  backend: {
    dev: 'itsmechloe',
    label: 'backend',
    words: [
      'endpoint', 'api', 'controller', 'route', 'express', 'middleware', 'bcrypt',
      'jwt', 'cookie', 'session', '500', '503', '502', '400', '401', '403', '404',
      '409', 'server error', 'auth', 'authentication', 'login', 'token', 'req', 'res'
    ]
  },
  devsecops: {
    dev: 'Polygonic',
    label: 'devsecops',
    words: [
      'vercel', 'deploy', 'deployment', 'github action', 'ci/cd', 'workflow',
      'sast', 'codeql', 'cors', 'helmet', 'ssl', 'dns', 'environment variable',
      'env', 'secret', 'production build', 'docker'
    ]
  },
  tests: {
    dev: 'princeaguinaldo',
    label: 'tests',
    words: [
      'playwright', 'vitest', 'jest', 'test case', 'e2e', 'regression', 'assertion',
      'test suite', 'test failure', 'locator', 'supertest'
    ]
  }
};

function isBugIssue(issue) {
  if (!issue) return false;
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labels.some((lbl) => lbl.includes('bug') || lbl.includes('defect'))) {
    return true;
  }
  const title = issue.title || '';
  if (/\[BUG[-\w]*\]/i.test(title) || /^\s*\[?bug\]?/i.test(title) || /\bdefect\b/i.test(title)) {
    return true;
  }
  return false;
}

function determineBugAssignee(issue) {
  if (!issue) return null;
  const body = issue.body || '';
  const title = issue.title || '';
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());

  // 1. Explicit Assignee in body (e.g. **Assignee:** @KathrynChloe)
  const assigneeMatch = body.match(/\*\*Assignee:\*\*\s*([^\r\n]+)/i);
  if (assigneeMatch) {
    const mentions = assigneeMatch[1].match(/@([a-zA-Z0-9_-]+)/g);
    if (mentions) {
      for (const rawMention of mentions) {
        const clean = rawMention.replace('@', '').toLowerCase();
        if (DEV_ALIASES[clean]) {
          return {
            dev: DEV_ALIASES[clean],
            reason: 'explicit_assignee',
            label: null
          };
        }
      }
    }
  }

  // 2. Explicit Component / Area / Role in body (e.g. from Issue Form or markdown)
  const roleMatch = body.match(/(?:\*\*Role:\*\*|### Affected Component \/ Area|\*\*Component:\*\*)\s*([^\r\n]+)/i);
  if (roleMatch) {
    const line = roleMatch[1].toLowerCase();
    for (const [key, mapping] of Object.entries(ROLE_TO_DEV)) {
      if (line.includes(key)) {
        return {
          dev: mapping.dev,
          reason: 'explicit_role',
          label: mapping.label
        };
      }
    }
  }

  // 3. Issue Labels
  for (const label of labels) {
    if (ROLE_TO_DEV[label] && label !== 'bug') {
      return {
        dev: ROLE_TO_DEV[label].dev,
        reason: 'label',
        label: ROLE_TO_DEV[label].label
      };
    }
  }

  // 4. Keyword heuristic scoring
  const combinedText = `${title}\n${body}`.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const config of Object.values(KEYWORDS)) {
    let score = 0;
    for (const word of config.words) {
      const regex = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = {
        dev: config.dev,
        reason: 'keyword_match',
        label: config.label
      };
    }
  }

  if (bestMatch && highestScore > 0) {
    return bestMatch;
  }

  // 5. Default fallback to Scrum Master
  return {
    dev: 'Raii-stack',
    reason: 'fallback_triage',
    label: null
  };
}

function formatBugTriageComment(dev, reason, label) {
  const areaText = label ? ` (area: \`${label}\`)` : '';
  return `🤖 **Automated Bug Triage:** Assigned to @${dev}${areaText} based on ${reason.replace('_', ' ')}. Defect added to the Sprint board for pickup.`;
}

function formatReadyNotification(assignees) {
  const mentions = Array.isArray(assignees) && assignees.length > 0
    ? assignees.map((a) => (a.startsWith('@') ? a : `@${a}`)).join(' ')
    : '@team';
  return `${mentions}: All prerequisite tasks for this issue have been completed. This task is now in the **Ready** column on the [Sprint Plan](https://github.com/users/Raii-stack/projects/5) board and is ready to be picked up.`;
}

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

async function addIssueToProject(token, issueNodeId) {
  if (!issueNodeId) return null;
  const mutation = `mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }`;
  try {
    const data = await graphql(token, mutation, {
      projectId: PROJECT_ID,
      contentId: issueNodeId
    });
    return data?.addProjectV2ItemById?.item?.id || null;
  } catch (err) {
    console.warn(`Could not add issue ${issueNodeId} to Project #${PROJECT_ID}:`, err.message);
    return null;
  }
}

async function assignIssueOnGitHub(token, issueNum, assignees, repo = process.env.GITHUB_REPOSITORY || 'Raii-stack/BAIYOGESIC') {
  if (!assignees || assignees.length === 0) return false;
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/assignees`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Action-Automation',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ assignees })
    });
    if (res.ok) {
      console.log(`Assigned [${assignees.join(', ')}] to Issue #${issueNum}`);
      return true;
    } else {
      const err = await res.text();
      console.warn(`Failed to assign Issue #${issueNum}:`, err);
      return false;
    }
  } catch (err) {
    console.warn(`Error assigning Issue #${issueNum}:`, err.message);
    return false;
  }
}

async function addLabelsToIssue(token, issueNum, labels, repo = process.env.GITHUB_REPOSITORY || 'Raii-stack/BAIYOGESIC') {
  if (!labels || labels.length === 0) return false;
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/labels`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Action-Automation',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ labels })
    });
    if (res.ok) {
      console.log(`Added labels [${labels.join(', ')}] to Issue #${issueNum}`);
      return true;
    }
  } catch (err) {
    console.warn(`Error adding labels to Issue #${issueNum}:`, err.message);
  }
  return false;
}

async function commentOnIssue(token, issueNum, commentText, repo = process.env.GITHUB_REPOSITORY || 'Raii-stack/BAIYOGESIC') {
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/comments`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Action-Automation',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ body: commentText })
    });
    return res.ok;
  } catch (err) {
    console.warn(`Error posting comment on Issue #${issueNum}:`, err.message);
    return false;
  }
}

async function handleBugAssignment(token, issue, itemByIssueNum, repo = process.env.GITHUB_REPOSITORY || 'Raii-stack/BAIYOGESIC') {
  if (!isBugIssue(issue)) return false;

  const currentAssignees = issue.assignees?.map((a) => (typeof a === 'string' ? a : a.login)) || [];
  if (currentAssignees.length > 0) {
    console.log(`Issue #${issue.number} already has assignees [${currentAssignees.join(', ')}]. Skipping assignment.`);
    return false;
  }

  const triage = determineBugAssignee(issue);
  if (!triage || !triage.dev) return false;

  console.log(`Auto-assigning Issue #${issue.number} to @${triage.dev} (reason: ${triage.reason})`);
  await assignIssueOnGitHub(token, issue.number, [triage.dev], repo);

  // Apply relevant labels
  const currentLabels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  const newLabels = [];
  if (!currentLabels.includes('bug')) newLabels.push('bug');
  if (triage.label && !currentLabels.includes(triage.label)) newLabels.push(triage.label);

  if (newLabels.length > 0) {
    await addLabelsToIssue(token, issue.number, newLabels, repo);
  }

  // Post triage confirmation comment
  const commentText = formatBugTriageComment(triage.dev, triage.reason, triage.label);
  await commentOnIssue(token, issue.number, commentText, repo);

  // Sync to Project #5
  const it = itemByIssueNum ? itemByIssueNum.get(issue.number) : null;
  if (!it && issue.node_id) {
    const itemId = await addIssueToProject(token, issue.node_id);
    if (itemId) {
      console.log(`Added Issue #${issue.number} to Project #5 (Item ID: ${itemId}) -> Setting status to Ready`);
      await updateItemStatus(token, itemId, STATUS_OPTIONS.READY);
    }
  } else if (it) {
    console.log(`Issue #${issue.number} already in Project #5 -> Ensuring status is Ready`);
    await updateItemStatus(token, it.id, STATUS_OPTIONS.READY);
  }

  return true;
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

function parseClosingIssueNumbers(body, branch = '', title = '') {
  const closingIssues = [];
  const sanitizedBody = (body || '').replace(/<!--[\s\S]*?-->/g, '');
  const text = `${sanitizedBody}\n${title || ''}`;
  const closeRegex = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
  let match;
  while ((match = closeRegex.exec(text)) !== null) {
    closingIssues.push(Number(match[1]));
  }
  if (branch) {
    const branchMatch = /(?:issue|feat|feature)[/-](\d+)/i.exec(branch);
    if (branchMatch) {
      closingIssues.push(Number(branchMatch[1]));
    }
  }
  return [...new Set(closingIssues)];
}

async function notifyReady(token, issueNum, assignees, body) {
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;

  // 1. Check if notification comment was already posted
  const commentsRes = await fetch(`https://api.github.com/repos/Raii-stack/BAIYOGESIC/issues/${issueNum}/comments`, {
    headers: {
      Authorization: authHeader,
      'User-Agent': 'GitHub-Action-Automation',
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (commentsRes.ok) {
    const comments = await commentsRes.json();
    const alreadyNotified = comments.some(
      (c) => c.body && c.body.includes('ready to be picked up')
    );
    if (alreadyNotified) {
      console.log(`Issue #${issueNum} was already notified. Skipping.`);
      return;
    }
  }

  // Determine handles to mention
  let targetAssignees = assignees;
  if (!targetAssignees || targetAssignees.length === 0) {
    const match = (body || '').match(/\*\*Assignee:\*\*\s*([^\r\n]+)/i);
    if (match) {
      const parsed = match[1].match(/@([a-zA-Z0-9_-]+)/g);
      if (parsed) {
        targetAssignees = parsed.map((p) => p.replace('@', ''));
      }
    }
  }

  const commentText = formatReadyNotification(targetAssignees);
  const postRes = await fetch(`https://api.github.com/repos/Raii-stack/BAIYOGESIC/issues/${issueNum}/comments`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Action-Automation',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({ body: commentText })
  });

  if (postRes.ok) {
    console.log(`Successfully posted Ready notification on Issue #${issueNum}.`);
  } else {
    const err = await postRes.text();
    console.error(`Failed to post comment on #${issueNum}:`, err);
  }
}

async function closeIssueOnGitHub(token, issueNum) {
  const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/Raii-stack/BAIYOGESIC/issues/${issueNum}`, {
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Action-Automation',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' })
    });
    if (res.ok) {
      console.log(`Closed Issue #${issueNum} via GitHub REST API.`);
    } else {
      const err = await res.text();
      console.warn(`Failed to close Issue #${issueNum} via API:`, err);
    }
  } catch (err) {
    console.warn(`Error closing Issue #${issueNum}:`, err.message);
  }
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

  // Fetch all items from Project #5 with assignees and node IDs
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
                assignees(first: 5) {
                  nodes { login }
                }
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

    // Parse closing issue numbers from PR body, branch, and title
    const closingIssues = parseClosingIssueNumbers(pr.body || '', pr.head?.ref || '', pr.title || '');
    const prNodeId = pr.node_id;

    if (action === 'closed' && pr.merged) {
      // PR merged -> auto-link PR, close issue via API (required for non-default target branches), and move to Done
      for (const issueNum of closingIssues) {
        const it = itemByIssueNum.get(issueNum);
        if (it && it.content && it.content.id && prNodeId) {
          try {
            await graphql(token, `mutation($input: AddCloseIssueReferencesInput!) {
              addCloseIssueReferences(input: $input) {
                issue { id number }
              }
            }`, {
              input: {
                issueId: it.content.id,
                pullRequestIds: [prNodeId]
              }
            });
            console.log(`Auto-linked PR #${pr.number} to Issue #${issueNum}`);
          } catch (err) {
            console.warn(`Could not link PR #${pr.number} to Issue #${issueNum}:`, err.message);
          }
        }

        await closeIssueOnGitHub(token, issueNum);

        if (it) {
          console.log(`Setting Issue #${issueNum} -> Done (merged via PR #${pr.number})`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.DONE);
          closedIssueNums.add(issueNum);
        }
      }
    } else if (['opened', 'reopened', 'ready_for_review', 'edited'].includes(action)) {
      // Auto-link PR to closing issues via GraphQL if not already linked
      for (const issueNum of closingIssues) {
        const it = itemByIssueNum.get(issueNum);
        if (it && it.content && it.content.id && prNodeId) {
          try {
            await graphql(token, `mutation($input: AddCloseIssueReferencesInput!) {
              addCloseIssueReferences(input: $input) {
                issue { id number }
              }
            }`, {
              input: {
                issueId: it.content.id,
                pullRequestIds: [prNodeId]
              }
            });
            console.log(`Auto-linked PR #${pr.number} to Issue #${issueNum}`);
          } catch (err) {
            console.warn(`Could not link PR #${pr.number} to Issue #${issueNum}:`, err.message);
          }
        }

        if (it && it.content.state !== 'CLOSED') {
          console.log(`Setting Issue #${issueNum} -> In Review (PR #${pr.number} ${action})`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.IN_REVIEW);
        }
      }
    }
  }

  // 2. Issue Events (e.g. Opened, Labeled, Edited, Reopened, Closed)
  if (eventName === 'issues') {
    const issue = eventPayload.issue;
    const action = eventPayload.action;
    console.log(`Issue #${issue.number} action: ${action}`);

    // Auto-triage and assign newly opened / labeled bug reports
    if (['opened', 'labeled'].includes(action) || (action === 'edited' && (!issue.assignees || issue.assignees.length === 0))) {
      await handleBugAssignment(token, issue, itemByIssueNum);
    }

    const it = itemByIssueNum.get(issue.number);
    if (it) {
      if (action === 'reopened') {
        console.log(`Setting reopened Issue #${issue.number} -> In Progress`);
        await updateItemStatus(token, it.id, STATUS_OPTIONS.IN_PROGRESS);
        closedIssueNums.delete(issue.number);
      } else if (action === 'closed') {
        console.log(`Setting closed Issue #${issue.number} -> Done`);
        await updateItemStatus(token, it.id, STATUS_OPTIONS.DONE);
        closedIssueNums.add(issue.number);
      }
    }
  }

  // 3. Reconcile Closed Issues to Done
  for (const it of items) {
    if (!it.content || !it.content.number) continue;
    if (it.content.state === 'CLOSED') {
      const statusVal = it.fieldValues?.nodes?.find((f) => f.field && f.field.name === 'Status');
      if (statusVal && statusVal.name !== 'Done') {
        console.log(`Reconciling closed Issue #${it.content.number} -> Done (current: ${statusVal.name})`);
        await updateItemStatus(token, it.id, STATUS_OPTIONS.DONE);
      }
    }
  }

  // 4. Check Prerequisites for open items
  // If all prerequisites are closed, promote to Ready and notify developer
  for (const it of items) {
    if (!it.content || !it.content.number) continue;
    const issueNum = it.content.number;
    const isClosed = it.content.state === 'CLOSED';
    if (isClosed) continue;

    const statusVal = it.fieldValues?.nodes?.find((f) => f.field && f.field.name === 'Status');
    const currentStatus = statusVal ? statusVal.name : 'Backlog';

    const assignees = it.content.assignees?.nodes?.map((n) => n.login) || [];

    if (currentStatus === 'Backlog' || !statusVal) {
      const prereqs = parsePrerequisiteNumbers(it.content.body);
      if (prereqs.length > 0) {
        const allMet = prereqs.every((req) => closedIssueNums.has(req));
        if (allMet) {
          console.log(`All prerequisites [${prereqs.join(', ')}] met for Issue #${issueNum}! Moving to Ready.`);
          await updateItemStatus(token, it.id, STATUS_OPTIONS.READY);
          await notifyReady(token, issueNum, assignees, it.content.body);
        }
      }
    } else if (currentStatus === 'Ready') {
      // Ensure assignee has been notified for ready item
      await notifyReady(token, issueNum, assignees, it.content.body);
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

module.exports = {
  handleEvent,
  parsePrerequisiteNumbers,
  parseClosingIssueNumbers,
  formatReadyNotification,
  isBugIssue,
  determineBugAssignee,
  formatBugTriageComment,
  assignIssueOnGitHub,
  addLabelsToIssue,
  commentOnIssue,
  addIssueToProject,
  handleBugAssignment,
  DEV_ALIASES,
  ROLE_TO_DEV,
  KEYWORDS,
  STATUS_OPTIONS
};
