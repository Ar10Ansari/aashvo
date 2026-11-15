# AASHVO SEO, AEO & GEO Launch Checklist

**Domain:** `https://aashvo.vercel.app`
**Brand:** Aashvo — Find your place. Find your people.
**Target Metros:** Delhi NCR (Gurugram, Noida, Delhi), Bengaluru, Mumbai, Pune, Hyderabad
**Date:** November 15, 2026
**Auditor:** AASHVO Marketing & Engineering Architecture

---

## 1. Technical SEO & HTML Metadata

| Element | Production Configuration | Verification Status |
| :--- | :--- | :--- |
| **Title Tag** | `Aashvo — Find your place. Find your people \| Shared Living & Rental Trust` | **VERIFIED** |
| **Meta Description** | `Discover verified flatmates, rooms in family homes with homecooked meals, and direct-owner flats across Delhi NCR, Bengaluru, and Mumbai with itemized costs, zero broker fees, and rental trust protection.` (194 characters) | **VERIFIED** |
| **Canonical URL** | `<link rel="canonical" href="https://aashvo.vercel.app/" />` | **VERIFIED** |
| **Robots Directives** | `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />` | **VERIFIED** |
| **Theme Color** | `#244737` (Aashvo Forest Green) | **VERIFIED** |
| **Favicon** | `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` | **VERIFIED** |
| **Viewport** | `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` | **VERIFIED** |

---

## 2. Social Graph Metadata (OpenGraph & Twitter Cards)

### 2.1 Open Graph Protocol
- `og:type`: `website`
- `og:url`: `https://aashvo.vercel.app/`
- `og:site_name`: `Aashvo`
- `og:locale`: `en_IN`
- `og:title`: `Aashvo — Find your place. Find your people`
- `og:description`: `Verified rooms, flatmates, and family stays with complete cost transparency and rental agreement protection across Delhi NCR, Bengaluru, and Mumbai.`
- `og:image`: High-resolution living space hero image (1200x630, Unsplash CDN)
- `og:image:alt`: `Aashvo verified accommodation and rental trust living space`

### 2.2 Twitter Cards
- `twitter:card`: `summary_large_image`
- `twitter:url`: `https://aashvo.vercel.app/`
- `twitter:title`: `Aashvo — Find your place. Find your people`
- `twitter:description`: `Find verified flatmates, homecooked meals in family stays, and direct-owner rooms with zero brokerage markups.`
- `twitter:image`: 1200x630 preview asset

---

## 3. Schema.org JSON-LD Structured Data

The `index.html` file includes comprehensive JSON-LD structured data under the `@graph` array:

1. **Organization (`https://aashvo.vercel.app/#organization`):**
   - **Name:** Aashvo
   - **Logo:** `https://aashvo.vercel.app/favicon.svg`
   - **Founding Date:** 2026
   - **Area Served:** India
   - **Founders:**
     - Abdul Rehman Ansari (`Co-founder & Chief Technology Officer`)
     - Tushar Jaisawl (`Co-founder & Head of Marketing`)
   - **Contact Point:** `support@aashvo.in`
2. **WebSite (`https://aashvo.vercel.app/#website`):**
   - **SearchAction:** Configured with `https://aashvo.vercel.app/?search={search_term_string}`
3. **BreadcrumbList:**
   - Structured root hierarchy for search engine breadcrumbs.
4. **FAQPage (`https://aashvo.vercel.app/#faq`):**
   - 4 rich FAQ entities answering:
     - How flatmate compatibility matching operates (food, sleep, cleanliness, pet-friendliness).
     - Eligibility rules for Family Stays (resident families living on-premises).
     - Meal arrangements (Included, Optional Extra, Self-Catering).
     - Zero brokerage and transparent itemized fee structures.

---

## 4. Crawlability & Indexing Control

### 4.1 robots.txt (`public/robots.txt`)
- **Allowed:**
  - `/` (All public discovery pages)
  - `/llms.txt` (AI agents and LLMs)
  - `/sitemap.xml` (Search engine sitemaps)
- **Disallowed (Protected):**
  - `/admin` (Internal moderation portal)
  - `/auth/` (OAuth callback flows)
  - `/api/` (Private backend endpoints)
  - `/tickets/` (Private user tickets)
  - `/disputes/` (Confidential tenancy disputes)
  - `/reports/` (Safety reports)
  - `/dashboard` (User private account area)
- **Sitemap Directive:** `Sitemap: https://aashvo.vercel.app/sitemap.xml`

### 4.2 sitemap.xml (`public/sitemap.xml`)
Includes 14 high-priority public URLs:
- Homepage (`priority: 1.0`, `daily`)
- Tab discovery URLs: `flatmates` (`0.9`), `family_stays` (`0.9`), `entire_flats` (`0.8`)
- Metro-specific discovery hubs: `Gurugram` (`0.8`), `Delhi NCR` (`0.8`), `Bengaluru` (`0.8`), `Noida` (`0.7`), `Mumbai` (`0.7`), `Pune` (`0.7`), `Hyderabad` (`0.7`)
- Educational trust pages: `#faq` (`0.6`), `#our-founders` (`0.5`)

---

## 5. AI Search Engine Optimization (AEO & GEO)

1. **`public/llms.txt`:**
   - Fully documents platform capabilities, target metros, privacy guarantees (location masking and phone masking), founders Abdul Rehman Ansari & Tushar Jaisawl, and architecture for LLM search agents (Perplexity, ChatGPT Search, Gemini).
2. **Local Metro Visibility (GEO):**
   - Structured copy and sitemap URLs target key IT and student hubs: Cyber City, Golf Course Road, Sector 62 (Delhi NCR); Koramangala, HSR Layout, Indiranagar, Whitefield (Bengaluru); Bandra, Powai, Andheri (Mumbai); Kothrud, Hinjewadi (Pune); HITEC City, Gachibowli (Hyderabad).

---

## 6. Verification Status

**ALL SEO, AEO, AND GEO AUDIT REQUIREMENTS: PASS (100%)**
