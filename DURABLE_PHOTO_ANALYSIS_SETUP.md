# Durable Photo Analysis Setup

This feature makes signed-in ProofVault uploads resilient: the photo is placed in private Supabase Storage before AI analysis begins, then a durable job retries provider outages without requiring another upload.

## One-time Supabase step

In the Supabase SQL Editor, run:

`supabase/migrations/0003_durable_photo_analysis_jobs.sql`

Then run:

`supabase/migrations/0004_multi_photo_intake.sql`

Together these create the private per-user job queue and let one job safely hold an overview photo plus close-ups of the same item. Do not loosen its row-level-security policies.

## Required Vercel environment variables

Add these as **Production** environment variables. Do not prefix any of them with `VITE_`.

| Name | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | The Supabase **service_role** key. Server-only; never expose it in the browser. |
| `PROOFVAULT_QUEUE_WORKER_SECRET` | A newly generated random string, at least 32 characters. |
| `CRON_SECRET` | A different newly generated random string, at least 32 characters. |
| `PROOFVAULT_APP_URL` | `https://proofvault-app.vercel.app` |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are also accepted by server routes. The current project already has browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; keep those for the client.

## Scheduling behavior

The included `vercel.json` schedules one daily recovery pass at 02:17 UTC. It is compatible with Vercel Hobby, where scheduled functions may run only once a day and the exact time is not guaranteed. Each invocation claims one job atomically, which prevents duplicate analysis but means Hobby is only a safety net—not a suitable paid-customer processing schedule.

While a signed-in user has ProofVault open, the app starts eligible jobs immediately and checks progress every 12 seconds. The daily job protects photos after the browser closes.

Before charging customers, change the schedule to every five minutes and use a Vercel plan that supports minute-level cron schedules:

```json
{ "path": "/api/process-analysis-jobs", "schedule": "*/5 * * * *" }
```

## What customers experience

- Each photo is safely stored before it is analyzed.
- For one item, users can submit up to four photos: one overview plus close-ups of the make/model, serial number, barcode, or condition.
- If the overview contains multiple distinct items, ProofVault creates separate unsaved review cards so the user chooses which records to keep.
- A provider outage puts the job into `retrying`; no credit is used.
- Completed analysis drafts appear automatically in the normal bulk-review flow.
- After ten unsuccessful attempts, the job is marked failed but the original private photo remains stored for support or manual review.

## Independent provider fallback

The server already tries OpenAI automatically when Gemini remains unavailable, but only after these server-only variables are added:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI server API key. Never use a `VITE_` prefix. |
| `OPENAI_VISION_MODEL` | The supported OpenAI vision model you choose for production. |

A second Gemini model helps with model congestion; OpenAI is the independent fallback for a Google-wide interruption.
