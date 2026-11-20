import initSqlJs from "sql.js";
import type {
  Account,
  AccountType,
  Journal,
  Line,
  Settings,
  Snapshot,
  SourceRow,
} from "./types";
import { assertDate, isValidDate, linesBalanced } from "./accounting";

type SQLDatabase = any;
type SQLModule = any;

const STORE = "ai-accounting-ledger";
const KEY = "sqlite";
const ACCOUNT_TYPES: AccountType[] = [
  "Asset",
  "Liability",
  "Equity",
  "Income",
  "Expense",
];
const SUPPORTED_CURRENCIES = [
  "BDT",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "INR",
  "AUD",
] as const;
const isBrowserRuntime =
  typeof window !== "undefined" || typeof document !== "undefined";

type SaveDraftInput = {
  id?: string;
  date: string;
  description: string;
  reference?: string;
  lines: Line[];
};

const SEEDED_ACCOUNTS: Account[] = [
  {
    id: "bank",
    code: "1000",
    name: "Bank",
    type: "Asset",
    description: "Money held in a business bank account.",
  },
  {
    id: "cash",
    code: "1010",
    name: "Cash",
    type: "Asset",
    description: "Physical cash held by the business.",
  },
  {
    id: "ar",
    code: "1100",
    name: "Receivables",
    type: "Asset",
    description: "Amounts customers owe the business.",
  },
  {
    id: "equipment",
    code: "1200",
    name: "Equipment",
    type: "Asset",
    description: "Durable business equipment kept for use.",
  },
  {
    id: "inventory",
    code: "1300",
    name: "Inventory",
    type: "Asset",
    description: "Goods held for sale or use in production.",
  },
  {
    id: "ap",
    code: "2000",
    name: "Payables",
    type: "Liability",
    description: "Amounts owed to suppliers and other creditors.",
  },
  {
    id: "deposits",
    code: "2100",
    name: "Customer Deposits",
    type: "Liability",
    description: "Customer money received before goods or services are earned.",
  },
  {
    id: "capital",
    code: "3000",
    name: "Owner capital",
    type: "Equity",
    description: "Owner contributions that are not loans.",
  },
  {
    id: "loan",
    code: "3100",
    name: "Owner loan",
    type: "Liability",
    description: "Funding the owner expects the business to repay.",
  },
  {
    id: "sales",
    code: "4000",
    name: "Sales",
    type: "Income",
    description: "Income earned from selling goods or services.",
  },
  {
    id: "supplies",
    code: "5000",
    name: "Supplies",
    type: "Expense",
    description: "Consumables used in ordinary business operations.",
  },
  {
    id: "rent",
    code: "5100",
    name: "Rent",
    type: "Expense",
    description: "Premises or equipment rental cost.",
  },
  {
    id: "fees",
    code: "5200",
    name: "Fees",
    type: "Expense",
    description: "Bank, platform, professional, and other service fees.",
  },
  {
    id: "expense",
    code: "5900",
    name: "General expense",
    type: "Expense",
    description:
      "Other ordinary business costs pending more specific classification.",
  },
];

let memoryBytes: Uint8Array | undefined;

