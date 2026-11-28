import type { Ledger } from "./db";
import type { Proposal, PostingHead } from "./operations";
import type { AccountType } from "./types";
const extra: Partial<
  Record<
    PostingHead,
    { code: string; name: string; type: AccountType; description: string }
  >
> = {
  cogs: {
    code: "5300",
    name: "Cost of goods sold",
    type: "Expense",
    description: "Carrying cost of delivered goods.",
  },
  wages: {
    code: "5400",
    name: "Wages and salaries",
    type: "Expense",
    description: "Reviewed gross payroll accrual.",
  },
  "payroll-payable": {
    code: "2200",
    name: "Payroll payable",
    type: "Liability",
    description: "Approved net wages owed to employees.",
  },
  deductions: {
    code: "2210",
    name: "Payroll deductions payable",
    type: "Liability",
    description:
      "Reviewed deductions awaiting remittance; statutory calculation is external.",
  },
};
export async function saveOperationalDraft(
  ledger: Ledger,
  proposal: Proposal,
  sourceCurrency: string,
): Promise<string> {
  if (ledger.snapshot().settings.currency !== sourceCurrency)
    throw Error("Operations and ledger currencies must match");
  const heads = new Map<PostingHead, string>();
  for (const line of proposal.lines) {
    if (heads.has(line.head)) continue;
    const definition = extra[line.head];
    if (!definition) {
      heads.set(line.head, line.head);
      continue;
    }
    const existing = ledger
      .snapshot()
      .accounts.find((a) => a.code === definition.code);
    if (existing) {
      if (
        existing.type !== definition.type ||
        existing.name !== definition.name
      )
        throw Error(
          "Operational account code has a conflicting meaning; review the chart of accounts",
        );
      heads.set(line.head, existing.id);
    } else heads.set(line.head, await ledger.addAccount(definition));
  }
  return ledger.importOperationDraft(proposal.id, {
    date: proposal.date,
    description: proposal.description,
    lines: proposal.lines.map((line) => ({
      accountId: heads.get(line.head)!,
      debit: line.debit,
      credit: line.credit,
    })),
  });
}
