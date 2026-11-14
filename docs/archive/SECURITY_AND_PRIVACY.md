# Aashvo — Security, Privacy & Data Protection Architecture

**Version:** 2.0.0-Nationwide  
**Lead:** Founding CTO & Security Reviewer  
**Regulatory Framework:** Indian Digital Personal Data Protection (DPDP) Act 2023 Compliance  

---

## 1. Threat Model & Architectural Mitigation Matrix

| Threat Vector | Severity | Vulnerability Surface | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **1. Privilege Escalation** | Critical | Client modifies `role: 'admin'` in profile update request or JWT claim spoofing. | **Trigger `trg_prevent_role_escalation`** raises exception `P0001` if non-admin attempts to mutate `role`. Functions use `SECURITY DEFINER SET search_path = public, pg_temp;`. |
| **2. Unauthorized Profile Access** | High | Direct REST `SELECT` on `public.profiles` leaking private user data. | **RLS Policy** restricts direct `profiles` reads to `auth.uid() = id OR public.is_admin()`. Public discovery uses secure view `public_profiles`. |
| **3. Contact-Detail Scraping** | Critical | Bots scraping classified directories to sell phone numbers to spam brokers. | **Zero public phone numbers on listing pages.** Contacts are masked and unlocked only through verified, authenticated interest requests with audit logging. |
| **4. Inquiry Access by Unauthorized Users** | High | Malicious user intercepting or reading private inquiries sent to another host/renter. | **RLS on `interest_requests`** enforces access strictly to `sender_id = auth.uid()`, the verified listing owner, or the targeted flatmate. |
| **5. Listing Moderation Bypass** | High | Untrusted host issuing direct API `POST` or `PATCH` with `status: 'active'`. | **Trigger `trg_prevent_status_bypass`** forces `NEW.status := 'pending_review'` for any non-admin submission or modification. |
| **6. Forged Phone Verification** | Critical | Client sending `phone_verified: true` in update payload to bypass phone gate. | **Trigger `trg_prevent_verification_forgery`** rejects user updates to `phone_verified`. Phone status is updated solely by server-trusted OTP confirmation. |
| **7. Forged Profile-Completion Status** | Medium | Client flipping a boolean `is_profile_complete: true` to bypass workflow rules. | **No client-side completion flag exists.** Profile eligibility is dynamically calculated by server-side rules (`evaluateActionEligibility`). |
| **8. Unauthorized Photo Upload/Deletion** | Medium | User uploading malicious scripts or deleting photos belonging to another listing. | **Storage RLS on `storage.objects`** enforces user-folder scoping (`(storage.foldername(name))[1] = auth.uid()::text`), 5MB caps, and MIME whitelisting (`image/jpeg`, `image/png`, `image/webp`). |
| **9. Cross-Account Data Access** | High | Multi-tenant leaks allowing User A to mutate User B's listings or drafts. | **PostgreSQL RLS with strict `auth.uid() = owner_id`** checks on all `UPDATE` and `DELETE` operations. |
| **10. OAuth Misconfiguration & Account Linking Hijacking** | Critical | Malicious actor registering unverified email account and auto-linking with victim's OAuth. | **Strict Identity Linking Policy:** Rejects automatic account merge of unverified email accounts. Enforces PKCE, CSRF state verification, and redirect origin whitelisting. |

---

## 2. Public Views vs. Base Tables Security Audit

A safe RLS policy on a base table does not automatically guarantee safety on exposed database views:

1. **`public.public_profiles` View:**
   - **Exposed Columns:** `id`, `full_name`, `role`, `avatar_url`, `bio`, `id_verified`, `phone_verified`, `created_at`.
   - **Excluded Columns (Zero Leakage):** `phone_number`, `email`, `updated_at`.
   - **Permissions:** `GRANT SELECT TO anon, authenticated`.
2. **`public.public_properties` View:**
   - **Exposed Columns:** Title, description, category, rent, deposit, maintenance, electricity, room type, amenities, rules, locality, city, state, pincode.
   - **Excluded Columns (Zero Leakage):** Exact flat numbers, private owner phone number, internal moderation notes.
   - **Filter Clause:** `WHERE status = 'active'`.

---

## 3. Phone Verification & OTP Endpoint Defense

1. **Rate Limiting & Cooldown:**
   - Enforces a 60-second cooldown between consecutive OTP requests to the same mobile number.
   - Enforces a strict ceiling of **4 OTP dispatches per hour** per number.
2. **Brute-Force & Replay Protections:**
   - Verification attempts capped at **5 tries per OTP session**. The 6th incorrect attempt locks the session and requires a fresh OTP.
   - Cryptographic OTPs expire after **10 minutes**.
3. **Decoupled Gateway Credentials:**
   - All SMS provider API keys and credentials reside in private backend environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `SMS_GATEWAY_AUTH_TOKEN`).
   - Browser client bundles never receive provider secrets.

---

## 4. Privacy-by-Design & Indian DPDP Act 2023 Compliance

1. **Data Minimization:**
   - No unnecessary personal data collection. Only minimal profile information is collected contextually when needed for an intended workflow.
2. **Location Privacy:**
   - Public view shows Locality, Sector, and Landmarks. Exact building and flat numbers are disclosed only after an inquiry is mutually accepted.
3. **Verified Account Deletion & Data Retention:**
   - Users may request account deletion at any time (`DELETE /auth/v1/user`).
   - Profile PII (phone number, email, avatars) is permanently purged within 30 days.
   - Historical financial transaction audits and community fraud reports are anonymized and retained to fulfill Indian legal accounting and law enforcement requirements.
4. **Transparent Broker & Family Identification:**
   - Direct Owners (₹0 brokerage) are clearly badged.
   - Commercial brokers must state their explicit fee before listing goes live.
   - Family Stays require resident family owner verification; brokers posing as family hosts are permanently blacklisted.

---

## 5. Help & Support System Security & Confidentiality

1. **Strict Internal Staff Notes Isolation:**
   - Database RLS policy on `public.ticket_messages` ensures that queries from ordinary authenticated users or guests only return messages where `is_internal = false`.
   - The client API/context sanitizer (`sanitizeTicketForClient`) guarantees that `auditEvents` and internal messages are completely purged before state delivery to non-admins.
2. **Anonymous & Authenticated Ticket Segregation:**
   - Unauthenticated visitors submitting a ticket receive a unique `ASH-TKT-XXXXXX` reference code.
   - Guest ticket lookups require **both** the exact reference code and the matching contact email used during submission, preventing ticket enumeration or ID harvesting.
   - Authenticated users can only query tickets where `user_id = auth.uid()` or matching verified email.
3. **Reporter & Reported Party Confidentiality:**
   - Safety reports submitted against listings or flatmate profiles are strictly concealed from the reported party.
   - The reported party is never informed who submitted the report or the exact text of the report.
   - Safety reports are routed exclusively to the staff moderation console.
4. **Attachment Upload Restrictions & Storage Policies:**
   - Uploads are capped at **5MB per file** and **maximum 3 files per ticket**.
   - Strict MIME type whitelisting permits only `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`. Executables, HTML, JavaScript, and archive files are rejected at both client and storage policy levels.
   - Private Supabase Storage bucket `support-attachments` allows read access only to staff moderators and the authenticated owner.
5. **Zero Secret Logging:**
   - Notification dispatch hooks and logging suppress secret passwords, OTPs, or financial payment credentials.
