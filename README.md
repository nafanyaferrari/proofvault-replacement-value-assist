# ProofVault web demo

A responsive, local-first demo of ProofVault and its premium **Replacement Value Assist** module. Built with React, TypeScript, and Vite for GitHub/Vercel deployment. The domain models and service boundary are intentionally portable to the planned Expo/SQLite mobile app.

## Run locally

```bash
npm install
npm run dev
```

## Test the feature

1. Open Inventory and try **Photograph & prefill** with any item photo. The web demo creates a reviewable item draft from a mocked analysis result.
2. Review the prefilled fields, then use **Save & add another** to return to the fast intake screen for the next item.
3. In free mode, confirm automatic lookup is locked while manual value entry remains available.
4. Open Settings and switch the demo to Premium.
5. Try **Photograph & prefill** again or open the Milwaukee M18 Brushless Drill and choose **Find Comparable Values**.
6. Save or select a comparable value.
7. Open Incident and generate the packet. It includes the estimate, comparable links, checked date, confidence, and disclaimer.

Data is stored only in browser `localStorage`. Marketplace results are mocked and adapters are defined for a future secure backend; API keys must never be put in the client.

Photo-first intake is also mocked in the no-cloud demo. It uses one fixed simulated recognition result, so uploaded images are not truly analyzed yet. This proves the intended low-effort flow—photo, AI-prefilled draft, user verification, optional premium estimate—without sending images to a live AI service.

For the web demo, selected intake photos are resized in the browser before being saved to `localStorage` so the bulk-entry flow can tolerate more items. Settings shows an approximate browser storage meter and the app warns instead of falsely saving when browser storage is full. The future mobile app stores evidence files in app-private storage rather than browser storage.

Settings includes **Reset demo data** for walkthroughs and QA. Download a backup first if you want to keep the current browser records.

Before approving a deploy, run the web checklist in `WEB_PREDEPLOY_QA.md`.


## Deploy

Import the repository into Vercel. The included `vercel.json` supports client-side routing; the default Vite build settings are sufficient.

## Mobile preparation

The normalized SQLite schema and web-to-mobile plan live in `mobile/`. The schema has been executed against SQLite in memory to validate table, index, constraint, and foreign-key syntax. Shared models, completeness scoring, valuation contracts, and the mock valuation engine live in `packages/domain` for both web and mobile.

The Expo scaffold is in `apps/mobile`, with dependencies installed and checked against Expo SDK 56. Run `npm run start --workspace @proofvault/mobile` and open it with Expo Go or an emulator. Estimates selected with “Use this value” persist with their comparable listings in the device SQLite database.

The mobile item screen can take a camera photo or choose one from the device library. ProofVault copies selected evidence into its private documents directory and stores the durable local URI and metadata in SQLite.

Mobile users can optionally enable App Lock. The preference is stored with Expo SecureStore, unlocking uses the device biometric/passcode flow, and the vault relocks when the app leaves the foreground.

Run `npm run bundle:native --workspace @proofvault/mobile` to verify Metro can produce both Android and iOS bundles. Hardware acceptance steps are documented in `mobile/DEVICE_ACCEPTANCE.md`.

The mobile demo subscription is stored in SQLite and can be switched between free and premium without payment. Free mode keeps manual value entry available but blocks automatic comparable lookup; premium enables lookup and estimate persistence.

Mobile evidence capture distinguishes general item photos, serial-number photos, and owner-marking photos. Marking text, location, and distinguishing features are stored with the item and contribute to completeness.

Receipts, appraisals, warranties, and other supporting PDFs or images can be selected with the native document picker. Files are copied from temporary picker storage into ProofVault’s private documents directory and categorized in SQLite.

Damage or loss photos have a separate mobile capture category and gallery so they remain distinguishable from general inventory evidence.

The mobile Incidents tab can create a dated incident, select affected inventory, assign stolen/damaged/destroyed/missing/recovered status per item, and persist the relationships transactionally in SQLite.

Mobile incident packets are generated as local text files and shared through the native system sheet. They include values, estimate range, confidence, checked date, evidence counts, disclaimer, and premium-only comparable links.

Mobile incidents can be reopened and edited, including owner contact details, police agency/case number, and insurance company/claim number. A schema migration adds these fields to existing local databases.

Each affected item can carry incident-specific notes. Incident deletion requires destructive confirmation and removes only the incident and its link rows, never the underlying inventory or evidence.

Mobile inventory uses archive/restore instead of deletion. Archived items leave the active list but remain resolvable—with their valuations and evidence—in historical incident views and exports.

Incident-specific camera/library photos attach to an affected item within one incident. They remain separate from general and damage/loss inventory evidence, persist through incident edits, and appear as a labeled count in shared packets.

The mobile Settings tab contains reusable saved locations, App Lock, demo subscription controls, privacy guidance, and About information. Saved locations appear as one-tap suggestions in the item editor while free-text locations remain supported.

Mobile Settings can export and restore an exact SQLite database image. Restore validates the file header, database integrity, and required ProofVault tables before replacement. This database-only backup preserves records and file references but does not embed app-private photo/document files.

Mobile item editing now covers the full core record: location/room, make/model, serial, barcode, owner marking details, distinguishing features, purchase date/price, manual value, condition, current status, description, and notes.

The mobile inventory dashboard shows active, identifiable, and valued counts, prioritizes weak records, and searches across item identity, product, barcode, marking, and location fields.

AI Description Assist now uses one shared mock service on web and mobile. Mobile stores suggestions separately from user-authored descriptions, labels them as unverified, and reports missing recommended fields.
