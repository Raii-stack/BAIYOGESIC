---
name: Task Issue
about: "Standard task issue template for HOPE, Inc. ERP"
title: "[TASK-ID] [new feat/bug/chore]: Task Title"
labels: task

---

<!--
Issue Title Convention:
Format: [TASK-ID] [type]: Task Title
Example: [S3-DEV-06] [new feat]: Employee Job History Promotion & Transfer Tracking
Example: [S2-BUG-01] [bug]: Fix Registration API 503 and DB Insertion Error

Issue types matching automated code review conventions:
- new feat (or feat): New feature or functional addition
- bug (or fix): Defect or bug resolution
- chore: Tooling, dependencies, maintenance, config
- refactor: Code reorganization without behavioral change
- test: Unit, integration, or E2E test suite additions
- docs: Documentation changes
- perf: Performance optimization
- ci: CI/CD workflows and automated pipelines
- style: Formatting, CSS, or UI visual polish
-->

### [TASK-ID] [new feat/bug/chore]: Task Title

**Assignee:** @AssigneeHandle  
**Role:** [Developer / DB Admin / Test Engineer / UI/UX / Scrum Master]  
**Type:** [new feat / bug / chore / refactor / test / docs / perf / ci / style]  
**Prerequisites:** [List prerequisite tasks or 'None']  

**Description:**
Describe the purpose and scope of this task.

## Target Files and Paths
<!-- Required for automated PR review alignment. List files expected to be touched or created: -->
- `path/to/file.ext` - Description of changes

### API Endpoints and Contracts
<!-- Optional: List API endpoints being introduced or modified (e.g. GET /api/employees/:empno/job-history) -->
- `METHOD /api/path` - Contract specification

**Acceptance Criteria:**
<!-- Required for automated PR review verification: -->
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

<!--
Pull Request Instructions:
When submitting a PR for this issue, format the PR title according to automated review conventions:
  <type>(<scope>): <short description> (Closes #<issue_number>)

Examples:
- new feat(api): implement employee job history (Closes #114)
- bug(auth): resolve session timeout race condition (Fixes #51)
- chore: update npm dependencies (Closes #88)

Ensure the PR modifies the designated Target Files and satisfies all Acceptance Criteria above.
-->