function now(): string {
  return new Date().toISOString();
}
function newId(prefix: string): string {
  const cryptoObject = (globalThis as any).crypto;
  if (cryptoObject?.randomUUID) return `${prefix}-${cryptoObject.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function asRows(
  db: SQLDatabase,
  sql: string,
  params: any[] = [],
): Record<string, any>[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const [first] = result;
  return first.values.map((values: any[]) =>
    Object.fromEntries(
      first.columns.map((column: string, index: number) => [
        column,
        values[index],
      ]),
    ),
  );
}
function scalar(db: SQLDatabase, sql: string, params: any[] = []): any {
  return asRows(db, sql, params)[0]?.value;
}
function enableForeignKeys(db: SQLDatabase): void {
  db.run("PRAGMA foreign_keys = ON");
}
function exportDatabase(db: SQLDatabase): Uint8Array {
  enableForeignKeys(db);
  const bytes = new Uint8Array(db.export());
  // sql.js exports/reconstructs databases with foreign-key enforcement reset;
  // keep the live connection safe for the next mutation too.
  enableForeignKeys(db);
  return bytes;
}
function ensureInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(
      `${label} must be a non-negative integer minor-unit amount`,
    );
}
function validateLine(line: Line, accountIds: Set<string>): void {
  if (!accountIds.has(line.accountId))
    throw new Error(`Unknown account: ${line.accountId}`);
  ensureInteger(line.debit, "Debit");
  ensureInteger(line.credit, "Credit");
  if (line.debit > 0 && line.credit > 0)
    throw new Error("A line cannot contain both debit and credit");
}
function validateDateAndText(date: string, description: string): void {
  assertDate(date);
  if (!description.trim()) throw new Error("Description is required");
}

async function openStore(): Promise<IDBDatabase | undefined> {
  const indexedDBObject = (globalThis as any).indexedDB as
    | IDBFactory
    | undefined;
  if (!indexedDBObject) {
    if (isBrowserRuntime)
      throw new Error("IndexedDB is required for browser ledger persistence");
    return undefined;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDBObject.open(STORE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("data"))
        request.result.createObjectStore("data");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Unable to open ledger storage"));
  });
}
async function readBytes(): Promise<Uint8Array | undefined> {
  const db = await openStore();
  if (!db) return memoryBytes && new Uint8Array(memoryBytes);
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("data", "readonly")
      .objectStore("data")
      .get(KEY);
    request.onsuccess = () => {
      const result = request.result
        ? new Uint8Array(request.result)
        : undefined;
      db.close();
      resolve(result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("Unable to read ledger storage"));
    };
  });
}
async function writeBytes(bytes: Uint8Array): Promise<void> {
  const copy = new Uint8Array(bytes);
  const db = await openStore();
  if (!db) {
    memoryBytes = copy;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("data", "readwrite");
    transaction.objectStore("data").put(copy, KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Unable to persist ledger"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Ledger persistence was aborted"));
    };
  });
}

async function acquireLifetimeLock(): Promise<() => void> {
  const locks = (globalThis as any).navigator?.locks;
  if (!locks?.request) {
    if (isBrowserRuntime)
      throw new Error(
        "Web Locks are required for browser multi-tab ledger safety",
      );
    return () => undefined;
  }
  let releaseHold!: () => void;
  let resolveAcquired!: () => void;
  let rejectAcquired!: (reason: unknown) => void;
  const acquired = new Promise<void>((resolve, reject) => {
    resolveAcquired = resolve;
    rejectAcquired = reject;
  });
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  void locks
    .request(
      "ai-accounting-ledger-lifetime",
      { mode: "exclusive", ifAvailable: true },
      async (lock: any) => {
        if (!lock) {
          rejectAcquired(new Error("Another browser tab owns the ledger"));
          return;
        }
        resolveAcquired();
        await hold;
      },
    )
    .catch(rejectAcquired);
  await acquired;
  return releaseHold;
}

function createSchema(db: SQLDatabase): void {
  db.run("PRAGMA foreign_keys = ON");
  db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('Asset','Liability','Equity','Income','Expense')),
      description TEXT NOT NULL, parent_id TEXT REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','posted')),
      reference TEXT, reversal_of TEXT REFERENCES journals(id)
    );
    CREATE TABLE IF NOT EXISTS lines (
      journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE, line_index INTEGER NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id), debit INTEGER NOT NULL CHECK(debit >= 0), credit INTEGER NOT NULL CHECK(credit >= 0),
      PRIMARY KEY(journal_id, line_index), CHECK(NOT (debit > 0 AND credit > 0))
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, reference TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('transactions','reconciliation')), journal_id TEXT REFERENCES journals(id), matched_line TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), name TEXT NOT NULL, currency TEXT NOT NULL, country TEXT NOT NULL, framework TEXT NOT NULL, guidance INTEGER NOT NULL CHECK(guidance IN (0,1)));
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, action TEXT NOT NULL);`);
  db.run("INSERT OR IGNORE INTO meta(key,value) VALUES ('schema_version','1')");
}
function seed(db: SQLDatabase): void {
  for (const account of SEEDED_ACCOUNTS)
    db.run(
      "INSERT INTO accounts(id,code,name,type,description,parent_id) VALUES (?,?,?,?,?,?)",
      [
        account.id,
        account.code,
        account.name,
        account.type,
        account.description,
        account.parentId || null,
      ],
    );
  db.run(
    "INSERT OR IGNORE INTO settings(id,name,currency,country,framework,guidance) VALUES (1,?,?,?,?,?)",
    ["My ledger", "BDT", "Bangladesh", "General accrual bookkeeping", 1],
  );
}
function checkSchema(db: SQLDatabase): void {
  enableForeignKeys(db);
  const integrity = asRows(db, "PRAGMA integrity_check")[0]?.integrity_check;
  if (integrity !== "ok")
    throw new Error(`SQLite integrity check failed: ${integrity || "unknown error"}`);
  if (asRows(db, "PRAGMA foreign_key_check").length)
    throw new Error("SQLite foreign-key check failed");
  const tables = new Set(
    asRows(db, "SELECT name FROM sqlite_master WHERE type='table'").map(
      (row) => row.name,
    ),
  );
  for (const table of [
    "meta",
    "accounts",
    "journals",
    "lines",
    "sources",
    "settings",
    "audit",
  ])
    if (!tables.has(table)) throw new Error("Incompatible ledger database");
  if (scalar(db, "SELECT value FROM meta WHERE key='schema_version'") !== "1")
    throw new Error("Incompatible ledger schema version");

  const settingsRows = asRows(
    db,
    "SELECT name,currency,country,framework,guidance FROM settings WHERE id=1",
  );
  if (settingsRows.length !== 1) throw new Error("Ledger settings are missing");
  const settings = settingsRows[0];
  for (const [field, max] of [
    ["name", 120],
    ["country", 120],
    ["framework", 200],
  ] as const) {
    if (
      typeof settings[field] !== "string" ||
      !settings[field].trim() ||
      settings[field].length > max
    )
      throw new Error(`Invalid ledger setting: ${field}`);
  }
  if (
    !SUPPORTED_CURRENCIES.includes(settings.currency) ||
    ![0, 1].includes(Number(settings.guidance))
  )
    throw new Error("Invalid ledger settings");

  const accountRows = asRows(
    db,
    "SELECT id,code,name,type,description,parent_id FROM accounts",
  );
  const accountIds = new Set(accountRows.map((row) => row.id));
  for (const row of accountRows) {
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      typeof row.code !== "string" ||
      !row.code.trim() ||
      row.code.length > 50 ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 200 ||
      typeof row.description !== "string" ||
      row.description.length > 1000 ||
      !ACCOUNT_TYPES.includes(row.type)
    )
      throw new Error("Invalid ledger account");
    if (
      row.parent_id !== null &&
      (!accountIds.has(row.parent_id) ||
        row.parent_id === row.id ||
        accountRows.find((parent) => parent.id === row.parent_id)?.type !== row.type)
    )
      throw new Error("Invalid account parent");
  }
  for (const seeded of SEEDED_ACCOUNTS) {
    const account = accountRows.find((row) => row.id === seeded.id);
    if (!account || account.code !== seeded.code || account.type !== seeded.type)
      throw new Error(`Required account is missing: ${seeded.id}`);
  }
  for (const row of accountRows) {
    const visited = new Set<string>();
    let current = row.id;
    while (current) {
      if (visited.has(current))
        throw new Error("Account hierarchy contains a cycle");
      visited.add(current);
      current =
        accountRows.find((account) => account.id === current)?.parent_id || "";
    }
  }

  const journalRows = asRows(
    db,
    "SELECT id,date,description,status FROM journals",
  );
  for (const row of journalRows) {
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      !isValidDate(String(row.date)) ||
      typeof row.description !== "string" ||
      !row.description.trim() ||
      !["draft", "posted"].includes(row.status)
    )
      throw new Error("Invalid ledger journal");
  }
  for (const line of asRows(
    db,
    "SELECT journal_id,line_index,account_id,debit,credit FROM lines",
  )) {
    if (
      !accountIds.has(line.account_id) ||
      !journalRows.some((journal) => journal.id === line.journal_id) ||
      !Number.isSafeInteger(Number(line.line_index)) ||
      Number(line.line_index) < 0 ||
      !Number.isSafeInteger(Number(line.debit)) ||
      !Number.isSafeInteger(Number(line.credit)) ||
      Number(line.debit) < 0 ||
      Number(line.credit) < 0 ||
      (Number(line.debit) > 0 && Number(line.credit) > 0)
    )
      throw new Error("Invalid ledger line");
  }
  const badPosted = asRows(
    db,
    `SELECT j.id FROM journals j JOIN (SELECT journal_id, SUM(debit) d, SUM(credit) c FROM lines GROUP BY journal_id) x ON x.journal_id=j.id WHERE j.status='posted' AND (x.d IS NULL OR x.d=0 OR x.d<>x.c)`,
  );
  const postedWithoutLines = asRows(
    db,
    "SELECT j.id FROM journals j LEFT JOIN lines l ON l.journal_id=j.id WHERE j.status='posted' GROUP BY j.id HAVING COUNT(l.journal_id)=0",
  );
  if (badPosted.length || postedWithoutLines.length)
    throw new Error("Ledger contains an unbalanced posted journal");

  const seenMatchedLines = new Set<string>();
  for (const source of asRows(
    db,
    "SELECT id,date,description,amount,reference,mode,journal_id,matched_line FROM sources",
  )) {
    if (
      typeof source.id !== "string" ||
      !source.id.trim() ||
      !isValidDate(String(source.date)) ||
      typeof source.description !== "string" ||
      !source.description.trim() ||
      typeof source.reference !== "string" ||
      !Number.isSafeInteger(Number(source.amount)) ||
      !["transactions", "reconciliation"].includes(source.mode)
    )
      throw new Error("Invalid source row");
    const hasJournal = source.journal_id !== null;
    const hasMatchedLine = source.matched_line !== null;
    if (source.mode === "transactions" && hasMatchedLine)
      throw new Error("Transaction source has an invalid matched line");
    if (source.mode === "reconciliation" && hasJournal !== hasMatchedLine)
      throw new Error("Reconciliation source link is incomplete");
    if (!hasMatchedLine) continue;
    if (
      typeof source.matched_line !== "string" ||
      seenMatchedLines.has(source.matched_line)
    )
      throw new Error("Matched journal line is linked more than once");
    seenMatchedLines.add(source.matched_line);
    const separator = source.matched_line.lastIndexOf(":");
    const matchedJournalId =
      separator > 0 ? source.matched_line.slice(0, separator) : "";
    const lineIndexText =
      separator > 0 ? source.matched_line.slice(separator + 1) : "";
    const lineIndex = Number(lineIndexText);
    if (
      matchedJournalId !== source.journal_id ||
      !lineIndexText ||
      !Number.isSafeInteger(lineIndex) ||
      lineIndex < 0 ||
      String(lineIndex) !== lineIndexText
    )
      throw new Error("Invalid matched journal line");
    const line = asRows(
      db,
      "SELECT account_id,debit,credit FROM lines WHERE journal_id=? AND line_index=?",
      [matchedJournalId, lineIndex],
    )[0];
    const matchedJournal = journalRows.find((journal) => journal.id === matchedJournalId);
    if (
      !matchedJournal ||
      matchedJournal.status !== "posted" ||
      !line ||
      !["bank", "cash"].includes(line.account_id) ||
      Number(source.amount) !== Number(line.debit) - Number(line.credit) ||
      Math.abs(Date.parse(matchedJournal.date) - Date.parse(source.date)) >
        3 * 86400000
    )
      throw new Error("Invalid reconciliation match");
  }
}

