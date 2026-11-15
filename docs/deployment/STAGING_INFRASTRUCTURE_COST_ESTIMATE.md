# AASHVO — STAGING INFRASTRUCTURE COST ESTIMATE
## Rigorous Financial Projections, Service Sizing & Indian Rupee (INR) Budget

**Author:** Chief Technology Officer & DevOps Lead  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 15, 2026  
**Budget Status:** **ESTIMATE PREPARED FOR FOUNDER APPROVAL (ZERO SPENDING TO DATE)**

---

## 1. FINANCIAL SUMMARY & TOTAL MONTHLY BUDGET (INR)

The staging environment is designed to mirror production topology while utilizing right-sized, cost-effective resource tiers. 

| Infrastructure Component | Provider & Region | Proposed Service Sizing | Monthly Cost (USD) | Monthly Cost (INR @ ₹85/$1) |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Compute (API)** | DigitalOcean (`BLR1`) | App Platform Basic: 1 vCPU, 512 MB RAM | $5.00 | ₹425.00 |
| **Managed Database** | DigitalOcean (`BLR1`) | Managed PostgreSQL 16: 1 vCPU, 1 GB RAM, 10 GB Storage | $15.00 | ₹1,275.00 |
| **Public Asset Storage** | Cloudflare R2 (Global Edge)| Standard R2: 10 GB Free Allowance, 0 Egress | $0.00 | ₹0.00 |
| **Private Document Storage**| AWS S3 (`ap-south-1` Mumbai)| Standard S3: ~2 GB Storage, Presigned URLs | $0.05 | ₹4.25 |
| **Transactional Email** | Resend (Free Tier) | 3,000 emails/month allowance | $0.00 | ₹0.00 |
| **Frontend Staging Hosting**| Vercel (Preview Branch) | Included in existing Vercel project plan | $0.00 | ₹0.00 |
| **Net Infrastructure Cost** | — | — | **$20.05** | **₹1,704.25** |
| **Applicable 18% Indian GST**| Government of India Tax | 18% IGST on Cloud Electronic Services | **$3.61** | **₹306.77** |
| **Total Staging Cost / Month**| — | **All Tiers Combined (Inclusive of GST)** | **$23.66** | **₹2,011.00** |

> [!NOTE]
> **Conservative Scaling Buffer:**
> If testing under load requires upgrading the App Platform container from 512 MB to 1 GB RAM ($10.00/mo), the total monthly budget will be **$29.56 USD (~₹2,512.00 INR inclusive of GST)**.

---

## 2. COMPONENT-BY-COMPONENT SIZING & PRICING BREAKDOWN

### A. DigitalOcean App Platform (`BLR1` Bangalore)
- **Specification:**
  - Resource: 1 Container Instance
  - Plan: **Basic**
  - Specs: 1 Shared vCPU, 512 MB RAM
  - Ingress: HTTPS on port 4000
  - Region: `blr1` (Bangalore, India)
- **Assumptions & Uncertainty:**
  - Pricing is fixed at **$5.00/mo** billed on an hourly pro-rata basis ($0.007/hr).
  - Staging does not require multi-instance autoscaling. Min instances = 1, Max instances = 1.
  - Uncertainty: Bandwidth overage is zero since App Platform includes 100 GB outbound transfer per month.

### B. DigitalOcean Managed PostgreSQL 16 (`BLR1` Bangalore)
- **Specification:**
  - Configuration: Single Node Primary (No standby replica needed for staging)
  - Plan: **Basic Shared CPU**
  - Specs: 1 vCPU, 1 GB RAM, 10 GB NVMe SSD Storage
  - Version: PostgreSQL 16.x
  - Region: `blr1` (Bangalore, India)
  - Connection Pool: Built-in PgBouncer pool included at no additional cost.
- **Assumptions & Uncertainty:**
  - Pricing is fixed at **$15.00/mo** ($0.022/hr).
  - Includes automated daily snapshots (7-day retention) and continuous WAL streaming.
  - Storage can be scaled up dynamically if synthetic test data exceeds 10 GB ($2.50 per 10 GB).

### C. Cloudflare R2 (Public Media Storage)
- **Specification:**
  - Bucket Name: `aashvo-public-staging`
  - Purpose: Public property photos and user avatars
- **Cost Model & Free Tier:**
  - Storage: 10 GB/month free (Staging projected: ~1.5 GB -> $0.00).
  - Class A Operations (Writes/Uploads): 1,000,000/month free (Staging projected: ~3,000 -> $0.00).
  - Class B Operations (Reads/Downloads): 10,000,000/month free (Staging projected: ~25,000 -> $0.00).
  - Data Egress: **$0.00** (Zero egress fees globally).
- **Assumptions:**
  - Net monthly cost: **$0.00**.

### D. AWS S3 `ap-south-1` Mumbai (Private Rental Documents)
- **Specification:**
  - Bucket Name: `aashvo-private-staging`
  - Region: `ap-south-1` (Mumbai, India)
  - Purpose: Sensitive tenancy agreements, move-in condition photos, and dispute evidence
- **Cost Model:**
  - Storage: $0.023 per GB/month. Projected: 2 GB = $0.046.
  - PUT/POST Requests: $0.005 per 1,000 requests. Projected: 500 = $0.0025.
  - GET Requests: $0.0004 per 1,000 requests. Projected: 1,000 = $0.0004.
  - Data Transfer Out: AWS provides 100 GB free data transfer out per month.
- **Assumptions:**
  - Net monthly cost: **~$0.05 USD (~₹4.25 INR)**.

### E. Transactional Email (Resend)
- **Specification:**
  - Purpose: Staging email verification tokens and password reset delivery
- **Cost Model:**
  - Resend Free Tier: 3,000 emails/month (100 emails/day cap).
  - Staging projected volume: ~150 emails/month for QA verification.
- **Assumptions:**
  - Net monthly cost: **$0.00**.

---

## 3. SUMMARY OF UNCERTAINTIES & SENSITIVITY ANALYSIS

1. **Foreign Exchange Fluctuation:** Calculations assume a USD to INR exchange rate of **₹85.00**. A ±5% fluctuation changes total monthly cost by ±₹100 INR.
2. **Indian GST (18%):** DigitalOcean and AWS charge 18% IGST to Indian credit cards unless an authorized Indian GSTIN is registered on the billing profile.
3. **Billing Cycle Control:** If staging is activated only during active QA verification sprints and paused/destroyed when idle, the actual monthly cost will be significantly less than ₹1,000 INR.

---

## 4. FOUNDER AUTHORIZATION GATEWAY

- **Total Initial Capital Commitment:** **₹2,011.00 INR / month (~$23.66 USD)**.
- **Current Spend to Date:** **₹0.00 INR** (Zero paid resources provisioned).
- **Action Required:** The founder must approve the provision of a corporate credit card with a ₹3,000 INR monthly authorization limit before proceeding with Section 5 (Deployment Runbook).

