# AASHVO — NEON SCHEMA COMPARISON REPORT

**Author**: Principal Database Architect  
**Reviewer / Approver**: AASHVO CTO  
**Date**: November 15, 2026  
**Status**: Read-Only Audit Comparison Completed  

---

## 1. High-Level Comparison Matrix

| Architectural Layer | Local PostgreSQL 16 (Port 5433) | Neon PostgreSQL 18.7 (Singapore) | Expected Target After Migration |
| :--- | :--- | :--- | :--- |
| **Engine Version** | PostgreSQL 16.16 | PostgreSQL 18.7 (a21afb5) | PostgreSQL 18.7 |
| **Database Name** | `aashvo_test` / `aashvo_dev` | `neondb` | `neondb` |
| **Active Schema** | `public` | `public` | `public` |
| **Installed Extensions**| `citext` (1.6), `plpgsql` (1.0) | `plpgsql` (1.0) (*`citext` 1.8 available*) | `citext` (1.8), `plpgsql` (1.0) |
| **Custom ENUM Types** | **38** enums | **0** enums | **38** enums |
| **Total Tables** | **33** tables | **0** tables | **33** tables |
| **Application Tables** | **32** tables | **0** tables | **32** tables |
| **Migration Tables** | `_prisma_migrations` (5 rows) | None | `_prisma_migrations` (5 rows) |
| **Total Constraints** | **120** constraints | **0** constraints | **120** constraints |
| **Foreign Keys** | **65** foreign keys | **0** foreign keys | **65** foreign keys |
| **Check Constraints** | **20** check constraints | **0** check constraints | **20** check constraints |
| **User / Test Data** | Local development & test rows | **0 rows** (*Strictly Isolated*) | Pure schema only; zero local test data |

---

## 2. Table-by-Table Structural Comparison

Below is the exhaustive inventory of all 33 tables in the AASHVO database architecture, comparing local presence, column definitions, index count, and current Neon state:

| # | Table Name | Columns | Local Row Count | Local Indexes | Neon State | Expected Migration Source |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **01** | `_prisma_migrations` | 8 | 5 | 1 | Absent | Prisma Migrate bootstrap |
| **02** | `users` | 13 | 7 | 3 | Absent | `20261112165753_init_independent_schema` |
| **03** | `profiles` | 12 | 7 | 3 | Absent | `20261112165753_init_independent_schema` |
| **04** | `oauth_identities` | 9 | 0 | 3 | Absent | `20261112165753_init_independent_schema` |
| **05** | `refresh_sessions` | 12 | 8 | 5 | Absent | `20261112165753_init_independent_schema` |
| **06** | `verification_tokens` | 8 | 7 | 4 | Absent | `20261112165753_init_independent_schema` |
| **07** | `phone_otp_challenges` | 8 | 0 | 3 | Absent | `20261112165753_init_independent_schema` |
| **08** | `properties` | 36 | 3 | 7 | Absent | `20261112165753_init_independent_schema` & GIN index |
| **09** | `property_photos` | 8 | 3 | 2 | Absent | `20261112165753_init_independent_schema` |
| **10** | `flatmate_profiles` | 22 | 4 | 5 | Absent | `init` + `connect` + `intentions` |
| **11** | `interest_requests` | 12 | 2 | 4 | Absent | `20261112165753_init_independent_schema` |
| **12** | `media_assets` | 11 | 0 | 4 | Absent | `20261112165753_init_independent_schema` |
| **13** | `tenancy_agreements` | 13 | 1 | 4 | Absent | `20261112165753_init_independent_schema` |
| **14** | `rent_payment_records` | 12 | 0 | 4 | Absent | `20261112165753_init_independent_schema` |
| **15** | `property_inspections` | 16 | 1 | 2 | Absent | `init` + `master_feature_expansion` |
| **16** | `tenancy_reviews` | 15 | 0 | 3 | Absent | `20261112165753_init_independent_schema` |
| **17** | `rental_disputes` | 15 | 1 | 6 | Absent | `20261112165753_init_independent_schema` & partial uq |
| **18** | `support_tickets` | 19 | 1 | 5 | Absent | `20261112165753_init_independent_schema` |
| **19** | `ticket_messages` | 9 | 2 | 2 | Absent | `20261112165753_init_independent_schema` |
| **20** | `ticket_audit_events` | 9 | 0 | 2 | Absent | `20261112165753_init_independent_schema` |
| **21** | `safety_reports` | 18 | 0 | 3 | Absent | `20261112165753_init_independent_schema` |
| **22** | `listing_reports` | 9 | 0 | 1 | Absent | `20261112165753_init_independent_schema` |
| **23** | `audit_logs` | 11 | 31 | 4 | Absent | `20261112165753_init_independent_schema` |
| **24** | `notification_outbox` | 11 | 6 | 2 | Absent | `20261112165753_init_independent_schema` |
| **25** | `flatmate_interests` | 6 | 2 | 4 | Absent | `20261115000000_aashvo_connect_matching` |
| **26** | `flatmate_matches` | 8 | 1 | 5 | Absent | `20261115000000_aashvo_connect_matching` |
| **27** | `match_messages` | 7 | 2 | 3 | Absent | `20261115000000_aashvo_connect_matching` |
| **28** | `user_blocks` | 5 | 0 | 3 | Absent | `20261115000000_aashvo_connect_matching` |
| **29** | `user_reports` | 7 | 0 | 3 | Absent | `20261115000000_aashvo_connect_matching` |
| **30** | `saved_items` | 6 | 1 | 3 | Absent | `20261115020000_master_feature_expansion` |
| **31** | `property_visits` | 12 | 1 | 5 | Absent | `20261115020000_master_feature_expansion` |
| **32** | `property_verifications` | 15 | 1 | 3 | Absent | `20261115020000_master_feature_expansion` |
| **33** | `user_notifications` | 10 | 5 | 2 | Absent | `20261115020000_master_feature_expansion` |

