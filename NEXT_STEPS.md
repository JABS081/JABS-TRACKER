# JABS TRACKER — Go-Live Sequence

1. Create/choose the production Supabase project.
2. Apply the three SQL migrations in order.
3. Create at least one authenticated user and a company membership or individual account record.
4. Create real assets in `public.assets` and register devices.
5. Configure Vercel environment variables from `.env.example`.
6. Configure the approved map tile provider, routing provider and geocoding provider.
7. Run `npm install` and `npm run build` locally.
8. Deploy to Vercel.
9. Update hardware/phone GPS endpoints to the deployed `/api/telemetry` endpoint.
10. Configure Stripe test-mode Price IDs and webhook secret.
11. Execute the Phase 8 test matrix before switching Stripe to live mode.
12. Only after security, tenant isolation and webhook tests pass, move the configured Stripe Prices and keys to live mode.
