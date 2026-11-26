import "fake-indexeddb/auto";
import initSqlJs from "sql.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectExternalBook,
  mapExternalEntries,
  type ExternalBook,
} from "../src/lib/external-books";
import {
  allocateMinorUnits,
  sourceAging,
  stockCost,
} from "../src/lib/accounting-skills";
import { Ledger } from "../src/lib/db";
import { report } from "../src/lib/accounting";

const wasmPath = `${process.cwd()}/node_modules/sql.js/dist/sql-wasm.wasm`;
async function database(sql: string) {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  try {
    db.run(sql);
    return db.export();
  } finally {
    db.close();
  }
}
const reborn = `CREATE TABLE accounts(id INTEGER,code TEXT,name TEXT,kind TEXT);
 INSERT INTO accounts VALUES(1,'1000','Bank','asset'),(2,'1100','Receivables','asset'),(3,'4000','Sales','income');
 CREATE TABLE entries(id INTEGER,date TEXT,memo TEXT); INSERT INTO entries VALUES(1,'2026-01-01','Service invoice'),(2,'2026-02-01','Partial receipt');
 CREATE TABLE journal_lines(entry_id INTEGER,account_id INTEGER,debit_cents INTEGER,credit_cents INTEGER);
 INSERT INTO journal_lines VALUES(1,2,10000,0),(1,3,0,10000),(2,1,4000,0),(2,2,0,4000);
 CREATE TABLE contacts(id INTEGER,name TEXT); INSERT INTO contacts VALUES(1,'Synthetic customer');
 CREATE TABLE documents(id INTEGER,type TEXT,date TEXT,due_date TEXT,contact_id INTEGER,total_cents INTEGER);
 INSERT INTO documents VALUES(1,'invoice','2026-01-01','2026-01-15',1,10000);
 CREATE TABLE payments(document_id INTEGER,date TEXT,amount_cents INTEGER); INSERT INTO payments VALUES(1,'2026-02-01',4000);`;

