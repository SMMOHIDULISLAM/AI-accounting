import initSqlJs, { type Database } from "sql.js";
import { assertDate, linesBalanced, parseMoney } from "./accounting";
import type { Account, AccountType, Line } from "./types";

export type BookFormat = "ledger-reborn" | "accounting-sqlite" | "openqbw";
export interface ExternalAccount {
  id: string;
  code: string;
  name: string;
  type?: AccountType;
}
export interface ExternalEntry {
  id: string;
  date: string;
  description: string;
  lines: { accountId: string; debit: number; credit: number }[];
}
export interface AgingDocument {
  id: string;
  kind: "invoice" | "bill";
  date: string;
  dueDate: string;
  party: string;
  total: number;
}
export interface ExternalBook {
  format: BookFormat;
  accounts: ExternalAccount[];
  entries: ExternalEntry[];
  warnings: string[];
  errors: string[];
  currency?: string;
  documents: AgingDocument[];
  payments: { documentId: string; date: string; amount: number }[];
  diagnostics: Record<string, string>;
  rawLines: Record<string, string | null>[];
}
export interface ExternalDraft {
  sourceId: string;
  date: string;
  description: string;
  lines: Line[];
}
const LIMIT = 5000;
function rows(db: Database, sql: string): Record<string, any>[] {
  const result = db.exec(sql)[0];
  if (!result) return [];
  if (result.values.length > LIMIT)
    throw Error(
      `Source exceeds the ${LIMIT}-row review limit. Split it into smaller exports.`,
    );
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((column, i) => [column, row[i]])),
  );
}
function read(
  db: Database,
  table: string,
  columns: string,
): Record<string, any>[] {
  // Both table and columns are fixed application constants, never user SQL.
  return rows(db, `SELECT ${columns} FROM "${table}" LIMIT ${LIMIT + 1}`);
}
function integer(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw Error("Amounts must be nonnegative integer minor units.");
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw Error("Amount exceeds the exact supported range.");
  return n;
}
function required(value: unknown, label: string, limit = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw Error(`Invalid ${label}`);
  return value;
}
function accountType(value: unknown): AccountType | undefined {
  const types: Record<string, AccountType> = {
    asset: "Asset",
    assets: "Asset",
    liability: "Liability",
    liabilities: "Liability",
    equity: "Equity",
    income: "Income",
    revenue: "Income",
    expense: "Expense",
    expenses: "Expense",
  };
  return types[String(value).trim().toLowerCase()];
}
function checkEntries(book: ExternalBook): void {
  for (const account of book.accounts) {
    required(account.id, "source account ID", 200);
    required(account.code, "source account code", 200);
    required(account.name, "source account name", 200);
  }
  const accounts = new Set(book.accounts.map((account) => account.id));
  if (accounts.size !== book.accounts.length)
    throw Error("Duplicate source account IDs");
  const seen = new Set<string>();
  for (const entry of book.entries) {
    try {
      required(entry.id, "source journal ID", 200);
      if (seen.has(entry.id)) throw Error("Duplicate source journal ID");
      seen.add(entry.id);
      assertDate(entry.date);
      required(entry.description, "journal description");
      if (entry.lines.some((line) => !accounts.has(line.accountId)))
        throw Error("Missing source account");
      if (!linesBalanced(entry.lines))
        throw Error("Unbalanced, empty or oversized journal");
    } catch (e) {
      book.errors.push(`Journal ${entry.id}: ${(e as Error).message}`);
    }
  }
}

