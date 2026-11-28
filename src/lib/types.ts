export type AccountType =
  "Asset" | "Liability" | "Equity" | "Income" | "Expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description: string;
  parentId?: string;
}

export interface Line {
  accountId: string;
  /** Integer minor units (for example, cents). */
  debit: number;
  /** Integer minor units (for example, cents). */
  credit: number;
}

export interface Journal {
  id: string;
  date: string;
  description: string;
  status: "draft" | "posted";
  lines: Line[];
  reference?: string;
  reversalOf?: string;
}

export interface SourceRow {
  id: string;
  date: string;
  description: string;
  /** Signed integer minor units; positive is an inflow after CSV normalization. */
  amount: number;
  reference: string;
  mode: "transactions" | "reconciliation";
  journalId?: string;
  matchedLine?: string;
}

export interface Settings {
  name: string;
  currency: string;
  country: string;
  framework: string;
  guidance: boolean;
}

export interface Snapshot {
  accounts: Account[];
  journals: Journal[];
  sources: SourceRow[];
  settings: Settings;
  audit: { date: string; action: string }[];
}
