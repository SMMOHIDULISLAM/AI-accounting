# Public accounting repositories: what we can reuse

Seven public repositories were inspected and shallow-cloned on 20 November 2026. The useful route is to extend our independently written accounting core using established accounting behaviors as references, rather than copying a large application wholesale. None of the reviewed repositories supplies the whole requested combination: no-install removable-drive operation, online/mobile support and a high-skill local AI assistant without paid APIs.

A private repository does not automatically make open-source license obligations disappear. Private internal use, distributing binaries and operating a modified network service are different situations. Before incorporating code, check the actual file and dependency licenses, preserve notices and satisfy any applicable source-availability requirements. The notes below are engineering guidance, not legal advice.

## Offline accounting references

**Frappe Books** is especially relevant to file-backed bookkeeping: it uses local SQLite company files, migration/patch handling and adjacent dated backups. Its posting code balances debits and credits and supports reversals; its general ledger offers date, account and reference filters. It uses AGPLv3, not a permissive license. Research observed an October 2026 EOL/archive notice in the checked-out tree and web pages, while API archive metadata disagreed; treat this particular repository as an end-of-life reference for planning, not an unquestioned maintained dependency. We found no dedicated bank-statement matching workflow in the inspected boundary. [1]

**GnuCash** has valuable offline concepts: transactions made of splits, exact numerical amounts, reconciliation status and date, rollback of failed edits, and XML/SQLite storage adapters. It also covers receivables, payables, investments and multi-currency accounting. Its local file formats are described as single-user, not a synchronization system. The root license permits GPL version 2 or 3 for most purposes, with individual-file exceptions and additional notices. Its Windows installer is not evidence of a turnkey no-install F-drive package. [2]

For our product, independently implement company-file selection, migrations with backups, exact accounting invariants and reviewed reconciliation states. Do not transplant either program's source into the current private repository without a deliberate licensing decision. Our existing web foundation already has balanced journals, reversals and browser-persisted SQLite; the next storage step is an actual disk-relative company file for the portable edition.

## Broader accounting and finance workflows

**ERPNext**, under GPLv3, offers the broadest business-accounting reference in this set. Its general-ledger posting pipeline checks accounting periods, disabled accounts, dimensions and balance; payment entries validate allocations and outstanding balances; cancellation reverses ledger effects. Its bank-reconciliation tools sit behind permissions. It depends on the Frappe server stack rather than being a drop-in SQLite/Windows runtime. [3]

**LedgerSMB** is useful for approval and control mechanisms. Reviewed SQL distinguishes drafts from approved batches, records approver/time, limits sensitive actions, and prevents ordinary edits to approved reconciliations. It supports OFX, CAMT.053 and CSV-oriented reconciliation imports. Its PostgreSQL/Perl architecture and root GPLv2 license need a separate architectural and license decision before source reuse. [4]

**Akaunting** provides transaction types, reconciliation periods and modular API resources, and supports SQLite. However, its current BSL 1.1 license includes production-use, branding and Accounting Service restrictions with a GPLv3 change license. It must not be assumed to be unrestricted GPL software for a new customer-facing product. Use its publicly documented workflows as requirements references unless the exact intended reuse fits the applicable license. [5]

These projects suggest useful future extensions: invoice/payment allocation, period locks, approval history, accounting dimensions, inventory/asset recognition, and richer import/report adapters. They do not establish compliance with every jurisdiction or prove that a local model has professional accounting qualifications.

## Xero and QuickBooks: connectors, not disclosed engines

The official **Xero Node SDK** is MIT-licensed. It provides OAuth, tenant discovery, generated API models, HTTP requests and idempotency headers. It does not implement Xero's proprietary hosted ledger, tax decisions, reconciliation matcher or report engine locally. Authorized Xero access, credentials, scopes and network service are separate requirements; a free SDK does not guarantee free Xero service/API usage. Keep it as an optional future online connector, not an offline dependency. [6]

The official **QuickBooks V3 PHP SDK** is Apache-2.0-licensed. Its data, report, batch and OAuth services make remote QuickBooks Online requests. Journal-entry objects document the balanced debit/credit rule, but the SDK is not a local posting or reconciliation engine. It requires a PHP environment and authorized Intuit/QuickBooks access. Preserve applicable notices if it is later redistributed. [7]

We have not connected either paid service, used credentials, installed the cloned projects' dependencies, executed their code, or incorporated their source into our app. No claim is made that the vendors have disclosed their proprietary accounting mechanisms.

## Recommended next upgrades

First, implement a disk-backed storage adapter for the proposed Windows portable edition. Resolve paths relative to the launcher, keep app-managed data/runtime/model files on the removable disk, use locks and integrity checks, and back up before migrations. Test drive-letter changes and interrupted writes. Connecting the disk should not execute anything; the user deliberately starts the launcher.

Second, strengthen reconciliation with both unmatched bank rows and unmatched book-side lines, separate statement/book balance calculations, timing differences and explicit final review. Add OFX/CAMT only after the CSV and duplicate/approval path is robust. No network feed should be necessary for offline bookkeeping.

Third, expand the replaceable local-AI adapter with model/version provenance and vetted framework-specific knowledge packs. Keep model output advisory: accounting validation and report calculations remain deterministic, and the user confirms posting. Larger models may improve some tasks but need suitable hardware and do not guarantee correct or universal accounting advice.

Online publication, secure multi-user cloud storage, mobile offline operation, cross-device synchronization and the no-install executable remain separate unfinished deliverables. The current web foundation must not be advertised as already meeting those requirements.

## Clone scope

All seven research clones exist outside the app source, beneath `/home/ubuntu/accounting-research/`, in folders `frappe-books`, `gnucash`, `erpnext`, `ledgersmb`, `akaunting`, `xero-sdk` and `quickbooks-sdk`. These are cloud-sandbox paths, not files on the user's C:, D:, E: or F: drives. They are not included in the product's Git repository. Detailed per-repository inspection notes are stored alongside them.

## References

[1]: https://github.com/frappe/books "Frappe Books source, LICENSE, database manager, ledger postings and maintenance notice"
[2]: https://github.com/Gnucash/gnucash "GnuCash source, LICENSE, split engine, reconciliation and storage backends"
[3]: https://github.com/frappe/erpnext "ERPNext source, GPL license, general ledger, payments and bank reconciliation"
[4]: https://github.com/ledgersmb/LedgerSMB "LedgerSMB source, root license, batch approvals, reconciliation and reporting SQL"
[5]: https://github.com/akaunting/akaunting "Akaunting source, BSL license, banking transactions and reconciliation models"
[6]: https://github.com/XeroAPI/xero-node "Official Xero Node SDK, MIT license, OAuth client and generated API models"
[7]: https://github.com/intuit/QuickBooks-V3-PHP-SDK "Official Intuit QuickBooks V3 PHP SDK, Apache license, data services and reports"
