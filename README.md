# AI Accounting

A local-first double-entry bookkeeping app with a browser SQLite ledger, optional local Ollama assistance, and an optional **My Accounts** WhatsApp intake queue.

## Version 0.3: three tracks

The repository now keeps [Core](editions/core/README.md), [ERPNext](editions/erpnext/README.md) and [WhatsApp-first](editions/whatsapp/README.md) tracks. Core has local foreign-book inspection/import, source aging and accounting-pattern tools. The ERP edition has a separate evaluation profile; it has not been launched here. Cash memos supports local English receipt OCR with manual review. The [integration scope](docs/ACCOUNTING-SOURCES.md) records exactly what is active and what remains a reference.

**73 unique requested projects** are catalogued in the app. Two pinned licensed source snapshots are retained under `third_party/`; the other projects are not all installed or merged. Run `pnpm verify:sources` to verify the retained code. Full ERP code and the browser ledger remain separate systems with different data models and licenses.

## My Accounts input

Open **My Accounts · WhatsApp** to try:

```text
sale cash 100 bdt, credit 50 bdt
```

The review shows debit Cash 100, debit Receivables 50, and credit Sales 150 BDT. “Credit” in this command means a customer's unpaid amount. The message creates a draft; you review and post it in Transactions. Bengali digits and `বিক্রি নগদ ১০০ বাকি ৫০` also work. This first parser handles explicit BDT sale commands only. Unknown wording, other currencies, tax and inventory treatment require manual review. It does not use AI to guess missing facts.

Optional WhatsApp Business webhooks receive allowlisted messages into a private server-side SQLite inbox. Delivery IDs prevent duplicates. Only authenticated inbox access can fetch messages. Imports into the browser ledger are idempotent, including retries after posting. Incoming cash-memo image/document **references** are retained; their media download and WhatsApp replies remain unfinished. Manually chosen PNG/JPEG memos can now be read using local English Tesseract in Cash memos. No live WhatsApp connection is configured by this source update.

[WhatsApp setup and boundaries](docs/WHATSAPP.md) · [Review and evidence](docs/REVIEW-2026-11-27.md)

## Run locally

Requirements: **Node.js 24 LTS**, pnpm 11.25.0, and a current browser with IndexedDB and Web Locks. Ollama is optional.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`dev` listens on port 3000 (or `PORT`) with local AI disabled. For loopback-only use with an installed local Ollama model, run `pnpm local`.

For a production build and loopback-only serving:

```bash
pnpm build
pnpm start
```

`pnpm serve` serves the production build on `0.0.0.0` with Ollama disabled, for deployment behind HTTPS. That command does not provision hosting, TLS, WhatsApp credentials or persistent storage. Docker builds on Node 24; mount a private persistent volume for the optional inbox. The development/build scripts copy the WASM binary from the installed sql.js package, keeping binary and JavaScript versions paired.

```bash
pnpm check
pnpm test
pnpm build
pnpm smoke
pnpm audit
```

The GitHub Actions workflow runs install, type checking, tests and build. Local testing and actual GitHub execution are separate evidence.

## Your data

The **ledger** stays in this browser's IndexedDB, scoped to its browser and origin. It is not synchronized between devices. Keep one active ledger tab. Clearing browser storage can remove records. Export genuine `.sqlite` backups, keep multiple copies and test a restore. Backups queue behind earlier saves and exclude later saves. Restore checks the canonical web schema and record invariants before replacement; altered triggers, unsafe totals and invalid reconciliation links are rejected.

The optional **WhatsApp intake** changes the data path: selected incoming messages pass through Meta and the configured intake server. That server stores text and receipt metadata separately from the local ledger. Use one designated browser ledger for intake; two separate browsers can otherwise import the same source into separate ledgers. Browser backups do not include the server inbox. Back up the inbox separately using a consistent SQLite backup/snapshot with correct WAL handling.

Records, inbox data and exported backups are **not encrypted by this app**. Keep `.env`, tokens, messages, databases and backups out of Git. Source visibility does not protect financial records. The repository was observed as public during the 27 November 2026 review; no sharing settings were changed by this update.

## Accounting controls

- Exact integer minor units with safe aggregate bounds and exact decimal edit/export text.
- Balanced, nonzero posting; posted journals cannot be edited through the ledger API. Correct them with linked reversals.
- CSV source rows remain separate from journals; duplicates are flagged for review.
- Exact signed bank/cash reconciliation within three days, with no line reuse.
- Posted-only draft management reports. Period profit/loss is separate from cumulative as-of balances.

This is a single-currency ledger. Currency cannot change after records exist. Custom cash/bank categories, invoice/customer subledgers, inventory costing, tax engines, multi-user access, cloud synchronization and statutory statement sets need further implementation. This app does not certify GAAP/IFRS compliance, audit accounts or file taxes.

## Optional local AI

Only `--local` mode may call the fixed loopback Ollama `/api/tags` and `/api/chat` endpoints on `127.0.0.1:11434`. Cloud/remote models are rejected; there is no cloud fallback. Install a model you choose with Ollama, then use the Assistant connection control. Only explicitly submitted context is sent. Structured output must reference supplied account IDs and is always marked for review. Model output cannot execute SQL or post entries.

## Android source

The supplied `aibooks` archive is a **separate** Expo/React Native app with a different SQLite schema version. It has not been merged into this web repository. Web v1 and native v2 backups are not interchangeable without a tested migration. The handoff documents record host/mocked tests; they do not prove a successful APK, Android runtime, physical USB workflow or native model inference. The historical [Android plan](ANDROID-PLAN.md) and [storage evidence](SQLITE-BACKUP-TESTS.md) remain for context. The current WhatsApp direction is documented above and in `docs/WHATSAPP.md`.
