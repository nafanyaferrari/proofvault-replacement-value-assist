# ProofVault AI access plan

## Customer-facing launch policy

- **Free:** three one-time Try Before You Buy AI photo analyses.
- **Premium Home:** 500 AI assists per annual membership cycle.
- **Add-ons:** 100 additional AI assists when billing is enabled.
- **Household:** one account owner, one invited household member, and up to three active devices.

One AI assist analyzes one overview photo and returns an AI description, make/model/SN candidates, and an approximate replacement estimate. Users can upload additional evidence photos without an AI assist unless they explicitly request another AI analysis.

Do not market a truly unlimited plan at launch. A future higher-priced plan can be described as high-volume access only after actual usage, provider cost, and abuse data support a fair-use policy.

## Enforcement architecture

`supabase/migrations/0002_ai_entitlements.sql` creates an entitlement record, a server-written usage ledger, household/device tables, and an atomic assist-consumption function. New accounts receive the three-assist free trial automatically. A billing webhook should provision Premium with:

- `annual_assist_limit = 500`
- `household_member_limit = 1`
- `active_device_limit = 3`

For a 100-assist add-on, increment `annual_assist_limit` by 100 for the current cycle. Do not expose the Supabase service-role key to the browser or mobile app.

The billing/backend release must also enforce the household-member and active-device limits before issuing AI work. The migration stores those limits and device records; its browser UI is intentionally deferred until the secure release path exists.

The Vercel AI endpoint supports enforcement only after these server environment variables are set:

- `AI_USAGE_ENFORCEMENT=true`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Until then, the prototype presents its limits using browser-local counters. That is intentionally not a substitute for billing enforcement.
