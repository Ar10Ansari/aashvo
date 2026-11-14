-- AASHVO Master Feature Expansion Migration
-- 1. Create Enums
CREATE TYPE "saved_item_type" AS ENUM ('property', 'flatmate_profile', 'connect_profile', 'family_stay');
CREATE TYPE "visit_status" AS ENUM ('pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'rejected');
CREATE TYPE "property_verification_status" AS ENUM ('not_submitted', 'submitted', 'under_review', 'verified', 'rejected', 'expired');
CREATE TYPE "notification_category" AS ENUM (
  'connect_match',
  'connect_message',
  'visit_request',
  'visit_update',
  'property_inquiry',
  'property_verification',
  'agreement_update',
  'inspection_update',
  'listing_alert',
  'support_update'
);

-- 2. Extend Property Inspections (Move-In Checklist)
ALTER TABLE "property_inspections"
  ADD COLUMN "meter_readings" JSONB DEFAULT '{}',
  ADD COLUMN "inventory" JSONB DEFAULT '[]',
  ADD COLUMN "key_handover_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deposit_confirmed" BOOLEAN NOT NULL DEFAULT false;

-- 3. Create Saved Items Table
CREATE TABLE "saved_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "item_type" "saved_item_type" NOT NULL,
  "target_id" UUID NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_saved_items_no_self" CHECK ("user_id" <> "target_id"),
  CONSTRAINT "uq_saved_items_user_target" UNIQUE ("user_id", "item_type", "target_id"),
  CONSTRAINT "fk_saved_items_user" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_saved_items_user_created" ON "saved_items"("user_id", "created_at" DESC);

-- 4. Create Property Visits Table
CREATE TABLE "property_visits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "property_id" UUID NOT NULL,
  "visitor_id" UUID NOT NULL,
  "host_id" UUID NOT NULL,
  "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "visit_status" NOT NULL DEFAULT 'pending',
  "visitor_message" TEXT,
  "host_notes" TEXT,
  "rescheduled_at" TIMESTAMPTZ(6),
  "rescheduled_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "property_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_property_visits_no_self" CHECK ("visitor_id" <> "host_id"),
  CONSTRAINT "fk_property_visits_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_property_visits_visitor" FOREIGN KEY ("visitor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_property_visits_host" FOREIGN KEY ("host_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_property_visits_prop_time" ON "property_visits"("property_id", "scheduled_at");
CREATE INDEX "idx_property_visits_visitor" ON "property_visits"("visitor_id", "created_at" DESC);
CREATE INDEX "idx_property_visits_host" ON "property_visits"("host_id", "created_at" DESC);
CREATE UNIQUE INDEX "uq_property_confirmed_visit" ON "property_visits"("property_id", "scheduled_at") WHERE "status" = 'confirmed';

-- 5. Create Property Verifications Table
CREATE TABLE "property_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "property_id" UUID NOT NULL,
  "submitted_by" UUID NOT NULL,
  "status" "property_verification_status" NOT NULL DEFAULT 'submitted',
  "document_type" VARCHAR(64) NOT NULL,
  "document_url" VARCHAR(1024) NOT NULL,
  "owner_id_type" VARCHAR(64) NOT NULL,
  "reviewed_by" UUID,
  "review_notes" TEXT,
  "rejection_reason" TEXT,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "property_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_property_verifications_property" UNIQUE ("property_id"),
  CONSTRAINT "fk_property_verifications_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_property_verifications_submitter" FOREIGN KEY ("submitted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_property_verifications_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_property_verifications_status" ON "property_verifications"("status", "submitted_at");

-- 6. Create User Notifications Table
CREATE TABLE "user_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "category" "notification_category" NOT NULL,
  "target_url" VARCHAR(512),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_user_notifications_user" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_user_notifications_unread" ON "user_notifications"("user_id", "read", "created_at" DESC);

