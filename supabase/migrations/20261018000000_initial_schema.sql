-- ====================================================================
-- Aashvo — PostgreSQL / Supabase Schema & Row Level Security (RLS)
-- Version: 1.0.0
-- Locality: Delhi NCR Pilot
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES (Idempotent creation with comprehensive label validation)
DO $$
DECLARE
    missing_labels text[];
    expected_labels text[] := ARRAY['renter', 'owner', 'broker', 'admin'];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('renter', 'owner', 'broker', 'admin');
    ELSE
        SELECT ARRAY(
            SELECT unnest(expected_labels)
            EXCEPT
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'user_role'
        ) INTO missing_labels;

        IF cardinality(missing_labels) > 0 THEN
            RAISE EXCEPTION 'Incompatible existing enum "user_role": missing required labels: %', array_to_string(missing_labels, ', ');
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_type') THEN
        CREATE TYPE property_type AS ENUM ('apartment', 'builder_floor', 'villa', 'gated_society');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN
        CREATE TYPE room_type AS ENUM ('private_room', 'shared_room', 'entire_flat');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_type') THEN
        CREATE TYPE provider_type AS ENUM ('owner', 'tenant_flatmate', 'verified_manager');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'furnishing_status') THEN
        CREATE TYPE furnishing_status AS ENUM ('fully_furnished', 'semi_furnished', 'unfurnished');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_preference') THEN
        CREATE TYPE gender_preference AS ENUM ('any', 'female_only', 'male_only');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
        CREATE TYPE moderation_status AS ENUM ('pending_review', 'active', 'paused', 'rented', 'rejected');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'food_habit') THEN
        CREATE TYPE food_habit AS ENUM ('Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sleep_routine') THEN
        CREATE TYPE sleep_routine AS ENUM ('Early Bird', 'Night Owl', 'Flexible');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleanliness_level') THEN
        CREATE TYPE cleanliness_level AS ENUM ('Spotless', 'Moderate', 'Relaxed');
    END IF;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role user_role DEFAULT 'renter'::user_role NOT NULL,
    avatar_url TEXT,
    phone_verified BOOLEAN DEFAULT FALSE NOT NULL,
    id_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. PROPERTIES TABLE
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    locality TEXT NOT NULL,
    city TEXT DEFAULT 'Gurugram' NOT NULL,
    address_short TEXT NOT NULL,
    property_type property_type DEFAULT 'apartment'::property_type NOT NULL,
    room_type room_type DEFAULT 'private_room'::room_type NOT NULL,
    furnishing furnishing_status DEFAULT 'fully_furnished'::furnishing_status NOT NULL,
    rent_amount NUMERIC(10, 2) NOT NULL CHECK (rent_amount > 0),
    deposit_amount NUMERIC(10, 2) NOT NULL CHECK (deposit_amount >= 0),
    maintenance_charge NUMERIC(10, 2) DEFAULT 0 NOT NULL CHECK (maintenance_charge >= 0),
    electricity_rate_per_unit NUMERIC(5, 2) DEFAULT 8.0 NOT NULL CHECK (electricity_rate_per_unit >= 0),
    brokerage_fee NUMERIC(10, 2) DEFAULT 0 NOT NULL CHECK (brokerage_fee >= 0),
    provider_type provider_type DEFAULT 'owner'::provider_type NOT NULL,
    gender_preference gender_preference DEFAULT 'any'::gender_preference NOT NULL,
    bedrooms INT DEFAULT 1 NOT NULL,
    bathrooms INT DEFAULT 1 NOT NULL,
    available_from TEXT DEFAULT 'Immediately' NOT NULL,
    amenities TEXT[] DEFAULT '{}' NOT NULL,
    house_rules TEXT[] DEFAULT '{}' NOT NULL,
    status moderation_status DEFAULT 'pending_review'::moderation_status NOT NULL,
    last_availability_check TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. PROPERTY PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.property_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    room_tag TEXT DEFAULT 'Bedroom' NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. FLATMATE PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.flatmate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    occupation TEXT NOT NULL,
    age INT NOT NULL CHECK (age >= 18),
    gender TEXT NOT NULL,
    has_room BOOLEAN DEFAULT FALSE NOT NULL,
    room_details TEXT,
    target_localities TEXT[] DEFAULT '{}' NOT NULL,
    budget_max NUMERIC(10, 2) NOT NULL CHECK (budget_max > 0),
    food_habit food_habit DEFAULT 'Vegetarian'::food_habit NOT NULL,
    sleep_routine sleep_routine DEFAULT 'Flexible'::sleep_routine NOT NULL,
    cleanliness cleanliness_level DEFAULT 'Spotless'::cleanliness_level NOT NULL,
    pet_friendly BOOLEAN DEFAULT TRUE NOT NULL,
    smoking TEXT DEFAULT 'No' NOT NULL,
    bio TEXT NOT NULL,
    interests TEXT[] DEFAULT '{}' NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. INTEREST REQUESTS (Gated Contact Flow)
