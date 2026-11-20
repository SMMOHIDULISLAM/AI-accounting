# AI Accounting outcomes

- [x] Local SQLite ledger: real sql.js database persisted in IndexedDB, save errors surfaced, .sqlite backup/validated restore, one currency including editable BDT, explanations for Assets/Liabilities/Equity/Income/Expenses. Prevent conflicting tab writes. No cloud ledger or encryption claim.
- [x] Balanced journals: integer minor units, editable drafts, nonzero balanced multiline posting, immutable posted entries, corrections via linked reversals with reason and audit history.
- [x] CSV inbox: map date/description/reference/signed amount or debit/credit; sign convention explained; preview, row errors, source retention and probable duplicate review; no direct automatic posting. Reconciliation-only bank rows and downloadable sample.
- [x] Assistant and manual selection: labelled guided rules ask clarifying questions, explain equipment/expense, deposit/revenue, owner funding/loan, payable settlement; balanced suggestions require user review. Guidance off leaves manual entry. Optional same-origin loopback Ollama lists installed local models, validates structured account suggestions, no cloud/paid fallback, no model SQL or autonomous posting. Preview accurately shows local AI unavailable.
- [x] Reconciliation: exact account/amount/date/reference candidate matches to posted bank lines, explicit confirmation, no reuse, opening/closing bank balances and difference, unmatched items retained, no invented adjustments.
- [x] Statements: deterministic posted-ledger trial balance, general ledger, period P&L, as-of balance sheet including earnings, labelled cash movement summary, exceptions, report dates and CSV export. Draft management reports, not complete GAAP/IFRS statutory statements.
- [x] Usable web app: responsive Swiss financial workbench, left navigation and contextual explanations, local assets, diagnostics, route manifest and managed Preview runtime. No paid inference or unapproved publication.
- [ ] Handoff: local setup README and AI limitations, type checks/build/focused tests and read-only review, saved checkpoint, private AI-accounting repository created through owner card and transfer completed. Repository is not created until confirmed.

- [ ] Revised portable scope: confirm Windows 10/11 x64, store app-controlled ledger/attachments/runtime/models on the removable disk, no destination dependency installation, no USB autorun, run only on explicit user launch. Current browser IndexedDB build does not satisfy disk portability. Online/mobile sync remains separate unimplemented work. See PORTABLE-ROADMAP.md.
- [ ] Source reuse: inspect and clone legitimate public accounting engines and official SDKs under their licenses, report exact reuse constraints, and select reviewed components before integration. Proprietary Xero/QuickBooks engine source is not implied by public SDKs.

## Foundation evidence

TypeScript checking and production build pass. Fifteen accounting/storage regressions and four mock-local-AI adapter regressions pass (19 total). A focused browser check confirmed blank report dates show validation and recover without changing records. Public source clones remain outside this repository. Portable executable, bundled model, online publication and mobile sync are not implemented. Private repository transfer is pending owner confirmation.
