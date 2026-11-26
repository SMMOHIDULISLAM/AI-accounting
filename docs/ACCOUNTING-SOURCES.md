# Accounting integration release 0.3

## Scope

The user's submitted lists contain **73 unique GitHub repositories** after removing repeats. Each repository's current public metadata and license signal was retrieved on 27 November 2026. This is not a full code/security audit of 73 products. Detailed source inspection and executable checks concentrate on the pinned integrations below. The searchable in-app Source catalog and `public/accounting-repositories.json` preserve every unique submitted link, descriptions, license signals and exact reuse status.

Two permissively licensed source snapshots are retained with their licenses/notices and hashes. The unlicensed SQLite example is a reference for an independently authored adapter; its code and datasets are withheld. The full ERP systems, alternative ledgers, payroll/billing packages, OFX libraries and receipt tools remain explicit catalog references. They have not all been installed, tested, rewritten or combined into one engine.

## Track 1: local core

Open **Imports & skills**:

- Ledger Reborn SQLite: read canonical journal/account fields, enforce integer amounts, inspect historical receivables/payables aging, require account mapping and USD compatibility, and import balanced journals as unposted drafts.
- Accounting SQLite example: independently read only `Accounts` and signed `Journals`. Require the debit/credit sign convention and source currency; invoices/bills/receipts/payment documents are excluded. This is not a full migration of the example ledger.
- OpenQBW version-1 SQLite exports: retain exact raw decimal strings, NULLs, raw dates, flags and diagnostic/rejection counts. The adapter is **inspection-only** because upstream does not establish the numeric value as a journal amount or the date/table attribution as verified. Raw `.qbw`/`.qbb` require the separate retained parser/toolchain; they are not browser SQLite files.
- Accounting skills: correct draft patterns for earned invoices, ordinary bills, customer collections, bill settlement and credit stock purchases. Drafts do not create customer/document/inventory masters.
- Exact largest-remainder allocation and moving weighted-average stock-cost calculators. These are previews, not an automatic inventory or invoice-allocation subledger.

Account codes must not be matched blindly: source code 1200 means Inventory in Ledger Reborn but Equipment in this app. Account type and meaning require explicit review. Source and target currencies must match; the BDT default is never substituted for USD.

Imports are atomic, accept up to 500 journals per batch, and are idempotent under a stable source book ID plus journal ID. A changed source or account mapping conflicts instead of overwriting an earlier draft/posted journal. Changing the book ID can bypass deduplication, so retain it across exports. Journals are drafts until separately reviewed and posted.

## Track 2: ERP foundation

ERPNext was selected as an isolated full-ERP evaluation foundation. Its official local Compose profile is adapted under `editions/erpnext/`, with required private passwords and loopback binding. The profile is derived from a pinned MIT Frappe Docker source; ERPNext remains GPL-licensed as a separate service. Docker was unavailable, so container/site startup, resources, document workflows and migrations are not verified here. No existing browser ledger is moved into ERPNext. See the edition README for setup and boundaries.

## Track 3: WhatsApp and receipts

The existing signed/allowlisted WhatsApp intake remains. **Cash memos** adds local English PNG/JPEG OCR using installed Tesseract, with image/output/time/concurrency bounds. It proposes only explicit ISO dates and labelled totals, preserves ambiguity and requires currency, account and amount review before a draft can be saved. No image is stored by the OCR endpoint and no journal is posted automatically. Paste text if OCR is unavailable.

The OCR executable was tested on one synthetic clean English memo. Real receipt/handwriting/Bengali accuracy is not established. Receiving a WhatsApp attachment reference does not download/read that file. Real Meta setup, HTTPS webhook hosting, authenticated incoming-media retrieval and conversation replies/confirmation still require work. No paid service or live messaging configuration was activated.

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm verify:sources
python -m unittest discover -s third_party/ledger-reborn/tests -v
python scripts/create-source-example.py /NEW/OUTPUT/synthetic.sqlite
node --import tsx scripts/verify-source-example.mjs /NEW/OUTPUT/synthetic.sqlite
pnpm build
pnpm smoke
```

The source generator refuses to overwrite an existing file. Use a disposable new output path. On restricted Windows hosts, set TEMP/TMP to a writable workspace test directory before the Python test suite. Python is needed for retained-engine tests, not for the browser core. Cargo/Rust 1.95+ is needed to build the retained OpenQBW CLI; no successful native build is asserted.

Evidence at authoring: 78 app tests passed; 35 retained Ledger Reborn tests passed; the real source-engine-to-web contract passed with 5 synthetic journals (income USD 124, COGS USD 14, profit USD 110, receivables USD 84). The clean synthetic English OCR read BDT 150.00 and 2026-11-27 correctly. YAML/config inspection is distinct from launching the ERP stack. Interactive browser and final GitHub workflow evidence are recorded separately as they occur.

## License and provenance

`third_party/provenance.json`, retained LICENSE/NOTICE files and `public/THIRD-PARTY-LICENSES.txt` document copied code. Other projects remain references pending full license/module/technical review. Accounting-pattern knowledge does not certify IFRS, local tax compliance, audit assurance or statutory reporting. Metadata, copied source, adapted helpers, working interfaces and installed services are distinct states in the catalog.
