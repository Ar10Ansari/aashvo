-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('renter', 'owner', 'broker', 'admin');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'suspended', 'deleted_pending');

-- CreateEnum
CREATE TYPE "property_category" AS ENUM ('flats_rooms', 'family_stays');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('apartment', 'builder_floor', 'villa', 'gated_society');

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('private_room', 'shared_room', 'entire_flat');

-- CreateEnum
CREATE TYPE "provider_type" AS ENUM ('owner', 'tenant_flatmate', 'verified_manager');

-- CreateEnum
CREATE TYPE "furnishing_status" AS ENUM ('fully_furnished', 'semi_furnished', 'unfurnished');

-- CreateEnum
CREATE TYPE "gender_preference" AS ENUM ('any', 'female_only', 'male_only');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('pending_review', 'active', 'paused', 'rented', 'rejected');

-- CreateEnum
CREATE TYPE "meals_offered" AS ENUM ('included', 'optional_extra', 'none');

-- CreateEnum
CREATE TYPE "food_habit" AS ENUM ('Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan');

-- CreateEnum
CREATE TYPE "sleep_routine" AS ENUM ('Early Bird', 'Night Owl', 'Flexible');

-- CreateEnum
CREATE TYPE "cleanliness_level" AS ENUM ('Spotless', 'Moderate', 'Relaxed');

