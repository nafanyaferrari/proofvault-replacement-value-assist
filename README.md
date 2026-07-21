# ProofVault web demo

A responsive, local-first demo of ProofVault and its premium **Replacement Value Assist** module. Built with React, TypeScript, and Vite for GitHub/Vercel deployment. The domain models and service boundary are intentionally portable to the planned Expo/SQLite mobile app.

## Run locally

```bash
npm install
npm run dev
```

## Test the feature

1. Open the local demo or sign in, then use **Walk around and add many photos** / **Add many photos** to create a saved batch of reviewable item drafts. Use one clear overview photo per item; the web demo processes up to 12 items per batch for reliable browser storage.
2. Review the essential fields first: item name, location, make, model, Serial Number (SN), and value. Use **Save this item** or **Save all drafts for later** depending on how quickly you want to move through the batch. Drafts survive a refresh and can be resumed from Start Here or Inventory.
3. Use the **Bulk review queue** or **Review next** to spot missing make/model, serial candidates, AI-prefilled records, missing values, and missing supporting evidence.
4. In free mode, use up to three **Try Before You Buy** AI photo analyses. Each successful photo creates a draft with an AI description, make/model/SN candidate, and approximate replacement estimate; confirm the fields still need user review.
5. Confirm a fourth free AI photo analysis asks for Premium demo access, while manual item and value entry remains available.
6. Open Settings and switch the prototype test setting to Premium demo access.
6. Try **Add one photo** again or open an item and choose **Estimate replacement cost**.
7. Save or select a comparable value.
8. Open Incident and generate the packet. It includes the estimate, comparable links, checked date, confidence, and disclaimer.

The signed-out local demo is stored in browser `localStorage`. Signed-in accounts load and autosave their inventory, evidence references, incidents, locations, prototype access setting, and batch defaults to the user's private Supabase account. Opening the local demo starts from fresh sample data, so it does not reuse a prior signed-in account's browser cache. Free access includes three **Try Before You Buy** AI photo analyses per browser scope (local demo or signed-in browser account); the count is deliberately labeled as prototype-only and is not secure billing or a cross-device entitlement. Marketplace results are mocked and adapters are defined for a future secure backend; API keys must never be put in the client.

The launch access design is three free analyses, then **500 Premium AI assists per annual cycle**, with planned 100-assist add-ons. Premium is intended for one owner, one invited household member, and three active devices—not password sharing. The billing-ready Supabase migration and server enforcement handoff are documented in `AI_ACCESS_PLAN.md`; browser counters remain a prototype-only preview until the secure backend variables and billing webhook are enabled.

Photo-first intake can use the secure AI endpoint when configured, and it falls back to a fixed mock result for local demo/testing. This proves the intended low-effort flow—photos, AI-prefilled drafts, user verification, optional premium estimate—without putting AI or marketplace API keys in the client.

The future live-AI handoff is documented in `AI_INTAKE_BACKEND_PLAN.md`. The shared domain package includes a secure backend contract so real vision/OCR and marketplace providers can be added later without exposing API keys in the web or mobile app.

For the web demo, selected intake photos are resized in the browser before saved review drafts are written to `localStorage`. The browser flow intentionally limits each batch to 12 item photos, saves each successful draft as it is created, skips unreadable images without abandoning the rest, and lets the user resume saved drafts after a refresh. Web and mobile fast intake support batch location and room defaults so a user can document one area at a time with less repeated typing. Settings shows an approximate browser storage meter and the app warns instead of falsely saving when browser storage is full. The future mobile app stores evidence files in app-private storage rather than browser storage.

Web and mobile both surface a shared bulk review queue for records that still need follow-up, such as adding make/model, verifying serial candidates, reviewing AI-prefilled details, adding values, or attaching receipt/appraisal evidence. Overview metrics show how many active records still need quick review. The queue prioritizes make/model, serial, and AI-prefill checks first, shows the top backlog count, summarizes remaining issue types, lists all remaining checks for each queued item, and **Review next** opens the top record directly for editing. Once a user reviews and saves an AI-prefilled record, the AI-review flag is cleared while the AI description remains available on the item. Opening a queued item shows the same checklist on the item detail screen, including quick serial correction and quick manual value entry when those are the missing pieces. When the backlog is clear, the queue shows a confirmation card instead of disappearing.

