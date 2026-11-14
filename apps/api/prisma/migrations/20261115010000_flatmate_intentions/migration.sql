-- CreateEnum
CREATE TYPE "flatmate_intention" AS ENUM ('has_room', 'needs_room', 'team_up');

-- AlterTable
ALTER TABLE "flatmate_profiles" ADD COLUMN "intentions" "flatmate_intention"[] NOT NULL DEFAULT ARRAY[]::"flatmate_intention"[];

-- Backfill existing rows based on has_room
UPDATE "flatmate_profiles"
SET "intentions" = CASE
  WHEN "has_room" = true THEN ARRAY['has_room']::"flatmate_intention"[]
  ELSE ARRAY['needs_room', 'team_up']::"flatmate_intention"[]
END;

