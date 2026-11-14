# Aashvo — Product & Technical Roadmap

**Version:** 2.1.0-ConfirmedHierarchy  
**Lead:** Founding CTO & Product Architecture, Aashvo  
**Business Positioning:** Pan-India Affordable-Living Platform for Students and Working Professionals  
**Brand Tagline:** *Find your place. Find your people.*

---

## 1. Confirmed Product Hierarchy & Living Experience Architecture

```
[Aashvo Core Marketplace Platform]
  │
  ├── PRIMARY FEATURE A: Flatmates & Roommates
  │     ├── People seeking compatible flatmates to team up for a home
  │     ├── People with a vacant room seeking a compatible roommate
  │     ├── People seeking a private or shared room in an existing flat
  │     └── Lifestyle compatibility: food habits, sleep routines, cleanliness, guests
  │
  ├── PRIMARY FEATURE B: Affordable Family Stays (Resident Host Homes)
  │     ├── Strict eligibility: Resident families living in the same home ONLY
  │     ├── Prohibited: Non-resident landlords, commercial brokers, managers, PG agencies
  │     ├── Canonical meal models: 'included' in rent, 'optional_extra', or 'none' (self-catering)
  │     └── Transparent cost breakdowns: zero double-counting of included food costs
  │
  └── SECONDARY FEATURE C: Entire Flats & Apartments
        ├── Independent flats and apartments for eligible owners/verified managers
        ├── Transparent upfront brokerage disclosure (₹0 for owners)
        └── Full itemized move-in outlays preserved without dominating the platform
```

---

## 2. Confirmed 9-Stage Implementation Sequence

The implementation sequence prioritizes technical security, database integrity, and primary product workflows before secondary features and marketplace optimization:

| Priority | Implementation Stage | Core Technical Deliverables | Security & Quality Gates |
| :---: | :--- | :--- | :--- |
| **1** | **Real Supabase Connection & Database Foundation** | Provision AWS Mumbai (`ap-south-1`) Supabase instance, apply SQL migrations (`20261018`, `20261019`, `20261020`), configure strict search_path, RLS, and secure connection pooling. | Zero public table grants without RLS; verify anti-tampering triggers against malicious SQL/REST calls. |
| **2** | **Real Authentication & Progressive Profiles** | Google OAuth Client ID integration, Email/Password sign-up with cryptographic verification links, secure session cookies, progressive profile completion engine (phone verification requested strictly at protected contact/listing points). | Public browsing without auth; JWT role claims enforced server-side; zero client-controlled role elevation. |
| **3** | **Secure Listing Persistence & Photo Storage** | Supabase Storage bucket (`property-photos`) with 5MB file cap, strict MIME validation, user-folder isolation, secure presigned URLs, and public address masking (hiding door/flat numbers and private GPS coordinates). | Server-side MIME validation; prevention of arbitrary binary uploads; zero public exposure of private addresses. |
| **4** | **Flatmate & Roommate Discovery (Primary A)** | Flatmate profile creation, room-offer vs room-seeking toggle, multi-dimensional lifestyle filters (dietary/food habits, sleep schedule, cleanliness, guest policy, budget ceiling, target clusters). | Distinction between flatmate profiles and property listings; verified phone barrier prior to connection requests. |
| **5** | **Family Stays with Meal Options (Primary B)** | Resident-family host portal, mandatory co-living declaration (`chk_family_stay_eligibility`), meal configuration (`included`, `optional_extra`, `none`), move-in outlay calculator with zero double-counting of meals. | Prohibit non-resident landlords and brokers at database level; verify rental cost calculation formulas. |
| **6** | **Nationwide Location Search & Assisted Geolocation** | Option A (Current device GPS via `navigator.geolocation` with permission denial and timeout fallbacks) + Option B (Manual selection by Indian State/UT, City, Locality, PIN Code). | GPS permission denial handled seamlessly; zero hardcoded Delhi NCR restrictions; privacy masking on public views. |
| **7** | **Inquiry Workflows, Moderation & Operational Safety** | WhatsApp/Email inquiry notifications, 14-day availability reconfirmation cycle, community report submission, admin moderation console for listing suspension. | Direct provider phone numbers masked until inquiry verification; audited moderation log. |
| **8** | **Matching Engine, Notifications & Marketplace Analytics** | Lifestyle compatibility scoring algorithm, WhatsApp Business API webhooks for freshness checks, tenant-host match alerts. | Encrypted webhook secrets; rate-limited outbound notifications; DPDP Act compliance. |
| **9** | **Entire-Flat Experience Improvements (Secondary C)** | Advanced filters for independent flats, society amenities, direct owner vs broker fee badge, preserving secondary navigation hierarchy. | Secondary placement preserved on homepage and discovery tabs; zero regression of existing functionality. |

---

## 3. Marketplace Monetization & Free Access Policy

- **Initial Stage: 100% Free Access:** Basic browsing, listing creation for resident families and direct owners, and flatmate matching remain completely free during market validation.
- **Zero Premature Paywalls:** No recurring subscriptions, pay-per-contact locks, or paid promotion banners will be introduced until marketplace density and trust benchmarks are firmly established.
- **Transparent Brokerage:** Direct owners always pay ₹0 fee; verified commercial managers must disclose upfront brokerage before publishing.