-- CreateEnum
CREATE TYPE "inquiry_status" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('open', 'in_review', 'awaiting_user', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ticket_sender_role" AS ENUM ('user', 'support', 'admin');

-- CreateEnum
CREATE TYPE "safety_target_type" AS ENUM ('listing', 'flatmate', 'user');

-- CreateEnum
CREATE TYPE "safety_report_status" AS ENUM ('pending', 'investigating', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "agreement_status" AS ENUM ('draft', 'active', 'terminated', 'expired');

-- CreateEnum
CREATE TYPE "payment_category" AS ENUM ('monthly_rent', 'security_deposit', 'maintenance', 'utility');

-- CreateEnum
CREATE TYPE "payment_verification_status" AS ENUM ('pending_confirmation', 'confirmed_by_landlord', 'disputed');

-- CreateEnum
CREATE TYPE "inspection_type" AS ENUM ('move_in', 'periodic', 'move_out');

-- CreateEnum
CREATE TYPE "tenancy_reviewer_role" AS ENUM ('landlord', 'tenant');

-- CreateEnum
CREATE TYPE "review_moderation_status" AS ENUM ('approved', 'flagged', 'hidden');

-- CreateEnum
CREATE TYPE "dispute_type" AS ENUM ('deposit_deduction', 'unpaid_rent', 'maintenance_responsibility', 'early_termination', 'other');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('open', 'under_review', 'resolved_tenant', 'resolved_landlord', 'dismissed');

-- CreateEnum
CREATE TYPE "media_bucket" AS ENUM ('property-photos', 'user-avatars', 'support-attachments', 'rental-documents');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('pending_upload', 'verified', 'deleted');

-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('email_verification', 'password_reset', 'guest_ticket_access');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'dispatched', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "password_hash_algorithm" VARCHAR(24),
    "password_reset_required" BOOLEAN NOT NULL DEFAULT false,
    "role" "user_role" NOT NULL DEFAULT 'renter',
    "account_status" "account_status" NOT NULL DEFAULT 'active',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone_number" VARCHAR(20),
    "role" "user_role" NOT NULL DEFAULT 'renter',
    "bio" VARCHAR(1000),
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "id_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "provider_email" CITEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "raw_claims" JSONB,
    "last_sign_in_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "replaced_by_hash" VARCHAR(128),
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "client_platform" VARCHAR(24) NOT NULL DEFAULT 'web',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" CITEXT,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "otp_hash" VARCHAR(128) NOT NULL,
    "attempts_remaining" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "property_category" NOT NULL DEFAULT 'flats_rooms',
    "property_type" "property_type" NOT NULL,
    "room_type" "room_type" NOT NULL,
    "furnishing" "furnishing_status" NOT NULL,
    "locality" VARCHAR(120) NOT NULL,
    "city" VARCHAR(80) NOT NULL DEFAULT 'Gurugram',
    "state" VARCHAR(80) NOT NULL DEFAULT 'Haryana',
    "pincode" VARCHAR(12),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "address_short" VARCHAR(240) NOT NULL,
    "rent_amount" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maintenance_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "electricity_rate_per_unit" DECIMAL(5,2),
    "brokerage_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "provider_type" "provider_type" NOT NULL,
    "gender_preference" "gender_preference" NOT NULL DEFAULT 'any',
    "bedrooms" INTEGER NOT NULL DEFAULT 1,
    "bathrooms" INTEGER NOT NULL DEFAULT 1,
    "available_from" VARCHAR(80) NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "house_rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "family_lives_on_property" BOOLEAN NOT NULL DEFAULT false,
    "meals_offered" "meals_offered" NOT NULL DEFAULT 'none',
    "optional_meal_cost" DECIMAL(10,2),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "moderation_reason" TEXT,
    "status" "moderation_status" NOT NULL DEFAULT 'pending_review',
    "last_availability_check" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "media_id" UUID,
    "photo_url" TEXT NOT NULL,
    "room_tag" VARCHAR(60),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flatmate_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "occupation" VARCHAR(120) NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" VARCHAR(32) NOT NULL,
    "has_room" BOOLEAN NOT NULL DEFAULT false,
    "room_details" TEXT,
    "target_localities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" VARCHAR(80) NOT NULL DEFAULT 'Gurugram',
    "budget_max" DECIMAL(10,2) NOT NULL,
    "food_habit" "food_habit" NOT NULL,
    "sleep_routine" "sleep_routine" NOT NULL,
    "cleanliness" "cleanliness_level" NOT NULL,
    "pet_friendly" BOOLEAN NOT NULL DEFAULT false,
    "smoking" VARCHAR(64) NOT NULL,
    "bio" TEXT NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flatmate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_requests" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "property_id" UUID,
    "target_flatmate_id" UUID,
    "sender_name" VARCHAR(120) NOT NULL,
    "sender_phone" VARCHAR(20) NOT NULL,
    "sender_email" CITEXT NOT NULL,
    "move_in_date" VARCHAR(60),
    "message" TEXT NOT NULL,
    "status" "inquiry_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interest_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "bucket" "media_bucket" NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "status" "media_status" NOT NULL DEFAULT 'pending_upload',
    "source_origin" VARCHAR(32) NOT NULL DEFAULT 's3',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancy_agreements" (
    "id" UUID NOT NULL,
    "property_id" UUID,
    "landlord_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "monthly_rent" DECIMAL(10,2) NOT NULL,
    "security_deposit" DECIMAL(10,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "agreement_status" "agreement_status" NOT NULL DEFAULT 'draft',
    "document_url" TEXT,
    "terms_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenancy_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_payment_records" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_category" "payment_category" NOT NULL,
    "payment_date" DATE NOT NULL,
    "receipt_url" TEXT,
    "transaction_reference" VARCHAR(120),
    "verification_status" "payment_verification_status" NOT NULL DEFAULT 'pending_confirmation',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_inspections" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "inspection_type" "inspection_type" NOT NULL,
    "conducted_by" UUID NOT NULL,
    "inspection_date" DATE NOT NULL,
    "room_name" VARCHAR(100) NOT NULL,
    "condition_rating" INTEGER NOT NULL,
    "damage_notes" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acknowledged_by_counterparty" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancy_reviews" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewee_id" UUID NOT NULL,
    "reviewer_role" "tenancy_reviewer_role" NOT NULL,
    "communication_rating" INTEGER NOT NULL,
    "maintenance_rating" INTEGER NOT NULL,
    "property_care_rating" INTEGER NOT NULL,
    "agreement_clarity_rating" INTEGER NOT NULL,
    "overall_rating" DECIMAL(2,1) NOT NULL,
    "review_title" VARCHAR(140),
    "review_content" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "moderation_status" "review_moderation_status" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenancy_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_disputes" (
    "id" UUID NOT NULL,
    "dispute_number" VARCHAR(32) NOT NULL,
    "agreement_id" UUID NOT NULL,
    "initiator_id" UUID NOT NULL,
    "respondent_id" UUID NOT NULL,
    "dispute_type" "dispute_type" NOT NULL,
    "disputed_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'open',
    "evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolution_summary" TEXT,
    "assigned_moderator_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "rental_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(32) NOT NULL,
    "user_id" UUID,
    "user_email" CITEXT NOT NULL,
    "user_name" VARCHAR(120) NOT NULL,
    "user_phone" VARCHAR(20),
    "category" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "reference_listing_id" UUID,
    "reference_user_id" UUID,
    "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "status" "ticket_status" NOT NULL DEFAULT 'open',
    "assigned_to" UUID,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID,
    "sender_name" VARCHAR(120) NOT NULL,
    "sender_role" "ticket_sender_role" NOT NULL DEFAULT 'user',
    "message" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_audit_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(120) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "reporter_email" CITEXT,
    "target_type" "safety_target_type" NOT NULL,
    "reported_property_id" UUID,
    "reported_flatmate_id" UUID,
    "reported_user_id" UUID,
    "target_title" VARCHAR(200) NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "details" TEXT NOT NULL,
    "evidence_url" TEXT,
    "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "status" "safety_report_status" NOT NULL DEFAULT 'pending',
    "assigned_to" UUID,
    "admin_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,

    CONSTRAINT "safety_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "property_id" UUID,
    "reason_code" VARCHAR(64) NOT NULL,
    "details" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(24),
    "event_type" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(128),
    "outcome" VARCHAR(24) NOT NULL,
    "ip_address" VARCHAR(64),
    "request_id" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "channel" VARCHAR(24) NOT NULL,
    "template_key" VARCHAR(64) NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_phone_number_idx" ON "profiles"("phone_number");

-- CreateIndex
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_provider_subject_key" ON "oauth_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_revoked_at_idx" ON "refresh_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_purpose_idx" ON "verification_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "phone_otp_challenges_phone_number_created_at_idx" ON "phone_otp_challenges"("phone_number", "created_at");

-- CreateIndex
CREATE INDEX "phone_otp_challenges_user_id_created_at_idx" ON "phone_otp_challenges"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "properties_status_city_category_idx" ON "properties"("status", "city", "category");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "properties_rent_amount_idx" ON "properties"("rent_amount");

-- CreateIndex
CREATE INDEX "properties_last_availability_check_idx" ON "properties"("last_availability_check" DESC);

-- CreateIndex
CREATE INDEX "property_photos_property_id_sort_order_idx" ON "property_photos"("property_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "flatmate_profiles_user_id_key" ON "flatmate_profiles"("user_id");

-- CreateIndex
CREATE INDEX "flatmate_profiles_city_budget_max_idx" ON "flatmate_profiles"("city", "budget_max");

-- CreateIndex
CREATE INDEX "interest_requests_sender_id_created_at_idx" ON "interest_requests"("sender_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "interest_requests_property_id_status_idx" ON "interest_requests"("property_id", "status");

-- CreateIndex
CREATE INDEX "interest_requests_target_flatmate_id_status_idx" ON "interest_requests"("target_flatmate_id", "status");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_bucket_idx" ON "media_assets"("owner_id", "bucket");

-- CreateIndex
CREATE INDEX "media_assets_status_created_at_idx" ON "media_assets"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_bucket_object_key_key" ON "media_assets"("bucket", "object_key");

-- CreateIndex
CREATE INDEX "tenancy_agreements_landlord_id_agreement_status_idx" ON "tenancy_agreements"("landlord_id", "agreement_status");

-- CreateIndex
CREATE INDEX "tenancy_agreements_tenant_id_agreement_status_idx" ON "tenancy_agreements"("tenant_id", "agreement_status");

-- CreateIndex
CREATE INDEX "tenancy_agreements_property_id_idx" ON "tenancy_agreements"("property_id");

-- CreateIndex
CREATE INDEX "rent_payment_records_agreement_id_payment_date_idx" ON "rent_payment_records"("agreement_id", "payment_date" DESC);

-- CreateIndex
CREATE INDEX "rent_payment_records_payer_id_idx" ON "rent_payment_records"("payer_id");

-- CreateIndex
CREATE INDEX "rent_payment_records_recipient_id_idx" ON "rent_payment_records"("recipient_id");

-- CreateIndex
CREATE INDEX "property_inspections_agreement_id_created_at_idx" ON "property_inspections"("agreement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenancy_reviews_reviewee_id_moderation_status_idx" ON "tenancy_reviews"("reviewee_id", "moderation_status");

-- CreateIndex
CREATE UNIQUE INDEX "tenancy_reviews_agreement_id_reviewer_id_key" ON "tenancy_reviews"("agreement_id", "reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_disputes_dispute_number_key" ON "rental_disputes"("dispute_number");

-- CreateIndex
CREATE INDEX "rental_disputes_agreement_id_status_idx" ON "rental_disputes"("agreement_id", "status");

-- CreateIndex
CREATE INDEX "rental_disputes_initiator_id_idx" ON "rental_disputes"("initiator_id");

-- CreateIndex
CREATE INDEX "rental_disputes_status_idx" ON "rental_disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_ticket_number_user_email_idx" ON "support_tickets"("ticket_number", "user_email");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "ticket_audit_events_ticket_id_created_at_idx" ON "ticket_audit_events"("ticket_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "safety_reports_status_priority_created_at_idx" ON "safety_reports"("status", "priority", "created_at" DESC);

-- CreateIndex
CREATE INDEX "safety_reports_reporter_id_idx" ON "safety_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_created_at_idx" ON "audit_logs"("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_outbox_status_available_at_idx" ON "notification_outbox"("status", "available_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_otp_challenges" ADD CONSTRAINT "phone_otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flatmate_profiles" ADD CONSTRAINT "flatmate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_target_flatmate_id_fkey" FOREIGN KEY ("target_flatmate_id") REFERENCES "flatmate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_agreements" ADD CONSTRAINT "tenancy_agreements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_agreements" ADD CONSTRAINT "tenancy_agreements_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_agreements" ADD CONSTRAINT "tenancy_agreements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payment_records" ADD CONSTRAINT "rent_payment_records_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenancy_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payment_records" ADD CONSTRAINT "rent_payment_records_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payment_records" ADD CONSTRAINT "rent_payment_records_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_inspections" ADD CONSTRAINT "property_inspections_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenancy_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_inspections" ADD CONSTRAINT "property_inspections_conducted_by_fkey" FOREIGN KEY ("conducted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_reviews" ADD CONSTRAINT "tenancy_reviews_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenancy_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_reviews" ADD CONSTRAINT "tenancy_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_reviews" ADD CONSTRAINT "tenancy_reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_disputes" ADD CONSTRAINT "rental_disputes_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenancy_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_disputes" ADD CONSTRAINT "rental_disputes_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_disputes" ADD CONSTRAINT "rental_disputes_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_disputes" ADD CONSTRAINT "rental_disputes_assigned_moderator_id_fkey" FOREIGN KEY ("assigned_moderator_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reference_listing_id_fkey" FOREIGN KEY ("reference_listing_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reference_user_id_fkey" FOREIGN KEY ("reference_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_audit_events" ADD CONSTRAINT "ticket_audit_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_audit_events" ADD CONSTRAINT "ticket_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_property_id_fkey" FOREIGN KEY ("reported_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_flatmate_id_fkey" FOREIGN KEY ("reported_flatmate_id") REFERENCES "flatmate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