Settings includes **Reset demo data** for walkthroughs and QA. Download a backup first if you want to keep the current browser records. Web backups include inventory, incidents, locations, subscription mode, and fast-intake batch defaults; restore/reset rolls back safely if browser storage rejects the write.

Before approving a deploy, run the web checklist in `WEB_PREDEPLOY_QA.md`.


## Deploy

Import the repository into Vercel. The included `vercel.json` supports client-side routing; the default Vite build settings are sufficient.

## Mobile preparation

The normalized SQLite schema and web-to-mobile plan live in `mobile/`. The schema has been executed against SQLite in memory to validate table, index, constraint, and foreign-key syntax. Shared models, completeness scoring, valuation contracts, and the mock valuation engine live in `packages/domain` for both web and mobile.

The Expo scaffold is in `apps/mobile`, with dependencies installed and checked against Expo SDK 56. Run `npm run start --workspace @proofvault/mobile` and open it with Expo Go or an emulator. Estimates selected with **Use this value** persist with their comparable listings in the device SQLite database.

The mobile inventory screen can set batch location/room defaults before taking photo-intake pictures, and those defaults persist in SQLite app settings. New mobile records support **Save & add another** / **Save & photograph another** so a user can keep moving through a room without restarting the workflow after every item. The mobile item screen can take a camera photo or choose one from the device library. ProofVault copies selected evidence into its private documents directory and stores the durable local URI and metadata in SQLite.

Mobile users can optionally enable App Lock. The preference is stored with Expo SecureStore, unlocking uses the device biometric/passcode flow, and the vault relocks when the app leaves the foreground.

Run `npm run bundle:native --workspace @proofvault/mobile` to verify Metro can produce both Android and iOS bundles. Hardware acceptance steps are documented in `mobile/DEVICE_ACCEPTANCE.md`.

The mobile demo subscription is stored in SQLite and can be switched between free and premium without payment. Free mode keeps manual value entry available but blocks automatic comparable lookup; premium enables lookup and estimate persistence.

Mobile evidence capture distinguishes general item photos, serial-number photos, and owner-marking photos. Marking text, location, and distinguishing features are stored with the item and contribute to completeness.

Receipts, appraisals, warranties, and other supporting PDFs or images can be selected with the native document picker. Files are copied from temporary picker storage into ProofVault's private documents directory and categorized in SQLite.

Damage or loss photos have a separate mobile capture category and gallery so they remain distinguishable from general inventory evidence.

The mobile Incidents tab can create a dated incident, select affected inventory, assign stolen/damaged/destroyed/missing/recovered status per item, and persist the relationships transactionally in SQLite.

Mobile incident packets are generated as local text files and shared through the native system sheet. They include values, estimate range, confidence, checked date, evidence counts, disclaimer, and premium-only comparable links.

Mobile incidents can be reopened and edited, including owner contact details, police agency/case number, and insurance company/claim number. A schema migration adds these fields to existing local databases.

Each affected item can carry incident-specific notes. Incident deletion requires destructive confirmation and removes only the incident and its link rows, never the underlying inventory or evidence.

Mobile inventory uses archive/restore instead of deletion. Archived items leave the active list but remain resolvable, with their valuations and evidence, in historical incident views and exports.

Incident-specific camera/library photos attach to an affected item within one incident. They remain separate from general and damage/loss inventory evidence, persist through incident edits, and appear as a labeled count in shared packets.

The mobile Settings tab contains reusable saved locations, App Lock, demo subscription controls, privacy guidance, and About information. Saved locations appear as one-tap suggestions in the item editor while free-text locations remain supported.

Mobile Settings can export and restore an exact SQLite database image. Restore validates the file header, database integrity, and required ProofVault tables before replacement. This database-only backup preserves records and file references but does not embed app-private photo/document files, so Settings can also export a JSON attachment manifest listing the app-private files that must be preserved with a future portable backup.

Mobile item editing now covers the full core record: location/room, make/model, serial, barcode, owner marking details, distinguishing features, purchase date/price, manual value, condition, current status, description, and notes.

The mobile inventory dashboard shows active, identifiable, and valued counts, prioritizes weak records, and searches across item identity, product, barcode, marking, and location fields.

AI Description Assist now uses one shared mock service on web and mobile. Mobile stores suggestions separately from user-authored descriptions, labels them as unverified, and reports missing recommended fields.
