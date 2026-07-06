# ProofVault MVP requirements audit

Status as of 2026-07-05. The repository contains a deployed React/Vite web MVP plus an Expo SDK 56 mobile MVP that compiles into Android and iOS Hermes bundles.

## Photo-first bulk intake

- Mobile inventory offers a one-tap camera-first path that prefills an editable item draft, retains the overview photo, saves an AI description, and can attach a Premium mock valuation in the same save operation.
- The no-cloud demo is deliberately labeled simulated and does not claim to inspect pixels. The provider-neutral `ItemIntakeAnalyzer` is ready for a future secure backend vision/OCR adapter; API keys must never live in the app.
- Make, model, and serial candidates stay editable. Serial OCR is marked low confidence and requires user verification.

| Original requirement | Status | Notes |
|---|---|---|
| Expo + React Native + TypeScript | Complete (MVP implementation) | SDK 56 app compiles into both Android and iOS Hermes bundles. |
| Expo Router/React Navigation | Deferred | Current navigation is local React state. |
| SQLite local persistence | Complete (mobile core) | Inventory, incidents, valuations, comparables, settings, attachments, locations, archive state, and migrations persist in Expo SQLite. |
| Dark, tactical, offline inventory UI | Complete (web) | Responsive dark UI; inventory works after initial page load. |
| No login or cloud sync | Complete | No account, analytics, tracking, or cloud data storage. |
| Typed data models and persistence layer | Complete (web) | Typed models and local repository helpers. |
| Home Dashboard | Complete (web and mobile) | Inventory, identifiable-record, valuation metrics, and weak-record guidance. |
| Inventory List | Complete (web and mobile) | Search across identity, product, barcode, and location data. |
| Add/Edit Item | Complete | Validation and local persistence. |
| Item Detail | Complete | Identity, evidence, score, values, and valuation assist. |
| Locations | Complete (web and mobile) | Dedicated local manager; item forms use saved-location suggestions. |
| Incident Mode / Detail | Complete (web and mobile core) | Mobile creates and edits incidents, owner/claim details, affected inventory, and per-item statuses. |
| Export/Share Packet | Complete (web and mobile text) | Mobile shares a local incident packet with valuation evidence and premium-gated comparable links; web additionally supports CSV and printable PDF. |
| Settings/About | Complete (web and mobile core) | Mobile has locations, database backup/restore, plan controls, App Lock, privacy, and About. |
| All inventory fields | Complete (web and mobile core model) | Mobile add/edit covers identity, barcode, purchase data, marking details, condition/status, location/room, values, description, and notes. |
| All evidence categories | Complete (web and mobile) | Mobile supports labeled general, serial, marking, damage/loss, receipt, appraisal, warranty, and other evidence. |
| Native camera/library picker | Complete (mobile implementation) | Captures or selects images and copies them to app-private storage; physical-device acceptance remains. |
| Owner-applied markings first-class | Complete (web and mobile core) | Mobile stores marking text, location, distinguishing features, and separately labeled marking photos. |
| Mock AI description service/UI | Complete (web and mobile) | Shared typed mock service, saved suggestions, missing-field guidance, and explicit verification labeling. |
| Documentation completeness score | Complete | 0–100 score and plain-language feedback. |
| Incident-specific notes | Complete (web and mobile) | Stored per affected item and included in packets. |
| Incident-specific photos | Complete (web and mobile) | Stored per affected item; mobile packets include a labeled count. |
| Export owner/contact placeholders | Complete | Name, phone, email, and mailing address in incident forms and exports. |
| Export full evidence rendering | Complete (web) | Labeled item, serial, marking, incident, damage, receipt, appraisal, warranty, and other evidence groups. |
| App lock | Complete (mobile implementation) | Optional device authentication, secure preference storage, and foreground relocking; physical-device acceptance remains. |
| Privacy notice screen | Complete (web and mobile settings) | Explains local storage, data-loss risk, no analytics, and backups. |
| Encryption/biometric/cloud/share-link TODOs | Complete | Explicit security roadmap in Settings. |
| Five requested seed items | Complete | Drill, ring, bicycle, laptop, and storage tote. |
| README/setup/test notes | Complete | Local setup and test flow documented. |
| No paid services | Complete | Static Vercel hosting and local browser persistence. |
| Original acceptance flow | Complete (web and mobile core) | Mobile supports inventory, evidence, scoring, gating, valuation persistence, incident creation, native packet sharing, and app lock. |
| Safe lifecycle controls | Complete (web and mobile) | Mobile archive/restore preserves incident references and evidence; incident deletion requires confirmation. |
| Dashboard completion guidance | Complete | Prioritizes weak records and gives the next documentation action. |
| Automated browser acceptance run | Environment-blocked | Required in-app browser skill/runtime is missing from this session; production build and nine logic/export tests pass. |
| Printable large-evidence pagination | Complete | Print-specific page margins and break rules keep headings, evidence groups, and figures together without trapping a whole item on one page. |
| Mobile SQLite implementation | Complete (MVP schema) | Inventory, incidents, valuations, settings, locations, attachments, migrations, and lifecycle controls are live. |
| Mobile database backup integrity | Complete (database-only) | Exact SQLite export; restore validates header, integrity, and required tables. Attachment binaries are not embedded. |
| Web-to-mobile migration contract | Complete | Package boundaries, persistence mapping, migration order, and native security/file rules documented. |

## Next gap-closing sequence

1. Run the documented acceptance checklist on physical iPhone and Android devices.
2. Package app-private attachment binaries with portable backups.
3. Add store-ready icons, splash assets, signing, build profiles, and listing screenshots.
4. Consider Expo Router before the screen hierarchy grows beyond this MVP.
