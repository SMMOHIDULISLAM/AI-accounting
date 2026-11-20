import type { Account, AccountType, Line, Snapshot } from "./types";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a decimal amount into integer minor units without floating-point arithmetic. */
export function parseMoney(input: string): number {
  if (typeof input !== "string") throw new Error("Money must be text");
  let value = input.trim();
  if (!value) throw new Error("Money is required");

  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1).trim();
  }
  if (value.startsWith("+")) value = value.slice(1);
  else if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  }
  value = value
    .replace(/^[A-Z]{3}\s*/i, "")
    .replace(/^[$€£₹৳]\s*/, "")
    .trim();

  const match = /^(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error(`Invalid money amount: ${input}`);
  const wholeText = match[1].replace(/,/g, "");
  const fraction = (match[2] || "").padEnd(2, "0");
  const whole = Number(wholeText);
  const cents = Number(fraction || "0");
  const result = whole * 100 + cents;
  if (!Number.isSafeInteger(result))
    throw new Error("Money amount is too large");
  return negative ? -result : result;
}

export function formatMoney(cents: number, currency = "BDT"): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Money must be an integer");
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function isValidDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC treats years 0..99 as 1900..1999. Build the date first, then
  // set the full year so that valid ISO years such as 0001 remain valid.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertDate(value: string): void {
  if (!isValidDate(value)) throw new Error(`Invalid date: ${value}`);
}

export interface Report {
  trial: { account: Account; debit: number; credit: number; balance: number }[];
  income: number;
  expense: number;
  profit: number;
  assets: number;
  liabilities: number;
  equity: number;
  earnings: number;
  cashIn: number;
  cashOut: number;
  cashBalance: number;
  balanced: boolean;
}

function naturalBalance(
  type: AccountType,
  debit: number,
  credit: number,
): number {
  return type === "Asset" || type === "Expense"
    ? debit - credit
    : credit - debit;
}

function isCashAccount(account: Account): boolean {
  return account.id === "bank" || account.id === "cash";
}

/** Build management-report figures from posted journals only. */
export function report(snapshot: Snapshot, from: string, to: string): Report {
  assertDate(from);
  assertDate(to);
  if (from > to)
    throw new Error("Report start date must not be after its end date");

  const accounts = new Map(
    snapshot.accounts.map((account) => [account.id, account]),
  );
  const allTotals = new Map<string, { debit: number; credit: number }>();
  const periodTotals = new Map<string, { debit: number; credit: number }>();
  let cashIn = 0;
  let cashOut = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  for (const journal of snapshot.journals) {
    if (journal.status !== "posted" || journal.date > to) continue;
    const inPeriod = journal.date >= from;
    for (const line of journal.lines) {
      const account = accounts.get(line.accountId);
      if (!account) continue;
      const all = allTotals.get(line.accountId) || { debit: 0, credit: 0 };
      all.debit += line.debit;
      all.credit += line.credit;
      allTotals.set(line.accountId, all);
      totalDebits += line.debit;
      totalCredits += line.credit;
      if (inPeriod) {
        const period = periodTotals.get(line.accountId) || {
          debit: 0,
          credit: 0,
        };
        period.debit += line.debit;
        period.credit += line.credit;
        periodTotals.set(line.accountId, period);
        if (isCashAccount(account)) {
          cashIn += line.debit;
          cashOut += line.credit;
        }
      }
    }
  }

  const trial = snapshot.accounts.map((account) => {
    const total = allTotals.get(account.id) || { debit: 0, credit: 0 };
    const debit = Math.max(total.debit - total.credit, 0);
    const credit = Math.max(total.credit - total.debit, 0);
    return {
      account,
      debit,
      credit,
      balance: naturalBalance(account.type, total.debit, total.credit),
    };
  });

  let income = 0;
  let expense = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  for (const row of trial) {
    if (row.account.type === "Income") {
      const period = periodTotals.get(row.account.id) || {
        debit: 0,
        credit: 0,
      };
      income += period.credit - period.debit;
    } else if (row.account.type === "Expense") {
      const period = periodTotals.get(row.account.id) || {
        debit: 0,
        credit: 0,
      };
      expense += period.debit - period.credit;
    } else if (row.account.type === "Asset") assets += row.balance;
    else if (row.account.type === "Liability") liabilities += row.balance;
    else if (row.account.type === "Equity") equity += row.balance;
  }

  // Earnings are cumulative through the report date, while P&L is date-range based.
  let earnings = 0;
  for (const row of trial) {
    if (row.account.type === "Income" || row.account.type === "Expense")
      earnings += row.account.type === "Income" ? row.balance : -row.balance;
  }

  return {
    trial,
    income,
    expense,
    profit: income - expense,
    assets,
    liabilities,
    equity,
    earnings,
    cashIn,
    cashOut,
    cashBalance: trial
      .filter((row) => isCashAccount(row.account))
      .reduce((sum, row) => sum + row.balance, 0),
    balanced: totalDebits === totalCredits,
  };
}

export function linesBalanced(lines: Line[]): boolean {
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  return lines.length > 0 && debit > 0 && debit === credit;
}
