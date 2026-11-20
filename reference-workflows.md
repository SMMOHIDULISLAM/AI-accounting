# Accounting workflow references

Checked 20 November 2026. No Xero or QuickBooks paid account or API was used.

Xero's official reconciliation report pack compares actual and book balances and keeps bank statement lines and statement exceptions visible. Its guidance differentiates unmatched ledger payments/receipts and unreconciled imported lines, and notes that missing or duplicate records can cause differences. The app should not equate a zero aggregate difference with completed line-by-line reconciliation. Source: https://central.xero.com/s/article/Bank-Reconciliation-Summary

QuickBooks' official guide describes gathering opening/closing statements and ledger records, matching transactions, identifying outstanding items, investigating differences, and then reviewing adjusted book and bank balances. It stresses that automated suggestions still need human checking. Source: https://quickbooks.intuit.com/r/accounting/bank-reconciliation/

These are usability and process references, not evidence that this MVP has the full functionality, assurance, security or integrations of either commercial product. The first version keeps imported rows separate, proposes matches, requires confirmation, shows exceptions and does not silently manufacture adjustments. A later complete reconciliation report should expose unmatched book-side lines and timing differences as well as statement-side exceptions.
