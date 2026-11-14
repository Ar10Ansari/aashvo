# Aashvo — Legal Readiness & Tenancy Agreement Review Package
## Comprehensive Dossier for Retained Legal Counsel

**Document Version:** 1.0.0-PROD-READINESS<br/>
**Date Prepared:** October 2026<br/>
**Jurisdiction:** Republic of India<br/>
**Target Entities:** Landlords (Lessor / Licensor), Tenants (Lessee / Licensee), and Flatmates<br/>
**Applicable Frameworks:** Model Tenancy Act 2021, Indian Contract Act 1872, Information Technology Act 2000, Indian Stamp Act 1899 / State Stamp Acts, Registration Act 1908, Digital Personal Data Protection (DPDP) Act 2023

---

> [!IMPORTANT]
> **STATUTORY REGULATORY DISCLAIMER & STATUS NOTICE:**
> 1. **DRAFT TEMPLATE ONLY:** All tenancy agreements, condition logs, and dispute workflows generated or facilitated by Aashvo are standardized digital draft templates for negotiation and mutual record-keeping. They do NOT constitute legally reviewed, stamped, or registered instruments until reviewed by qualified legal counsel, executed with requisite stamp duty, and registered where mandated by state law.
> 2. **NO ESCROW OR FINANCIAL CUSTODY:** Aashvo is a technology and communication facilitator. Aashvo is NOT a bank, non-banking financial company (NBFC), escrow depository, insurance provider, or financial intermediary. Aashvo NEVER holds, custodies, or guarantees security deposits or rent payments. All monetary settlements occur directly between the landlord and tenant via third-party banking/UPI channels.
> 3. **NO ADJUDICATION OR ARBITRATION COURT:** Aashvo's dispute management tool is an informal, mutual communication mechanism. Aashvo does not act as an arbitrator, mediator under the Mediation Act 2023, or judicial rent authority.

---

## 1. Tenancy Agreement Data Model & Field Mapping

The Aashvo Rental Trust & Protection engine captures and binds the following structured data fields into tenancy agreements (`public.tenancy_agreements`):

| Data Field | Database Column | Data Type | Source & Verification Method |
| :--- | :--- | :--- | :--- |
| **Agreement UUID** | `id` | `UUID PK` | Cryptographically generated (`gen_random_uuid()`). |
| **Property ID** | `property_id` | `UUID FK` | Bound to verified listing in `public.properties`. |
| **Landlord Identity** | `landlord_id` | `UUID FK` | Bound to authenticated user (`auth.users.id`). Verified phone & ID flags. |
| **Tenant Identity** | `tenant_id` | `UUID FK` | Bound to authenticated user (`auth.users.id`). Verified email & phone flags. |
| **Premises Locality & City** | `properties.locality, city` | `TEXT` | Verified locality and municipal city within India. Exact address masked publicly. |
| **Monthly Rent** | `monthly_rent` | `NUMERIC(10,2)` | Agreed monthly rental amount in INR. Positive constraint enforced. |
| **Security Deposit** | `security_deposit` | `NUMERIC(10,2)` | Agreed security deposit outlay in INR. Non-negative constraint enforced. |
| **Commencement Date** | `start_date` | `DATE` | Lease start date. Constraint: `start_date < end_date`. |
| **Expiration Date** | `end_date` | `DATE` | Lease expiration date. Typically 11 months from commencement. |
| **Agreement Status** | `agreement_status` | `ENUM` | Lifecycle states: `draft`, `active`, `terminated`, `expired`. |
| **Terms Summary** | `terms_summary` | `TEXT` | Core contractual stipulations, house rules, and utility sharing terms. |
| **Document URL** | `document_url` | `TEXT` | Scoped storage path in `rental-documents/{agreement_id}/*`. |

---

## 2. Standard Contractual Clauses (Generated Template)

### Clause 1: Grant of Tenancy / License
> "The Landlord hereby grants to the Tenant, and the Tenant hereby accepts from the Landlord, the tenancy/occupancy of the residential premises situated at [Property Locality, City, State] for a fixed term commencing on [Start Date] and expiring on [End Date], unless terminated earlier in accordance with the provisions herein."

### Clause 2: Consideration & Payment Schedule
> "The Tenant shall pay to the Landlord a fixed monthly sum of ₹[Monthly Rent] payable on or before the 5th day of each calendar month. Payments shall be remitted directly to the Landlord via UPI / NEFT / IMPS. Aashvo provides an auditable payment ledger for mutual receipt tracking, but does not process, custody, or guarantee rental payments."

### Clause 3: Security Deposit & Settlement Conditions
> "The Tenant has deposited with the Landlord a sum of ₹[Security Deposit] as an interest-free security deposit. The Landlord covenants to refund the deposit within thirty (30) days following vacant possession by the Tenant, subject to itemized deductions solely for documented physical damage exceeding normal wear and tear, or outstanding unpaid utility charges. All deductions must be supported by mutual move-out condition inspection records."

### Clause 4: Condition Inspection & Damage Baseline
> "Both parties agree that the digitized Move-In Condition Log recorded within the Aashvo platform on or prior to the Commencement Date constitutes the prima facie condition of the premises, fixtures, and appliances. Subsequent claims for pre-existing damages shall not be permissible."

