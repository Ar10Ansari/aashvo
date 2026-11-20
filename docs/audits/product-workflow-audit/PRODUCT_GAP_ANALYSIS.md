# AASHVO Market Benchmark & Product Gap Analysis

**Audit Date:** November 20, 2026  
**Auditor:** AASHVO CTO & Chief Product Officer  
**Scope:** Competitive benchmarking of AASHVO against global leaders (Airbnb, Zillow, SpareRoom, Flatmates.com.au, Bumble BFF) and identification of missing enterprise-grade marketplace capabilities.

---

## 1. Competitive Capability Benchmark

| Capability / Dimension | AASHVO Current Status | Industry Standard Benchmark | Competitive Parity Gap |
| :--- | :--- | :--- | :--- |
| **Flatmate Matching Engine** | **Superior** (6-dimension compatibility, missing-data neutrality, custom weights) | Bumble BFF / SpareRoom (Basic filters, no vector scoring) | **AASHVO Leads** |
| **Multi-Persona Profiles** | **Superior** (5 interchangeable personas with distinct metadata) | Airbnb / Zillow (Separate host/guest accounts or rigid toggles) | **AASHVO Leads** |
| **Direct Landlord Chat** | **Missing** (Inquiry sends email/toast; no persistent real-time chat) | Zillow / SpareRoom (Instant threaded inbox between renter & owner) | **Critical Gap** |
| **Interactive Map Search** | **Basic** (Static mock map / text search; no dynamic pin clustering) | Zillow / Airbnb (Mapbox/Google Maps cluster view with draw-boundary) | **High Gap** |
| **Rent Payments & Escrow** | **Stubbed** (Schema supports deposits; no payment gateway integrated) | Airbnb / RentSpree (Integrated Stripe/Plaid security deposit escrow) | **High Gap** |
| **Verified Review System** | **Backend Only** (Prisma `Review` model exists; no UI submit/view) | Airbnb / Zillow (Verified stay reviews, host ratings, response rates) | **High Gap** |
| **Digital Lease Signing** | **Stubbed** (Schema supports agreements; UI disconnected) | DocuSign / HelloSign (Legally binding electronic signature canvas) | **Medium Gap** |
| **Move-in Inspections** | **Orphaned** (Component written, not mounted) | RentCheck / Zillow Rental Manager (Condition photos & meter logs) | **Quick Win** |

---

## 2. In-Depth Product Capability Gaps

### 2.1 Direct Landlord-Tenant Messaging
- **Current State:** AASHVO has real-time messaging exclusively inside the AASHVO Connect flatmate modal. If a renter wants to inquire about a rental property, they click "Send Inquiry" which sends a message into the void.
- **Industry Standard:** Mature rental marketplaces feature a unified Inbox where inquiries automatically spawn a persistent conversation thread between applicant and property manager.
- **Recommendation:** Extend the messaging infrastructure created in `ConnectModule` into a unified `MessagingModule` serving both flatmate matches and property inquiries.

### 2.2 Live Map-Based Search & Geocoding
- **Current State:** Search relies on text string matching against `city` and `address`.
- **Industry Standard:** Renters search by visual radius or commute time (e.g. "Within 20 minutes transit of NYU"). Map markers update dynamically as the user pans and zooms.
- **Recommendation:** Integrate Leaflet / Mapbox GL with PostGIS spatial queries on PostgreSQL.

### 2.3 Integrated Payments & Security Deposit Escrow
- **Current State:** Lease deposits and monthly rent are listed as integer values without payment rails.
- **Industry Standard:** Seamless in-app holding of security deposits until move-in checklist is signed by both parties, dramatically reducing rental fraud.
- **Recommendation:** Integrate Stripe Connect with escrow holding capabilities.

### 2.4 User & Property Reviews Visibility
- **Current State:** The database includes a full `Review` model with ratings (1 to 5 stars), category ratings (cleanliness, communication, accuracy), and comments. However, listing cards and detail modals do not display these reviews or provide a "Write Review" button.
- **Recommendation:** Mount a review carousel on property detail views and prompt renters for reviews 7 days post-move-in.
