# Aashvo — Sprint Implementation Plan

**Scope:** End-to-End MVP Implementation across 6 Sprints  
**Status:** In Progress  

---

## Sprint Overview

- **Sprint 1: Foundation & Brand Experience**
  - Scaffold Vite + React 18 + TypeScript + Tailwind CSS project structure.
  - Establish design tokens (Warm Ivory `#F5F3ED`, Forest Green `#244737`, Sand `#D9B98C`, Charcoal `#292D2A`).
  - Implement Editorial Typography (Serif Headlines, Sans UI).
  - Build responsive Navigation header with wordmark and quick actions.
  - Build Centered Hero with headline, supporting copy, interactive search bar, and architectural landscape.
  - Build listing freshness and transparent-cost highlight section.
  - Run initial build and TypeScript quality checks.

- **Sprint 2: Property Discovery & Cost Transparency**
  - Seed high-fidelity Delhi NCR listings (Gurugram DLF Phases, Cyber City, Saket, Hauz Khas).
  - Build PropertyCard with image gallery, verified badges, owner/broker tags, and freshness timestamps.
  - Implement real-time multi-dimensional search & filtering (Locality, Budget slider, Room type, Furnishing, Owner vs Broker).
  - Build rich Property Detail Modal with full financial transparency breakdown (Rent, Security Deposit, Maintenance, Electricity per unit, Brokerage).
  - Handle loading, populated, and empty search results gracefully.

- **Sprint 3: Authentication & Listing Management**
  - Build Auth modal with seamless Renter / Owner / Broker login simulation and Supabase readiness.
  - Create 5-step guided Property Listing Creation Wizard with photo upload simulation, amenity selection, rule configuration, and transparent pricing inputs.
  - Implement Provider Dashboard allowing users to edit, pause, and track moderation status of their listings.

- **Sprint 4: Flatmate Discovery & Compatibility Matching**
  - Seed authentic student and young professional flatmate profiles in Delhi NCR.
  - Build FlatmateCard with lifestyle badges (Diet, Routine, Cleanliness, Pets, Guest policy).
  - Implement Flatmate filtering (Gender preference, Budget, Locality, Has Room vs Needs Room).
  - Build interactive "Send Interest / Connect Request" flow with personalized introductory message.

- **Sprint 5: Admin Moderation, Safety & Reporting**
  - Build Admin Moderation Console.
  - Listing review queue: One-click Approve, Request Changes, or Reject.
  - Report listing modal with actionable violation codes.
  - Manage freshness timestamps and owner/broker enforcement.

- **Sprint 6: Quality Gates, E2E Browser Testing & Release Documentation**
  - Full TypeScript strict validation.
  - Production bundle compilation (`npm run build`).
  - Automated browser agent inspection across desktop and mobile viewports.
  - Performance, accessibility, and visual audit against brand specifications.
  - Update `docs/DEVELOPMENT_LOG.md` and `README.md`.
