// Adaptations of Ledger Reborn's _allocate and _aging policies.
// Copyright (c) 2026 Ledger Reborn contributors. MIT; see third_party/ledger-reborn/LICENSE.
import { assertDate } from "./accounting";
import type { ExternalBook } from "./external-books";

export const ACCOUNTING_SKILLS = [
  {
    id: "invoice",
    title: "Invoice before payment",
    debit: "ar",
    credit: "sales",
    explanation:
      "An earned service invoice increases Receivables and Sales. A later receipt reduces Receivables; it must not record Sales again.",
    checks:
      "Confirm delivery, customer, invoice date and tax separately. This draft does not create an invoice master.",
  },
  {
    id: "supplier-bill",
    title: "Ordinary supplier bill",
    debit: "expense",
    credit: "ap",
    explanation:
      "An unpaid ordinary operating cost increases Expense and Payables. Inventory and durable assets use their own asset accounts.",
    checks:
      "Check recognition date, supplier, evidence and tax. This draft does not create a supplier-bill master.",
  },
  {
    id: "receipt",
    title: "Collect a recorded invoice",
    debit: "bank",
    credit: "ar",
    explanation:
      "Money received against an already recorded invoice increases Bank and reduces Receivables.",
    checks:
      "Check the original invoice and outstanding amount. Do not recognize the sale twice.",
  },
  {
    id: "payment",
    title: "Pay a recorded supplier bill",
    debit: "ap",
    credit: "bank",
    explanation:
      "Paying an existing bill reduces Payables and Bank. A partial payment leaves the remaining payable outstanding.",
    checks:
      "Match the supplier and bill, check the remaining balance, and do not expense the bill twice.",
  },
  {
    id: "stock-purchase",
    title: "Buy inventory on credit",
    debit: "inventory",
    credit: "ap",
    explanation:
      "Goods held for resale increase Inventory and Payables. Selling later also requires a cost-of-goods-sold entry and an actual stock record.",
    checks:
      "This draft does not create stock quantities. Review freight, returns, tax and costing policy separately.",
  },
] as const;

function minor(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Amounts must be nonnegative safe integer minor units");
  return BigInt(value);
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 0n)
    throw Error("Total exceeds the exact supported amount range");
  return Number(value);
}
/** Largest-remainder allocation; ties retain source order, with no lost cents. */
export function allocateMinorUnits(
  amount: number,
  weights: number[],
): number[] {
  const n = minor(amount),
    values = weights.map(minor);
  const total = values.reduce((a, b) => a + b, 0n);
  if (!values.length || total === 0n)
    throw Error("Provide positive allocation weights");
  const shares = values.map((weight) => (n * weight) / total);
  const remainder = safe(n - shares.reduce((a, b) => a + b, 0n));
  const order = values
    .map((weight, index) => ({ index, remainder: (n * weight) % total }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  for (let i = 0; i < remainder; i++) shares[order[i].index]++;
  return shares.map(safe);
}
export function sourceAging(
  book: ExternalBook,
  kind: "invoice" | "bill",
  asOf: string,
) {
  assertDate(asOf);
  const buckets = {
    current: 0,
    "1–30": 0,
    "31–60": 0,
    "61–90": 0,
    "over 90": 0,
  };
  const rows = book.documents
    .filter((document) => document.kind === kind && document.date <= asOf)
    .map((document) => {
      const paid = book.payments
        .filter(
          (payment) =>
            payment.documentId === document.id && payment.date <= asOf,
        )
        .reduce((sum, payment) => sum + minor(payment.amount), 0n);
      if (paid > minor(document.total))
        throw Error(`Source document ${document.id} is overpaid`);
      const outstanding = safe(minor(document.total) - paid);
      const days = Math.max(
        0,
        Math.floor(
          (Date.parse(asOf) - Date.parse(document.dueDate)) / 86400000,
        ),
      );
      const bucket: keyof typeof buckets =
        days === 0
          ? "current"
          : days <= 30
            ? "1–30"
            : days <= 60
              ? "31–60"
              : days <= 90
                ? "61–90"
                : "over 90";
      buckets[bucket] = safe(minor(buckets[bucket]) + minor(outstanding));
      return { ...document, outstanding, days, bucket };
    })
    .filter((document) => document.outstanding > 0);
  return {
    asOf,
    kind,
    rows,
    buckets,
    total: safe(
      Object.values(buckets).reduce((sum, amount) => sum + minor(amount), 0n),
    ),
  };
}

/** Moving weighted-average stock cost, calculated exactly to six quantity decimals. */
export function stockCost(
  stockQuantity: string,
  stockValue: number,
  soldQuantity: string,
) {
  const quantity = (text: string) => {
    if (!/^\d+(?:\.\d{1,6})?$/.test(text))
      throw Error("Use nonnegative quantities with at most six decimal places");
    const [whole, fraction = ""] = text.split(".");
    const value = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    if (value > 1_000_000_000_000_000n)
      throw Error("Quantity exceeds the supported range");
    return value;
  };
  const held = quantity(stockQuantity),
    sold = quantity(soldQuantity),
    value = minor(stockValue);
  if (held <= 0n || sold <= 0n || sold > held)
    throw Error("Sold quantity must be positive and cannot exceed stock");
  const numerator = value * sold;
  const cost = sold === held ? value : (numerator + held / 2n) / held;
  return {
    cost: safe(cost),
    remainingValue: safe(value - cost),
    remainingQuantity: `${(held - sold) / 1_000_000n}.${String((held - sold) % 1_000_000n).padStart(6, "0")}`,
  };
}
