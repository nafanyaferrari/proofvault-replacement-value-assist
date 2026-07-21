# Supabase free-tier setup for ProofVault

This adds the real backend foundation for the demo while keeping the local browser backup mode intact.

## 1. Create a free Supabase project

Create a project at <https://supabase.com>. The free tier is enough for early testing of:

- email-link auth
- Postgres inventory/incident/location records
- private storage buckets for item photos and documents

## 2. Apply the schema

Open Supabase → SQL Editor → New query, paste the contents of:

`supabase/migrations/0001_proofvault_foundation.sql`

Run it once.

## 3. Add app environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Use the public anon key only. Do not put a service-role key in the mobile app or web client.

## 4. Configure auth redirect URLs

In Supabase → Authentication → URL Configuration:

- Site URL for local dev: `http://localhost:5173`
- Add the deployed Vercel URL when ready: `https://proofvault-app.vercel.app`

## 5. Run locally

```bash
npm run dev
```

Go to Settings → Cloud sync. Send yourself a magic link, sign in, then upload local demo data to Supabase.

## What this does not do yet

- It does not upload every photo/blob to Supabase Storage yet. It creates private buckets and policies so the next step can move large photo data out of browser storage.
- It does not enforce paid subscriptions server-side yet. Current premium/free mode is still demo-mode until real payments/auth claims are added.
- It does not run live AI analysis yet. AI calls should be made from a backend endpoint so provider keys stay off the client.
