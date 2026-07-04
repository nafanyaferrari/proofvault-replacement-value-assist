# ProofVault web demo

A responsive, local-first demo of ProofVault and its premium **Replacement Value Assist** module. Built with React, TypeScript, and Vite for GitHub/Vercel deployment. The domain models and service boundary are intentionally portable to the planned Expo/SQLite mobile app.

## Run locally

```bash
npm install
npm run dev
```

## Test the feature

1. Open Inventory → Milwaukee M18 Brushless Drill.
2. In free mode, confirm lookup is locked and add a manual value.
3. Open Settings and switch the demo to Premium.
4. Return to the drill and choose **Find Comparable Values**.
5. Select a used/refurbished comparable value.
6. Open Incident and generate the packet. It includes the estimate, comparable links, checked date, confidence, and disclaimer.

Data is stored only in browser `localStorage`. Marketplace results are mocked and adapters are defined for a future secure backend; API keys must never be put in the client.


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
