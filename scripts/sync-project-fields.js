const fs = require('fs');

// Project 5 field IDs
const PROJECT_ID = "PVT_kwHOCu4u2c4Bm3EV";
const PRIORITY_FIELD_ID = "PVTSSF_lAHOCu4u2c4Bm3EVzhleUG8";
const DEADLINE_FIELD_ID = "PVTF_lAHOCu4u2c4Bm3EVzhleUHU";
const START_DATE_FIELD_ID = "PVTF_lAHOCu4u2c4Bm3EVzhleUHQ";

// Priority Option IDs in Project 5:
// Highest: 79628723
// High:    0a877460
// Medium:  da944a9c
const PRIORITIES = {
  P1: "79628723", // Highest
  P2: "0a877460", // High
  P3: "da944a9c"  // Medium
};

// Map of Issue Number -> { priority, deadline, start }
const ISSUE_SCHEDULE = {
  // Sprint 1
  13: { priority: PRIORITIES.P2, deadline: "2026-10-16", start: "2026-10-14" },
  14: { priority: PRIORITIES.P2, deadline: "2026-10-17", start: "2026-10-14" },
  15: { priority: PRIORITIES.P1, deadline: "2026-10-18", start: "2026-10-14" },
  16: { priority: PRIORITIES.P2, deadline: "2026-10-20", start: "2026-10-16" },
  17: { priority: PRIORITIES.P1, deadline: "2026-10-22", start: "2026-10-19" },
  18: { priority: PRIORITIES.P1, deadline: "2026-10-23", start: "2026-10-19" },
  19: { priority: PRIORITIES.P1, deadline: "2026-10-16", start: "2026-10-14" },
  20: { priority: PRIORITIES.P1, deadline: "2026-10-18", start: "2026-10-15" },
  21: { priority: PRIORITIES.P1, deadline: "2026-10-19", start: "2026-10-16" },
  22: { priority: PRIORITIES.P1, deadline: "2026-10-16", start: "2026-10-14" },
  23: { priority: PRIORITIES.P1, deadline: "2026-10-18", start: "2026-10-14" },
  24: { priority: PRIORITIES.P1, deadline: "2026-10-20", start: "2026-10-16" },
  25: { priority: PRIORITIES.P1, deadline: "2026-10-22", start: "2026-10-19" },
  26: { priority: PRIORITIES.P1, deadline: "2026-10-23", start: "2026-10-19" },
  27: { priority: PRIORITIES.P2, deadline: "2026-10-16", start: "2026-10-14" },
  28: { priority: PRIORITIES.P2, deadline: "2026-10-18", start: "2026-10-15" },
  29: { priority: PRIORITIES.P2, deadline: "2026-10-17", start: "2026-10-14" },
  30: { priority: PRIORITIES.P1, deadline: "2026-10-21", start: "2026-10-16" },
  31: { priority: PRIORITIES.P1, deadline: "2026-10-23", start: "2026-10-19" },
  32: { priority: PRIORITIES.P1, deadline: "2026-10-23", start: "2026-10-19" },
  51: { priority: PRIORITIES.P1, deadline: "2026-10-23", start: "2026-10-20" },
  52: { priority: PRIORITIES.P2, deadline: "2026-10-23", start: "2026-10-20" },
  53: { priority: PRIORITIES.P2, deadline: "2026-10-24", start: "2026-10-21" },

  // Sprint 2
  54: { priority: PRIORITIES.P2, deadline: "2026-10-28", start: "2026-10-26" },
  55: { priority: PRIORITIES.P3, deadline: "2026-10-30", start: "2026-10-26" },
  56: { priority: PRIORITIES.P2, deadline: "2026-11-03", start: "2026-10-30" },
  57: { priority: PRIORITIES.P1, deadline: "2026-11-04", start: "2026-11-02" },
  58: { priority: PRIORITIES.P2, deadline: "2026-11-05", start: "2026-11-02" },
  59: { priority: PRIORITIES.P1, deadline: "2026-11-05", start: "2026-11-02" },
  60: { priority: PRIORITIES.P2, deadline: "2026-11-05", start: "2026-11-02" },
  61: { priority: PRIORITIES.P3, deadline: "2026-11-06", start: "2026-11-02" },

  // Sprint 3
  62: { priority: PRIORITIES.P2, deadline: "2026-11-11", start: "2026-11-09" },
  63: { priority: PRIORITIES.P3, deadline: "2026-11-13", start: "2026-11-09" },
  64: { priority: PRIORITIES.P1, deadline: "2026-11-16", start: "2026-11-12" },
  65: { priority: PRIORITIES.P2, deadline: "2026-11-16", start: "2026-11-12" },
  66: { priority: PRIORITIES.P1, deadline: "2026-11-17", start: "2026-11-13" },
  67: { priority: PRIORITIES.P2, deadline: "2026-11-19", start: "2026-11-16" },
  68: { priority: PRIORITIES.P1, deadline: "2026-11-19", start: "2026-11-16" },
  69: { priority: PRIORITIES.P2, deadline: "2026-11-19", start: "2026-11-16" },
  70: { priority: PRIORITIES.P3, deadline: "2026-11-20", start: "2026-11-16" },

  // Sprint 4
  71: { priority: PRIORITIES.P1, deadline: "2026-11-25", start: "2026-11-23" },
  72: { priority: PRIORITIES.P1, deadline: "2026-11-26", start: "2026-11-23" },
  73: { priority: PRIORITIES.P2, deadline: "2026-11-27", start: "2026-11-24" },
  74: { priority: PRIORITIES.P1, deadline: "2026-11-30", start: "2026-11-26" },
  75: { priority: PRIORITIES.P1, deadline: "2026-11-30", start: "2026-11-26" },
  76: { priority: PRIORITIES.P2, deadline: "2026-11-30", start: "2026-11-26" },
  77: { priority: PRIORITIES.P2, deadline: "2026-12-01", start: "2026-11-27" },
  78: { priority: PRIORITIES.P1, deadline: "2026-12-02", start: "2026-11-30" },
  79: { priority: PRIORITIES.P1, deadline: "2026-12-02", start: "2026-11-30" },
  80: { priority: PRIORITIES.P2, deadline: "2026-12-03", start: "2026-12-01" },
  81: { priority: PRIORITIES.P2, deadline: "2026-12-03", start: "2026-12-01" },
  82: { priority: PRIORITIES.P1, deadline: "2026-12-03", start: "2026-12-01" },
  83: { priority: PRIORITIES.P2, deadline: "2026-12-03", start: "2026-12-01" },
  84: { priority: PRIORITIES.P1, deadline: "2026-12-04", start: "2026-12-01" }
};

