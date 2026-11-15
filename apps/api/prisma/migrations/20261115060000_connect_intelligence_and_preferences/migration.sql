-- CreateTable: User Matching Preferences for Connect Intelligence
CREATE TABLE "user_matching_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "budget_weight" INTEGER NOT NULL DEFAULT 20,
  "location_weight" INTEGER NOT NULL DEFAULT 20,
  "lifestyle_weight" INTEGER NOT NULL DEFAULT 20,
  "food_weight" INTEGER NOT NULL DEFAULT 15,
  "sleep_weight" INTEGER NOT NULL DEFAULT 10,
  "move_in_weight" INTEGER NOT NULL DEFAULT 10,
  "interests_weight" INTEGER NOT NULL DEFAULT 5,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_matching_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_matching_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_user_matching_preferences_user_id" UNIQUE ("user_id")
);