export class Ledger {
  private db: SQLDatabase;
  private SQL: SQLModule;
  private releaseLock: () => void;
  private mutationQueue: Promise<void> = Promise.resolve();
  private closed = false;

  private constructor(
    SQL: SQLModule,
    db: SQLDatabase,
    releaseLock: () => void,
  ) {
    this.SQL = SQL;
    this.db = db;
    this.releaseLock = releaseLock;
  }

  static async open(): Promise<Ledger> {
    const releaseLock = await acquireLifetimeLock();
    try {
      const SQL = await (initSqlJs as any)({
        locateFile: (file: string) => {
          const browser =
            typeof window !== "undefined" || typeof document !== "undefined";
          if (browser) return "/sql-wasm.wasm";
          const cwd = (globalThis as any).process?.cwd?.() || ".";
          return `${cwd}/node_modules/sql.js/dist/${file}`;
        },
      });
      const stored = await readBytes();
      const db = stored ? new SQL.Database(stored) : new SQL.Database();
      if (!stored) {
        createSchema(db);
        seed(db);
        await writeBytes(exportDatabase(db));
      }
      enableForeignKeys(db);
      checkSchema(db);
      return new Ledger(SQL, db, releaseLock);
    } catch (error) {
      releaseLock();
      throw error;
    }
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error("Ledger is released");
  }
  private accountIds(): Set<string> {
    return new Set(
      asRows(this.db, "SELECT id FROM accounts").map((row) => row.id),
    );
  }
  private backupBytes(): Uint8Array {
    this.ensureOpen();
    return exportDatabase(this.db);
  }
  private async persistMutation(mutator: () => void): Promise<void> {
    const operation = this.mutationQueue.then(async () => {
      this.ensureOpen();
      const before = this.backupBytes();
      try {
        this.db.run("BEGIN");
        mutator();
        this.db.run("COMMIT");
        await writeBytes(this.backupBytes());
      } catch (error) {
        try {
          this.db.run("ROLLBACK");
        } catch {
          /* transaction may already have been rolled back */
        }
        this.db.close();
        this.db = new this.SQL.Database(before);
        enableForeignKeys(this.db);
        throw error;
      }
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }
  private journal(id: string): Journal | undefined {
    return this.snapshot().journals.find((journal) => journal.id === id);
  }

  private prepareDraft(input: SaveDraftInput): string {
    validateDateAndText(input.date, input.description);
    const id = input.id || newId("journal");
    const ids = this.accountIds();
    if (!input.lines.length) throw new Error("A journal needs at least one line");
    input.lines.forEach((line) => validateLine(line, ids));
    return id;
  }

  private saveDraftInTransaction(input: SaveDraftInput, id: string): void {
    const existing = this.journal(id);
    if (existing?.status === "posted")
      throw new Error("Posted journals are immutable");
    if (existing) {
      this.db.run(
        "UPDATE journals SET date=?,description=?,reference=? WHERE id=?",
        [input.date, input.description.trim(), input.reference || null, id],
      );
      this.db.run("DELETE FROM lines WHERE journal_id=?", [id]);
    } else
      this.db.run(
        "INSERT INTO journals(id,date,description,status,reference) VALUES (?,?,?,?,?)",
        [
          id,
          input.date,
          input.description.trim(),
          "draft",
          input.reference || null,
        ],
      );
    input.lines.forEach((line, index) =>
      this.db.run(
        "INSERT INTO lines(journal_id,line_index,account_id,debit,credit) VALUES (?,?,?,?,?)",
        [id, index, line.accountId, line.debit, line.credit],
      ),
    );
    this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
      now(),
      `${existing ? "Updated" : "Saved"} draft ${id}`,
    ]);
  }

