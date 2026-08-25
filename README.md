# JABS TRACKER — Production-Oriented Command Center

JABS TRACKER is a real operational visibility platform for authorized trucks, ships and phones. This package removes the old demo workspace from the application flow and uses Supabase authentication + tenant-aware data as the source of truth.

## Architecture

- React + Vite frontend
- Supabase Auth + Postgres + Realtime
- Universal `assets` model: TRUCK / SHIP / PHONE
- Leaflet map runtime with provider configuration through environment variables
- Real browser phone geolocation intake through `/api/telemetry`
- Secure device credential checks and asset binding
- Realtime asset/alert subscriptions
- Historical location trail loading
- Routing provider abstraction through `/api/routing/route`
- Stripe REST integration endpoints with signed webhook verification
- Vercel API functions

## Important

The application does **not** insert demo assets. A new environment with no authorized assets will show an empty state until real assets are created in the connected database.

External services cannot be marked production-ready until their credentials and provider configuration are supplied and tested.

## Environment

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` or server secrets.

## Supabase migrations

Apply these migrations in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_universal_assets_security.sql`
3. `supabase/migrations/003_billing.sql`

Review the generated SQL in a staging project before production execution.

## Local

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Vercel

Set the frontend `VITE_*` variables and server-only variables in the Vercel project settings. Deploy from GitHub with the included `vercel.json`.

## Real GPS

Dedicated devices must be registered to an asset and use the `x-jabs-device-key` credential. The API rejects missing, invalid, revoked, cross-asset and unauthorized submissions.

## Phone tracking

An authorized phone user grants browser location permission, selects their registered phone asset, enters the registered device credential and starts tracking. Coordinates are sent to `/api/telemetry` and update the same universal asset stream.

## Billing

Stripe is disabled until server-side Stripe secrets and Price IDs are configured. The frontend never activates paid access by itself. Subscription state is updated by the verified webhook.

## Map

Set `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION`. Do not rely on an undocumented hard-coded public tile endpoint in production.
