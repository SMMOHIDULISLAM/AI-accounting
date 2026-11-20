# AI Accounting — first-version build plan

Status: original web foundation approved on 20 November 2026; portable revision awaits target agreement. Project: `/home/ubuntu/aiaccounting`. Repository requested: private `AI-accounting`.

## Product promise and boundaries

Build a working local-first accounting web app that helps a person with little accounting knowledge keep balanced records and understand their choices. Local SQLite storage, CSV import, and guided accounting-head selection are essential. The assistant asks about the economic substance of a transaction, offers understandable alternatives, explains debit and credit effects, and lets the user approve or correct a draft. AI guidance can be turned off for manual entry.

The user's long-term goal is a broad finance and accounting assistant informed by practices taught in CPA, ACCA, CMA and CA programs. Those are qualifications, not interchangeable reporting frameworks. The first version will use a common double-entry core with a clearly identified general accrual-bookkeeping profile. It will record country and desired reporting framework as context, without claiming to implement every country's GAAP or provide statutory certification. Framework-specific recognition, tax, disclosures and advanced finance modules are later extensions, not completed MVP features.

No API purchase, subscription, paid model, paid hosting, bank connection or billing integration will be required for the local version. Do not enable paid AI fallback. Local AI needs an existing computer capable of running a model, storage for the download and electricity. Higher-quality models can require substantially more memory; no model can be guaranteed to have the highest accounting skill or always classify correctly.

## Essential workflows

### Local ledger and controls

Use actual SQLite compiled to WebAssembly through `sql.js`, persisted as exported database bytes in IndexedDB in the user's browser. Data is local to the current browser and origin; it is not a shared cloud database, and clearing browser storage can remove it. Show save failures rather than claiming successful persistence. Provide downloadable `.sqlite` backup and validated restore; a private GitHub repository protects source-code visibility, not accounting records or backups. Do not claim the database is encrypted.

Include a hierarchical chart of accounts for Assets, Liabilities, Equity, Income and Expenses, each with a short plain-language explanation. Store money as integer minor units; allow one reporting currency per ledger in the first version. Offer BDT as an editable initial choice. Currency labels do not imply currency conversion or implemented local tax rules.

Support balanced multi-line journal entries. Allow editable drafts, but require nonzero equal debit and credit totals before posting. Posted journals are not directly editable or deletable; corrections use linked reversing entries with a reason. Store posting, reversal, classification and reconciliation actions in a local audit history. Prevent conflicting writes from multiple browser tabs rather than silently overwriting another ledger session.

### CSV import

Let the user select and map date, description, reference, and either signed amount or debit/credit columns. Explain the chosen bank-statement sign convention and preview the result. Validate dates, numeric formats and missing fields, show row-level errors, preserve source rows, and flag probable duplicates before committing the batch. Unrecognized or duplicate-looking rows require review rather than being silently posted or discarded.

Import records into an unposted source inbox. Classification produces draft journals that the user reviews before posting. Include a small downloadable example CSV. Bank statements can also be imported as reconciliation-only records so the same business transaction need not be posted twice.

### Assisted and manual classification

Provide a question-led, rules-based guide that works without an AI model. It must be labelled "Guided rules", not passed off as generative AI. Explain decisions such as equipment versus expense, customer deposit versus earned income, owner contribution versus loan, and settlement of an existing payable versus a new expense. Show assumptions, proposed account heads, alternatives and balanced journal effects.

Provide a real optional Ollama assistant in the local-run version. A same-origin local Node server connects to Ollama on loopback and lists installed local models for user selection. No external model-provider key is needed. The user explicitly connects and submits a question; send only the chosen transaction and context, not the entire ledger automatically. Reject nonlocal/cloud model use, validate the returned structured suggestions and account IDs, and never execute AI-generated SQL or post entries from model output.

The online development preview cannot access the user's computer's Ollama server. It will show the working guided rules and an honest "Local AI not connected" state with local setup instructions. Open-ended model chat is usable after the source runs on the user's computer and a model is installed. The assistant is a drafting and learning tool, not a CPA/CA certification, auditor, tax filing tool or guaranteed worldwide compliance engine. Switching guidance off leaves all manual account and journal controls usable.

### Reconciliation and draft statements

Offer suggested matches between bank source rows and posted bank journal lines using amount, account, date and reference. Show matched and unmatched items, require confirmation, and prevent reuse of the same source or ledger line. Ask for opening and closing bank balances and show the remaining difference; do not invent an adjustment to force a zero balance. Transfers and previously recorded invoice settlements must not become duplicate income or expense.

Generate reports deterministically from posted journals, never from an AI estimate: trial balance, general ledger, period profit and loss, and an as-of balance sheet including accumulated earnings. Provide a labelled cash-movement summary and reconciliation exceptions, not a claim of a complete IFRS cash-flow statement. Support report dates and CSV export. Explain that adjusting entries, policies, comparatives, notes, other comprehensive income, changes in equity and jurisdiction-specific disclosures can be required for a complete compliant financial statement set. Reports will be clearly labelled draft management reports.

## Application structure and serving

The initialized flexible workspace is empty, so use a small React/TypeScript/Vite frontend with a Node/Express development and local production server. No managed SQL database or cloud ledger storage is requested. Server capability is available for serving and the optional local adapter, but no cloud deployment or paid inference is required.