async function executeGraphQL(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      'User-Agent': 'HOPE-ERP-Sync'
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function sync() {
  const mcpConfig = JSON.parse(fs.readFileSync('C:/Users/user/.gemini/config/mcp_config.json', 'utf8'));
  const token = mcpConfig.mcpServers.github.headers.Authorization;

  console.log("Fetching project items...");
  const itemsQuery = `
    query {
      user(login: "Raii-stack") {
        projectV2(number: 5) {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                }
              }
            }
          }
        }
      }
    }
  `;
  const itemsRes = await executeGraphQL(token, itemsQuery);
  const items = itemsRes.data?.user?.projectV2?.items?.nodes || [];
  console.log(`Found ${items.length} items in Project 5.`);

  const updateMutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: $value
        }
      ) {
        projectV2Item { id }
      }
    }
  `;

  let updatedCount = 0;
  for (const item of items) {
    const num = item.content?.number;
    if (!num || !ISSUE_SCHEDULE[num]) continue;

    const sched = ISSUE_SCHEDULE[num];

    // 1. Update Priority
    const pRes = await executeGraphQL(token, updateMutation, {
      projectId: PROJECT_ID,
      itemId: item.id,
      fieldId: PRIORITY_FIELD_ID,
      value: { singleSelectOptionId: sched.priority }
    });
    if (pRes.errors) {
      console.warn(`  Failed Priority on #${num}:`, pRes.errors[0]?.message);
    }

    // 2. Update Deadline
    const dRes = await executeGraphQL(token, updateMutation, {
      projectId: PROJECT_ID,
      itemId: item.id,
      fieldId: DEADLINE_FIELD_ID,
      value: { date: sched.deadline }
    });
    if (dRes.errors) {
      console.warn(`  Failed Deadline on #${num}:`, dRes.errors[0]?.message);
    }

    // 3. Update Start date
    if (sched.start) {
      const sRes = await executeGraphQL(token, updateMutation, {
        projectId: PROJECT_ID,
        itemId: item.id,
        fieldId: START_DATE_FIELD_ID,
        value: { date: sched.start }
      });
      if (sRes.errors) {
        console.warn(`  Failed Start Date on #${num}:`, sRes.errors[0]?.message);
      }
    }

    updatedCount++;
    console.log(`[${updatedCount}/${items.length}] Updated #${num} (${item.content.title.slice(0, 35)}...) -> Priority & Deadline: ${sched.deadline}`);
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\nSuccessfully updated ${updatedCount} items on Project 5!`);
}

sync().catch(console.error);
