# AASHVO — DEPENDENCY REMEDIATION REPORT
## CVE Investigation, Vulnerability Assessment & Remediation Actions

**Document Status:** Approved & Final  
**Classification:** Software Supply Chain Security  
**Date:** November 2026  
**Auditor:** AASHVO Security Lead & Principal Code Reviewer  
**Target Release:** RC-1.0.0  
**Package Manager:** npm (Monorepo Workspaces)  

---

## 1. Executive Summary

This Dependency Remediation Report details the thorough security investigation, vulnerability tracing, and remediation decisions for all security advisories identified during the RC-1.0.0 audit cycle.

### Summary of Actions Taken

| Package Name | Severity | CVE / Advisory | Remediation Status | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| **`zod`** | **High** | GHSA-m954-95gx-2v72 | **REMEDIATED** | Removed unreferenced `"zod"` dependency from `apps/api/package.json`. High CVE eliminated. |
| **`vite`** | **Moderate** | GHSA-8g5g-mxqh-grgj | **REMEDIATED** | Bumped Vite to `^6.4.6` in root `package.json` with lockfile synchronization. Resolved cleanly. |
| **`deepmerge-ts`** | **High** | GHSA-c2cw-3rch-8wh5 | **ACCEPTED (Zero Runtime Risk)** | Traced to Prisma CLI devDependency (`@prisma/config`). Zero production exploitability. Refused unsafe `--force` bump to preserve Prisma 6 stability. |

---

## 2. In-Depth Vulnerability Investigations

### 2.1 Remediation of `zod` High Severity Advisory
- **Advisory:** GHSA-m954-95gx-2v72 (Denial of Service / Uncontrolled Resource Consumption in Zod schema parsing).
- **Initial State:** `"zod": "^3.24.2"` declared in `apps/api/package.json`.
- **Codebase Audit:**
  - Ran global regex searches across `src/`, `packages/contracts/`, and `apps/api/src/`.
  - Result: Zero imports of `zod`.
  - AASHVO's API validation layer exclusively uses `@nestjs/common`'s `ValidationPipe` with `class-validator` and `class-transformer`.
  - The shared contracts package (`@aashvo/contracts`) defines plain TypeScript interfaces and constants.
- **Action:** Removed `"zod": "^3.24.2"` from `apps/api/package.json`.
- **Verification:** Ran `npm run api:build` and Jest integration test suite; 100% clean compilation with zero regression. Vulnerability completely eliminated.

---

### 2.2 Remediation of `vite` Moderate Advisory
- **Advisory:** GHSA-8g5g-mxqh-grgj (Vite dev server static asset bypass).
- **Initial State:** `vite@6.4.0` resolved in `package-lock.json`.
- **Action:** Updated root `package.json` to `"vite": "^6.4.6"` and ran `npm update vite --package-lock-only`.
- **Verification:** Rebuilt frontend via `npm run build`; clean build achieved in 4.92s with zero warnings.

---

### 2.3 Assessment of `deepmerge-ts` Transitive Dependency
- **Advisory:** GHSA-c2cw-3rch-8wh5 / Prototype Pollution in `deepmerge-ts` versions `<8.0.0` when merging untrusted input containing `__proto__`.
- **Dependency Tree Inspection:**
  ```text
  aashvo@1.0.0 D:\Projects\AASHVO
  └─┬ apps/api -> .\apps\api
    └─┬ prisma@6.19.0 (devDependencies)
      └─┬ @prisma/config@6.19.0
        └── deepmerge-ts@7.1.5 (High Severity)
  ```
- **Exploitability Analysis:**
  1. **Build-Time Isolation:** `prisma` is listed strictly under `devDependencies` in `apps/api/package.json`. It is invoked exclusively during local development and CI migration runs (`npx prisma generate`, `npx prisma migrate`).
  2. **Zero Runtime Dependency:** The production runtime database client is `@prisma/client@6.19.0`. `@prisma/client` does **not** depend on `@prisma/config` or `deepmerge-ts`.
  3. **No Untrusted Input:** The Prisma CLI only processes the static, checked-in `prisma/schema.prisma` file maintained by AASHVO core engineers. It never parses untrusted user network input.
  4. **Production Artifacts:** In production Docker containers or serverless deployments, `devDependencies` are omitted via `npm prune --production` or multi-stage builds.
- **Decision on `npm audit fix --force`:**
  - Running `npm audit fix --force` would forcibly upgrade `prisma` to `7.10.1`.
  - Prisma 7 introduces major breaking changes to schema generators, connection pooling configurations, and query engines that would destabilize the verified PostgreSQL 16 schema.
  - **Directive:** In accordance with CTO engineering guidelines, destructive `--force` upgrades that risk application stability are strictly forbidden. The residual risk is categorized as **ACCEPTABLE (Build-time DevDependency Only)**.

---

## 3. Package Lock Integrity & Dependency Governance

1. **Lockfile Enforcement:** Continuous integration must execute `npm ci` rather than `npm install` to enforce reproducible, tamper-free dependency trees.
2. **Production Pruning:** Container build scripts must execute:
   ```bash
   npm prune --omit=dev
   ```
   This ensures devDependencies (including the Prisma CLI and its transitive `deepmerge-ts` dependency) are never packaged into production containers.
3. **Automated Dependabot / Renovate Rule:** Minor and patch updates should be reviewed weekly; semver-major upgrades (such as Prisma 6 $\to$ 7) must be scheduled as dedicated architectural upgrade sprints with complete integration regression testing.

---

## 4. Supply Chain Security Sign-Off

The AASHVO RC-1.0.0 runtime application has **zero high or critical vulnerabilities** in its production dependency graph.

