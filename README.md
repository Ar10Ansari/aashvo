# Aashvo — Find your place. Find your people.

> **Pan-India website-first discovery platform for verified rooms, flats, and flatmates.**  
> Built with radical financial transparency, zero phantom listings, and verified co-living safety.

---

## 🏛️ Brand & Design Direction

- **Brand:** `aashvo`
- **Tagline:** *Find your place. Find your people.*
- **Hero Headline:**  
  *“A better way to call a place home.”*
- **Supporting Promise:**  
  *“Find rooms, flats and flatmates that fit your life and your budget. Simple. Safe. Built for real people.”*
- **Aesthetics & Palette:**
  - **Warm Ivory:** `#F5F3ED` (Editorial canvas & warmth)
  - **Forest Green:** `#244737` (Primary brand accent & stability)
  - **Sand:** `#D9B98C` (Architectural highlights & badges)
  - **Deep Charcoal:** `#292D2A` (Crisp typographic contrast)
  - **Typography:** *Playfair Display* (Editorial Serif) paired with *Plus Jakarta Sans* (Clean UI Sans)
  - **Architectural Landscape:** Custom vector SVG anchored at the hero base

---

## 🚀 Core Features & User Journeys

1. **Find a Place:**
   - Multi-dimensional filtering by Locality (*Gurugram DLF Phases 1-5, Cyber City, Sector 43/54, South Delhi Saket, Hauz Khas, Malviya Nagar*), Budget, Room Type (*Private Room, Shared Room, Entire Flat*), Furnishing, and Provider Type.
   - **Itemized Cost Transparency:** Complete upfront disclosure of Monthly Rent, Security Deposit, Society Maintenance, Electricity per-unit rate, and Brokerage fee (with estimated 1st month outlay calculator).
   - **Verified Freshness Badges:** Real-time indication of when availability was confirmed by the provider.

2. **Find a Flatmate:**
   - Verified student & young professional profiles with living compatibility dimensions (Diet/Food habits, Sleep schedule, Cleanliness standards, Pet friendliness, Smoking policy).
   - Distinguishes between flatmates who already have a room available vs. those seeking to team up.
   - Gated, privacy-shielded connect requests with custom introductory notes.

3. **List a Property (Owner & Manager Wizard):**
   - 5-step guided wizard: Property details, transparent financial breakdown, amenities & house rules, photo uploads, and provider identity declaration (*Direct Owner ₹0 fee vs Current Flatmate vs Declared Manager*).

4. **Safety & Editorial Moderation Console:**
   - Live administrative review console allowing one-click approval, pausing, and status updates for inventory and community violation reports.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS (Custom HSL/Hex brand design tokens)
- **Icons:** `lucide-react`
- **Animation:** `framer-motion` & GPU-accelerated CSS transforms (`prefers-reduced-motion` compliant)
- **Database Architecture:** PostgreSQL via Supabase with Row Level Security (RLS) policies
- **Architecture Pattern:** Repository Pattern (Seamless local deterministic store for zero-blocker development + production Supabase adapter)

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js `v18+` (Tested on `v24.15.0`)
- npm `v9+` (Tested on `v11.12.1`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
Validates strict TypeScript types (`tsc --noEmit`) and compiles the optimized bundle into `dist/`.

---

## 📚 Architectural & Product Documentation

Full technical, design, and product documentation is available in the [`docs/`](./docs) directory:
- [`docs/SKILLS_AND_WORKFLOWS.md`](./docs/SKILLS_AND_WORKFLOWS.md) — Discovered skills, audit, and workflow mappings.
- [`docs/PRODUCT_REQUIREMENTS.md`](./docs/PRODUCT_REQUIREMENTS.md) — Product requirements, personas, and MVP scope.
- [`docs/USER_JOURNEYS.md`](./docs/USER_JOURNEYS.md) — Detailed user journeys and experience diagrams.
- [`docs/COMPETITOR_AND_ASSUMPTIONS.md`](./docs/COMPETITOR_AND_ASSUMPTIONS.md) — Competitor matrix, Delhi NCR assumptions, and validation checklist.
- [`docs/TECHNICAL_ARCHITECTURE.md`](./docs/TECHNICAL_ARCHITECTURE.md) — System architecture, design tokens, and state flow.
- [`docs/DATABASE_DESIGN.md`](./docs/DATABASE_DESIGN.md) — Database schema, ER diagram, and RLS security model.
- [`docs/SECURITY_AND_PRIVACY.md`](./docs/SECURITY_AND_PRIVACY.md) — Threat model, phone masking, and data protection.
- [`docs/TEST_STRATEGY.md`](./docs/TEST_STRATEGY.md) — Quality gates, test matrix, and verification plan.
- [`docs/SPRINT_PLAN.md`](./docs/SPRINT_PLAN.md) — 6-sprint implementation schedule.
- [`docs/DEVELOPMENT_LOG.md`](./docs/DEVELOPMENT_LOG.md) — Continuous changelog of engineering decisions and verifications.
- [`supabase/migrations/20261018000000_initial_schema.sql`](./supabase/migrations/20261018000000_initial_schema.sql) — Production PostgreSQL DDL and RLS security policies.

---

## 🔒 Security & Privacy Notice
Aashvo implements strict privacy by design. Phone numbers are never exposed in public DOM or API endpoints without authenticated mutual consent. No secret credentials are committed to version control.
