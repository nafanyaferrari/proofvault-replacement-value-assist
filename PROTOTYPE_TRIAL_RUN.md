# ProofVault prototype trial run

Use this checklist for the first live prototype pass after deployment.

## Before opening the app

- Vercel Deployment Protection is off for the public URL.
- Public URL: https://proofvault-app.vercel.app
- Supabase Auth allowed redirect URLs include:
  - https://proofvault-app.vercel.app
  - http://localhost:5173
- Vercel production environment variables are present:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY`
  - `GEMINI_VISION_MODEL`

## Suggested test accounts

Use two email addresses you control:

- Free user test account
- Premium demo test account

Feature access is still mocked in the app for this prototype, so switch **Premium demo access** in Settings during the walkthrough. Premium shows a 500-assist annual allowance, but it is not a paid subscription or secure customer entitlement yet.

## Signed-out local demo flow

1. Open https://proofvault-app.vercel.app in a fresh private/incognito window.
2. Confirm the first screen invites you to try the local demo before signing in.
3. Confirm the feature preview mentions walk-around bulk photos, make/model/SN review, Replacement Value Assist, and incident packets.
4. Select Open local demo.
5. Confirm the Start Here screen shows **Try Before You Buy** with three free AI photo analyses.
6. Open the sample Trek bicycle item and confirm Replacement Value Assist shows an estimate, comparables, confidence, checked date, and disclaimer.
7. Confirm the review queue includes an AI/SN verification sample so the reviewer flow is visible outside signed-in accounts.
8. Confirm local demo data is labeled as separate from signed-in account data.

## Free user flow

1. Open https://proofvault-app.vercel.app in a fresh private/incognito window.
2. Sign in with the free test email.
3. Confirm the account starts empty.
4. Confirm the top status banner says signed-in account and Free demo access.
5. On Start Here, use one free Try Before You Buy photo analysis and confirm it creates a reviewable draft with description, make/model/SN candidate, and estimate.
6. Confirm the status shows two trial analyses remain. Use the remaining two, then confirm a fourth photo asks for Premium.
7. Open Inventory and confirm manual entry remains available on Free.
8. Add an item manually.
9. Confirm the first fields are Item name, Location, Make, Model, Serial Number (SN), and value.
10. Add at least one item photo manually.
11. Add a serial-number photo manually if available.
12. Add a user-entered replacement value manually.
13. Save the item.
14. Confirm the app shows an autosave status.
15. Refresh the page and confirm the item remains in the signed-in account.

## Premium demo flow

1. Switch the account to Premium demo access in Settings.
2. Return to Start Here and confirm the Premium status shows 500 annual AI assists remaining.
3. Use "Add many photos" with two or more clear item photos, one overview photo per item. Confirm the browser workflow limits one batch to 12 photos.
4. Confirm ProofVault saves each successful draft and creates a review queue of photo drafts.
5. Confirm the bulk review screen prioritizes Item name, Make, Model, Serial Number (SN), Location, and Value.
6. Confirm each AI-filled SN is treated as something to verify, not a guaranteed identifier.
7. Save one draft, then use "Save all drafts for later" for the rest. Confirm the individually reviewed draft does not remain flagged for AI review.
8. Refresh before finishing a second batch and confirm **Resume review** restores the saved drafts. Open Inventory and confirm the saved drafts appear.
9. Use "Add one photo" with a clear item photo.
10. Confirm the single-item draft includes AI-filled description, make/model help, and a serial candidate if visible.
11. Save the draft.
12. Open the item detail screen.
13. Confirm Replacement Value Assist shows a value estimate, confidence, checked date, disclaimer, and comparables.
14. Confirm the main value button says "Estimate replacement cost."
15. Confirm the item persists after refresh.

## Incident export flow

1. Open Incident Mode.
2. Create a new incident.
3. Select at least one affected item.
4. Add incident details and save.
5. Open the incident packet.
6. Confirm the export preview includes:
   - user-entered value
   - approximate replacement estimate
   - confidence rating
   - checked date
   - disclaimer
   - comparable links for Premium
7. Try Copy, CSV, and Print / Save PDF.

## Expected prototype limitations

- Premium access is still a prototype test setting. The 500-assist counter and Try Before You Buy counts are browser-scoped only; the secure enforcement migration is prepared but billing, household invitations, and device controls are not active yet.
- Marketplace value lookup is mocked.
- Live AI photo analysis uses Gemini for testing.
- Multi-device conflict handling is basic snapshot sync, not full conflict resolution yet.
