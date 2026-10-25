# Aashvo — Mobile Backend Architecture & API Contracts
## Shared Supabase Contracts for Future iOS & Android Native Clients

**Target Environment:** Supabase PostgreSQL (`ap-south-1` Mumbai)<br/>
**Gateway URL:** `https://<project-ref>.supabase.co`<br/>
**API Specification:** Supabase PostgREST v12+ / GoTrue Auth v2+ / Supabase Storage v1+<br/>
**Target Mobile Clients:** React Native / Flutter / Swift (iOS) / Kotlin (Android)

---

> [!IMPORTANT]
> **UNIFIED BACKEND DIRECTIVE:**
> Future mobile applications must share the exact same PostgreSQL database, GoTrue authentication service, Row Level Security (RLS) policies, and storage buckets as the web frontend. Native clients must never bypass server-side database triggers or business rules.

---

## 1. Authentication & Session Lifecycle

### 1.1 SDK Initialization & Headers
Mobile clients initialize the Supabase client using public browser-safe credentials only:
```typescript
// Example: React Native / Kotlin Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage, // or Keychain / EncryptedSharedPreferences
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

All authenticated REST requests must transmit the standard HTTP authorization header:
```http
Authorization: Bearer <jwt_access_token>
apikey: <supabase_anon_key>
Content-Type: application/json
Prefer: return=representation
```

### 1.2 Authentication Endpoints
1. **Email / Password Sign-Up:**
   - `POST /auth/v1/signup`
   - Body: `{ "email": "user@example.com", "password": "SecurePassword123!", "data": { "full_name": "Rohan Varma" } }`
   - *Server Behavior:* Triggers atomic execution of `public.handle_new_user()`, inserting a matching row into `public.profiles` with `role = 'renter'`.
2. **Email / Password Sign-In:**
   - `POST /auth/v1/token?grant_type=password`
   - Returns `{ "access_token": "...", "refresh_token": "...", "expires_in": 3600, "user": { ... } }`
3. **Session Refresh:**
   - `POST /auth/v1/token?grant_type=refresh_token`
4. **Sign-Out:**
   - `POST /auth/v1/logout`

---

## 2. Standardized Error Response Format

PostgREST and Supabase Auth return structured JSON error payloads with standard PostgreSQL SQLSTATE error codes:

```json
{
  "code": "P0001",
  "message": "Privilege escalation rejected: phone_verified cannot be set on client registration.",
  "details": null,
  "hint": null
}
```

### Common Error Codes:
| SQLSTATE Code | HTTP Status | Meaning | Client Handling |
| :--- | :---: | :--- | :--- |
| `P0001` | 400 / 403 | Custom trigger exception raised (e.g., anti-forgery, family stay eligibility violation) | Surface specific message in UI toast |
| `42501` | 403 | RLS policy violation / permission denied | Prompt user to log in or switch to authorized account |
| `23505` | 409 | Unique constraint violation (e.g., duplicate review or active dispute) | Notify user of existing record |
| `23503` | 400 | Foreign key violation (e.g., non-existent property_id) | Prompt user to refresh listing data |

---

## 3. Database Entities & Mobile Operations

### 3.1 Profiles (`public.profiles`)
- **Read Current Profile:**
  `GET /rest/v1/profiles?id=eq.<auth_uid>&select=*`
- **Update Permitted Fields (Full Name, Avatar, Bio):**
  `PATCH /rest/v1/profiles?id=eq.<auth_uid>`
  Body: `{ "full_name": "Updated Name", "avatar_url": "https://..." }`
- **Security Interlock:** Direct PATCH requests attempting to modify `role`, `phone_verified`, `id_verified`, or `email_verified` will be rejected with `P0001` via `trg_prevent_verification_forgery`.

### 3.2 Property Discovery & Search (`public.properties`)
- **Public Feed (Paginated):**
  `GET /rest/v1/properties?status=eq.active&select=*&order=last_availability_check.desc`
  - Headers for pagination: `Range: 0-19` (fetches first 20 records)
  - Content-Range returned: `0-19/142`
- **Category Filter:**
  `GET /rest/v1/properties?status=eq.active&category=eq.family_stays`
- **Search by City / Locality:**
  `GET /rest/v1/properties?status=eq.active&city=ilike.*Delhi*`
- **Budget Ceiling Filter:**
  `GET /rest/v1/properties?status=eq.active&rent_amount=lte.25000`
- **Create Listing Draft (Host):**
  `POST /rest/v1/properties`
  - Mandatory fields: `title`, `locality`, `city`, `rent_amount`, `deposit_amount`, `provider_type`, `category`.
  - *Family Stay Constraint:* If `category = 'family_stays'`, must include `family_lives_on_property = true` and `provider_type = 'owner'`, or PostgreSQL constraint `chk_family_stay_eligibility` rejects the insertion.
  - *Moderation Safety:* Triggers automatically force `status := 'pending_review'`.

### 3.3 Flatmate Discovery & Compatibility (`public.public_flatmates`)
- **Browse Public Flatmate Feed (Secure View):**
  `GET /rest/v1/public_flatmates?select=*&order=created_at.desc`
  - Safely exposes public discovery fields (`full_name`, `avatar_url`, lifestyle habits, localities, budget, verification badges) without exposing private user emails or phone numbers.
- **Create / Update Personal Roommate Profile:**
  `POST /rest/v1/flatmate_profiles` (with `Prefer: resolution=merge-duplicates`)
  - Fields: `age`, `occupation`, `gender`, `has_room`, `room_details`, `target_localities`, `budget_max`, `food_habit`, `sleep_routine`, `cleanliness`, `pet_friendly`, `smoking`, `bio`, `interests`.
  - Anti-forgery trigger `trg_prevent_flatmate_verification_forgery` prevents client self-assertion of `verified = true`.
- **Client-Side Compatibility Calculation:**
  Execute rule-based 6-dimensional comparison (Food Habit, Sleep Schedule, Cleanliness standard, Pet policy, Smoking, and Budget) to generate transparent percentage scores (0–100) and explainable factor chips without third-party AI dependencies.

### 3.4 Inquiries & Viewing Requests (`public.interest_requests`)
- **Submit Inquiry:**
  `POST /rest/v1/interest_requests`
  - Body for property: `{ "property_id": "<uuid>", "sender_name": "...", "sender_email": "...", "message": "..." }`
  - Body for flatmate: `{ "target_flatmate_id": "<uuid>", "sender_name": "...", "sender_email": "...", "message": "..." }`
  - *Prerequisite Trigger:* Server verifies sender profile has `email_verified = true` and `phone_verified = true`.
- **Read Received Inquiries (Host or Targeted Flatmate):**
  `GET /rest/v1/interest_requests?select=*&order=created_at.desc`
  - RLS strictly filters to inquiries sent by `auth.uid()`, or inquiries where user is the property owner or targeted flatmate.

### 3.5 Rental Trust & Protection Portal
1. **Tenancy Agreements (`public.tenancy_agreements`):**
   `GET /rest/v1/tenancy_agreements?select=*` (Restricted by RLS to agreement landlord or tenant).
2. **Rent Payment Ledger (`public.rent_payment_records`):**
   `POST /rest/v1/rent_payment_records` (Logged by payer; confirmable only by recipient).
3. **Move-in / Move-out Condition Logs (`public.property_inspections`):**
   `POST /rest/v1/property_inspections` (Includes room photos and condition ratings).
4. **Two-Sided Reputation Reviews (`public.tenancy_reviews`):**
   `POST /rest/v1/tenancy_reviews` (Enforces verified tenancy agreement party eligibility via trigger).
5. **Rental Disputes & Mediation Ledger (`public.rental_disputes`):**
   `POST /rest/v1/rental_disputes` (Creates auditable dispute docket).

---

## 4. File Storage & Evidence Upload Protocols

### 4.1 Storage Buckets
| Bucket Name | Visibility | File Size Limit | Allowed MIME Types | Folder Structure Convention |
| :--- | :---: | :---: | :--- | :--- |
| `property-photos` | Public | 5 MB | `image/jpeg`, `image/png`, `image/webp` | `{user_id}/{filename}` |
| `rental-documents` | Private | 10 MB | `image/*`, `application/pdf` | `{agreement_id}/{filename}` |
| `support-attachments` | Private | 5 MB | `image/*`, `application/pdf` | `{ticket_number}/{filename}` |
| `reports` | Private | 5 MB | `image/*`, `application/pdf` | `{report_id}/{filename}` |

### 4.2 Native Upload Workflow
1. Upload file binary via Supabase Storage REST API:
   `POST /storage/v1/object/rental-documents/{agreement_id}/lease_draft.pdf`
2. For private buckets, retrieve a time-limited signed URL:
   `POST /storage/v1/object/sign/rental-documents/{agreement_id}/lease_draft.pdf`
   Body: `{ "expiresIn": 3600 }`
3. Store the scoped path string (`rental-documents/{agreement_id}/lease_draft.pdf`) in the database record.

---

## 5. Security & DPDP Compliance Guidelines for Native Clients

1. **Token Storage:** Tokens must be stored in OS-level hardware security modules (iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, Android `EncryptedSharedPreferences` backed by Android KeyStore). Never use unencrypted SharedPreferences or standard UserDefaults.
2. **Location Privacy:** Exact door/flat numbers and exact GPS coordinates must remain masked until an inquiry is accepted by the host. Only locality and city are displayed on public cards.
3. **No Financial Custody:** Native apps must clearly display statutory banners explaining that Aashvo does not custody rent or security deposits.
4. **State Regulatory Notices:** For Maharashtra-based listings, mobile UI must present the Section 55 Leave and License registration advisory.
