# Request for independent accounting review — v0.5 learning preview

Status: **not certified**. No CPA, FCA, CA, firm or institute has reviewed or endorsed this release. No free certification provider has been confirmed. A voluntary review is requested; a certificate can only be represented after an appropriately qualified independent reviewer defines, performs and documents its scope.

## Review package

Read the [operation guide](OPERATIONS-GUIDE-BN.md), [platform scope](PLATFORM-SETUP.md), [source/license catalog](ACCOUNTING-SOURCES.md), [trial schema](../editions/cloud/schema.sql) and [RLS verification](../editions/cloud/verify-rls.sql). Run `pnpm check`, `pnpm test`, `pnpm verify:sources`, the retained Python tests and production smoke check. Native language checks run separately. Automated tests are engineering evidence, not a professional audit opinion.

Use disposable synthetic companies only. Do not send client ledgers, passwords, payroll records, account numbers or identity documents in public issues.

## Suggested procedures

| Area | Synthetic procedure | Expected outcome |
|---|---|---|
| Double entry | Cash 100 BDT + credit sale 50 BDT | Cash debit 100; receivable debit 50; sales credit 150; draft excluded until posted |
| Corrections | Try editing a posted entry; create reversal | API rejects direct edits; linked reversal retains original |
| Exact money | Decimal/Bangla input, maximum supported amounts, rounding | Integer minor units; no floating-point drift or unsafe totals |
| Supply chain | Receive 10 units for BDT 1,000, consume 6 for 3 finished units, deliver 2 | Raw BDT 400 + remaining FG BDT 200 = inventory BDT 600; delivered cost BDT 400 |
| Proposals | Retry importing the same receipt/delivery proposal | One stable draft; changed content conflicts; user separately posts |
| Payroll | Salary 30,000 × 29/30 + 1,000 allowance − 500 deduction | Gross 30,000, net 29,500, deductions 500; accrual only, no payment |
| Reconciliation | Signed cash/bank rows with repeated amounts | Currency/date/amount reviewed; one line cannot be reused |
| Backup | Export/restore ledger and operations separately | Corrupt state rejected; correct balances reload; proposals reconciled |
| Messaging | Invalid signature/header, unapproved sender, repeated ID | Rejected/ignored as appropriate; authorized message persists once |
| Trial | Two owners, anonymous access, stale revision, expired trial | Cross-owner access denied; no anonymous table access; stale write rejected; expired owner reads/exports only |

## Matters requiring professional judgment

Revenue timing, tax treatment, cash/credit grammar, chart mapping, payroll deductions, inventory valuation, labour/overhead absorption, opening balances, reporting framework and jurisdiction are not automatically certified. This prototype's statements are management drafts. It has no complete IFRS/GAAP disclosures, consolidation, statutory reporting or filing engine. Manufacturing excludes returns, partial receipts/deliveries, scrap and full conversion costs. The trial is owner-only and lacks enterprise segregation of duties, tamper-evident audit infrastructure and a tested enterprise recovery regime.

A reviewer should identify credentials and jurisdiction, independence/conflicts, exact commit reviewed, procedures, findings, exceptions and permitted wording. A favourable limited review must not be advertised as universal legal, tax or professional certification. Request no-cost volunteer help first; do not incur review fees without a separately agreed scope and budget.
