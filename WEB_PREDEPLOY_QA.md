# ProofVault web pre-deploy QA

Run this against the local or preview web build before approving a production deploy.

## Fast intake

1. Open Inventory.
2. Tab to **Photograph & prefill** and confirm Enter/Space opens the file picker.
3. Choose a normal item photo.
4. Confirm the item form opens as a new item, not an edit.
5. Confirm the AI-prefilled warning is visible.
6. Confirm the warning says no-cloud demo mode uses a fixed simulated recognition result.
7. Confirm photo, description, make/model, and serial candidate are editable.
8. Save with **Save & add another** and confirm the app returns to Inventory.

## Replacement Value Assist

1. In Settings, switch to Free.
2. Open an item and confirm automatic lookup is locked while manual value entry works.
3. Switch to Premium.
4. Run **Find Comparable Values** and confirm range, confidence, comparable listings, checked date, and disclaimer appear.

## Incidents and exports

1. Create or edit an incident with at least one affected item.
2. Confirm copy, CSV, print/save PDF, and share controls are present.
3. Confirm Premium exports include comparable links and Free exports omit marketplace links.

## Storage and reset

1. Open Settings and confirm browser storage meter appears or explains unavailable estimate.
2. Download a backup.
3. Choose **Reset demo data**, cancel once, then confirm once.
4. Confirm inventory, incident sample data, locations, and Free plan reset.

## Final local checks

```bash
npm run build
npm test
git diff --check
```
