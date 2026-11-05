# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> TC-E2E-01: user can log in and the dashboard renders
- Location: tests\e2e\smoke.spec.js:5:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Work email')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to content" [ref=e4] [cursor=pointer]:
    - /url: "#main-content"
  - main [ref=e5]:
    - region [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - img "HOPE logo" [ref=e9]
          - generic [ref=e10]:
            - generic [ref=e11]: HOPE, Inc.
            - generic [ref=e12]: Business workspace
        - navigation "Main navigation" [ref=e13]:
          - link "The workspace" [ref=e14] [cursor=pointer]:
            - /url: "#workspace"
          - link "Team access" [ref=e15] [cursor=pointer]:
            - /url: "#access"
          - button "Register" [ref=e16] [cursor=pointer]
          - link "Sign in" [ref=e17] [cursor=pointer]:
            - /url: /login
            - text: Sign in
            - generic [aria-hidden] [ref=e18]: ↗
      - generic [ref=e19]:
        - paragraph [ref=e20]: Run your entire business with confidence
        - heading "Your business, connected in one ERP workspace." [level=1] [ref=e21]:
          - generic [ref=e22]: Your business,
          - generic [ref=e23]: connected in one
          - generic [ref=e24]: ERP workspace.
        - paragraph [ref=e25]: Bring your people, products, and everyday operations together. One place to keep work moving.
        - generic [ref=e26]:
          - link "Sign in to your workspace" [ref=e27] [cursor=pointer]:
            - /url: /login
            - text: Sign in to your workspace
            - generic [aria-hidden] [ref=e28]: ↗
          - button "Register for an account" [ref=e29] [cursor=pointer]:
            - text: Register for an account
            - generic [aria-hidden] [ref=e30]: →
        - link "Explore the workspace" [ref=e31] [cursor=pointer]:
          - /url: "#workspace"
          - text: Explore the workspace
          - generic [aria-hidden] [ref=e32]: ↓
    - region [ref=e33]:
      - generic [ref=e34]:
        - heading "Less switching. More getting things done." [level=2] [ref=e35]: Less switching.More getting things done.
        - generic [ref=e36]:
          - generic [ref=e37]:
            - paragraph [ref=e38]: Built around your work
            - heading "The everyday details. All in one place." [level=3] [ref=e39]: The everyday details.All in one place.
            - paragraph [ref=e40]: Sales, inventory, customers, employees, and reports. Connected in your HOPE workspace, with access managed for your team.
          - generic [ref=e41]:
            - generic [ref=e42]:
              - generic [aria-hidden] [ref=e43]: "01"
              - generic [ref=e44]:
                - heading "Sales & customers" [level=3] [ref=e45]
                - paragraph [ref=e46]: From customer records to sales transactions and payments. Keep the details of every relationship together.
            - generic [ref=e47]:
              - generic [aria-hidden] [ref=e48]: "02"
              - generic [ref=e49]:
                - heading "Inventory & pricing" [level=3] [ref=e50]
                - paragraph [ref=e51]: Organize your product catalog and follow price history, with the right price for each transaction date.
            - generic [ref=e52]:
              - generic [aria-hidden] [ref=e53]: "03"
              - generic [ref=e54]:
                - heading "People & reports" [level=3] [ref=e55]
                - paragraph [ref=e56]: Maintain employee records and job history. Review your business through focused, ready-to-print reports.
    - region [ref=e57]:
      - generic [ref=e58]:
        - generic [ref=e59]:
          - paragraph [ref=e60]: Your next step
          - heading "A place for your team to work." [level=2] [ref=e61]: A place foryour team to work.
        - generic [ref=e62]:
          - paragraph [ref=e63]: Already part of HOPE? Your workspace is ready when you are.
          - generic [ref=e64]:
            - link "Open your workspace" [ref=e65] [cursor=pointer]:
              - /url: /login
              - text: Open your workspace
              - generic [aria-hidden] [ref=e66]: ↗
            - button "Register" [ref=e67] [cursor=pointer]
          - paragraph [ref=e68]: Need elevated access? Contact your administrator.
  - contentinfo [ref=e69]:
    - generic [ref=e70]:
      - img "HOPE logo" [ref=e71]
      - generic [ref=e72]:
        - generic [ref=e73]: HOPE, Inc.
        - generic [ref=e74]: Business workspace
    - paragraph [ref=e75]: © 2026 HOPE, Inc. All rights reserved.
    - link "Back to top" [ref=e76] [cursor=pointer]:
      - /url: "#main-content"
      - text: Back to top
      - generic [aria-hidden] [ref=e77]: ↑
```

# Test source

```ts
  1  | require('dotenv').config({ path: '.env.test', quiet: true });
  2  | 
  3  | async function login(page, email, password = process.env.QA_PASSWORD) {
  4  |   await page.goto('/');
> 5  |   await page.getByLabel('Work email').fill(email);
     |                                       ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  6  |   await page.locator('#login-password').fill(password);
  7  |   await page.getByRole('button', { name: 'Sign in' }).click();
  8  | }
  9  | 
  10 | module.exports = { login };
```