---

## 3. Enumerated Types (ENUMs) Inventory

The following **38 custom PostgreSQL ENUMs** are defined across the 5 migrations and will be instantiated on Neon:

1. `account_status` (`active`, `suspended`, `deleted_pending`)
2. `agreement_status` (`draft`, `active`, `terminated`, `expired`)
3. `auth_token_purpose` (`email_verification`, `password_reset`, `guest_ticket_access`)
4. `cleanliness_level` (`Spotless`, `Moderate`, `Relaxed`)
5. `dispute_status` (`open`, `under_review`, `resolved_tenant`, `resolved_landlord`, `dismissed`)
6. `dispute_type` (`deposit_deduction`, `unpaid_rent`, `maintenance_responsibility`, `early_termination`, `other`)
7. `flatmate_intention` (`has_room`, `needs_room`, `team_up`)
8. `flatmate_interest_type` (`like`, `pass`)
9. `flatmate_match_status` (`active`, `unmatched`, `blocked`)
10. `food_habit` (`Vegetarian`, `Non-Vegetarian`, `Eggetarian`, `Vegan`)
11. `furnishing_status` (`fully_furnished`, `semi_furnished`, `unfurnished`)
12. `gender_preference` (`any`, `female_only`, `male_only`)
13. `inquiry_status` (`pending`, `accepted`, `declined`)
14. `inspection_type` (`move_in`, `periodic`, `move_out`)
15. `meals_offered` (`included`, `optional_extra`, `none`)
16. `media_bucket` (`property-photos`, `user-avatars`, `support-attachments`, `rental-documents`)
17. `media_status` (`pending_upload`, `verified`, `deleted`)
18. `moderation_status` (`pending_review`, `active`, `paused`, `rented`, `rejected`)
19. `notification_category` (`connect_match`, `connect_message`, `visit_request`, `visit_update`, `property_inquiry`, `property_verification`, `agreement_update`, `inspection_update`, `listing_alert`, `support_update`)
20. `outbox_status` (`pending`, `dispatched`, `failed`)
21. `payment_category` (`monthly_rent`, `security_deposit`, `maintenance`, `utility`)
22. `payment_verification_status` (`pending_confirmation`, `confirmed_by_landlord`, `disputed`)
23. `property_category` (`flats_rooms`, `family_stays`)
24. `property_type` (`apartment`, `builder_floor`, `villa`, `gated_society`)
25. `property_verification_status` (`not_submitted`, `submitted`, `under_review`, `verified`, `rejected`, `expired`)
26. `provider_type` (`owner`, `tenant_flatmate`, `verified_manager`)
27. `review_moderation_status` (`approved`, `flagged`, `hidden`)
28. `room_type` (`private_room`, `shared_room`, `entire_flat`)
29. `safety_report_status` (`pending`, `investigating`, `resolved`, `dismissed`)
30. `safety_target_type` (`listing`, `flatmate`, `user`)
31. `saved_item_type` (`property`, `flatmate_profile`, `connect_profile`, `family_stay`)
32. `sleep_routine` (`Early Bird`, `Night Owl`, `Flexible`)
33. `tenancy_reviewer_role` (`landlord`, `tenant`)
34. `ticket_priority` (`low`, `medium`, `high`, `urgent`)
35. `ticket_sender_role` (`user`, `support`, `admin`)
36. `ticket_status` (`open`, `in_review`, `awaiting_user`, `resolved`, `closed`)
37. `user_role` (`renter`, `owner`, `broker`, `admin`)
38. `visit_status` (`pending`, `confirmed`, `rescheduled`, `completed`, `cancelled`, `rejected`)

---

## 4. Advanced Constraints & Indexes Comparison

### A. GIN Indexes (Search & Array Matching)
- `idx_properties_amenities_gin` on `properties USING GIN (amenities)`
- `idx_flatmates_localities_gin` on `flatmate_profiles USING GIN (target_localities)`
- `idx_flatmates_interests_gin` on `flatmate_profiles USING GIN (interests)`
*Status on Neon*: **Verified compatible.** Neon PostgreSQL 18.7 natively supports GIN indexing on text arrays.

### B. Domain Check Constraints
- `chk_properties_non_negative_money`: Ensures monetary amounts >= 0.
- `chk_family_stay_eligibility`: Restricts Family Stays to properties where owner family lives on site.
- `chk_flatmate_adult_age`: Restricts flatmate matching eligibility to age >= 18.
- `ck_flatmate_interests_no_self`: Prevents users from sending likes/passes to themselves.
- `ck_flatmate_matches_lexicographical`: Enforces `user1_id < user2_id` to prevent duplicate or conflicting match rows.
- `ck_property_visits_no_self`: Prevents users from requesting visits to their own properties.
*Status on Neon*: **Verified compatible.**

---

## 5. Data Privacy & Local Isolation Confirmation

- **Zero Data Copying**: As mandated by the CTO, no records from the local test tables (e.g. 7 test users, 3 properties, 31 audit logs) will be transferred into Neon.
- **Migration Deployment Scope**: `prisma migrate deploy` will create the database structure, constraints, and indexes only.
- **Staging Starting Point**: Neon will begin as a verified, empty, production-grade schema awaiting explicit staging seed or production traffic.

