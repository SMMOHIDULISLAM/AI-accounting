# Track 1 — AI Accounting Core

The existing React/SQLite app remains the local bookkeeping workbench. It now has reviewed foreign-book imports, source aging, exact allocation/stock-cost calculators, accounting-pattern drafts and a searchable catalog of the 73 requested repositories.

Run `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm edition:core`. Default URL: `http://127.0.0.1:3001`. The launcher disables WhatsApp intake for this core process. Node 24 is required.

Source imports are drafts only. A stable book ID plus source journal ID prevents repeated exports from duplicating an earlier import; changed content/mapping rejects the entire batch. Do not rename the source book ID for later snapshots. The source and ledger currencies must match.

Browser records belong to this origin and browser. They are not shared with the ERPNext database or another browser/port. Use explicit, checked exports/imports and backups; no synchronization is implied.
