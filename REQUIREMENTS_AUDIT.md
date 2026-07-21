# ProofVault MVP requirements audit

Status as of 2026-07-21. The repository contains a React/Vite web MVP with a separate signed-out local demo and private Supabase account sync, plus an Expo SDK 56 mobile MVP that compiles into Android and iOS Hermes bundles.

## Photo-first bulk intake

- Web and mobile inventory both offer a photo-first path that prefills an editable item draft, retains the overview photo, saves an AI description, and can attach a Premium mock valuation in the same save operation.
- The Vercel demo lets a user choose or take an overview photo from the Inventory screen, review the generated draft, and save it as a normal local item.
- The local/mock fallback is deliberately labeled simulated and uses one fixed recognition result when the secure AI endpoint is unavailable. The provider-neutral `ItemIntakeAnalyzer` and secure backend contract are ready for live vision/OCR providers; API keys must never live in the app.
- Make, model, and serial candidates stay editable. Serial/OCR warnings are surfaced in the web and mobile review forms, and extracted serial numbers require user verification.
- Web and mobile include overview metrics plus a shared bulk review queue so users can quickly find missing make/model, AI-prefilled records, serial candidates, missing values, missing photos, and missing receipt/appraisal evidence. The queue now shows top-of-total backlog counts and issue-type summaries, has a one-tap "Review next" path for bulk cleanup, quick serial/value fields for common fixes, a clear-backlog confirmation state, and reviewed AI-prefilled records stop reappearing as AI-review work.
- Web and mobile fast intake support batch location and room defaults so repeated item photos from one area require less manual correction. The web demo persists these defaults in browser storage, while mobile persists them in SQLite app settings. New mobile records also support a save-and-continue action for manual entry or the next photo-assisted item.

| Original requirement | Status | Notes |
|---|---|---|
| Expo + React Native + TypeScript | Complete (MVP implementation) | SDK 56 app compiles into both Android and iOS Hermes bundles. |
| Expo Router/React Navigation | Deferred | Current navigation is local React state. |
| SQLite local persistence | Complete (mobile core) | Inventory, incidents, valuations, comparables, settings, attachments, locations, archive state, and migrations persist in Expo SQLite. |
| Dark, tactical, offline inventory UI | Complete (web) | Responsive dark UI; inventory works after initial page load. |
| Accounts and cloud sync | Complete (web prototype) | The signed-out local demo uses browser storage. Signed-in accounts use private Supabase rows, autosave, and private evidence storage references. |
| Typed data models and persistence layer | Complete (web) | Typed models and local repository helpers. |
| Home Dashboard | Complete (web and mobile) | Inventory, identifiable-record, valuation metrics, and weak-record guidance. |
| Inventory List | Complete (web and mobile) | Search across identity, product, barcode, and location data. |
| Add/Edit Item | Complete | Validation and local persistence. |
| Item Detail | Complete | Identity, evidence, score, values, and valuation assist. |
| Locations | Complete (web and mobile) | Dedicated local manager; item forms use saved-location suggestions. |
| Incident Mode / Detail | Complete (web and mobile core) | Mobile creates and edits incidents, owner/claim details, affected inventory, and per-item statuses. |
| Export/Share Packet | Complete (web and mobile text) | Mobile shares a local incident packet with valuation evidence and premium-gated comparable links; web additionally supports CSV and printable PDF. |
| Settings/About | Complete (web and mobile core) | Mobile has locations, database backup/restore, plan controls, App Lock, privacy, and About. |
| Demo reset for QA | Complete (web) | Settings can reset browser inventory, incidents, locations, and plan status to the original demo records after confirmation. |
| Browser storage safeguards | Complete (web) | Fast-intake photos are compressed, saved review drafts are written incrementally, each browser batch is limited to 12 item photos, unreadable photos are skipped without abandoning the batch, Settings shows approximate browser storage use, item/incident changes are not shown as saved if localStorage rejects them, multi-key restore/reset rolls back after storage failure including batch defaults, and web backups include batch defaults. |
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
| Bulk review queue | Complete (web and mobile) | Shared domain helper flags serial verification, AI-prefilled details, missing value, missing overview photo, and missing receipt/appraisal follow-up. Overview metrics show the active quick-review backlog. Queue items also surface the same checklist on item detail, the top queued item can be opened directly for editing, queue cards show top-of-total backlog counts and issue-type summaries, quick serial/value saves clear those specific queue flags, and a clear state confirms when no active items need follow-up. |
| Automated browser acceptance run | Environment-blocked | Required in-app browser skill/runtime is missing from this session; production build and twenty-three logic/export tests pass. |
| Printable large-evidence pagination | Complete | Print-specific page margins and break rules keep headings, evidence groups, and figures together without trapping a whole item on one page. |
| Mobile SQLite implementation | Complete (MVP schema) | Inventory, incidents, valuations, settings, locations, attachments, migrations, and lifecycle controls are live. |
| Mobile database backup integrity | Complete (database-only plus manifest) | Exact SQLite export; restore validates header, integrity, and required tables. Attachment binaries are not embedded yet, but Settings can export a JSON attachment manifest listing app-private files that must be preserved with a future portable backup. |
| Web-to-mobile migration contract | Complete | Package boundaries, persistence mapping, migration order, and native security/file rules documented. |

## Next gap-closing sequence

1. Run the documented acceptance checklist on physical iPhone and Android devices.
2. Package app-private attachment binaries into the manifest-backed portable backup archive.
3. Add store-ready icons, splash assets, signing, build profiles, and listing screenshots.
4. Consider Expo Router before the screen hierarchy grows beyond this MVP.
