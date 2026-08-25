# Backend Setup

The Vercel API layer uses Supabase service-role access server-side. The service-role key must never be exposed as a `VITE_*` variable.

Required server variables:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- JABS_TELEMETRY_INGEST_KEY (bootstrap only; registered device credentials are stored hashed)
- ALLOWED_ORIGINS
- APP_URL
- ROUTING_URL when a routing provider is enabled
- Stripe variables from `.env.example` when billing is enabled

The `/api/telemetry` endpoint uses device-level credentials and checks that the device is active, not revoked, and bound to the submitted asset.
