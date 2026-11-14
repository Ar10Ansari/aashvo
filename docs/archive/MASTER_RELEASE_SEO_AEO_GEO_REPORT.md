# AASHVO — MASTER RELEASE SEO, AEO & GEO AUDIT REPORT
## Search Engine, Answer Engine & Generative Engine Optimization Architecture

**Author:** CTO & Lead Product Architect  
**Project:** AASHVO Platform (`https://aashvo.vercel.app`)  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  
**Search Discovery Verdict:** **FULLY OPTIMIZED ACROSS CRAWLERS & AI DISCOVERY ENGINES**

---

## 1. DISCOVERY ASSETS ARCHITECTURE

### A. Sitemap Architecture (`public/sitemap.xml`)
Includes 13 canonical, high-priority URLs covering national hubs and marketplace search corridors:
1. `https://aashvo.vercel.app/` (Priority: 1.0, daily)
2. `https://aashvo.vercel.app/#flats` (Priority: 0.9, daily)
3. `https://aashvo.vercel.app/#flatmates` (Priority: 0.9, daily)
4. `https://aashvo.vercel.app/#family-stays` (Priority: 0.85, daily)
5. `https://aashvo.vercel.app/city/bangalore` (Priority: 0.8, weekly)
6. `https://aashvo.vercel.app/city/gurugram` (Priority: 0.8, weekly)
7. `https://aashvo.vercel.app/city/mumbai` (Priority: 0.8, weekly)
8. `https://aashvo.vercel.app/city/pune` (Priority: 0.8, weekly)
9. `https://aashvo.vercel.app/city/hyderabad` (Priority: 0.8, weekly)
10. `https://aashvo.vercel.app/city/delhi` (Priority: 0.8, weekly)
11. `https://aashvo.vercel.app/city/noida` (Priority: 0.8, weekly)
12. `https://aashvo.vercel.app/safety` (Priority: 0.7, monthly)
13. `https://aashvo.vercel.app/help` (Priority: 0.7, monthly)

### B. Robots Policy (`public/robots.txt`)
Configured to allow compliant search crawlers (Googlebot, Bingbot) and generative AI engines (ChatGPT-User, Claude-Web, PerplexityBot, Gemini):
```txt
User-agent: *
Allow: /
Allow: /llms.txt
Allow: /sitemap.xml

Sitemap: https://aashvo.vercel.app/sitemap.xml
```

### C. Generative Engine Optimization Specification (`public/llms.txt`)
Provides structured, factual context designed specifically for LLM citation and retrieval engines:
- Clear definition: *"AASHVO is India's verified student and young professional accommodation marketplace."*
- Core differentiators: Zero brokerage, verified tenancy agreements, digital move-in inspections, home-cooked meal policies in Family Stays, adult flatmate compatibility.
- Technical parameters: Indian Rupee (INR) pricing, major education and tech IT hubs (Koramangala, DLF Cyber City, Powai, Hinjewadi, HITEC City).

---

## 2. STRUCTURED DATA & SCHEMA.ORG JSON-LD

Implemented in `index.html` with multi-node linked entities:

1. **`Organization` Schema:**
   - Formal entity name, official URL, logo link, customer service contact phone, founders.
2. **`WebSite` Schema:**
   - Includes `potentialAction` of type `SearchAction` enabling Google Sitelinks Search Box directly targeting `/search?q={query}`.
3. **`FAQPage` Schema:**
   - Pre-indexes high-intent consumer questions:
     - *"Is AASHVO zero brokerage?"* -> Explicitly confirmed.
     - *"What are Family Stays?"* -> Explains host family residency and home-cooked meals.
     - *"How does the Rental Trust system protect tenants and landlords?"* -> Details digital move-in condition inspections and dispute mediation.

---

## 3. OPEN GRAPH & SOCIAL METADATA

- `og:title`: `AASHVO — Verified Accommodation & Flatmates Across India`
- `og:description`: `Zero-brokerage student housing, verified flats, flatmate matching, and authentic family stays across India's top university and IT hubs.`
- `og:type`: `website`
- `og:url`: `https://aashvo.vercel.app`
- `twitter:card`: `summary_large_image`
- Viewport: Strict mobile responsive viewport with `maximum-scale=5.0` for full accessibility compliance.

---

## 4. LOCAL SEARCH & GEOGRAPHIC KEYWORD STRATEGY

The application indexes 10 high-demand student and tech employment corridors in India:
- **Bengaluru:** Koramangala, HSR Layout, Indiranagar, Whitefield, Electronic City.
- **Gurugram:** DLF Cyber City, Sector 43, Golf Course Extension, Sohna Road.
- **Mumbai:** Powai, Bandra West, Andheri East, Lower Parel.
- **Pune:** Hinjewadi, Viman Nagar, Kothrud, Baner.
- **Hyderabad:** HITEC City, Gachibowli, Madhapur, Kondapur.
- **Delhi / NCR:** North Campus (DU), South Campus, Saket, Noida Sector 62.

All regional search corridors map directly to backend database locality queries using indexed array matching.

