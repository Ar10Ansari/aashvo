# AASHVO Known Limitations & Operational Considerations

**Document Version:** 1.0.0  
**Status:** Monitored Non-Blockers  

---

## 1. Third-Party External Integrations

- **Google OAuth Production Client ID:**
  - Local and test environments utilize mocked RSA signing and local verification keys.
  - In production, valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables must be populated in Render backend settings.
- **Supabase S3 Storage Bucket:**
  - Photo uploads fallback to local data URIs / Unsplash presets when hosted Supabase Storage keys are absent in development.
  - Production deployments require configured `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. In-Memory Services (Future Hardening Targets)

- **WebSocket Realtime Gateway:**
  - Realtime messaging uses in-memory pub/sub for local instances. For multi-replica Render autoscaling, an Upstash Redis adapter should be introduced.
- **SMS Gateway for Phone OTP:**
  - Phone authentication currently logs verification OTP to console in development. Twilio / Gupshup provider integration should be configured for production SMS delivery.
