import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localOcrPath, runLocalOcr } from "../server/receipts.ts";
import { receiptCandidates } from "../src/lib/receipt-text.ts";
const executable = localOcrPath();
if (!executable || !process.argv[2])
  throw Error(
    "Requires installed local Tesseract and the synthetic receipt image path",
  );
const text = await runLocalOcr(executable, readFileSync(process.argv[2]));
const result = receiptCandidates(text);
assert(
  result.totals.some(
    (total) => total.amount === 15000 && total.currency === "BDT",
  ),
);
assert(result.dates.includes("2026-11-27"));
console.log(
  JSON.stringify({
    localSyntheticEnglishOcr: "pass",
    amount: 15000,
    currency: "BDT",
    date: "2026-11-27",
    realReceiptsTested: false,
  }),
);