CREATE TABLE IF NOT EXISTS public.interest_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    target_flatmate_id UUID REFERENCES public.flatmate_profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    move_in_date TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. COMMUNITY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.listing_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reason_code TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id)
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flatmate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. POLICIES (Idempotent Reconciled Policy Creation)
-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
CREATE POLICY "Users can update only their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- PROPERTIES POLICIES
DROP POLICY IF EXISTS "Active properties are viewable by everyone" ON public.properties;
CREATE POLICY "Active properties are viewable by everyone"
ON public.properties FOR SELECT
TO anon, authenticated
USING (status = 'active' OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can create property listings" ON public.properties;
CREATE POLICY "Authenticated users can create property listings"
ON public.properties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their own properties" ON public.properties;
CREATE POLICY "Owners can update their own properties"
ON public.properties FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners can delete their own properties" ON public.properties;
CREATE POLICY "Owners can delete their own properties"
ON public.properties FOR DELETE
TO authenticated
USING (auth.uid() = owner_id OR public.is_admin());

-- PROPERTY PHOTOS POLICIES
DROP POLICY IF EXISTS "Photos of active properties are readable by anyone" ON public.property_photos;
CREATE POLICY "Photos of active properties are readable by anyone"
ON public.property_photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_photos.property_id
    AND (p.status = 'active' OR p.owner_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Owners can manage photos of their properties" ON public.property_photos;
CREATE POLICY "Owners can manage photos of their properties"
ON public.property_photos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_photos.property_id
    AND (p.owner_id = auth.uid() OR public.is_admin())
  )
);

-- INTEREST REQUESTS POLICIES
DROP POLICY IF EXISTS "Users can view their sent or received interest requests" ON public.interest_requests;
CREATE POLICY "Users can view their sent or received interest requests"
ON public.interest_requests FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = interest_requests.property_id AND p.owner_id = auth.uid()
  ) OR
  public.is_admin()
);

DROP POLICY IF EXISTS "Authenticated users can send interest requests" ON public.interest_requests;
CREATE POLICY "Authenticated users can send interest requests"
ON public.interest_requests FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- REPORTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.listing_reports;
CREATE POLICY "Authenticated users can submit reports"
ON public.listing_reports FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view and resolve reports" ON public.listing_reports;
CREATE POLICY "Only admins can view and resolve reports"
ON public.listing_reports FOR ALL
TO authenticated
USING (public.is_admin());

-- ====================================================================
-- INDICES FOR PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_properties_locality ON public.properties(locality);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_rent ON public.properties(rent_amount);
CREATE INDEX IF NOT EXISTS idx_properties_freshness ON public.properties(last_availability_check DESC);
CREATE INDEX IF NOT EXISTS idx_flatmates_localities ON public.flatmate_profiles USING GIN(target_localities);
