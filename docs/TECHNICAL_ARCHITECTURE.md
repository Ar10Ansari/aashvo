# Aashvo — Technical Architecture & System Design

**Version:** 1.0.0  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Supabase (PostgreSQL)  
**Architect:** Founding CTO, Aashvo  

---

## 1. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AASHVO WEB CLIENT (React 18)                    │
│                                                                        │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │  Header & Brand  │  │  Hero Discovery  │  │ Cost Transparency  │   │
│   └──────────────────┘  └──────────────────┘  └────────────────────┘   │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │ Property Search  │  │ Flatmate Matcher │  │ Listing Submission │   │
│   └──────────────────┘  └──────────────────┘  └────────────────────┘   │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │   Admin Review   │  │   Auth / Profile │  │ Toast & Modals UI  │   │
│   └──────────────────┘  └──────────────────┘  └────────────────────┘   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                        Pluggable Repository Layer
                     (IDataService / DataContext)
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌───────────────────────────┐                      ┌─────────────────────┐
│    Local Mock Store       │                      │  Supabase Client    │
│  (In-Memory / LocalStorage│                      │  (PostgreSQL + RLS  │
│  Deterministic Test Data) │                      │   Auth + Storage)   │
└───────────────────────────┘                      └─────────────────────┘
```

---

## 2. Directory Structure Conventions

```
d:/Projects/AASHVO/
├── .github/                 # CI/CD workflows and issue templates
├── docs/                    # Architectural and product documentation
│   ├── SKILLS_AND_WORKFLOWS.md
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── USER_JOURNEYS.md
│   ├── COMPETITOR_AND_ASSUMPTIONS.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── DATABASE_DESIGN.md
│   ├── SECURITY_AND_PRIVACY.md
│   ├── TEST_STRATEGY.md
│   ├── SPRINT_PLAN.md
│   └── DEVELOPMENT_LOG.md
├── public/                  # Static assets and favicons
├── src/
│   ├── assets/              # SVG illustrations, architectural graphics, brand marks
│   ├── components/
│   │   ├── admin/           # Moderation queue, report logs, status triggers
│   │   ├── auth/            # Sign in, Sign up, User Profile modal
│   │   ├── flatmate/        # Flatmate card, lifestyle chips, compatibility view
│   │   ├── layout/          # Navbar, Footer, Container, Page Layout
│   │   ├── listing/         # 5-step listing submission wizard, image uploader
│   │   ├── motion/          # Framer Motion transitions, stagger wrappers
│   │   ├── property/        # Property card, detail modal, cost calculator, filters
│   │   └── ui/              # Button, Input, Modal, Badge, Dropdown, Tabs
│   ├── context/             # Global Auth, Filter, and Data Contexts
│   ├── data/                # Seed properties and flatmates for Delhi NCR
│   ├── hooks/               # Custom reusable hooks (useMediaQuery, useDebounce)
│   ├── services/            # Supabase API client and fallback local store
│   ├── styles/              # Global CSS, Tailwind extensions, typography
│   ├── types/               # TypeScript interfaces and domain models
│   ├── utils/               # Currency formatters, date freshness calculators
│   ├── App.tsx              # Main orchestrator with stateful views
│   └── main.tsx             # React entry point
├── supabase/
│   └── migrations/          # Declarative PostgreSQL DDL + RLS scripts
├── index.html               # Semantic HTML5 entry with meta SEO
├── tailwind.config.js       # Brand color palette and font definitions
├── tsconfig.json            # Strict TypeScript compilation rules
└── vite.config.ts           # Fast HMR Vite build configuration
```

---

## 3. Brand Identity & Design Tokens

### Color Palette (Mandatory Approved Direction)
- **Warm Ivory:** `#F5F3ED` — Background canvas, soft card fills, editorial warmth.
- **Forest Green:** `#244737` — Primary brand color, headers, CTAs, badge accents.
- **Sand / Camel:** `#D9B98C` — Subtle warm borders, highlighting, secondary badges.
- **Deep Charcoal:** `#292D2A` — High-contrast typography, crisp borders, dark accents.
- **Accent Olive / Sage:** `#4A6B5D` — Hover states, soft secondary fills.
- **Warning Gold / Amber:** `#D97706` — Pending review tags.
- **Freshness Emerald:** `#15803D` — "Active Today" verified badge.

### Typography
- **Headlines / Display:** `Playfair Display` or `Fraunces` (Editorial Serif) — Sophisticated, warm, architectural.
- **Body & UI:** `Plus Jakarta Sans` / `Inter` (Sans-Serif) — Crisp readability, clean metrics.

---

## 4. State Management & Data Flow

1. **DataContext:** Central reactive store implementing:
   - `properties: Property[]`
   - `flatmates: Flatmate[]`
   - `reports: Report[]`
   - `filters: PropertyFilterState`
   - `activeView: 'home' | 'places' | 'flatmates' | 'list-property' | 'admin'`
   - CRUD actions: `addProperty()`, `updatePropertyStatus()`, `submitReport()`, `submitInterest()`
2. **AuthContext:**
   - Active user session (`id`, `name`, `email`, `role: 'renter' | 'owner' | 'broker' | 'admin'`)
   - Persistent login state (session storage / Supabase session token)
3. **Pluggable Backend Adapter:**
   - Detects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - If present: interacts with live Supabase client.
   - If absent: gracefully falls back to deterministic local storage with zero console errors or blank screens.
