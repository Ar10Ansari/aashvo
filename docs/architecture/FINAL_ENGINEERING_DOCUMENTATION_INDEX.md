# AASHVO — FINAL ENGINEERING DOCUMENTATION INDEX
## Authoritative Navigation Guide to Core Specifications, Runbooks & Release Evidence

**Document Status:** Approved & Authoritative  
**Classification:** Documentation Index & Engineering Governance  
**Date:** November 2026  
**Auditor:** AASHVO Principal Software Architect  
**Release Candidate:** RC-1.0.0  
**Repository Branch:** `master`  

---

## 1. Structure of Engineering Documentation

All engineering documentation for AASHVO is centralized in `docs/`:
- **Root `docs/`:** Contains **46 active, authoritative engineering specifications**, database topologies, security reviews, API contracts, deployment runbooks, and test evidence.
- **`docs/archive/`:** Contains **68 historical sprint reports**, superseded audits, and initial planning documents preserved as an immutable audit trail.

---

## 2. Active Engineering Documentation Index

### 2.1 Core System Architecture & Monorepo Governance
- **[FINAL_ARCHITECTURE.md](file:///d:/Projects/AASHVO/docs/FINAL_ARCHITECTURE.md):** Authoritative end-to-end system topology, multi-tier flow diagrams, NestJS domain modules, and storage abstractions.
- **[FINAL_REPOSITORY_STRUCTURE.md](file:///d:/Projects/AASHVO/docs/FINAL_REPOSITORY_STRUCTURE.md):** Detailed directory layout and code organization across `apps/api`, `packages/contracts`, and `src`.
- **[FINAL_REPOSITORY_CLEANUP.md](file:///d:/Projects/AASHVO/docs/FINAL_REPOSITORY_CLEANUP.md):** Dead code removal audit, inventory of retained assets, and post-cleanup test evidence.
- **[REPOSITORY_ARCHITECTURE_FINAL.md](file:///d:/Projects/AASHVO/docs/REPOSITORY_ARCHITECTURE_FINAL.md):** Monorepo structure, workspace scripts, and developer onboarding conventions.
- **[MONOREPO_TRANSITION_PLAN.md](file:///d:/Projects/AASHVO/docs/MONOREPO_TRANSITION_PLAN.md):** Historical monorepo transition blueprint and workspace boundary definitions.
- **[INDEPENDENT_BACKEND_ARCHITECTURE.md](file:///d:/Projects/AASHVO/docs/INDEPENDENT_BACKEND_ARCHITECTURE.md):** Detailed design of the standalone NestJS REST service and domain modules.

### 2.2 Database Schema, Models & Data Migration
- **[POSTGRESQL_DATABASE_DESIGN.md](file:///d:/Projects/AASHVO/docs/POSTGRESQL_DATABASE_DESIGN.md):** Comprehensive PostgreSQL 16 relational design, 22 Prisma tables, DDL constraints, and index strategy.
- **[DATA_MIGRATION_AND_ROLLBACK_PLAN.md](file:///d:/Projects/AASHVO/docs/DATA_MIGRATION_AND_ROLLBACK_PLAN.md):** Zero-downtime data migration runbook, table copy procedures, and fallback checkpoints.
- **[MIGRATION_ACCEPTANCE_CHECKLIST.md](file:///d:/Projects/AASHVO/docs/MIGRATION_ACCEPTANCE_CHECKLIST.md):** Acceptance criteria for verifying PostgreSQL data integrity prior to cutover.

### 2.3 Security, Privacy & Cryptographic Hardening
- **[FINAL_SECURITY_REVIEW.md](file:///d:/Projects/AASHVO/docs/FINAL_SECURITY_REVIEW.md):** Threat modeling, Argon2id parameters, JWT refresh rotation, IDOR query defenses, Connect privacy boundaries, and Pino redaction.
- **[ENGINEERING_HARDENING_REPORT.md](file:///d:/Projects/AASHVO/docs/ENGINEERING_HARDENING_REPORT.md):** Consolidates all hardening findings, remediations applied, and accepted build-time risks.
- **[STAGING_SECURITY_REMEDIATION.md](file:///d:/Projects/AASHVO/docs/STAGING_SECURITY_REMEDIATION.md):** Security remediation plan for staging environment infrastructure.
- **[AUTHENTICATION_MIGRATION_PLAN.md](file:///d:/Projects/AASHVO/docs/AUTHENTICATION_MIGRATION_PLAN.md):** Transition from GoTrue to independent Argon2id password hashing and session tokens.
- **[AUTH_MIGRATION_FEASIBILITY.md](file:///d:/Projects/AASHVO/docs/AUTH_MIGRATION_FEASIBILITY.md):** Security and cryptographic feasibility assessment of backend authentication.

### 2.4 Performance, Bundle Optimization & Scalability
- **[PERFORMANCE_REVIEW.md](file:///d:/Projects/AASHVO/docs/PERFORMANCE_REVIEW.md):** Rollup manual chunking breakdown, bundle size metrics, image delivery optimization, and sub-15ms database query benchmarks.
- **[INFRASTRUCTURE_FINAL_DECISION.md](file:///d:/Projects/AASHVO/docs/INFRASTRUCTURE_FINAL_DECISION.md):** Architectural evaluation of compute, database, and caching hosting tiers.
- **[MANAGED_INFRASTRUCTURE_EVALUATION.md](file:///d:/Projects/AASHVO/docs/MANAGED_INFRASTRUCTURE_EVALUATION.md):** Comparative benchmark of AWS, Cloudflare, and serverless hosting providers.

### 2.5 Accessibility & Inclusive UX (WCAG 2.1 AA)
- **[ACCESSIBILITY_REVIEW.md](file:///d:/Projects/AASHVO/docs/ACCESSIBILITY_REVIEW.md):** WCAG 2.1 AA evaluation, color contrast ratios (Forest Green on Ivory: **12.4:1**), keyboard navigation, and modal WAI-ARIA 1.2 dialog semantics.

### 2.6 Software Supply Chain & Dependency Governance
- **[DEPENDENCY_REMEDIATION.md](file:///d:/Projects/AASHVO/docs/DEPENDENCY_REMEDIATION.md):** In-depth investigation of `zod`, `vite`, and `deepmerge-ts` advisories with remediation justifications.
- **[DEPENDENCY_CLEANUP_REPORT.md](file:///d:/Projects/AASHVO/docs/DEPENDENCY_CLEANUP_REPORT.md):** Audit of npm dependencies across root, contracts, and backend workspaces.

### 2.7 Aashvo Connect (Flatmate Discovery & Mutual Matching)
- **[AASHVO_CONNECT_PRODUCT_SPEC.md](file:///d:/Projects/AASHVO/docs/AASHVO_CONNECT_PRODUCT_SPEC.md):** Product specification for swipe-based flatmate discovery and 3 flatmate intentions.
- **[AASHVO_CONNECT_TECHNICAL_DESIGN.md](file:///d:/Projects/AASHVO/docs/AASHVO_CONNECT_TECHNICAL_DESIGN.md):** Data models, matching algorithms, compatibility scoring weights, and messaging gates.
- **[AASHVO_CONNECT_API_REFERENCE.md](file:///d:/Projects/AASHVO/docs/AASHVO_CONNECT_API_REFERENCE.md):** REST endpoints, DTO contracts, and error responses for `/api/v1/connect`.
- **[AASHVO_CONNECT_SECURITY_REVIEW.md](file:///d:/Projects/AASHVO/docs/AASHVO_CONNECT_SECURITY_REVIEW.md):** Threat modeling of flatmate discovery, anti-stalking safeguards, and PII masking.
- **[AASHVO_CONNECT_QA_REPORT.md](file:///d:/Projects/AASHVO/docs/AASHVO_CONNECT_QA_REPORT.md):** Test report for swipe operations, mutual match triggers, and chat threads.

### 2.8 Feature Expansion & Marketplace Operations
- **[FEATURE_EXPANSION_PRODUCT_SPEC.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_PRODUCT_SPEC.md):** Specifications for Smart Location Discovery, Property Verification Badges, Rent Split Calculator, Move-In Checklists, and In-Person Visits.
- **[FEATURE_EXPANSION_TECHNICAL_DESIGN.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_TECHNICAL_DESIGN.md):** Haversine spatial formulas, fair rent allocation mathematics, and digital handover checklists.
- **[FEATURE_EXPANSION_API_REFERENCE.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_API_REFERENCE.md):** REST contracts for locations, verifications, visits, and rental checklists.
- **[FEATURE_EXPANSION_SECURITY_REVIEW.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_SECURITY_REVIEW.md):** Verification document access control and private proof vault policies.
- **[FEATURE_EXPANSION_QA_REPORT.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_QA_REPORT.md):** Automated test results for feature expansion services.
- **[FEATURE_EXPANSION_RELEASE_REPORT.md](file:///d:/Projects/AASHVO/docs/FEATURE_EXPANSION_RELEASE_REPORT.md):** Sign-off on feature expansion deliverables.

### 2.9 Full-Stack Integration & End-to-End Persona Verification
- **[FULL_STACK_INTEGRATION_AUDIT.md](file:///d:/Projects/AASHVO/docs/FULL_STACK_INTEGRATION_AUDIT.md):** Audit of the unified REST client connecting frontend to NestJS backend.
- **[FRONTEND_BACKEND_MAPPING.md](file:///d:/Projects/AASHVO/docs/FRONTEND_BACKEND_MAPPING.md):** Exhaustive mapping of every frontend service method to NestJS controllers.
- **[END_TO_END_USER_JOURNEYS.md](file:///d:/Projects/AASHVO/docs/END_TO_END_USER_JOURNEYS.md):** 27 automated end-to-end user journeys executed across real personas.
- **[INTEGRATION_BLOCKERS.md](file:///d:/Projects/AASHVO/docs/INTEGRATION_BLOCKERS.md):** Verification that zero integration blockers remain.
- **[FULL_STACK_QA_REPORT.md](file:///d:/Projects/AASHVO/docs/FULL_STACK_QA_REPORT.md):** Comprehensive QA report across the entire integration testing suite.
- **[BACKEND_CONNECTIVITY_MATRIX.md](file:///d:/Projects/AASHVO/docs/BACKEND_CONNECTIVITY_MATRIX.md):** Service-to-service connectivity and health check definitions.
- **[BACKEND_IMPLEMENTATION_ROADMAP.md](file:///d:/Projects/AASHVO/docs/BACKEND_IMPLEMENTATION_ROADMAP.md):** Completed milestones for backend implementation.
- **[FRONTEND_API_TRANSITION_PLAN.md](file:///d:/Projects/AASHVO/docs/FRONTEND_API_TRANSITION_PLAN.md):** Frontend transition strategy from legacy stubs to REST.

### 2.10 Staging Environment, Infrastructure & Deployment Runbooks
- **[STAGING_ARCHITECTURE.md](file:///d:/Projects/AASHVO/docs/STAGING_ARCHITECTURE.md):** Staging cloud environment topology (Render/Fly/Railway compute + Supabase/Neon PostgreSQL).
- **[STAGING_DEPLOYMENT_RUNBOOK.md](file:///d:/Projects/AASHVO/docs/STAGING_DEPLOYMENT_RUNBOOK.md):** Step-by-step staging deployment instructions and health verification.
- **[STAGING_ENVIRONMENT_VARIABLES.md](file:///d:/Projects/AASHVO/docs/STAGING_ENVIRONMENT_VARIABLES.md):** Authoritative staging environment variable inventory.
- **[STAGING_ROLLBACK_PLAN.md](file:///d:/Projects/AASHVO/docs/STAGING_ROLLBACK_PLAN.md):** Rollback runbook covering compute, DNS, and database state reversals.
- **[STAGING_ACCEPTANCE_TEST_PLAN.md](file:///d:/Projects/AASHVO/docs/STAGING_ACCEPTANCE_TEST_PLAN.md):** Formal acceptance criteria and test scripts for staging clearance.
- **[STAGING_EXECUTION_APPROVAL_CHECKLIST.md](file:///d:/Projects/AASHVO/docs/STAGING_EXECUTION_APPROVAL_CHECKLIST.md):** Final checklist required prior to provisioning staging resources.
- **[STAGING_INFRASTRUCTURE_COST_ESTIMATE.md](file:///d:/Projects/AASHVO/docs/STAGING_INFRASTRUCTURE_COST_ESTIMATE.md):** Monthly cloud hosting and CDN operational expenditure projections.
- **[STORAGE_MIGRATION_PLAN.md](file:///d:/Projects/AASHVO/docs/STORAGE_MIGRATION_PLAN.md):** Migration plan for moving assets to Cloudflare R2 and AWS S3.

### 2.11 Legacy Supabase Status & Decoupling Strategy
- **[LEGACY_SUPABASE_STATUS.md](file:///d:/Projects/AASHVO/docs/LEGACY_SUPABASE_STATUS.md):** Exhaustive audit of all Supabase assets, air-gapped status, and rollback policy.
- **[REPOSITORY_CLEANUP_AUDIT.md](file:///d:/Projects/AASHVO/docs/REPOSITORY_CLEANUP_AUDIT.md):** Historical maintenance log of initial repository cleanup.

---

## 3. Archived Documentation Directory (`docs/archive/`)

The 68 archived documents in `docs/archive/` represent historical milestones:
- Initial Sprint Reports: `SPRINT_0` through `SPRINT_4` completion reports, contracts, and security audits.
- Master Release Audits: Initial release audits, deployment runbooks, and sign-off memos.
- Legacy Exploration: Early Supabase activation checklists, prototype SQL audits, and preliminary technical architecture stubs.

---

## 4. Documentation Maintenance Policy

When updating documentation:
1. **Never create duplicate sprint reports:** Update the authoritative core documents directly.
2. **Synchronize OpenAPI:** After altering DTOs in `@aashvo/contracts`, run `npm run api:openapi` to refresh `packages/contracts/openapi.json`.
3. **Verify Links:** Ensure all document references utilize standard Markdown format with relative or `file:///` URLs.

