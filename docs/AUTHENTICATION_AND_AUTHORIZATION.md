# Authentication and Authorization

## Identity

Supabase Auth is the only production identity provider. Supported flows are
email/password signup, email confirmation, password reset, session refresh,
logout, and Google OAuth when the provider is configured in Supabase.

The application creates or repairs a matching `public.profiles` row after an
authenticated session is restored. The database trigger also provisions
profiles during Auth user creation. Both paths default new users to `renter`.

## Protected actions

Email and phone verification are evaluated for inquiries and listings. The
client may show requirements, but database triggers and RLS remain authoritative.

Client localStorage, demo personas, hidden buttons, and frontend role values do
not grant administrative authority. Admin actions require a trusted Supabase
identity and database role checks.

## Privacy boundaries

- Direct private profiles are limited to the profile owner or administrators.
- Public profiles omit phone numbers and email addresses.
- Public listings use the masked discovery view.
- Inquiries are visible only to the sender, authorized listing owner or target
  flatmate, and administrators.
- Rental documents use a private bucket with counterparty access policies.
- Internal support notes are excluded from customer responses.

## Production limitation

This repository does not contain Supabase credentials. Live authentication and
hosted RLS verification require configured Vercel/Supabase environments.
