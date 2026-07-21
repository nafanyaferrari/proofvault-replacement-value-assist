# ProofVault web pre-deploy QA

Run this against the local or preview web build before approving a production deploy.

## Fast intake and bulk review

1. From the signed-out screen, choose **Open local demo** and confirm it explains the demo is separate from signed-in accounts.
2. From Start Here, confirm **Walk around and add many photos** is the primary action.
3. In Premium mode, tab to **Add many photos** and confirm Enter/Space opens a multi-file picker.
4. Choose two or more item photos, using one clear overview photo per item. Confirm the picker accepts no more than the documented 12-item browser batch.
5. Confirm successful drafts are saved as they are created and the bulk review screen opens with item name, make, model, Serial Number (SN), location, and value first.
6. Confirm AI-filled serial numbers are presented as candidates that should be verified.
7. Save one draft with **Save this item**, then use **Save all drafts for later** for the rest. Confirm the individually reviewed draft no longer has an AI-review follow-up.
8. Refresh the page while drafts remain and confirm **Resume review** restores the saved batch from Start Here or Inventory.
9. Open Inventory, set a batch location and room/area in the bulk import card, then try **Add one photo**.
10. Confirm the item form opens as a new item, not an edit, with batch location and room/area prefilled.
11. Refresh the page and confirm the batch location and room/area are remembered locally.
12. Confirm any AI-prefilled warning and intake-service warnings appear before saving.
13. Confirm the Essential section shows item name, location, make, model, Serial Number (SN), and value first.
14. Save with **Save & add another** and confirm the app returns to Inventory.
15. Confirm the **Bulk review queue** shows missing make/model before lower-priority receipt/appraisal follow-up, and lists all remaining checks for each queued item.
16. Use **Review next** and confirm the top queued item opens directly in edit mode.
17. Save the reviewed item and confirm the AI-prefill review flag clears, while any remaining make/model, serial, value, photo, or document flags stay visible.
18. If an item has a serial candidate, enter a confirmed serial from the quick-check list and confirm the serial verification flag clears.
19. If an item has no manual or assisted value, enter a quick manual value from the quick-check list and confirm the value flag clears.
20. Open a queued item and confirm the item detail screen shows the same quick-check list with an edit action.
21. Type into a quick serial/value field, switch to another item, and confirm the quick-entry field is cleared so stale text cannot be saved to the wrong item.
22. When all active items are complete enough, confirm the queue shows a clear-backlog confirmation instead of disappearing silently.

## Replacement Value Assist

1. In Settings, switch to Free demo access and confirm the copy labels this as a prototype test setting, not a paid subscription.
2. Open an item and confirm automatic lookup is locked while manual value entry works.
3. Switch to Premium demo access.
4. Run **Estimate replacement cost** and confirm range, confidence, comparable listings, checked date, and disclaimer appear.

## Incidents and exports

1. Create or edit an incident with at least one affected item.
2. Confirm copy, CSV, print/save PDF, and share controls are present.
3. Confirm Premium exports include comparable links and Free exports omit marketplace links.

## Storage and reset

1. Open Settings and confirm browser storage meter appears or explains unavailable estimate.
2. Download a backup.
3. Choose **Reset demo data**, cancel once, then confirm once.
4. Confirm inventory, incident sample data, locations, saved photo drafts, and Free demo access reset.

## Mobile backup smoke check

1. In mobile Settings, export the SQLite database backup.
2. Export the attachment manifest and confirm the JSON summary lists inventory and incident attachment counts.
3. Confirm the Settings copy still explains that app-private photo/document binaries are not embedded in the database-only backup.

## Mobile bulk-entry smoke check

1. Start a manual mobile inventory item and confirm **Save & add another** saves it and reopens a blank item form.
2. Start a photo-assisted mobile intake item and confirm **Save & photograph another** saves it and returns to the camera/photo intake flow.
3. Confirm normal **Save item** still closes the editor after saving.

## Final local checks

```bash
npm run build
npm test
git diff --check
```
