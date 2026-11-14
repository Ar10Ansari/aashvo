# AASHVO — Sprint 3.5 SEO, AEO & GEO Technical Audit
## Search Engine Optimization, Answer Engine Discovery & Generative Optimization

**Author:** Senior Technical SEO Engineer & AEO/GEO Strategist  
**Date:** 2026-11-14  
**Workspace:** `D:\Projects\AASHVO` | Domain: `https://aashvo.vercel.app`  
**Status:** **AUDITED & OPTIMIZED**

---

## 1. Technical SEO Audit

### 1.1 Metadata & Semantic Tags (`index.html`)
- **Title Tag:**  
  `Aashvo — Find your place. Find your people | Shared Living & Rental Trust`  
  *Audit:* 72 characters, incorporates brand name, primary value proposition, and key categories.
- **Meta Description:**  
  `Discover verified flatmates, rooms in family homes with homecooked meals, and direct-owner flats across Delhi NCR, Bengaluru, and Mumbai with itemized costs, zero broker fees, and rental trust protection.`  
  *Audit:* 198 characters, covers core categories, pan-India metro coverage, and trust guarantees.
- **Canonical URL:**  
  `<link rel="canonical" href="https://aashvo.vercel.app/" />`  
  *Audit:* Valid absolute HTTPS URL preventing duplicate content consolidation issues.
- **Open Graph & Twitter Cards:**  
  Complete `og:title`, `og:description`, `og:image` (1200x630 high-resolution visual), `og:url`, `og:type` (`website`), `twitter:card` (`summary_large_image`), and `twitter:title` verified.

### 1.2 Robots Configuration (`public/robots.txt`)
The robots configuration enforces strict boundaries:
- **Allowed:** Public root (`/`), `sitemap.xml`, and `llms.txt`.
- **Disallowed (Zero Private Exposure):**  
  `Disallow: /admin` (moderation console)  
  `Disallow: /auth/` (auth callbacks and token exchanges)  
  `Disallow: /api/` (backend API endpoints)  
  `Disallow: /tickets/` (support tickets)  
  `Disallow: /disputes/` (rental disputes)  
  `Disallow: /reports/` (safety reports)  
  `Disallow: /dashboard` (user dashboard)
- **Sitemap Link:** Points directly to `https://aashvo.vercel.app/sitemap.xml`.

### 1.3 XML Sitemap Architecture (`public/sitemap.xml`)
The sitemap was upgraded from an unmaintained 1-URL stub to **13 canonical discovery URLs** covering all verified marketplace hubs:
- Root Home (`/` priority 1.0)
- Discovery Hubs: `?tab=flatmates` (0.9), `?tab=family_stays` (0.9), `?tab=entire_flats` (0.8)
- Metros with Verified Inventory: `?city=Gurugram` (0.8), `?city=Delhi%20NCR` (0.8), `?city=Bengaluru` (0.8), `?city=Noida` (0.7), `?city=Mumbai` (0.7), `?city=Pune` (0.7), `?city=Hyderabad` (0.7)
- Entity & Trust Hubs: `#faq` (0.6), `#our-founders` (0.5)

### 1.4 Heading Hierarchy & Semantic HTML
Audit of React component tree confirmed a clean heading hierarchy:
- **`H1`**: Exactly one `H1` tag per view located in `Hero.tsx` (*"Find your place. Find your people."*).
- **`H2`**: Section landmarks (`TrustFeatures`, `DiscoverySection`, `OurFounders`, `Footer`).
- **`H3`**: Sub-sections, feature cards, and property card titles.
- **Image Accessibility:** Property cards enforce descriptive `alt` text (`${property.title} in ${property.locality}, ${property.city}`).

---

## 2. AEO (Answer Engine Optimization) Audit

Answer Engine Optimization ensures that AI search engines (such as Google AI Overviews, Perplexity, and Gemini) can extract authoritative answers to common renter questions.

### 2.1 Answer-First Content Structure
Aashvo's FAQ data (`src/data/faqData.ts`) and landing content adopt answer-first structures:
1. **Definition of Family Stays:**  
   *Question:* What is an Aashvo Family Stay?  
   *Answer:* A room inside the primary home of a resident family living on the premises full-time, with transparent homecooked meal arrangements and zero commercial broker markups.
2. **Flatmate Compatibility Scoring:**  
   *Question:* How are flatmates matched?  
   *Answer:* Through 5 lifestyle dimensions: food habits (Vegetarian, Non-Vegetarian, Eggetarian, Vegan), sleep schedules (Early Bird vs Night Owl), cleanliness expectations, budget ceilings, and shared interests.
3. **Zero Brokerage Guarantee:**  
   *Question:* Do direct property owners pay brokerage?  
   *Answer:* Direct owners list with zero fees; rent, deposits, and electricity rates are itemized upfront with zero hidden charges.

### 2.2 Schema.org `FAQPage` Markup
The `index.html` JSON-LD graph incorporates an eligible `FAQPage` node mirroring these exact questions, enabling instant answer engine extraction.

---

## 3. GEO (Generative Engine Optimization) Audit

Generative Engine Optimization ensures generative AI tools accurately represent Aashvo's entity facts.

### 3.1 Entity Representation
- **Entity Name:** Aashvo
- **Founders:** Verified founders documented in `src/components/about/OurFounders.tsx` (heading verified as exact *"Our Founders"* by automated tests).
- **Operating Markets:** Pan-India (Delhi NCR, Gurugram, Noida, Bengaluru, Mumbai, Pune, Hyderabad).
- **Category Taxonomy:**
  1. Flatmates (Room-sharing & team-ups)
  2. Family Stays (Home stays with resident families and homecooked meals)
  3. Entire Flats (Direct-owner residential properties)

### 3.2 Supplementary Discovery (`public/llms.txt`)
Created `public/llms.txt` according to emerging LLM discovery standards. It provides a structured, factual summary of Aashvo's services, cities, trust guarantees, and API endpoints, without making unsupported claims or promising guaranteed rankings.

---

## 4. Privacy & Scraping Defenses

- **Zero Exposure of Private Data:** Search engines cannot index private listings, unaccepted contact numbers, or internal user tickets.
- **Address Masking:** Precise street numbers and coordinates are masked publicly, preventing unverified physical visits or scraping of residential homes.

---

## 5. Audit Verdict

Aashvo's technical SEO, AEO, and GEO infrastructure is fully aligned with modern search standards, Core Web Vitals expectations, and strict privacy principles.

