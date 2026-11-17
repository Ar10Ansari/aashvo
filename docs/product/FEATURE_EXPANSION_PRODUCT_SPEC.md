# AASHVO MASTER FEATURE EXPANSION — PRODUCT SPECIFICATION
## Comprehensive Accommodation & Shared-Living Marketplace for India

**Document Version:** 1.0.0  
**Status:** Approved & Architecture Planned  
**Target Release:** RC-1.2.0  
**Classification:** Core Product Specification  

---

## 1. Executive Summary

AASHVO is an independent accommodation and shared-living marketplace designed for students, early-career working professionals, and urban migrants across India. While traditional classified platforms suffer from stale listings, lack of lifestyle alignment, opaque pricing, and contentious move-in disputes, AASHVO provides a unified, trustworthy ecosystem spanning:

1. **Smart Location Discovery:** Real-world Indian urban search encompassing cities, micro-localities, PIN codes, and proximity to major educational institutions, tech parks, and metro transit corridors.
2. **Rent Split Calculator:** A transparent co-living financial utility allowing roommates to model equal, custom, and percentage splits for rent, utilities, and security deposits.
3. **Saved Listings & Shortlists:** Private, categorized shortlisting across properties, flatmate profiles, Connect candidates, and Family Stays, with automated availability status tracking.
4. **Property Visit Scheduling:** A structured viewing request workflow preventing conflicting appointments, supporting rescheduling, and enforcing owner confirmations in Indian Standard Time (IST).
5. **Property Verification Workflow:** A rigorous, auditable verification pipeline reviewing ownership/lease documents and issuing transparent verification badges without misleading title guarantees.
6. **Move-In Checklist:** An integrated Rental Trust Engine extension capturing room inventories, condition ratings, meter readings, key handovers, and two-party digital acknowledgements.
7. **Smart Notifications:** A unified in-app notification center powered by event-driven triggers across matches, messages, inquiries, visits, verification statuses, and ledger activities.

---

## 2. Feature Specifications

### 2.1 Feature 1: Smart Location Discovery (P1)
- **Scope:** Search across Delhi NCR (Hauz Khas, Saket, North Campus, Cyber City, Golf Course Road, Sector 62), Bengaluru (Koramangala, Indiranagar, HSR Layout, Whitefield), Mumbai (Bandra, Andheri, Powai), Pune (Kothrud, Viman Nagar, Hinjewadi), and Hyderabad (Gachibowli, Madhapur, Hitec City).
- **Landmark Anchors:**
  - *Universities/Colleges:* IIT Delhi, Delhi University, JIIT Noida, Christ University Bengaluru, IIT Bombay.
  - *Tech Parks/Offices:* DLF Cyber Hub Gurugram, Manyata Tech Park Bengaluru, Mindspace Madhapur Hyderabad, Hinjewadi IT Park Pune.
  - *Metro Lines:* Delhi Metro (Yellow, Blue, Magenta lines), Rapid Metro Gurugram, Namma Metro Bengaluru (Purple, Green lines).
- **Proximity Calculation:** Deterministic Haversine distance calculation between property coordinates and landmark centroids.
- **Privacy Boundary:** Displays approximate distance to landmarks (e.g. *"1.2 km from IIT Delhi"*) while strictly concealing exact private apartment and door numbers prior to scheduled visits.

### 2.2 Feature 2: Rent Split Calculator (P1)
- **Split Methodologies:**
  - *Equal Split:* $R_i = R_{\text{total}} / N$.
  - *Custom Split by Room Quality:* Independent room valuations (master bedroom with attached bath vs compact bedroom with shared bath).
  - *Percentage Split:* User-defined percentage shares ensuring $\sum P_i = 100\%$.
- **Recurring vs One-Time Classification:**
  - *Monthly Recurring:* Base rent, electricity, piped water, high-speed Wi-Fi, society maintenance fees, housekeeping.
  - *One-Time Capital:* Security deposit, move-in token, brokerage/documentation (if any).
- **Transparency & Portability:** Instant breakdown cards per flatmate, printable expense summary, and exportable link/state. Strictly non-custodial: no payment gateway or escrow simulation.

