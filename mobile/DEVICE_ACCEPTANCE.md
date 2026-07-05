# ProofVault mobile device acceptance

## Automated checks completed

- TypeScript compilation passes for the Expo workspace.
- Expo dependency compatibility passes for SDK 56.
- Metro produces Android and iOS Hermes bundles.
- Shared valuation, completeness, backup, and export tests pass.
- The Vite production build remains green.

## Real-device checks

Run these on one current iPhone and one current Android device before a store build:

1. Fresh install opens the seeded inventory from SQLite.
2. Add an inventory item, reopen it, edit its serial number and manual value, and confirm both changes persist.
3. Open the drill and take an item photo. Deny permission once, then grant it and retry.
4. Choose a library photo, close the app, reopen it, and confirm both images remain visible.
5. Record an owner marking and location, attach separate serial and marking photos, reopen the item, and confirm each appears under the correct heading.
6. Attach a receipt, appraisal, warranty, and other PDF; restart and confirm each remains under the correct heading.
7. Attach a damage/loss photo and confirm it does not appear in the general item-photo gallery.
8. Create an incident with two affected items and different statuses; restart and confirm both relationships persist.
9. Edit that incident with owner, police case, and insurance claim details; reopen it and confirm changes persist.
10. Share in Premium and confirm the packet contains contact/claim details, estimate, confidence, checked date, disclaimer, and comparable links.
11. Switch to Free, share again, and confirm marketplace links are omitted while valuation evidence remains.
12. Find comparable values, choose “Use this value,” restart, and confirm the estimate persists.
13. Confirm manual value editing still works in Free, then switch back to Premium.
14. Enable App Lock. Background and reopen the app; confirm authentication is required.
15. Cancel authentication and confirm inventory stays hidden, then unlock successfully.
16. Confirm VoiceOver/TalkBack announces tabs, cards, form fields, evidence buttons, App Lock, and valuation actions.

Face ID requires an Expo development build rather than Expo Go. Camera, file persistence, and biometric behavior must be tested on physical devices; successful native bundles cannot prove hardware behavior.