### Clause 5: Access, Privacy & Inspection Notice
> "The Landlord or authorized representatives retain the right to inspect the premises with minimum twenty-four (24) hours prior written or electronic notice to the Tenant, during reasonable daylight hours, except in cases of bona fide emergency threatening life or property."

### Clause 6: Termination & Notice Period
> "Either party may terminate this agreement prior to expiration by delivering one (1) calendar month's written notice to the counterparty, or by paying rent in lieu thereof."

---

## 3. Indian State-Specific Tenancy Law Analysis

A critical legal blocker for nationwide deployment is that tenancy and land laws fall primarily under Entry 18 of the State List (List II) of the Seventh Schedule of the Indian Constitution. A single uniform agreement is not sufficient without state-specific compliance:

### 3.1 Model Tenancy Act, 2021 (Central Benchmark)
- **Deposit Ceilings:** Restricts residential security deposits to a maximum of **two (2) months' rent**.
- **Mandatory Registration:** Mandates submission of agreement to the local Rent Authority within two months of execution.
- **Eviction Grounds:** Strictly defined; non-payment of rent for two consecutive months.

### 3.2 National Capital Territory of Delhi (Delhi Rent Control Act, 1958 & Transfer of Property Act, 1882)
- Premises where monthly rent exceeds ₹3,500 are exempt from the Delhi Rent Control Act, falling under the Transfer of Property Act, 1882.
- 11-month lease agreements avoid compulsory registration under Section 17 of the Registration Act, 1908, but require stamp duty payment (e-Stamp certificate via Stock Holding Corporation of India Ltd - SHCIL).

### 3.3 Haryana / Gurugram (Haryana Urban Control of Rent and Eviction Act, 1973)
- Commercial hubs (DLF Phases, Cyber City, Golf Course Road) operate under standard 11-month tenancy conventions.
- Stamp duty calculated on average annual rent plus deposit. Requires notarization or sub-registrar execution if lease term exceeds 11 months.

### 3.4 Karnataka / Bengaluru (Karnataka Rent Act, 1999)
- Traditional market custom demands 6 to 10 months' rent as deposit (historically non-statutory).
- The Karnataka Rent Act exempts premises with rent above ₹3,500/month in municipal corporations.
- 11-month agreements are standard practice; requires Karnataka e-Stamp paper (nominal duty for leases under 1 year).

### 3.5 Maharashtra / Mumbai & Pune (Maharashtra Rent Control Act, 1999)
- **Mandatory Registration (Section 55):** Section 55 makes registration of all Leave and License agreements **mandatory**, regardless of tenure (even 1 month or 11 months).
- Failure to register is a punishable offense by the landlord (imprisonment up to 3 months or fine).
- Requires biometric e-registration via Maharashtra Department of Registration and Stamps (e-filing portal).
- **Aashvo Position for Maharashtra:** The platform must clearly state that Aashvo generated drafts must be completed through Maharashtra's official e-filing portal or sub-registrar.

---

## 4. Digital Signature & Evidentiary Standard (IT Act 2000)

| Execution Method | Evidentiary Status under Indian Law | Platform Support Status | Legal Action Required |
| :--- | :--- | :--- | :--- |
| **In-App Digital Acknowledgment** | Admissible under Section 65B & Section 10A of IT Act 2000 as electronic record. | **CURRENT IMPLEMENTATION** (Both parties click confirm; immutable audit timestamps captured). | Must display clear warning that physical stamp duty and notarization/registration may be required for court enforcement. |
| **Aadhaar eSign (ESP/C-DAC)** | Legally equivalent to handwritten signature under Second Schedule of IT Act 2000. | **PLANNED INTEGRATION** | Requires licensing integration with a licensed Certifying Authority (e.g., NSDL, eMudhra). |
| **Physical Print & e-Stamp** | Traditional wet-ink signature on SHCIL e-Stamp paper. | **CURRENTLY SUPPORTED** (Downloadable draft agreement). | Standard recommendation given to users for formal execution. |

---

## 5. DPDP Act 2023 Compliance & Document Retention

1. **Purpose Limitation:** Tenancy agreements and inspection photos are collected solely for tenancy administration, payment verification, and counterparty dispute mitigation.
2. **Access Control:** Storage bucket `rental-documents` strictly restricts read/write permissions to the landlord and tenant of the specific agreement (`tenancy_agreements.id`).
3. **Data Principal Rights:** Users may request access, correction, or erasure of expired agreements following the statutory 3-year commercial dispute limitation period (Limitation Act, 1963).
4. **Data Redaction:** Bank account numbers, PAN numbers, and exact residential flat numbers are not publicly queryable.

---

## 6. Actionable Questions for Retained Legal Counsel

Counsel is requested to review and provide formal written opinion on:
1. Does the inclusion of Aashvo's Move-In Condition Log in the draft agreement provide adequate prima facie evidence to rebut landlord claims under Indian civil court proceedings?
2. What specific text modifications are recommended in the statutory banner to fully insulate Aashvo from potential consumer liability under the Consumer Protection Act, 2019?
3. For Maharashtra-based properties, should Aashvo automatically redirect users to authorized Leave and License e-registration service providers?
4. Are the dispute resolution mediation provisions enforceable as pre-litigation conciliation under the Mediation Act, 2023?
