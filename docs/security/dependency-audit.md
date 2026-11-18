# Dependency Vulnerability Scanning & Secret Leak Guard Policy ([S2-DSO-04])

## 1. Overview
HOPE, Inc. ERP enforces automated software composition analysis (SCA) and secret leak prevention across pull requests and protected branches (`main` and `test`) via `.github/workflows/ci.yml` and `package.json` dependency overrides.

---

## 2. CI Security Controls (`.github/workflows/ci.yml`)

| Control | Job / Step | Enforcement Scope | Failure Condition |
|---|---|---|---|
| **Runtime & Transitive CVE Gate** | `build-and-test` -> `Audit Dependencies for Critical CVEs` | All `push` and `pull_request` events targeting `main` and `test` | Any **critical** CVE detected by `npm audit --audit-level=critical` |
| **Secret Leak Scanning** | `secret-scan` -> `trufflesecurity/trufflehog@v3.90.0` | Full commit diff (`base.sha..head.sha`) on PRs and commit history on push | Any verified credential, API key, or token detected (`--only-verified`) |
| **Migration & Syntax Integrity** | `build-and-test` -> `npm run lint` & `node scripts/verify-migrations.js` | JavaScript sources and `supabase/migrations/*.sql` | Syntax error or migration timestamp collision/drift |
| **Production Branch Guard** | `.github/workflows/enforce-test-branch.yml` | All PRs targeting `main` | Direct PR not originating from `test` or unauthorized actor |

---

## 3. Baseline Vulnerability Audit Record (`npm audit`)

Verified against `package-lock.json` on branch `test`:

| Scope | Command | Critical | High | Moderate | Low | Info | Total | Status |
|---|---|---:|---:|---:|---:|---:|---:|---|
| **Production Runtime Dependencies** | `npm audit --omit=dev --json` | 0 | 0 | 0 | 0 | 0 | **0** | Clean (0 runtime vulnerabilities) |
| **Full Dependency Tree (incl. devDependencies)** | `npm audit --json` | 0 | 33 | 7 | 0 | 0 | **40** | CI critical gate passes; non-runtime findings isolated to legacy `jest@^25.1.0` dev toolchain |

### Pinned Security Overrides (`package.json`)
To mitigate transitive vulnerabilities without breaking legacy integration test compatibility, `package.json` enforces minimum patched versions via `overrides`:
- `form-data >= 2.5.6`
- `tough-cookie >= 4.1.3`
- `uuid >= 11.1.1`

---

## 4. Remediation & Exception Workflow
1. **Runtime or Critical CVEs:** Block merge immediately until upgraded or constrained via `package.json` `overrides` + regenerated `package-lock.json`.
2. **Transitive `devDependencies` Advisories:** Monitor quarterly; upgrading `jest` from `^25.1.0` requires verifying Jest/Supertest ESM and test-runner compatibility across `tests/integration/` and `tests/qa-unit/`.
3. **Secret Detection Alerts:** Never commit `.env*` secrets or service role keys (enforced by `.gitignore` and TruffleHog). If TruffleHog flags a leaked credential, rotate/revoke the secret immediately in Supabase/Vercel before rewriting or purging history.
