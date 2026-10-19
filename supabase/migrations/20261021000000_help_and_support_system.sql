-- ====================================================================
-- Aashvo — Help & Support System, Contextual Reporting & Moderation
-- Migration: 20261021000000_help_and_support_system.sql
-- Security Hardened: Strict RLS, Audit Logging, Role Isolation
-- ====================================================================

-- 1. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'account_login',
        'finding_flatmates',
        'rooms_listings',
        'family_stays_meals',
        'location',
        'verification',
        'privacy_safety',
        'technical_issues',
        'billing_fraud',
        'other'
    )),
    subject TEXT NOT NULL CHECK (char_length(trim(subject)) >= 5),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
    reference_listing_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    reference_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'awaiting_user', 'resolved', 'closed')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexing for fast search and user lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(user_email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- 2. TICKET MESSAGES / REPLIES THREAD TABLE
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'support', 'admin')),
    message TEXT NOT NULL CHECK (char_length(trim(message)) >= 1),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_internal ON public.ticket_messages(is_internal);

-- 3. TICKET AUDIT EVENTS (Strict Admin Log)
CREATE TABLE IF NOT EXISTS public.ticket_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_audit_events_ticket_id ON public.ticket_audit_events(ticket_id);

-- 4. UNIFIED SAFETY & FRAUD REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.safety_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_email TEXT,
    target_type TEXT NOT NULL CHECK (target_type IN ('listing', 'flatmate', 'user')),
    reported_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason_code TEXT NOT NULL CHECK (reason_code IN (
        'scam_fraud',
        'misleading_charges',
        'unavailable_listing',
        'duplicate_fake',
        'inappropriate_conduct',
        'harassment',
        'other'
    )),
    details TEXT NOT NULL CHECK (char_length(trim(details)) >= 10),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON public.safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_priority ON public.safety_reports(priority);
CREATE INDEX IF NOT EXISTS idx_safety_reports_property ON public.safety_reports(reported_property_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_user ON public.safety_reports(reported_user_id);

-- 5. FUNCTION & TRIGGER: Validate Status Transitions State Machine
CREATE OR REPLACE FUNCTION public.fn_validate_ticket_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If status hasn't changed, allow
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Enforce state machine rules:
    -- 'closed' is terminal
    IF OLD.status = 'closed' THEN
        RAISE EXCEPTION 'Aashvo Security: Closed tickets cannot be transitioned. A new ticket must be submitted.';
    END IF;

    -- 'resolved' can only transition to 'closed' or reopen to 'in_review'
    IF OLD.status = 'resolved' AND NEW.status NOT IN ('closed', 'in_review') THEN
        RAISE EXCEPTION 'Aashvo Security: Resolved tickets can only be confirmed as closed or reopened for review.';
    END IF;

    -- Update timestamps
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
        NEW.resolved_at = TIMEZONE('utc'::text, NOW());
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ticket_status_transition ON public.support_tickets;
CREATE TRIGGER trg_validate_ticket_status_transition
BEFORE UPDATE OF status ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_ticket_status_transition();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;

-- Helper function to verify admin status
CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- --------------------------------------------------------------------
-- A. SUPPORT TICKETS POLICIES
-- --------------------------------------------------------------------

-- 1. Insert: Both authenticated and anonymous users can create tickets
CREATE POLICY "Anyone can create a support ticket"
ON public.support_tickets FOR INSERT
WITH CHECK (
    user_email IS NOT NULL AND
    char_length(trim(user_email)) > 3 AND
    (auth.uid() IS NULL OR user_id = auth.uid())
);

-- 2. Select: Ticket owners can read their own tickets
CREATE POLICY "Users can view their own support tickets"
ON public.support_tickets FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    public.is_support_admin()
);

-- 3. Update: Strictly restricted to support admins
CREATE POLICY "Only admins can update support tickets"
ON public.support_tickets FOR UPDATE
USING (public.is_support_admin())
WITH CHECK (public.is_support_admin());

-- --------------------------------------------------------------------
-- B. TICKET MESSAGES POLICIES
-- --------------------------------------------------------------------

-- 1. Select: Ticket owners can view non-internal messages; admins can view all
CREATE POLICY "Users can view public messages on their tickets"
ON public.ticket_messages FOR SELECT
USING (
    public.is_support_admin() OR (
        is_internal = FALSE AND
        EXISTS (
            SELECT 1 FROM public.support_tickets
            WHERE id = ticket_messages.ticket_id AND user_id = auth.uid()
        )
    )
);

-- 2. Insert: Ticket owners can send public messages; admins can send public and internal messages
CREATE POLICY "Users and admins can add messages to tickets"
ON public.ticket_messages FOR INSERT
WITH CHECK (
    public.is_support_admin() OR (
        is_internal = FALSE AND
        sender_role = 'user' AND
        EXISTS (
            SELECT 1 FROM public.support_tickets
            WHERE id = ticket_messages.ticket_id AND user_id = auth.uid()
        )
    )
);

-- --------------------------------------------------------------------
-- C. TICKET AUDIT EVENTS POLICIES
-- --------------------------------------------------------------------

-- Audit events are strictly accessible and writable only by authorized admins
CREATE POLICY "Audit events strictly visible to admins"
ON public.ticket_audit_events FOR SELECT
USING (public.is_support_admin());

CREATE POLICY "Audit events strictly insertable by admins"
ON public.ticket_audit_events FOR INSERT
WITH CHECK (public.is_support_admin());

-- --------------------------------------------------------------------
-- D. SAFETY REPORTS POLICIES
-- --------------------------------------------------------------------

-- 1. Insert: Authenticated or guest users can submit safety reports
CREATE POLICY "Anyone can submit a safety report"
ON public.safety_reports FOR INSERT
WITH CHECK (
    details IS NOT NULL AND
    char_length(trim(details)) >= 10 AND
    (auth.uid() IS NULL OR reporter_id = auth.uid())
);

-- 2. Select & Update: Strictly restricted to admins (reported hosts cannot see reports)
CREATE POLICY "Safety reports visible only to admins"
ON public.safety_reports FOR SELECT
USING (public.is_support_admin());

CREATE POLICY "Safety reports modifiable only by admins"
ON public.safety_reports FOR UPDATE
USING (public.is_support_admin())
WITH CHECK (public.is_support_admin());

-- ====================================================================
-- STORAGE BUCKET: support-attachments
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'support-attachments',
    'support-attachments',
    FALSE,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage Access Policies:
-- Upload: Authenticated users can upload evidence to their own folder
CREATE POLICY "Users can upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'support-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Download: Ticket owner and admins can download attachments
CREATE POLICY "Users and admins can download support attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'support-attachments' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_support_admin()
    )
);
