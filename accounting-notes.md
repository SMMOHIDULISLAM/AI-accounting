# AI Accounting — MVP domain recommendation

## Recommended MVP boundary

Build a **local-first double-entry ledger**, not a universal compliance engine. Every transaction should become a journal entry with one or more debit lines and credit lines, and the entry must be balanced before it can be posted. Keep the chart of accounts separate from transactions, with stable account IDs, human labels, account type, parent account, normal balance, currency, and optional policy tags. Do not let a CSV row directly change a balance without passing through a journal entry.

Separate **draft** from **posted** state. Drafts may be edited and queried by the assistant. Posted journals should be immutable; corrections should use a reversal and a new entry, with who/when/why metadata. Preserve the imported source row, document reference, and any user decision so the ledger can be explained later.

Add reconciliation as a controlled workflow, not a guessing feature. Import bank or cash records into a separate source layer, detect duplicates, and propose matches using date, amount, currency, account, and reference. Keep matched, unmatched, and needs-review states. Use a configurable tolerance only as a review aid. Never silently post a weak match, and never delete an unmatched source item to make balances agree.

Make statements **period-aware**. Store fiscal-year and period boundaries, accounting basis, reporting currency, comparative-period settings, and a close/lock status. Generate trial balance, general ledger, profit or loss, balance sheet/statement of financial position, cash-flow view, and reconciliation exceptions from the same posted ledger. Treat period close as a review gate; reopening requires a reason and an audit event.

The assistant should ask novice-friendly questions and offer a proposed account plus plain-language reason, but require confirmation for ambiguous or material items. It should show the proposed debit, credit, amount, date, tax treatment if configured, and confidence before posting. The MVP should explicitly say that its outputs are management records or draft statements unless a qualified reviewer confirms the chosen framework, policies, adjustments, and disclosures.

## Framework and statement guardrails

Do not present “global accounting” as one rulebook. Store the selected reporting framework and version as ledger configuration, with local policy overrides. The IFRS Foundation describes IFRS for SMEs as a separate simplified framework: it omits topics, removes some options, simplifies recognition and measurement, requires fewer disclosures, and uses plainer language than full IFRS [1]. Therefore, the product should not assume that an SME profile, local GAAP profile, or full-IFRS profile is interchangeable.

For full IFRS, a compliance label must be treated as a high bar. IAS 1 says an entity may state that its financial statements comply with IFRS only when they comply with all requirements, and the statement must be explicit and unreserved [2]. The MVP should therefore use labels such as “generated from posted ledger” or “IFRS-oriented template” unless the relevant framework, local adoption rules, accounting policies, estimates, adjustments, and disclosures have been reviewed.

The complete-set scope described by IAS 1 includes a statement of financial position; profit or loss and other comprehensive income, either combined or separate; changes in equity; cash flows; notes with material accounting policy information and other explanatory information; and, in specified retrospective-restatement or reclassification cases, an opening statement of financial position for the preceding comparative period [2]. Generate the core numeric statements first, but make notes, policy disclosures, comparatives, and the exceptional opening statement explicit review requirements rather than pretending that a chart of accounts alone creates compliant financial statements.

## Plain-language ambiguity examples

- **“I bought $120 of printer ink on the business card.”** Ask whether it is ordinary consumable ink used now or a durable printer/equipment item, which business card was used, and whether tax was shown. A likely entry is debit office supplies and credit card payable; keep it as a suggestion until confirmed.
- **“Here is a $900 receipt for a laptop.”** Ask whether it is mainly for the business, the business’s capitalization threshold, expected useful life, who paid, and the purchase date. Depending on the policy, it may be equipment with depreciation rather than an immediate expense. Do not infer the policy from the receipt alone.
- **“A customer sent me $500.”** Ask whether an invoice was already issued, whether the promised goods or service were delivered, and whether this is a deposit, a loan, a refund, or revenue. A customer deposit is not automatically revenue.
- **“I paid the $1,000 supplier invoice.”** Ask which previously recorded invoice it settles. If the payable already exists, the usual action is debit accounts payable and credit bank; debiting expense again would double-count it.
- **“I put $2,000 into the business.”** Ask whether the owner expects repayment, whether it is an owner contribution, and which legal entity owns the account. It may be equity or a loan, not sales revenue.

## Why universal compliance and maximum expertise cannot be promised

“All-world compliance” cannot be guaranteed because jurisdictions differ in adopted standards, tax and VAT/GST rules, statutory formats, filing deadlines, payroll and industry requirements, retention rules, currency treatment, audit thresholds, and legal-entity definitions. Rules and standard editions also change. Even a framework name does not establish that a particular entity qualifies to use it or that its local regulator accepts the resulting presentation.

The assistant also cannot guarantee the highest level of accounting skill. Classification can depend on contracts, substance, estimates, materiality, related parties, impairment, leases, revenue timing, tax law, and facts missing from a receipt. The safe product promise is decision support with visible uncertainty, evidence capture, and approval—not autonomous certification, audit, tax advice, or a claim that the generated statements are legally compliant.

## Safe extension layers after MVP

1. **Framework/policy packs:** versioned profiles for full IFRS, IFRS for SMEs, and selected local GAAP, each with eligibility checks, effective dates, account mappings, statement layouts, disclosure checklists, tax settings, and an explicit “reviewed by” field.
2. **Jurisdiction adapters:** add one jurisdiction at a time for statutory, tax, e-invoicing, payroll, currency, and retention rules. Keep local rules separate from the core double-entry engine and show the rule source and effective date.
3. **Review and evidence layer:** require approval for high-risk classifications, retain source documents and explanations, export an accountant-ready trial balance and adjustment log, and provide a checklist for missing notes and reconciliations.
4. **Controlled automation:** permit auto-posting only for user-approved recurring rules with amount limits, duplicate checks, and rollback through reversing journals. Route anything outside the rule to draft/review.
5. **Professional handoff:** support a reviewer role, comments, sign-off, period lock, and a clear handoff package. The interface should never imply that software output replaces a licensed accountant, auditor, or tax professional.

## References

[1]: https://www.ifrs.org/issued-standards/ifrs-for-smes/ "The IFRS for SMEs Accounting Standard — IFRS Foundation"
[2]: https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/ "IAS 1 Presentation of Financial Statements — IFRS Foundation"
