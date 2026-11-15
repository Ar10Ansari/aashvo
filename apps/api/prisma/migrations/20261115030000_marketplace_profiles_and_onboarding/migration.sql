-- AASHVO Multi-Persona Marketplace Profiles & Progressive Onboarding Migration

-- 1. Create Marketplace Profile Enums
CREATE TYPE "marketplace_profile_type" AS ENUM (
  'flatmate_seeker',
  'property_owner',
  'family_stay_host',
  'family_stay_seeker'
);

CREATE TYPE "marketplace_profile_status" AS ENUM (
  'draft',
  'active',
  'paused'
);

-- 2. Extend Flatmate Profiles with Progressive Onboarding & Structured Requirements
ALTER TABLE "flatmate_profiles"
  ADD COLUMN "state" VARCHAR(80) DEFAULT 'Haryana',
  ADD COLUMN "country" VARCHAR(80) DEFAULT 'India',
  ADD COLUMN "budget_min" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN "move_in_date" VARCHAR(60),
  ADD COLUMN "move_in_flexible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "room_type" "room_type",
  ADD COLUMN "furnishing" "furnishing_status",
  ADD COLUMN "drinking" VARCHAR(64) DEFAULT 'Prefer not to say',
  ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "college_or_workplace" VARCHAR(160),
  ADD COLUMN "social_lifestyle" VARCHAR(64),
  ADD COLUMN "wfh_habits" VARCHAR(64),
  ADD COLUMN "noise_tolerance" VARCHAR(64),
  ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true;

-- 3. Create Multi-Persona Marketplace Profiles Table
CREATE TABLE "marketplace_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "profile_type" "marketplace_profile_type" NOT NULL,
  "status" "marketplace_profile_status" NOT NULL DEFAULT 'draft',
  "is_current_active" BOOLEAN NOT NULL DEFAULT false,
  "display_name" VARCHAR(120),
  "completion_percent" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketplace_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_marketplace_profiles_user_type" UNIQUE ("user_id", "profile_type")
);

-- 4. Create Indexes
CREATE INDEX "marketplace_profiles_user_id_is_current_active_idx" ON "marketplace_profiles"("user_id", "is_current_active");
