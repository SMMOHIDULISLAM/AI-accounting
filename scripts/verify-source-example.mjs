import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  inspectExternalBook,
  mapExternalEntries,
} from "../src/lib/external-books.ts";
import { sourceAging } from "../src/lib/accounting-skills.ts";
import { Ledger } from "../src/lib/db.ts";
import { report } from "../src/lib/accounting.ts";
if (!process.argv[2]) throw Error("Pass the synthetic source backup path");
const source = await inspectExternalBook(
  new Uint8Array(readFileSync(process.argv[2])),
  { wasmPath: `${process.cwd()}/node_modules/sql.js/dist/sql-wasm.wasm` },
);
assert.equal(source.format, "ledger-reborn");
assert.deepEqual(source.errors, []);
assert.equal(sourceAging(source, "invoice", "2026-01-31").total, 8400);
const ledger = await Ledger.open();
try {
  await ledger.updateSettings({ currency: "USD" });
  const cogs = await ledger.addAccount({
    code: "5300",
    name: "Cost of goods sold",
    type: "Expense",
    description: "Synthetic source contract test",
  });
  const mappingBySourceCode = {
    1000: "bank",
    1100: "ar",
    1200: "inventory",
    2000: "ap",
    3000: "capital",
    4000: "sales",
    5000: cogs,
  };
  const mapping = Object.fromEntries(
    source.accounts
      .filter((account) => mappingBySourceCode[account.code])
      .map((account) => [account.id, mappingBySourceCode[account.code]]),
  );
  const drafts = mapExternalEntries(
    source,
    mapping,
    ledger.snapshot().accounts,
  );
  await ledger.importExternalDrafts(
    source.format,
    "synthetic-company",
    "USD",
    drafts,
  );
  assert.equal(report(ledger.snapshot(), "2026-01-01", "2026-01-31").income, 0);
  for (const draft of ledger.snapshot().journals) await ledger.post(draft.id);
  const result = report(ledger.snapshot(), "2026-01-01", "2026-01-31");
  assert.equal(result.income, 12400);
  assert.equal(result.expense, 1400);
  assert.equal(result.profit, 11000);
  assert.equal(result.cashBalance, 104000);
  assert.equal(result.assets, 118000);
  assert.equal(result.liabilities, 7000);
  assert.equal(result.balanced, true);
  console.log(
    JSON.stringify({
      sourceEngineToWebContract: "pass",
      journals: drafts.length,
      income: result.income,
      profit: result.profit,
      receivables: 8400,
    }),
  );
} finally {
  await ledger.release();
}
