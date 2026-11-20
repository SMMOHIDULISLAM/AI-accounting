# AI Accounting — native Android-first plan

Confirmed 20 November 2026: native Android APK first, Windows second. USB disk is for backups, NOT running the application. This replaces the earlier F-drive portable-launcher proposal. Keep source private and do not require paid APIs or model-provider subscriptions.

## Scope carried forward

Use on-device SQLite as the authoritative accounting database. Import CSV through Android's document picker, with date/amount mapping, validation, original source review and duplicate warnings. Store unposted source rows separately from drafts and posted journals. Use the same independently authored double-entry invariants as the existing web foundation: integer minor-unit amounts, balanced nonzero posting, immutable posted records, linked reversals with reasons and audit history, and atomic source classification.

Design portrait screens for one-handed use: Overview, Transactions, New/Edit Draft, Accounts, Reconciliation, Statements, Assistant and Backup/Settings. Account explanations and transaction questions should use novice-friendly language. Guidance can be turned off without disabling manual accounting.

Provide deterministic draft trial balance, general ledger, period P&L, as-of balance sheet including accumulated earnings and a clearly labelled cash-movement summary. Reconciliation proposes reviewable matches and retains exceptions; it must not invent adjustments or post from AI output. Do not claim a complete statutory statement set or worldwide GAAP/tax compliance.

USB backup is an explicit user action. Create a consistent database backup before presenting Android's save/share/file-picker workflow; restore only after validating integrity and schema and confirming replacement. USB-OTG access depends on the phone and its document provider. The app may offer share/save and explain manual copying when direct USB selection is not exposed. No background scan of the disk, autorun or silent upload. Android app-private storage, not a removable drive, holds the live ledger.

## Offline assistant and device limits

Guided accounting rules must work offline, with honest labelling. Real generative AI requires a compatible native local-model runtime and downloaded or bundled model, a permitted redistribution license and enough device RAM/storage. Select and verify this in the native workspace; do not substitute a paid/cloud API or label rules as a connected model. A phone model cannot be guaranteed to have the highest accounting expertise. Model outputs are advisory and validated; users approve account choices and posting.

No Node/Ollama installation should be needed on the end user's phone for ordinary bookkeeping. A native APK itself must be installed with the user's permission. Expo Go is a development preview, not the delivered standalone APK, and may not support a custom local inference module. Use the native release build surface for such features and state any unverified device functionality.

## Implementation approach

Use the supported managed Expo Router / React Native / TypeScript starter in a fresh mobile workspace. Keep Web DOM components out of native screens. Reuse independently written money/date/report logic behind adapters; port browser sql.js/IndexedDB persistence to native SQLite with transactions, migrations, concurrency control, foreign keys and backup validation. Native files, alerts and USB selection need actual Android verification, not a web screenshot.

The mobile project requires its own managed build repository; do not disconnect or overwrite the existing private GitHub web project at https://github.com/SMMOHIDULISLAM/AI-accounting. Preserve that source, and provide an explicit private-source backup/handoff for Android where supported. No credentials are included in the source bundle.

Prepare source, launcher/splash assets, checks and a saved native checkpoint for the Dashboard Android build. Claim an APK only after the actual build output exists. Do not run unsupported Android release builds in this web sandbox, and do not start paid services. Windows packaging and secure online/mobile synchronization remain later work.

## Current status and blocker

The web foundation is complete as a prototype and is privately connected to GitHub. Nineteen checks passed and the blank report-date defect was verified in a browser. Seven public accounting repositories were cloned for inspection; their code was not integrated into the product. Relevant licenses and boundaries are documented in OPEN-SOURCE-REUSE.md.

This task is already bound to the web project and currently has no native initialization/attachment tools. No Android project or APK has been created. Continue the native build in a fresh mobile-capable task only after the user explicitly approves creating that task. Carry this plan, the source bundle and the research notes into it.
