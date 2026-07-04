# ProofVault web-to-mobile migration plan

The first migration step is complete: `packages/domain` contains framework-neutral models, completeness rules, valuation contracts, marketplace adapter boundaries, formatting helpers, and the mock valuation engine. The web demo consumes it through compatibility re-exports, and the future Expo app can import it directly.

The Expo application scaffold now lives in `apps/mobile`. Its first vertical slice opens an on-device `proofvault.db`, applies the initial schema, seeds a sample inventory item, lists inventory, opens item detail, calculates completeness, runs the shared mock Replacement Value Assist flow, and persists selected estimates and comparable listings. Dependencies are installed, type-checked, and aligned with Expo SDK 56.

Schema migration 2 adds durable item-attachment records. Camera and library images are copied out of temporary picker storage into the app-private documents directory before their URI and metadata are committed to SQLite.

The optional native App Lock uses Local Authentication and SecureStore. It checks for enrolled device authentication before enabling, requires authentication on launch, and relocks whenever the app leaves the foreground. Face ID requires a development build for complete testing; Expo Go does not support that path.

The web MVP is the behavior prototype. The mobile implementation should use Expo, React Native, Expo Router, TypeScript, `expo-sqlite`, and Expo ImagePicker without changing the domain meaning of inventory, incidents, valuations, or comparable listings.

## Package boundaries

- `domain/`: TypeScript models, completeness scoring, valuation interfaces, disclaimers, and export formatting. No React, browser, Expo, or database imports.
- `mobile/db/`: SQLite connection, migrations, typed repositories, and transactions.
- `mobile/services/`: Expo ImagePicker, file storage, sharing, print/PDF, biometrics, and secure storage adapters.
- `mobile/app/`: Expo Router screens and React Native UI.

## Persistence mapping

| Web MVP | Mobile implementation |
|---|---|
| `localStorage` item JSON | `inventory_items` plus `item_attachments` |
| Base64 data URLs | App-private file URIs; SQLite stores metadata/URI only |
| Embedded valuation fields | `valuation_records` and `comparable_listings` |
| Embedded incident items | `incident_items` and `incident_attachments` |
| Location text/list | `locations` foreign key plus preserved display text |
| JSON backup | Transactional SQLite export/import plus copied attachment files |

## Migration order

1. Extract framework-free domain functions from `src/services` and `src/types.ts`.
2. Initialize Expo Router and the SQLite migration runner.
3. Implement location and inventory repositories with transaction tests.
4. Replace browser attachments with ImagePicker and app-private file storage.
5. Port item list/form/detail and completeness score.
6. Port incident creation and export/share flows.
7. Port Replacement Value Assist and subscription gating.
8. Add biometric lock, local encryption strategy, and backup integrity checks.

## Non-negotiable data rules

- Never store marketplace API keys in the mobile client.
- Never store large images as SQLite blobs; store private local file URIs.
- Archive inventory referenced by incidents; do not cascade-delete it.
- Incident exports must remain reproducible after an item is archived.
- Every schema change is additive and recorded in `schema_migrations`.
- Backup restore runs in one transaction and validates attachment availability.

## Deferred native capabilities

- Camera/library capture through Expo ImagePicker.
- Biometric unlock through LocalAuthentication.
- Secure key material through SecureStore.
- Optional encrypted backup and cloud synchronization.
- Expiring secure share links through a future backend.
