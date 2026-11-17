# AASHVO Repository Cleanup Changelog

All notable structural and organizational improvements executed during the repository cleanup on branch `chore/repository-cleanup` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] - 2026-11-15 (Branch: `chore/repository-cleanup`)

### Added
- **`docs/README.md`**: Central documentation portal and taxonomy index explaining all engineering categories.
- **`docs/REPOSITORY_STRUCTURE.md`**: Comprehensive architectural layout and directory mapping for onboarding engineers.
- **`docs/REPOSITORY_CLEANUP_AUDIT.md`**: Formal audit report detailing files reviewed, moved, consolidated, and verified.
- **`docs/REPOSITORY_CLEANUP_CHANGELOG.md`**: This changelog tracking repository reorganization.

### Changed
- **`README.md` (Root)**:
  - Rewritten to be concise, professional, and accurate to current production status.
  - Added direct links to the new categorized `docs/` subdirectories.
  - Updated test counts to reflect the full 438 automated tests (275 frontend + 163 backend).
  - Explicitly updated founders: Abdul Rehman Ansari (Co-founder & CTO) and Tushar Jaisawl (Co-founder & Head of Marketing).
- **Documentation Restructuring (`docs/`)**:
  - Relocated 75 loose root documents into 9 categorized subdirectories via `git mv`:
    - `docs/product/` (3 files: Connect spec, feature expansion spec, user journeys)
    - `docs/architecture/` (11 files: system topology, modular backend design, monorepo plans)
    - `docs/api/` (4 files: Connect API reference, feature expansion API, transition plans)
    - `docs/database/` (18 files: PostgreSQL schema, migration runbooks, Supabase reconciliation)
    - `docs/security/` (9 files: OAuth audit, Google Identity Services, RLS policies, token rotation)
    - `docs/development/` (7 files: skills audit, dependency remediation, CI pipeline repairs)
    - `docs/deployment/` (14 files: staging runbooks, rollback plans, SEO launch checklists)
    - `docs/testing/` (8 files: QA reports, accessibility audits, performance benchmarks)
    - `docs/archive/` (24 files: historical sprint reports and superseded release audits)

### Removed
- **Boilerplate Assets**:
  - Confirmed `public/vite.svg` was completely unused and eliminated all remaining default Vite references across documentation and HTML.

### Verified & Retained
- **Zero Dead Code**:
  - Verified TypeScript compiler flags `"noUnusedLocals": true` and `"noUnusedParameters": true` are active in root and backend configurations.
  - Verified zero `console.log` statements exist in `src/` or `apps/api/src/`.
  - Verified zero `TODO` or `FIXME` comments exist in production code paths.
- **Complete Test Suite Parity**:
  - Frontend: 275 / 275 tests passed (25 test suites).
  - Backend: 163 / 163 tests passed (14 test suites).
  - Total: 438 / 438 tests passing (100% green).
- **Build & Compilation Parity**:
  - Root typecheck: 0 errors.
  - Backend typecheck: 0 errors.
  - Frontend Vite build: 0 errors.
  - Backend Nest build: 0 errors.
