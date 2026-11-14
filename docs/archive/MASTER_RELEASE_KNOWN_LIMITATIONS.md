# AASHVO — MASTER RELEASE KNOWN LIMITATIONS & ROADMAP
## Operational Boundaries, Staged Integrations & v1.1.0 Enhancement Roadmap

**Author:** CTO & Principal Product Architect  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  

---

## 1. CURRENT OPERATIONAL BOUNDARIES & LIMITATIONS

The release candidate `rc-1.0.0-independent` is an enterprise-grade accommodation platform designed for initial market launch. The following deliberate technical boundaries and staged capabilities are documented for operational transparency:

### A. Payment Settlement vs. Payment Ledger
- **Current Behavior:** The `RentPaymentRecord` ledger allows tenants and landlords to record rent, security deposits, maintenance fees, transaction references (e.g. UPI IDs, IMPS references), and upload payment receipts. Landlords review and confirm receipts digitally.
- **Limitation:** Direct in-app payment auto-capture via payment aggregators (e.g. Razorpay, Cashfree, PayU) is not directly bound via webhooks in this release candidate to avoid early regulatory escrow licensing overhead.
- **Mitigation:** The manual payment verification workflow (`pending_confirmation` -> `confirmed_by_landlord`) provides complete legal auditability and mutual digital sign-off.

### B. Domestic Indian SMS Gateway Integration
- **Current Behavior:** Email verification and password resets are fully operational via asymmetric verification tokens. Phone verification flags exist in the database and UI.
- **Limitation:** Live domestic Indian DLT (Distributed Ledger Technology) registered SMS OTP dispatch is currently stubbed/simulated pending corporate entity registration and sender ID approval from Indian telecom operators (TRAI).
- **Mitigation:** Unverified phone numbers are accepted with clear UI badges (`phoneVerified: false`), while email verification guarantees authentic user identity.

### C. Database Architecture: Single Primary Cluster with PITR
- **Current Behavior:** The primary database is a DigitalOcean Managed PostgreSQL 16 cluster located in `BLR1` (Bangalore), backed by continuous WAL archiving and automated daily backups.
- **Limitation:** Multi-region active-active database clustering or cross-region read replicas in Mumbai/Delhi are not provisioned for day 1 launch.
- **Mitigation:** Latency across major Indian metropolitan areas to Bangalore (BLR1) is < 35ms, which comfortably meets consumer performance standards.

### D. Push Notifications & In-App Outbox
- **Current Behavior:** System notifications are stored transactionally in the `notification_outbox` table and processed asynchronously.
- **Limitation:** Browser WebPush service workers and native mobile FCM (Firebase Cloud Messaging) tokens are not bundled in this web release candidate.
- **Mitigation:** Real-time modal toasts and in-app dashboard notification tabs keep users informed during active sessions.

---

## 2. RELEASE ROADMAP (v1.1.0 & v1.2.0)

```
[rc-1.0.0-independent] (Current Release Candidate)
   ├── NestJS 11 + PostgreSQL 16 Monorepo
   ├── Argon2id + RS256 Auth Engine
   ├── Full Marketplace & Rental Trust Engine
   └── 285 Automated Tests Passing
        │
        ▼
[v1.1.0 — Payment Gateway & DLT SMS] (Target: Q1 2027)
   ├── Razorpay Smart Collect Virtual UPI Escrow Integration
   ├── TRAI DLT Registered SMS Gateway (Fast2SMS / MSG91)
   └── Digital Lease E-Sign via Aadhaar eSign (DigiLocker / Leegality)
        │
        ▼
[v1.2.0 — Geographic Scaling & Native Mobile] (Target: Q2 2027)
   ├── Read-replica deployment in DigitalOcean Mumbai / Delhi
   ├── React Native / Flutter mobile applications
   └── Native WebPush & FCM push notification delivery
```

