-- CreateEnum
CREATE TYPE "flatmate_interest_type" AS ENUM ('like', 'pass');

-- CreateEnum
CREATE TYPE "flatmate_match_status" AS ENUM ('active', 'unmatched', 'blocked');

-- AlterTable
ALTER TABLE "flatmate_profiles" ADD COLUMN "discovery_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "flatmate_interests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "interest_type" "flatmate_interest_type" NOT NULL DEFAULT 'like',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flatmate_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flatmate_matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user1_id" UUID NOT NULL,
    "user2_id" UUID NOT NULL,
    "status" "flatmate_match_status" NOT NULL DEFAULT 'active',
    "matched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_interaction_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flatmate_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "details" VARCHAR(1000),
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Constraints
CREATE UNIQUE INDEX "flatmate_interests_sender_id_target_user_id_key" ON "flatmate_interests"("sender_id", "target_user_id");
CREATE INDEX "flatmate_interests_target_user_id_interest_type_idx" ON "flatmate_interests"("target_user_id", "interest_type");
CREATE INDEX "flatmate_interests_sender_id_created_at_idx" ON "flatmate_interests"("sender_id", "created_at" DESC);

CREATE UNIQUE INDEX "flatmate_matches_user1_id_user2_id_key" ON "flatmate_matches"("user1_id", "user2_id");
CREATE INDEX "flatmate_matches_user1_id_status_idx" ON "flatmate_matches"("user1_id", "status");
CREATE INDEX "flatmate_matches_user2_id_status_idx" ON "flatmate_matches"("user2_id", "status");
CREATE INDEX "flatmate_matches_last_interaction_at_idx" ON "flatmate_matches"("last_interaction_at" DESC);

CREATE INDEX "match_messages_match_id_created_at_idx" ON "match_messages"("match_id", "created_at" ASC);
CREATE INDEX "match_messages_sender_id_idx" ON "match_messages"("sender_id");

CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "user_blocks"("blocker_id", "blocked_id");
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

CREATE INDEX "user_reports_reported_id_status_idx" ON "user_reports"("reported_id", "status");
CREATE INDEX "user_reports_reporter_id_idx" ON "user_reports"("reporter_id");

-- Foreign Keys
ALTER TABLE "flatmate_interests" ADD CONSTRAINT "flatmate_interests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flatmate_interests" ADD CONSTRAINT "flatmate_interests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flatmate_matches" ADD CONSTRAINT "flatmate_matches_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flatmate_matches" ADD CONSTRAINT "flatmate_matches_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "flatmate_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain Check Constraints for Safety
ALTER TABLE "flatmate_interests" ADD CONSTRAINT "ck_flatmate_interests_no_self" CHECK ("sender_id" <> "target_user_id");
ALTER TABLE "flatmate_matches" ADD CONSTRAINT "ck_flatmate_matches_lexicographical" CHECK ("user1_id" < "user2_id");
ALTER TABLE "user_blocks" ADD CONSTRAINT "ck_user_blocks_no_self" CHECK ("blocker_id" <> "blocked_id");

