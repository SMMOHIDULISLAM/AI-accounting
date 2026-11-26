import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { Ledger } from "../src/lib/db";
import { formatMoney, linesBalanced, report } from "../src/lib/accounting";
import { exportCSV } from "../src/lib/csv";
import { minorUnitsText } from "../src/lib/money";
import initSqlJs from "sql.js";

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

describe("accounting reliability", () => {
  it("does not call rounded, unequal journal totals balanced", async () => {
    const max = Number.MAX_SAFE_INTEGER;
    const lines = [
      { accountId: "bank", debit: max, credit: 0 },
      { accountId: "bank", debit: 1, credit: 0 },
      { accountId: "bank", debit: 1, credit: 0 },
      { accountId: "sales", debit: 0, credit: max },
      { accountId: "sales", debit: 0, credit: 1 },
    ];
    expect(linesBalanced(lines)).toBe(false);
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2026-11-27",
      description: "Oversized split",
      lines,
    });
    await expect(ledger.post(id)).rejects.toThrow(/balanced|safe|large/i);
    expect(ledger.snapshot().journals[0].status).toBe("draft");
  });

  it("rejects overflowing report aggregates instead of silently rounding", async () => {
    ledger = await Ledger.open();
    for (const amount of [Number.MAX_SAFE_INTEGER, 1]) {
      const id = await ledger.saveDraft({
        date: "2026-11-27",
        description: "Sale",
        lines: [
          { accountId: "bank", debit: amount, credit: 0 },
          { accountId: "sales", debit: 0, credit: amount },
        ],
      });
      await ledger.post(id);
    }
    expect(() =>
      report(ledger!.snapshot(), "2026-11-01", "2026-11-27"),
    ).toThrow(/safe|large/i);
  });

  it("keeps the final cent in large displayed amounts", () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER, "USD")).toMatch(/409\.91/);
    expect(formatMoney(-1, "USD")).toContain("0.01");
    expect(formatMoney(-1, "USD")).toContain("-");
  });

  it("includes every earlier queued save in the requested backup", async () => {
    ledger = await Ledger.open();
    const saving = ledger.saveDraft({
      date: "2026-11-27",
      description: "Pending save",
      lines: [{ accountId: "bank", debit: 100, credit: 0 }],
    });
    const exporting = ledger.backup();
    await saving;
    const bytes = await exporting;
    await ledger.restore(bytes);
    expect(ledger.snapshot().journals.map((j) => j.description)).toEqual([
      "Pending save",
    ]);
  });

  it("excludes writes queued after the snapshot request", async () => {
    ledger = await Ledger.open();
    const exporting = ledger.backup();
    const saving = ledger.saveDraft({
      date: "2026-11-27",
      description: "Later",
      lines: [{ accountId: "bank", debit: 1, credit: 0 }],
    });
    const bytes = await exporting;
    await saving;
    expect(ledger.snapshot().journals).toHaveLength(1);
    await ledger.restore(bytes);
    expect(ledger.snapshot().journals).toHaveLength(0);
  });

  it("rejects a backup with unsafe posted totals and preserves the live ledger", async () => {
    ledger = await Ledger.open();
    const SQL = await initSqlJs();
    const db = new SQL.Database(await ledger.backup());
    db.run(
      "INSERT INTO journals(id,date,description,status) VALUES ('oversize','2026-11-27','Oversize','posted')",
    );
    const max = Number.MAX_SAFE_INTEGER;
    for (const [index, account, debit, credit] of [
      [0, "bank", max, 0],
      [1, "bank", 1, 0],
      [2, "sales", 0, max],
      [3, "sales", 0, 1],
    ])
      db.run(
        "INSERT INTO lines(journal_id,line_index,account_id,debit,credit) VALUES ('oversize',?,?,?,?)",
        [index, account, debit, credit],
      );
    const bytes = db.export();
    db.close();
    const before = ledger.snapshot();
    await expect(ledger.restore(bytes)).rejects.toThrow(/oversized|unbalanced/);
    expect(ledger.snapshot()).toEqual(before);
  });

  it("exports exact decimals while escaping formulas including leading whitespace", () => {
    const csv = exportCSV(
      ["Amount", "Description"],
      [
        [minorUnitsText(-Number.MAX_SAFE_INTEGER), " =1+1"],
        [minorUnitsText(1), '\t=HYPERLINK("https://example.invalid")'],
      ],
    );
    expect(csv).toContain("-90071992547409.91,' =1+1");
    expect(csv).toContain("'\t=HYPERLINK");
    expect(csv).toContain("0.01");
  });

  it("rejects unexpected backup triggers before they can change future ledger writes", async () => {
    ledger = await Ledger.open();
    const SQL = await initSqlJs();
    const db = new SQL.Database(await ledger.backup());
    db.run(
      "CREATE TRIGGER tamper AFTER INSERT ON audit BEGIN DELETE FROM lines; END",
    );
    const bytes = db.export();
    db.close();
    const before = ledger.snapshot();
    await expect(ledger.restore(bytes)).rejects.toThrow(/schema structure/);
    expect(ledger.snapshot()).toEqual(before);
  });
});