### 2.3 Feature 3: Saved Listings and Shortlists (P1)
- **Entities Supported:** Properties, Flatmate Profiles, Connect Candidates, Family Stays.
- **Categorization:** Filter by category (All, Properties, Flatmates, Family Stays).
- **Availability Sentinel:** Real-time badge indicating whether the listing is active or has transitioned to `rented`, `paused`, or `deleted`.
- **Privacy & Safety:** Self-saving prevention (`targetId !== callerId`), respect for blocked users, and privacy-shielded metadata.

### 2.4 Feature 4: Property Visit Scheduling (P1)
- **Request Flow:** Renter selects date and time slot within owner availability, submits viewing inquiry with optional move-in date and message.
- **Lifecycle States:** `pending` $\to$ `confirmed` | `rescheduled` | `rejected` $\to$ `completed` | `cancelled`.
- **Double-Booking Guard:** Database constraint / transaction ensuring no two visits for the same property can be `confirmed` within overlapping time windows (30-minute buffer).
- **Timezone Standard:** All appointments displayed in Indian Standard Time (IST / UTC+5:30). Clear disclaimer: Viewing is unconfirmed until the host explicitly accepts.

### 2.5 Feature 5: Property Verification Workflow (P2)
- **Verification Levels:**
  - *Owner Identity:* Government-issued ID (Aadhaar / PAN / Passport) verification.
  - *Property Proof:* Electricity bill, property tax receipt, registered sale deed, or society allotment letter.
- **Admin Review Queue:** Staff console to inspect documents, record verification notes, approve, reject with reason, or trigger reverification.
- **Audit Logging:** Every status change recorded in `audit_logs` with admin user ID and timestamp.
- **Disclaimer:** Prominent notice stating that verification certifies document submission and provider validation, but does not constitute legal title clearance or structural safety certification.

### 2.6 Feature 6: Move-In Checklist (P2)
- **Rental Trust Engine Synergy:** Built directly upon `PropertyInspection` and `TenancyAgreement`.
- **Comprehensive Checklist:**
  1. Tenancy agreement executed and active.
  2. Security deposit transfer record logged.
  3. Physical key handover confirmed.
  4. Room inventory: ACs, fans, geysers, lights, wardrobes, beds.
  5. Utility meters: Initial electricity meter reading (kWh) and water meter reading.
  6. Existing cosmetic/structural defect photos attached.
  7. Two-party digital acknowledgement.
- **Legal Demarcation:** Distinct notice distinguishing digital condition handover from statutory registration under the Indian Registration Act, 1908.

### 2.7 Feature 7: Smart Notifications (P1)
- **Notification Types:**
  - `connect_match`: Reciprocal interest established on Aashvo Connect.
  - `connect_message`: New direct message received in active match thread.
  - `visit_request`: Viewing request submitted by renter.
  - `visit_update`: Visit confirmed, rescheduled, or cancelled.
  - `inquiry_received`: New direct property inquiry.
  - `verification_update`: Property verification approved or rejected.
  - `agreement_update`: Agreement drafted, signed, or amended.
  - `inspection_update`: Move-in checklist ready for counterparty acknowledgement.
  - `listing_alert`: Saved property availability change.
- **User Controls:** In-app dropdown / center, unread counters, mark single as read, mark all read, notification category filters. Zero claim of SMS/email dispatch when provider is not configured.

---

## 3. Product Navigation Hierarchy

To eliminate redundant navigation destinations and deliver an architectural, co-living experience:

1. **Explore:** Discover Flatmates, Entire Flats, Family Stays, Location & Landmark Search.
2. **Connect:** Swipe Deck, Mutual Matches, Match Conversations.
3. **Saved:** Shortlisted Properties, Flatmates, and Stays with live availability.
4. **Messages:** Unified inbox for Match Conversations and Direct Property Inquiries.
5. **Profile:** Personal Identity, Lifestyle Preferences, Listed Properties, Security Settings.
6. **My Activity:** Scheduled Visits, Rental Agreements, Move-In Checklists, Support Tickets.

