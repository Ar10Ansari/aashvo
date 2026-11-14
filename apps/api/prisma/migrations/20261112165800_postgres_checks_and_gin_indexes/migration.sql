-- PostgreSQL constraints, partial unique indexes, and GIN indexes complementary to Prisma schema

ALTER TABLE properties
  ADD CONSTRAINT chk_properties_non_negative_money
    CHECK (rent_amount >= 0 AND deposit_amount >= 0 AND maintenance_charge >= 0 AND brokerage_fee >= 0),
  ADD CONSTRAINT chk_family_stay_eligibility
    CHECK (
      category = 'flats_rooms'
      OR (
        category = 'family_stays'
        AND provider_type = 'owner'
        AND family_lives_on_property = true
        AND meals_offered IN ('included', 'optional_extra', 'none')
      )
    );

ALTER TABLE flatmate_profiles
  ADD CONSTRAINT chk_flatmate_adult_age CHECK (age >= 18),
  ADD CONSTRAINT chk_flatmate_budget_positive CHECK (budget_max > 0);

ALTER TABLE interest_requests
  ADD CONSTRAINT chk_interest_request_target CHECK (
    (property_id IS NOT NULL AND target_flatmate_id IS NULL)
    OR (property_id IS NULL AND target_flatmate_id IS NOT NULL)
  );

ALTER TABLE tenancy_agreements
  ADD CONSTRAINT chk_tenancy_distinct_parties CHECK (landlord_id <> tenant_id),
  ADD CONSTRAINT chk_tenancy_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT chk_tenancy_amounts CHECK (monthly_rent >= 0 AND security_deposit >= 0);

ALTER TABLE rent_payment_records
  ADD CONSTRAINT chk_payment_distinct_parties CHECK (payer_id <> recipient_id),
  ADD CONSTRAINT chk_payment_positive_amount CHECK (amount > 0);

ALTER TABLE property_inspections
  ADD CONSTRAINT chk_inspection_rating_range CHECK (condition_rating BETWEEN 1 AND 5);

ALTER TABLE tenancy_reviews
  ADD CONSTRAINT chk_review_distinct_parties CHECK (reviewer_id <> reviewee_id),
  ADD CONSTRAINT chk_review_ratings_range CHECK (
    communication_rating BETWEEN 1 AND 5
    AND maintenance_rating BETWEEN 1 AND 5
    AND property_care_rating BETWEEN 1 AND 5
    AND agreement_clarity_rating BETWEEN 1 AND 5
    AND overall_rating BETWEEN 1.0 AND 5.0
  );

ALTER TABLE rental_disputes
  ADD CONSTRAINT chk_dispute_distinct_parties CHECK (initiator_id <> respondent_id),
  ADD CONSTRAINT chk_dispute_non_negative_amount CHECK (disputed_amount >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_dispute_per_agreement_type
  ON rental_disputes (agreement_id, dispute_type)
  WHERE status IN ('open', 'under_review');

CREATE INDEX IF NOT EXISTS idx_properties_active_featured
  ON properties (city, last_availability_check DESC)
  WHERE status = 'active' AND featured = true;

CREATE INDEX IF NOT EXISTS idx_properties_amenities_gin ON properties USING GIN (amenities);
CREATE INDEX IF NOT EXISTS idx_flatmates_localities_gin ON flatmate_profiles USING GIN (target_localities);
CREATE INDEX IF NOT EXISTS idx_flatmates_interests_gin ON flatmate_profiles USING GIN (interests);

