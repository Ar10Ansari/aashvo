# Aashvo — Database Schema & Security Architecture

**Engine:** PostgreSQL 15+ (Supabase)  
**Security:** Row Level Security (RLS) Enabled on all tables  
**Status:** Approved  

---

## 1. Entity Relationship Overview

```mermaid
erDiagram
    PROFILES ||--o{ PROPERTIES : "owns/manages"
    PROFILES ||--o{ FLATMATE_PROFILES : "creates"
    PROFILES ||--o{ INTEREST_REQUESTS : "sends"
    PROFILES ||--o{ REPORTS : "files"
    PROPERTIES ||--o{ PROPERTY_PHOTOS : "contains"
    PROPERTIES ||--o{ INTEREST_REQUESTS : "receives"
    PROPERTIES ||--o{ REPORTS : "reported_by"
    
    PROFILES {
        uuid id PK
        text email
        text full_name
        text phone_number
        user_role role
        boolean phone_verified
        boolean id_verified
        timestamp created_at
    }

    PROPERTIES {
        uuid id PK
        uuid owner_id FK
        text title
        text description
        property_type prop_type
        room_type room_type
        text locality
        text city
        numeric rent_amount
        numeric deposit_amount
        numeric maintenance_charge
        numeric electricity_rate_per_unit
        provider_type provider_type
        numeric brokerage_fee
        furnishing_status furnishing
        text[] amenities
        text[] house_rules
        moderation_status status
        timestamp last_availability_check
        timestamp created_at
    }

    PROPERTY_PHOTOS {
        uuid id PK
        uuid property_id FK
        text photo_url
        text room_tag
        boolean is_primary
        int sort_order
    }

    FLATMATE_PROFILES {
        uuid id PK
        uuid user_id FK
        text headline
        text bio
        text locality_preference
        numeric target_budget
        gender_preference preferred_gender
        food_habit food_habit
        work_routine routine
        cleanliness_level cleanliness
        boolean has_room_already
        timestamp created_at
    }

    INTEREST_REQUESTS {
        uuid id PK
        uuid sender_id FK
        uuid property_id FK
        uuid recipient_flatmate_id FK
        text message
        request_status status
        timestamp created_at
    }

    REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid reported_property_id FK
        uuid reported_user_id FK
        text reason_code
        text details
        report_status status
        timestamp created_at
    }
```

---

## 2. Row Level Security (RLS) Policy Declarations

### 1. `properties` Table:
- **SELECT:** Public can read where `status = 'active'`. Owners can read their own regardless of status. Admins can read all.
- **INSERT:** Authenticated users only (`auth.uid() = owner_id`). Default `status = 'pending_review'`.
- **UPDATE:** Owners can update details and mark availability (`auth.uid() = owner_id`). Admins can update `status` and `moderation_notes`.
- **DELETE:** Owners can delete their own draft/paused listings; Admins can purge.

### 2. `flatmate_profiles` Table:
- **SELECT:** Public / Authenticated users can view active flatmate profiles. Contact info is masked unless mutual interest is accepted.
- **INSERT / UPDATE:** Only the profile owner (`auth.uid() = user_id`).

### 3. `interest_requests` Table:
- **SELECT:** Only the sender (`sender_id = auth.uid()`) or the recipient property owner / flatmate recipient.
- **INSERT:** Authenticated users only.

### 4. `reports` Table:
- **INSERT:** Authenticated users can submit reports.
- **SELECT / UPDATE:** Restrained strictly to users with role = `admin`.