- `src/components/`: accessible shared controls, account picker and journal editor.
- `src/pages/`: overview, transaction inbox, chart of accounts, reconciliation, reports, assistant and settings.
- `src/lib/db/`: SQLite schema, prepared queries, migrations, IndexedDB persistence, locking and backups.
- `src/lib/accounting/`: money/date validation, balanced posting, reversals and deterministic reports.
- `src/lib/import/`: CSV parsing, mapping, validation and duplicate review.
- `src/lib/assistant/`: question flows, account explanations and validated suggestion types.
- `server/`: same-origin UI serving and explicitly local-only Ollama adapter with request limits and origin checks.
- `public/`: locally served SQLite WASM, brand mark, route manifest and sample CSV.
- `tests/`: focused automated checks for the implemented accounting, import and storage paths.

Keep dependencies and the package manager pinned with a lockfile and explicit lifecycle-build permissions. Configure language diagnostics before code. Declare the development command through the project runtime, verify HTTP readiness and serve a route manifest. Bundle SQLite assets locally so the ledger does not depend on a runtime CDN. Online publication is a separate user-controlled step; the source and local instructions are the zero-subscription deliverable.

## Design direction

Considered styles: Swiss financial workbench (sampled probability 0.012), editorial ledger (0.082), modern field notebook (0.013). Choose Swiss financial workbench.

**Design movement:** Swiss International Typographic Style adapted to a calm bookkeeping workbench.

**Core principles:** legible financial numbers, consistent hierarchy, visible evidence and uncertainty, and low-friction novice guidance. Prefer a left navigation rail with a broad ledger canvas and contextual right-hand explanation panel over a centered card grid.

**Color philosophy:** warm off-white surfaces and charcoal text feel like an orderly ledger. Deep teal is the main brand color, used for selections and confirmed actions. Amber signals review; muted red is reserved for real errors, not ordinary negative cash movement.

**Signature elements:** a two-column debit/credit mark, ruled ledger rows, and compact account-type chips. No decorative stock photography is needed for this internal tool.

**Interaction philosophy:** explanation at the point of decision; expandable details rather than walls of terminology. Imports have a clear review step, and posting has an explicit summary. Destructive and reversing actions explain their effects.

**Animation:** restrained 120–180 ms transitions for tabs and panels; no animated financial counts or gratuitous motion. Respect reduced-motion preferences.

**Typography:** locally bundled Inter for interface text and headings, with a locally bundled monospace font for references and tabular ledger amounts. Strong title hierarchy and tabular numerals make scan-and-compare tasks easier.

**Brand essence:** an understandable accounting workbench for people who want to keep reliable records while learning. Personality: precise, patient, transparent.

**Brand voice:** short, concrete and nonjudgmental. Example lines: "What was this payment for?" and "Review both sides before posting."

**Wordmark and logo:** AI Accounting paired with two offset vertical ledger bars joined by a balancing rule. **Signature brand color:** deep ledger teal, `#086B63`.

## Build and handoff workflow

After approval, create `TODO.md` carrying the concrete outcomes above, implement the source, and run type checks, build and focused automated checks. A read-only implementation review will trace the main workflows and flag concrete issues. Provide working Preview, source README and local AI setup instructions; do not claim that an unconnected preview has model-powered AI.

Save the completed app as a Manus checkpoint. Use the dedicated GitHub connection confirmation card to create the owner's new private `AI-accounting` repository, then transfer the saved source and confirm the repository switch completed. GitHub may ask the owner to authorize its app or select their account. Do not claim the repository exists before confirmed creation, and do not publicly publish the app without authorization.

## Verified sources

Ollama local inference and authentication: https://docs.ollama.com/api/introduction and https://docs.ollama.com/api/authentication

Ollama local data, model memory and local-only configuration: https://docs.ollama.com/faq

SQLite WebAssembly library and binary export: https://sql.js.org/documentation/ and https://sql.js.org/documentation/Database.html

Framework differences and the complete-set/compliance boundary: https://www.ifrs.org/issued-standards/ifrs-for-smes/ and https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/

Supporting notes are recorded in `technical-notes.md` and `accounting-notes.md`.

## Revision requested during build — portable F-drive edition

The user now requires no-install removable-drive operation, user-initiated launching, and future offline/online PC/mobile support. The browser-local storage architecture does not meet this portability requirement. Preserve the working web foundation without claiming portability or completed cloud/mobile synchronization. `PORTABLE-ROADMAP.md` specifies the proposed Windows x64 package, disk-relative paths, file-backed SQLite, bundled runtime and model, consent-based launch, and operating-system/hardware limits. Obtain agreement on the revised target and packaging before implementing that materially different edition. Do not access or modify the user's local drives from this cloud sandbox.

## Source-reuse request during build

The user requests public GitHub accounting/finance code inspection and cloning to accelerate improvements. Review seven relevant accounting engines and official cloud-integration SDKs in parallel, preserve license terms, and keep inspection clones outside the product repository. Do not execute or redistribute inspected sources or claim Xero/QuickBooks proprietary internals are public. Document recommendations in OPEN-SOURCE-REUSE.md before choosing an architecture or transplanting components.

## Latest confirmed direction — native Android APK

The user selected Android first, Windows second, USB backups rather than run-from-disk, and specifically a native APK rather than PWA. ANDROID-PLAN.md is the proposed native implementation approach. The F-drive launcher proposal is superseded. Preserve the current web/private GitHub foundation. Native initialization is unavailable in this bound web workspace; a fresh mobile-capable task requires explicit user authorization before creation. No APK exists yet.