let ledger: Ledger | undefined;
afterEach(async () => {
  await ledger?.release();
  ledger = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ai-accounting-ledger");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
describe("local foreign SQLite inspection", () => {
  it("reads Ledger Reborn journals and dated receivables without modifying input", async () => {
    const bytes = await database(reborn),
      before = new Uint8Array(bytes);
    const book = await inspectExternalBook(bytes, { wasmPath });
    expect(bytes).toEqual(before);
    expect(book).toMatchObject({
      format: "ledger-reborn",
      currency: "USD",
      errors: [],
    });
    expect(book.entries).toHaveLength(2);
    expect(sourceAging(book, "invoice", "2026-01-31")).toMatchObject({
      total: 10000,
      buckets: { "1–30": 10000 },
    });
    expect(sourceAging(book, "invoice", "2026-02-28")).toMatchObject({
      total: 6000,
      buckets: { "31–60": 6000 },
    });
  });
  it("imports mapped journals as drafts, then posts to the expected totals", async () => {
    const book = await inspectExternalBook(await database(reborn), {
      wasmPath,
    });
    ledger = await Ledger.open();
    await ledger.updateSettings({ currency: "USD" });
    const drafts = mapExternalEntries(
      book,
      { "1": "bank", "2": "ar", "3": "sales" },
      ledger.snapshot().accounts,
    );
    expect(
      await ledger.importExternalDrafts(
        book.format,
        "old-company",
        "USD",
        drafts,
      ),
    ).toEqual({ imported: 2, skipped: 0 });
    expect(report(ledger.snapshot(), "2026-01-01", "2026-02-28").income).toBe(
      0,
    );
    for (const draft of ledger.snapshot().journals) await ledger.post(draft.id);
    expect(report(ledger.snapshot(), "2026-01-01", "2026-02-28")).toMatchObject(
      { income: 10000, cashBalance: 4000, assets: 10000, balanced: true },
    );
    expect(
      await ledger.importExternalDrafts(
        book.format,
        "old-company",
        "USD",
        drafts,
      ),
    ).toEqual({ imported: 0, skipped: 2 });
    expect(ledger.snapshot().journals).toHaveLength(2);
  });
  it("requires explicit semantic mappings and rejects account type conflicts", async () => {
    const book = await inspectExternalBook(await database(reborn), {
      wasmPath,
    });
    ledger = await Ledger.open();
    expect(() =>
      mapExternalEntries(book, {}, ledger!.snapshot().accounts),
    ).toThrow(/Map source account/);
    expect(() =>
      mapExternalEntries(
        book,
        { "1": "bank", "2": "sales", "3": "sales" },
        ledger!.snapshot().accounts,
      ),
    ).toThrow(/type mismatch/);
    expect(() =>
      mapExternalEntries(
        book,
        { "1": "bank", "2": "ar", "3": "sales" },
        ledger!.snapshot().accounts,
      ),
    ).not.toThrow();
  });
  it("rolls back the whole import when a later source ID conflicts", async () => {
    const book = await inspectExternalBook(await database(reborn), {
      wasmPath,
    });
    ledger = await Ledger.open();
    await ledger.updateSettings({ currency: "USD" });
    const drafts = mapExternalEntries(
      book,
      { "1": "bank", "2": "ar", "3": "sales" },
      ledger.snapshot().accounts,
    );
    await ledger.importExternalDrafts(book.format, "old-company", "USD", [
      drafts[1],
    ]);
    const before = ledger.snapshot();
    await expect(
      ledger.importExternalDrafts(book.format, "old-company", "USD", [
        drafts[0],
        { ...drafts[1], description: "Changed source" },
      ]),
    ).rejects.toThrow(/changed|conflicts/);
    expect(ledger.snapshot()).toEqual(before);
  });
  it("rejects currency mismatch, duplicate IDs, unsafe totals and unknown formats", async () => {
    const book = await inspectExternalBook(await database(reborn), {
      wasmPath,
    });
    ledger = await Ledger.open();
    const drafts = mapExternalEntries(
      book,
      { "1": "bank", "2": "ar", "3": "sales" },
      ledger.snapshot().accounts,
    );
    await expect(
      ledger.importExternalDrafts(book.format, "old-company", "USD", drafts),
    ).rejects.toThrow(/currencies/);
    await expect(
      ledger.importExternalDrafts(book.format, "old-company", "BDT", [
        drafts[0],
        drafts[0],
      ]),
    ).rejects.toThrow(/duplicate/);
    await expect(
      ledger.importExternalDrafts("openqbw", "old-company", "BDT", drafts),
    ).rejects.toThrow(/format/);
    expect(ledger.snapshot().journals).toHaveLength(0);
  });
  it("requires an explicit signed-journal convention for the independently implemented SQLite adapter", async () => {
    const bytes = await database(
      `CREATE TABLE Accounts(id INTEGER,name TEXT,type TEXT);INSERT INTO Accounts VALUES(1,'Cash','Asset'),(2,'Revenue','Income');CREATE TABLE Journals(journal_no INTEGER,tran_date TEXT,description TEXT,line_account_id INTEGER,line_amount NUMERIC);INSERT INTO Journals VALUES(7,'2026-01-01','Sale',1,100.25),(7,'2026-01-01','Sale',2,-100.25);`,
    );
    await expect(inspectExternalBook(bytes, { wasmPath })).rejects.toThrow(
      /positive/,
    );
    const book = await inspectExternalBook(bytes, {
      wasmPath,
      sqlitePositive: "debit",
    });
    expect(book).toMatchObject({ format: "accounting-sqlite", errors: [] });
    expect(book.entries[0].lines).toEqual([
      { accountId: "1", debit: 10025, credit: 0 },
      { accountId: "2", debit: 0, credit: 10025 },
    ]);
    expect(book.warnings.join(" ")).toMatch(/not a complete migration/);
  });
  it("keeps raw OpenQBW values, unknowns and diagnostics inspection-only", async () => {
    const bytes = await database(
      `PRAGMA user_version=1;CREATE TABLE meta(key TEXT,value TEXT);INSERT INTO meta VALUES('format_version','1'),('count.line_items.undecoded_values','1');CREATE TABLE transactions(id TEXT);CREATE TABLE scan_rejections(kind TEXT);INSERT INTO scan_rejections VALUES('bad-record');CREATE TABLE transaction_line_items(id INTEGER,qb_id_parent TEXT,value TEXT,value_undecoded TEXT,txn_date_raw INTEGER,date_source TEXT,flags TEXT,source_table TEXT,page_number INTEGER);INSERT INTO transaction_line_items VALUES(1,'qb1','12.345678',NULL,173,'raw','unverified','unknown',3),(2,'qb1',NULL,'sector_boundary',NULL,'unknown','unverified',NULL,4);`,
    );
    const book = await inspectExternalBook(bytes, { wasmPath });
    expect(book.format).toBe("openqbw");
    expect(book.rawLines[0].value).toBe("12.345678");
    expect(book.rawLines[1].value).toBeNull();
    expect(book.diagnostics.rejected_records).toBe("1");
    expect(book.entries).toEqual([]);
    expect(() => mapExternalEntries(book, {}, [])).toThrow(/inspection-only/);
  });
  it("rejects foreign unknown schemas, corrupt bytes and REAL amounts in Ledger Reborn", async () => {
    await expect(
      inspectExternalBook(new Uint8Array([1, 2, 3]), { wasmPath }),
    ).rejects.toThrow(/genuine SQLite/);
    await expect(
      inspectExternalBook(
        await database("CREATE TABLE unrelated(id INTEGER)"),
        { wasmPath },
      ),
    ).rejects.toThrow(/Unsupported SQLite schema/);
    await expect(
      inspectExternalBook(
        await database(
          reborn +
            "UPDATE journal_lines SET debit_cents=1.5 WHERE entry_id=1 AND account_id=2",
        ),
        { wasmPath },
      ),
    ).rejects.toThrow(/integer cents/);
  });
  it("marks unbalanced source journals as errors that block mapping", async () => {
    const book = await inspectExternalBook(
      await database(
        reborn +
          "UPDATE journal_lines SET debit_cents=9999 WHERE entry_id=1 AND account_id=2",
      ),
      { wasmPath },
    );
    expect(book.errors.length).toBeGreaterThan(0);
    expect(() => mapExternalEntries(book, {}, [])).toThrow(
      /Correct source journal/,
    );
  });
});
describe("adapted accounting policies", () => {
  it("allocates every cent, preserving zero weights and deterministic ties", () => {
    expect(allocateMinorUnits(10001, [1, 1, 1])).toEqual([3334, 3334, 3333]);
    expect(allocateMinorUnits(1, [0, 1, 1])).toEqual([0, 1, 0]);
    expect(
      allocateMinorUnits(Number.MAX_SAFE_INTEGER, [1, 2, 3]).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => allocateMinorUnits(100, [0, 0])).toThrow();
    expect(() => allocateMinorUnits(100, [-1, 2])).toThrow();
  });
  it("conserves the last stock cent and refuses overselling", () => {
    expect(stockCost("3", 100, "1")).toMatchObject({
      cost: 33,
      remainingValue: 67,
    });
    expect(stockCost("2", 67, "1")).toMatchObject({
      cost: 34,
      remainingValue: 33,
    });
    expect(stockCost("1", 33, "1")).toMatchObject({
      cost: 33,
      remainingValue: 0,
    });
    expect(stockCost("0.000003", 1, "0.000003")).toMatchObject({
      cost: 1,
      remainingValue: 0,
    });
    expect(() => stockCost("1", 100, "2")).toThrow(/exceed/);
    expect(() => stockCost("1.0000001", 100, "1")).toThrow(/six/);
  });
});