  snapshot(): Snapshot {
    this.ensureOpen();
    const accounts = asRows(
      this.db,
      "SELECT id,code,name,type,description,parent_id FROM accounts ORDER BY code",
    ).map(
      (row) =>
        ({
          id: row.id,
          code: row.code,
          name: row.name,
          type: row.type,
          description: row.description,
          ...(row.parent_id ? { parentId: row.parent_id } : {}),
        }) as Account,
    );
    const journals = asRows(
      this.db,
      "SELECT id,date,description,status,reference,reversal_of FROM journals ORDER BY date,id",
    ).map(
      (row) =>
        ({
          id: row.id,
          date: row.date,
          description: row.description,
          status: row.status,
          ...(row.reference ? { reference: row.reference } : {}),
          ...(row.reversal_of ? { reversalOf: row.reversal_of } : {}),
          lines: asRows(
            this.db,
            "SELECT account_id,debit,credit FROM lines WHERE journal_id=? ORDER BY line_index",
            [row.id],
          ).map((line) => ({
            accountId: line.account_id,
            debit: Number(line.debit),
            credit: Number(line.credit),
          })),
        }) as Journal,
    );
    const sources = asRows(
      this.db,
      "SELECT id,date,description,amount,reference,mode,journal_id,matched_line FROM sources ORDER BY date,id",
    ).map(
      (row) =>
        ({
          id: row.id,
          date: row.date,
          description: row.description,
          amount: Number(row.amount),
          reference: row.reference,
          mode: row.mode,
          ...(row.journal_id ? { journalId: row.journal_id } : {}),
          ...(row.matched_line ? { matchedLine: row.matched_line } : {}),
        }) as SourceRow,
    );
    const settingsRow = asRows(
      this.db,
      "SELECT name,currency,country,framework,guidance FROM settings WHERE id=1",
    )[0];
    const settings: Settings = {
      name: settingsRow.name,
      currency: settingsRow.currency,
      country: settingsRow.country,
      framework: settingsRow.framework,
      guidance: Boolean(settingsRow.guidance),
    };
    return {
      accounts,
      journals,
      sources,
      settings,
      audit: asRows(this.db, "SELECT date,action FROM audit ORDER BY id").map(
        (row) => ({ date: row.date, action: row.action }),
      ),
    };
  }

  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const allowed: (keyof Settings)[] = [
      "name",
      "currency",
      "country",
      "framework",
      "guidance",
    ];
    for (const key of Object.keys(partial))
      if (!allowed.includes(key as keyof Settings))
        throw new Error(`Unknown setting: ${key}`);
    await this.persistMutation(() => {
      const current = this.snapshot().settings;
      const next = { ...current, ...partial };
      for (const [field, max] of [
        ["name", 120],
        ["country", 120],
        ["framework", 200],
      ] as const) {
        const value = next[field];
        if (typeof value !== "string" || !value.trim() || value.length > max)
          throw new Error(`${field[0].toUpperCase()}${field.slice(1)} is required and must be reasonably sized`);
      }
      if (!SUPPORTED_CURRENCIES.includes(next.currency as (typeof SUPPORTED_CURRENCIES)[number]))
        throw new Error("Currency must be one of BDT, USD, GBP, EUR, CAD, INR, or AUD");
      if (typeof next.guidance !== "boolean") throw new Error("Guidance must be boolean");
      const hasRecords = Boolean(
        scalar(this.db, "SELECT COUNT(*) AS value FROM journals") ||
          scalar(this.db, "SELECT COUNT(*) AS value FROM sources"),
      );
      if (hasRecords && next.currency !== current.currency)
        throw new Error("Currency cannot be changed after journals or sources exist");
      this.db.run(
        "UPDATE settings SET name=?,currency=?,country=?,framework=?,guidance=? WHERE id=1",
        [
          next.name.trim(),
          next.currency,
          next.country.trim(),
          next.framework.trim(),
          next.guidance ? 1 : 0,
        ],
      );
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        "Updated settings",
      ]);
    });
  }

  async saveDraft(input: SaveDraftInput): Promise<string> {
    const id = this.prepareDraft(input);
    await this.persistMutation(() => this.saveDraftInTransaction(input, id));
    return id;
  }

  async saveDraftFromSource(
    sourceId: string,
    input: SaveDraftInput,
  ): Promise<string> {
    const id = this.prepareDraft(input);
    await this.persistMutation(() => {
      const source = this.snapshot().sources.find(
        (item) => item.id === sourceId,
      );
      if (!source) throw new Error("Source row not found");
      if (source.mode !== "transactions")
        throw new Error("Only transaction sources can be linked to journals");
      if (source.journalId || source.matchedLine)
        throw new Error("Source row is already linked");
      if (
        asRows(this.db, "SELECT id FROM sources WHERE journal_id=?", [id])
          .length
      )
        throw new Error("Journal is already linked to a source row");

      this.saveDraftInTransaction(input, id);
      this.db.run("UPDATE sources SET journal_id=? WHERE id=?", [
        id,
        sourceId,
      ]);
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Linked source ${sourceId} to journal ${id}`,
      ]);
    });
    return id;
  }

  async post(id: string): Promise<void> {
    await this.persistMutation(() => {
      const journal = this.journal(id);
      if (!journal) throw new Error("Journal not found");
      if (journal.status === "posted")
        throw new Error("Journal is already posted");
      if (!linesBalanced(journal.lines))
        throw new Error(
          "Journal must be balanced with nonzero equal debit and credit totals",
        );
      this.db.run("UPDATE journals SET status='posted' WHERE id=?", [id]);
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Posted journal ${id}`,
      ]);
    });
  }

  async reverse(id: string, reason: string): Promise<string> {
    if (!reason.trim()) throw new Error("A reversal reason is required");
    const reversalId = newId("reversal");
    await this.persistMutation(() => {
      const original = this.journal(id);
      if (!original) throw new Error("Journal not found");
      if (original.status !== "posted")
        throw new Error("Only posted journals can be reversed");
      if (
        asRows(this.db, "SELECT id FROM journals WHERE reversal_of=?", [id])
          .length
      )
        throw new Error("Journal has already been reversed");
      this.db.run(
        "INSERT INTO journals(id,date,description,status,reference,reversal_of) VALUES (?,?,?,?,?,?)",
        [
          reversalId,
          original.date,
          `Reversal of ${id}: ${reason.trim()}`,
          "posted",
          original.reference || null,
          id,
        ],
      );
      original.lines.forEach((line, index) =>
        this.db.run(
          "INSERT INTO lines(journal_id,line_index,account_id,debit,credit) VALUES (?,?,?,?,?)",
          [reversalId, index, line.accountId, line.credit, line.debit],
        ),
      );
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Posted reversing journal ${reversalId} linked to ${id}: ${reason.trim()}`,
      ]);
    });
    return reversalId;
  }

  async importRows(rows: Omit<SourceRow, "id">[]): Promise<number> {
    rows.forEach((row) => {
      assertDate(row.date);
      if (!row.description.trim())
        throw new Error("Source description is required");
      if (!Number.isSafeInteger(row.amount))
        throw new Error("Source amount must be an integer");
      if (!["transactions", "reconciliation"].includes(row.mode))
        throw new Error("Invalid source mode");
    });
    await this.persistMutation(() => {
      rows.forEach((row) =>
        this.db.run(
          "INSERT INTO sources(id,date,description,amount,reference,mode) VALUES (?,?,?,?,?,?)",
          [
            newId("source"),
            row.date,
            row.description.trim(),
            row.amount,
            row.reference || "",
            row.mode,
          ],
        ),
      );
      if (rows.length)
        this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
          now(),
          `Imported ${rows.length} source row${rows.length === 1 ? "" : "s"}`,
        ]);
    });
    return rows.length;
  }

  async linkSource(sourceId: string, journalId: string): Promise<void> {
    await this.persistMutation(() => {
      const source = this.snapshot().sources.find(
        (item) => item.id === sourceId,
      );
      const journal = this.journal(journalId);
      if (!source) throw new Error("Source row not found");
      if (!journal) throw new Error("Journal not found");
      if (source.mode !== "transactions")
        throw new Error("Only transaction sources can be linked to journals");
      if (source.journalId || source.matchedLine)
        throw new Error("Source row is already linked");
      if (
        asRows(this.db, "SELECT id FROM sources WHERE journal_id=?", [journalId])
          .length
      )
        throw new Error("Journal is already linked to a source row");
      this.db.run("UPDATE sources SET journal_id=? WHERE id=?", [
        journalId,
        sourceId,
      ]);
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Linked source ${sourceId} to journal ${journalId}`,
      ]);
    });
  }

  async match(
    sourceId: string,
    journalId: string,
    lineIndex: number,
  ): Promise<void> {
    await this.persistMutation(() => {
      const source = this.snapshot().sources.find(
        (item) => item.id === sourceId,
      );
      const journal = this.journal(journalId);
      if (!source) throw new Error("Source row not found");
      if (source.mode !== "reconciliation")
        throw new Error("Only reconciliation sources can be matched");
      if (!journal || journal.status !== "posted")
        throw new Error("Only a posted journal can be matched");
      if (source.journalId || source.matchedLine)
        throw new Error("Source row is already matched");
      const line = journal.lines[lineIndex];
      if (!line) throw new Error("Journal line not found");
      if (
        !["bank", "cash"].includes(line.accountId) ||
        source.amount !== line.debit - line.credit
      )
        throw new Error("Source amount does not match journal line");
      if (
        Math.abs(Date.parse(journal.date) - Date.parse(source.date)) >
        3 * 86400000
      )
        throw new Error("Source and journal dates must be within 3 days");
      const matched = `${journalId}:${lineIndex}`;
      if (
        asRows(this.db, "SELECT id FROM sources WHERE matched_line=?", [
          matched,
        ]).length
      )
        throw new Error("Journal line is already matched");
      this.db.run("UPDATE sources SET journal_id=?,matched_line=? WHERE id=?", [
        journalId,
        matched,
        sourceId,
      ]);
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Matched source ${sourceId} to ${matched}`,
      ]);
    });
  }

  async unmatch(sourceId: string): Promise<void> {
    await this.persistMutation(() => {
      const source = this.snapshot().sources.find(
        (item) => item.id === sourceId,
      );
      if (!source) throw new Error("Source row not found");
      if (!source.journalId && !source.matchedLine)
        throw new Error("Source row is not matched");
      this.db.run(
        "UPDATE sources SET journal_id=NULL,matched_line=NULL WHERE id=?",
        [sourceId],
      );
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Unmatched source ${sourceId}`,
      ]);
    });
  }

  async backup(): Promise<Uint8Array> {
    return this.backupBytes();
  }

  async restore(bytes: Uint8Array): Promise<void> {
    if (!(bytes instanceof Uint8Array) || bytes.length < 16)
      throw new Error("Invalid SQLite backup");
    const operation = this.mutationQueue.then(async () => {
      this.ensureOpen();
      let candidate: SQLDatabase | undefined;
      try {
        candidate = new this.SQL.Database(new Uint8Array(bytes));
        checkSchema(candidate);
      } catch (error) {
        candidate?.close();
        throw new Error(
          `Invalid or incompatible ledger backup: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const before = this.backupBytes();
      try {
        await writeBytes(exportDatabase(candidate));
        this.db.close();
        this.db = candidate;
        candidate = undefined;
      } catch (error) {
        try {
          await writeBytes(before);
        } catch {
          /* preserve the original failure */
        }
        candidate?.close();
        throw error;
      }
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async addAccount(input: {
    code: string;
    name: string;
    type: AccountType;
    description: string;
    parentId?: string;
  }): Promise<string> {
    if (!ACCOUNT_TYPES.includes(input.type))
      throw new Error("Invalid account type");
    if (
      typeof input.code !== "string" ||
      typeof input.name !== "string" ||
      typeof input.description !== "string"
    )
      throw new Error("Account code, name, and description are required");
    const code = input.code.trim();
    const name = input.name.trim();
    const description = input.description;
    if (!code || !name)
      throw new Error("Account code and name are required");
    if (code.length > 50 || name.length > 200 || description.length > 1000)
      throw new Error("Account code, name, or description is too long");
    const id = newId("account");
    await this.persistMutation(() => {
      if (input.parentId) {
        const parent = asRows(
          this.db,
          "SELECT type FROM accounts WHERE id=?",
          [input.parentId],
        )[0];
        if (!parent) throw new Error("Parent account not found");
        if (parent.type !== input.type)
          throw new Error("Parent account must have the same type");
      }
      this.db.run(
        "INSERT INTO accounts(id,code,name,type,description,parent_id) VALUES (?,?,?,?,?,?)",
        [
          id,
          code,
          name,
          input.type,
          description,
          input.parentId || null,
        ],
      );
      this.db.run("INSERT INTO audit(date,action) VALUES (?,?)", [
        now(),
        `Added account ${id}`,
      ]);
    });
    return id;
  }

  async release(): Promise<void> {
    if (this.closed) return;
    await this.mutationQueue;
    if (this.closed) return;
    this.closed = true;
    this.db.close();
    this.releaseLock();
  }
}

export default Ledger;