/** Opens only an in-memory copy. Never restores a foreign database into the ledger. */
export async function inspectExternalBook(
  bytes: Uint8Array,
  options: { sqlitePositive?: "debit" | "credit"; wasmPath?: string } = {},
): Promise<ExternalBook> {
  if (
    bytes.length > 20_000_000 ||
    new TextDecoder().decode(bytes.slice(0, 16)) !== "SQLite format 3\0"
  )
    throw Error(
      "Choose a genuine SQLite file no larger than 20 MB. Raw QBW/QBB files must first be exported with OpenQBW.",
    );
  const SQL = await initSqlJs({
    locateFile: () => options.wasmPath || "/sql-wasm.wasm",
  });
  const db = new SQL.Database(new Uint8Array(bytes));
  try {
    db.run("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;");
    if (rows(db, "PRAGMA integrity_check")[0]?.integrity_check !== "ok")
      throw Error("Source SQLite integrity check failed");
    const tables = new Set(
      rows(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND sql NOT LIKE 'CREATE VIRTUAL TABLE%' AND name NOT LIKE 'sqlite_%'",
      ).map((row) => row.name),
    );
    const book: ExternalBook = {
      format: "ledger-reborn",
      accounts: [],
      entries: [],
      documents: [],
      payments: [],
      warnings: [],
      errors: [],
      diagnostics: {},
      rawLines: [],
    };
    if (
      [
        "transaction_line_items",
        "transactions",
        "meta",
        "scan_rejections",
      ].every((table) => tables.has(table))
    ) {
      book.format = "openqbw";
      const meta = read(db, "meta", "key,value");
      book.diagnostics = Object.fromEntries(
        meta.map((row) => [String(row.key), String(row.value)]),
      );
      const version = rows(db, "PRAGMA user_version")[0]?.user_version;
      if (version !== 1 || book.diagnostics.format_version !== "1")
        throw Error("Unsupported or inconsistent OpenQBW export version");
      book.rawLines = read(
        db,
        "transaction_line_items",
        "CAST(id AS TEXT) id,qb_id_parent,value,value_undecoded,CAST(txn_date_raw AS TEXT) txn_date_raw,date_source,flags,source_table,CAST(page_number AS TEXT) page_number",
      );
      book.warnings.push(
        "Inspection only: OpenQBW numeric fields are not established journal amounts; raw dates and source-table attribution are unverified. No journal import is offered.",
        "NULL means undecoded, never zero. Retain rejected-record counts and compare with independently verified source reports.",
      );
      book.diagnostics.rejected_records = String(
        rows(db, "SELECT COUNT(*) n FROM scan_rejections")[0].n,
      );
      return book;
    }
    if (
      ["accounts", "entries", "journal_lines"].every((table) =>
        tables.has(table),
      )
    ) {
      book.currency = "USD";
      book.accounts = read(
        db,
        "accounts",
        "CAST(id AS TEXT) id,code,name,kind",
      ).map((row) => ({
        id: row.id,
        code: String(row.code),
        name: String(row.name),
        type: accountType(row.kind),
      }));
      const entries = read(db, "entries", "CAST(id AS TEXT) id,date,memo");
      const lines = read(
        db,
        "journal_lines",
        "CAST(entry_id AS TEXT) entry_id,CAST(account_id AS TEXT) account_id,CAST(debit_cents AS TEXT) debit,CAST(credit_cents AS TEXT) credit,typeof(debit_cents) debit_type,typeof(credit_cents) credit_type",
      );
      const grouped = new Map<string, ExternalEntry["lines"]>();
      for (const line of lines) {
        if (line.debit_type !== "integer" || line.credit_type !== "integer")
          throw Error("Ledger Reborn money must be stored as integer cents");
        const group = grouped.get(line.entry_id) || [];
        group.push({
          accountId: line.account_id,
          debit: integer(line.debit),
          credit: integer(line.credit),
        });
        grouped.set(line.entry_id, group);
      }
      const entryIds = new Set(entries.map((entry) => entry.id));
      if (lines.some((line) => !entryIds.has(line.entry_id)))
        throw Error("Orphan source journal line");
      book.entries = entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        description: entry.memo || `Imported journal ${entry.id}`,
        lines: grouped.get(entry.id) || [],
      }));
      if (
        ["documents", "contacts", "payments"].every((table) =>
          tables.has(table),
        )
      ) {
        const contacts = new Map(
          read(db, "contacts", "CAST(id AS TEXT) id,name").map((row) => [
            row.id,
            String(row.name),
          ]),
        );
        book.documents = read(
          db,
          "documents",
          "CAST(id AS TEXT) id,type,date,due_date,CAST(contact_id AS TEXT) contact_id,CAST(total_cents AS TEXT) total,typeof(total_cents) total_type",
        ).map((row) => {
          if (
            !["invoice", "bill"].includes(row.type) ||
            row.total_type !== "integer"
          )
            throw Error("Invalid source document");
          assertDate(row.date);
          assertDate(row.due_date);
          if (!contacts.has(row.contact_id))
            throw Error("Document contact missing");
          return {
            id: row.id,
            kind: row.type,
            date: row.date,
            dueDate: row.due_date,
            party: contacts.get(row.contact_id)!,
            total: integer(row.total),
          };
        });
        book.payments = read(
          db,
          "payments",
          "CAST(document_id AS TEXT) document_id,date,CAST(amount_cents AS TEXT) amount,typeof(amount_cents) amount_type",
        ).map((row) => {
          assertDate(row.date);
          if (row.amount_type !== "integer")
            throw Error("Invalid source payment amount");
          const document = book.documents.find(
            (document) => document.id === row.document_id,
          );
          if (!document || row.date < document.date)
            throw Error("Invalid source payment/document relationship");
          return {
            documentId: row.document_id,
            date: row.date,
            amount: integer(row.amount),
          };
        });
      }
      book.warnings.push(
        "Ledger Reborn uses USD. Import does not convert currency. Only journal history becomes drafts; customers, invoices, payments, inventory and period locks are not migrated as editable application entities.",
        "Choose mappings by economic meaning. Account codes conflict: Ledger Reborn 1200 is Inventory; AI Accounting 1200 is Equipment.",
      );
    } else if (["Accounts", "Journals"].every((table) => tables.has(table))) {
      book.format = "accounting-sqlite";
      if (!options.sqlitePositive)
        throw Error(
          "Select whether positive source journal amounts represent debits or credits.",
        );
      book.accounts = read(db, "Accounts", "CAST(id AS TEXT) id,name,type").map(
        (row) => ({
          id: row.id,
          code: row.id,
          name: String(row.name),
          type: accountType(row.type),
        }),
      );
      const groups = new Map<string, ExternalEntry>();
      for (const row of read(
        db,
        "Journals",
        "CAST(journal_no AS TEXT) journal_no,tran_date,description,CAST(line_account_id AS TEXT) account_id,CAST(line_amount AS TEXT) amount",
      )) {
        const id = required(row.journal_no, "journal number", 200);
        const entry: ExternalEntry = groups.get(id) || {
          id,
          date: row.tran_date,
          description: `Source journal ${id}`,
          lines: [],
        };
        if (entry.date !== row.tran_date)
          throw Error(`Journal ${id} contains inconsistent dates`);
        const amount = parseMoney(required(row.amount, "decimal amount"));
        const debit = options.sqlitePositive === "debit" ? amount : -amount;
        entry.lines.push({
          accountId: row.account_id,
          debit: Math.max(debit, 0),
          credit: Math.max(-debit, 0),
        });
        if (
          row.description &&
          !entry.description.includes(String(row.description))
        )
          entry.description = `${entry.description}; ${row.description}`.slice(
            0,
            2000,
          );
        groups.set(id, entry);
      }
      book.entries = [...groups.values()];
      book.warnings.push(
        "Manual Journals table only. Invoices, bills, receipts and payments are not converted. This is not a complete migration of the example's document-based ledger.",
        "Source currency is unspecified; explicitly confirm the source currency before importing. This adapter was independently written; no unlicensed upstream code or dataset is redistributed.",
      );
    } else
      throw Error(
        "Unsupported SQLite schema. Use a Ledger Reborn backup, the accounting-sqlite manual-journal format, or OpenQBW SQLite export.",
      );
    checkEntries(book);
    return book;
  } finally {
    db.close();
  }
}

export function mapExternalEntries(
  book: ExternalBook,
  mapping: Record<string, string>,
  targets: Account[],
): ExternalDraft[] {
  if (book.format === "openqbw")
    throw Error("OpenQBW exports are inspection-only");
  if (book.errors.length)
    throw Error("Correct source journal errors before importing");
  const sourceAccounts = new Map(
    book.accounts.map((account) => [account.id, account]),
  );
  const targetAccounts = new Map(
    targets.map((account) => [account.id, account]),
  );
  return book.entries.map((entry) => ({
    sourceId: entry.id,
    date: entry.date,
    description: entry.description,
    lines: entry.lines.map((line) => {
      const source = sourceAccounts.get(line.accountId),
        target = targetAccounts.get(mapping[line.accountId]);
      if (!source || !target)
        throw Error(`Map source account ${source?.name || line.accountId}`);
      if (source.type && source.type !== target.type)
        throw Error(`Account type mismatch for ${source.name}`);
      return { ...line, accountId: target.id };
    }),
  }));
}
