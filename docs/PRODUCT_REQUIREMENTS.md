# Aashvo — Product Requirements Document (PRD)

**Version:** 1.0.0-MVP  
**Status:** Approved  
**Author:** Founding CTO & Product Team, Aashvo  
**Target Market:** Delhi NCR (Pilot Cluster: Gurugram Cyber Hub & DLF Phases / South Delhi Corridor)

---

## 1. Vision & Core Value Proposition

**Aashvo** is a website-first housing and flatmate discovery platform designed specifically for college students and young working professionals in Delhi NCR. 

The traditional rental market in Delhi NCR is plagued by:
1. Fake, stale, or bait-and-switch listings by unscrupulous brokers.
2. Hidden costs revealed only after contract signing (inflated security deposits, maintenance fees, electricity per-unit surcharges).
3. Mismatched living habits, food preferences, and lifestyle conflicts between flatmates.
4. Privacy invasion where renters' phone numbers are blasted to dozens of aggressive intermediaries.

**Aashvo's Mission:** Make finding a room, flat, or flatmate transparent, safe, and dignified.

> **Tagline:** Find your place. Find your people.  
> **Promise:** Simple. Safe. Built for real people.

---

## 2. Target Personas

### Persona A: The Young Professional ("Rohan", 24)
- **Profile:** Software engineer moving to Cyber City, Gurugram.
- **Budget:** ₹18,000 – ₹28,000/month.
- **Needs:** 1 Private Room in a pre-occupied 3BHK flat, close to Rapid Metro, high-speed Wi-Fi, transparent electricity charges, non-smoking/chill flatmates.
- **Pain Point:** Broker demands 1 month brokerage for showing dingy basement rooms; no idea who the other flatmates are.

### Persona B: The College Student ("Ananya", 20)
- **Profile:** Undergraduate student at Delhi University (South Campus) / Ashoka / Amity.
- **Budget:** ₹10,000 – ₹18,000/month.
- **Needs:** Shared or single room in a safe locality (Saket / Hauz Khas), female-only flat, strict safety, zero broker hassle, predictable deposit.
- **Pain Point:** Unsafe landlords, hidden electricity charges (₹12-14/unit), curfew restrictions not disclosed upfront.

### Persona C: The Verified Property Provider ("Col. Verma", 58 & Independent Property Manager "Sunil")
- **Profile:** Flat owner in DLF Phase 5 or professional co-living manager.
- **Needs:** Reliable, respectful tenants who pay on time; minimal vacancy downtime; straightforward listing tool without spam calls at midnight.
- **Pain Point:** Existing classified portals spam them with unqualified leads or re-list their property without permission.

---

## 3. The Three Core User Journeys

### Journey 1: Find a Place (Renters)
- Browse and filter by locality, budget range, room type (Private Room, Shared Room, Entire Flat), furnishing (Furnished, Semi-furnished, Unfurnished), and amenities (AC, Wi-Fi, Power Backup, Attached Washroom, Balcony, Food/Cook).
- Inspect transparent financials: **Monthly Rent**, **Security Deposit**, **Maintenance Charges**, **Average Utility/Electricity Cost**, and **Brokerage Fee (₹0 for owner listings, capped/explicit for managers)**.
- Review listing freshness: Explicit badge indicating when the landlord/roommate last confirmed availability (e.g., "Active today", "Verified 2 days ago").
- Request contact or schedule a visit via in-platform messaging/gated contact request.

### Journey 2: Find a Flatmate (Room Seekers & Room Holders)
- Explore flatmate profiles filtered by locality, target budget, gender preference, food habits (Vegetarian / Non-veg / Vegan), work schedule (Day / Night / Hybrid), and pet friendliness.
- Distinguish between **"Has a Room Available"** vs. **"Looking to Team-Up & Rent Together"**.
- View compatibility bio, mutual interests, and verified badge.
- Send an **"Interest Request"** with an introductory note.

### Journey 3: List a Property (Owners, Flat Occupants & Registered Managers)
- Guided, mobile-first listing creation flow:
  1. Property basics: Locality, address, property type, room types available.
  2. Financial breakdown: Base rent, deposit, maintenance, electricity rate, brokerage terms.
  3. Photos: High-resolution photos with room tags (Bedroom, Living, Washroom, Kitchen).
  4. Rules & Preferences: Gender preference, dietary openness, pets, smoking, guest policy.
  5. Provider identity: Clear toggle: **Independent Owner**, **Current Tenant (replacing flatmate)**, or **Professional Broker/Property Manager**.
- Instant submission into moderation queue (Pending -> Active / Changes Requested).
- Dashboard to mark as **"Available"**, **"Under Discussion"**, or **"Rented Out"**.

---

## 4. Non-Negotiable Product Principles

1. **Financial Transparency Above All:**
   - No hidden maintenance or deposit surprises. Every listing card displays the total monthly outlay.
2. **Strict Identity Clarity:**
   - Owners, flat occupants, and brokers are labeled with unmistakable visual tags.
3. **Freshness Guarantee:**
   - Listings unconfirmed for >14 days are demoted; >21 days are auto-paused until the provider reconfirms availability with one click.
4. **Privacy-Preserving Contact Flow:**
   - Phone numbers are never exposed to scrapers or the public. Contacts are unlocked only after mutual interest or authenticated inquiry.
5. **Anti-Spam & Moderation:**
   - Community reporting flags fake photos, duplicate listings, or discriminatory behavior.

---

## 5. Scope for MVP Launch (Pilot Cluster)

- **Pilot Locality Cluster:** Delhi NCR — Focus on Gurugram (Cyber City, DLF Phase 1-5, Golf Course Rd, Sector 43/54) and South Delhi (Hauz Khas, Saket, Malviya Nagar, Greater Kailash).
- **Core Platform:** Responsive Web Application (optimized for mobile web, tablet, and desktop).
- **Listing Capacity:** Seeded with 12+ meticulously crafted, authentic-feeling pilot properties and 10+ detailed flatmate profiles across the target cluster.
- **Interactive Capabilities:** Complete filtering, search, detail modals/views, interest submission, listing creation wizard, interactive review queue, and simulated/live auth state.
