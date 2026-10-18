# Aashvo — Security, Privacy & Data Protection Architecture

**Version:** 1.0.0  
**Lead:** Founding CTO & Security Reviewer  

---

## 1. Threat Model & Mitigation Matrix

| Threat Vector | Severity | Vulnerability Source | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Phone Scraping & Lead Theft** | Critical | Bots scraping classified directories to sell phone numbers to spam brokers. | **Zero public phone numbers on listing pages.** Contact details are gated behind authenticated interest requests with rate-limiting and audit logging. |
| **Bait-and-Switch Pricing** | High | Unscrupulous brokers advertising ₹10k rent then claiming it's ₹20k on phone. | **Mandatory cost breakdown.** Reporting triggers instant review. Price modifications >15% require re-moderation. |
| **Client-Side Privilege Escalation** | Critical | Insecure frontends allowing users to flip `is_admin: true` in localStorage. | **Zero trusting of client state.** In production, Supabase JWT claims and server-side RLS validate administrative roles. In local mock, strict role enum validation prevents unauthorized view access. |
| **Malicious File Uploads** | High | Upload of executable scripts disguised as property photos. | **Strict MIME-type checking, file extension validation, and 5MB size caps.** Only `image/jpeg`, `image/png`, and `image/webp` are permitted. |
| **Cross-Site Scripting (XSS)** | Medium | Bio or listing description injection of script tags. | **React automatic JSX escaping.** Sanitize any rich text input. Avoid `dangerouslySetInnerHTML`. |
| **Harassment via Flatmate DMs** | High | Inappropriate messaging to female students seeking rooms. | **Gated interest requests with report and block controls.** Verified ID badges. |

---

## 2. Privacy-By-Design Principles

1. **Exact Address Masking:**
   - Public view shows Locality, Sector, and Landmarks (e.g. *"DLF Phase 4, near Galleria Market, Gurugram"*).
   - Exact building/flat number is revealed only upon confirmed visit booking.
2. **Transparent Broker Identification:**
   - Every provider must explicitly declare:
     - `Owner` (₹0 brokerage)
     - `Current Tenant` (seeking replacement flatmate)
     - `Broker / Property Manager` (must state explicit commission rate before listing goes live).
3. **Data Minimization:**
   - No unnecessary personal data collection. Users provide only what is needed for living compatibility and rental agreement verification.

---

## 3. Environment Variable Hygiene

- Never commit `.env` or `.env.local` to Git.
- Provide `.env.example` with blank placeholder values:
  ```bash
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```
- Public client builds receive ONLY the Supabase `anon` key, never the `service_role` secret.
