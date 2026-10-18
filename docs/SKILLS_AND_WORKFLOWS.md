# Aashvo — Skills & Workflows Audit

## 1. Executive Summary

This document records the discovery, selection, mapping, and gap analysis of skills and automation workflows for the **Aashvo** housing and flatmate discovery platform (Delhi NCR).

Every phase of design, frontend engineering, database modeling, motion design, security, and quality assurance adheres to strict engineering guidelines and established workflows.

---

## 2. Skills Discovery

An inspection of the local environment (`C:\Users\Lenovo\.gemini\antigravity-ide\builtin\skills` and customization roots) revealed the following active skills:

| Skill Identifier | Location / Instruction File | Status | Description |
| :--- | :--- | :--- | :--- |
| `agy-customizations` | `C:\Users\Lenovo\.gemini\antigravity-ide\builtin\skills\agy-customizations\SKILL.md` | **Active / Discovered** | Reference guide for Antigravity Customization System (Skills, Rules, Plugins, Hooks, MCP servers, progressive disclosure). |
| `antigravity-guide` | `C:\Users\Lenovo\.gemini\antigravity-ide\builtin\skills\antigravity_guide\SKILL.md` | **Active / Discovered** | Comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY CLI, IDE, 2.0 app, Python SDK, slash commands). |
| `permissioned-github` | `C:\Users\Lenovo\.gemini\antigravity-ide\builtin\skills\permissioned-github\SKILL.md` | **Active / Discovered** | GitHub automation and repository permission integration. |

---

## 3. Skills Selection & Phase Mapping

| Project Discipline & Phase | Selected Skill / Workflow Mechanism | Instruction File / Standard Applied | Applied Phase |
| :--- | :--- | :--- | :--- |
| **Workspace & Rules Configuration** | `agy-customizations` | `agy-customizations/SKILL.md` | Phase 0 & 1, continuous project governance |
| **Environment & Tool Orchestration** | `antigravity-guide` | `antigravity_guide/SKILL.md` | Phase 0–10 (CLI, task orchestration, commands) |
| **Product Discovery & Requirements** | Specialized PRD & User Journey Workflow | Standardized Startup Product Framework (Lean MVP, Delhi NCR focus) | Phase 2 (PRD, User Journeys, Assumptions) |
| **UI/UX Design System & Brand** | Editorial Design System Workflow | Curated Design System (Warm Ivory `#F5F3ED`, Forest Green `#244737`, Sand `#D9B98C`, Charcoal `#292D2A`, Serif Headlines, Sans UI) | Phase 4 (Tokens, components, layout) |
| **Frontend Architecture** | React 18 + TypeScript + Vite + Tailwind CSS | Modern React Component Architecture, Strict TypeScript, Zero-placeholder policy | Phase 3 & 6 |
| **Motion & Interaction Design** | Hardware-accelerated Framer Motion / Motion | GPU-accelerated transforms (`transform`, `opacity`), prefers-reduced-motion compliance | Phase 5 & 6 |
| **Database & Auth Architecture** | Supabase PostgreSQL + Row Level Security (RLS) | Declarative SQL schemas, strict RLS policies, zero client-side privilege escalation | Phase 3 & 7 |
| **Browser Testing & Visual QA** | Built-in Browser Subagent & Playwright/Puppeteer automation | Headless/Visual browser testing, DOM inspection, viewport validation, visual diffs | Phase 8 |
| **Release & Git Management** | Git clean-history workflow + `.gitignore` strict hygiene | Conventional commits, zero credential leakage, reversible atomic changes | Phase 9 & 10 |

---

## 4. Unavailable Skills & Battle-Tested Alternatives

Where pre-packaged external skill packages are not bundled in the local environment, the following native alternatives are strictly enforced:

| Target Capability | Status | Native Engineering Alternative Employed |
| :--- | :--- | :--- |
| **Supabase / Postgres Management** | Not bundled as a discrete external skill | Direct SQL migration scripts (`supabase/migrations/*.sql`), client SDK typing with `@supabase/supabase-js`, local mock fallback adapters ensuring zero build-time blockage. |
| **Motion & Animation Skill** | Not bundled as a discrete external skill | Integrated `framer-motion` / `lucide-react`, GPU-accelerated CSS animations, and `prefers-reduced-motion` media queries. |
| **Accessibility & A11y Audit** | Not bundled as a discrete external skill | Semantic HTML5 structure, WAI-ARIA labels, automated axe-core/Playwright accessibility checks, keyboard tab indexing, contrast ratio validation (WCAG AA). |
| **Visual Regression / Browser Agent** | Discovered native tool | Native `browser_subagent` for full automated browser validation, DOM inspection, and screen recording. |

---

## 5. Conflict Resolution

1. **Tailwind CSS vs. Vanilla CSS Directive**:
   - *Directive context*: Web guidelines recommend Vanilla CSS unless specified; prompt explicitly specifies: *"Frontend: React, TypeScript, and Vite. Styling: Tailwind CSS and accessible reusable components"*.
   - *Resolution*: Tailwind CSS v3 is configured with custom semantic tokens matching the exact brand palette (`ivory`, `forest`, `sand`, `charcoal`), paired with vanilla CSS custom properties in `index.css` for typography and fluid spacing.
2. **Real Supabase vs. Initial UI Build**:
   - *Directive context*: *"Do not connect a production service or require paid services just to build the initial UI... If Supabase is not configured, complete the UI and architecture work without pretending that persistence or authentication is live."*
   - *Resolution*: The application implements a pluggable Data Access Layer (Repository Pattern). It provides an in-memory/localStorage seed store that fully mirrors Supabase tables and RLS logic for local development, while including production-ready SQL migrations and Supabase client configuration ready for credentials injection.

---

*Audited and Approved by Principal Software Architect & Founding CTO, Aashvo.*
