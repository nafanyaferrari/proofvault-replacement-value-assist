# AI Photo Intake Backend Plan

ProofVault now has a secure backend seam for real photo analysis while preserving the no-paid-service demo path.

## Current flow

1. The user takes or uploads an item photo.
2. The web app calls `POST /api/analyze-item`.
3. The API route returns a `SecureItemIntakeResponse`.
4. If server-side AI env vars are missing, the route returns a clearly labeled backend mock.
5. The user reviews the draft before any AI-filled field is treated as inventory evidence.

## Testing AI configuration

For the test/demo phase, use Gemini on the server side:

```env
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-3.5-flash
```

Do not prefix these with `VITE_`. They must not be exposed in the browser or mobile app.

Gemini is the first provider checked by `POST /api/analyze-item`. If `GEMINI_API_KEY` is present, the route uses Gemini. If it is absent, the route can fall back to OpenAI if OpenAI env vars are present, then to the backend mock.

## Later production AI configuration

Configure these only on the server/Vercel side:

```env
OPENAI_API_KEY=
OPENAI_VISION_MODEL=
```

Use this later when you are ready to move from Gemini testing to OpenAI for production/app-store customers.

The browser may optionally set:

```env
VITE_AI_INTAKE_BACKEND_URL=/api/analyze-item
```

## Backend contract

The shared domain package includes:

- `SecureItemIntakeRequest`
- `SecureItemIntakeResponse`
- `SecureItemIntakeBackendClient`
- `createSecureBackendItemIntakeAnalyzer`

These live in `packages/domain/src/itemIntakeBackendContract.ts`. Web and mobile can keep calling the same `ItemIntakeAnalyzer` interface while the backend provider changes over time.

## Security rules

- Never ship OpenAI, OCR, eBay, Amazon, Walmart, Best Buy, or other provider API keys in the web or mobile client.
- Serial numbers and barcodes extracted from images must be marked for user verification.
- Store only the minimum photo data needed for the task.
- Keep valuation language framed as an approximate replacement estimate, not an appraisal or guaranteed insurance value.

## Next backend upgrades

- Add server-side provider usage logging so testing costs can be tracked.
- Add OpenAI production model selection when switching off Gemini testing.
- Add server-side auth checks before accepting large photo-analysis requests.
- Add rate limits and per-user usage tracking before opening this to broader testing.
