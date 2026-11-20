import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  exportCSV,
  mapCSV,
  parseCSV,
  probableDuplicates,
} from "../src/lib/csv";
import { Ledger } from "../src/lib/db";
import { isValidDate, parseMoney, report } from "../src/lib/accounting";

let ledger: Ledger | undefined;

afterEach(async () => {
  await ledger?.release();
  ledger = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ai-accounting-ledger");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

describe("money and CSV", () => {
  it("parses exact minor units without floating point drift", () => {
    expect(parseMoney("1,234.56")).toBe(123456);
    expect(parseMoney("(10.5)")).toBe(-1050);
    expect(() => parseMoney("1.234")).toThrow();
  });

  it("normalizes dates, sign convention, and preserves row-level errors", () => {
    const parsed = parseCSV(
      'Date,Description,Amount\n31/12/2025,"Invoice, paid",12.50\n12/11/2025,Bad,4',
    );
    const mapped = mapCSV(
      parsed.rows,
      { date: "Date", description: "Description", amount: "Amount" },
      "inflow-positive",
      "transactions",
    );
    expect(mapped.valid).toHaveLength(1);
    expect(mapped.valid[0]).toMatchObject({
      date: "2025-12-31",
      amount: 1250,
      description: "Invoice, paid",
    });
    expect(mapped.errors[0].row).toBe(3);
  });

  it("flags duplicates but does not silently remove them", () => {
    const rows = [
      {
        date: "2025-01-01",
        description: "Sale",
        amount: 1000,
        reference: "A",
        mode: "transactions" as const,
      },
    ];
    expect(probableDuplicates(rows, [{ id: "old", ...rows[0] }])).toEqual([
      true,
    ]);
    expect(exportCSV(["Description", "Amount"], [["=SUM(A1)", -100]])).toBe(
      "Description,Amount\r\n'=SUM(A1),-100\r\n",
    );
  });

  it("accepts a real year 0001 without Date.UTC's 1900 offset", () => {
    expect(isValidDate("0001-01-01")).toBe(true);
    expect(isValidDate("0000-01-01")).toBe(false);
  });
});

describe("ledger controls and reports", () => {
  it("seeds stable accounts, enforces balanced posting, and keeps posted journals immutable", async () => {
    ledger = await Ledger.open();
    const initial = ledger.snapshot();
    expect(initial.journals).toHaveLength(0);
    expect(
      initial.accounts.find((account) => account.id === "bank")?.name,
    ).toBe("Bank");
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Sale",
      lines: [
        { accountId: "bank", debit: 10000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 10000 },
      ],
    });
    await ledger.post(id);
    await expect(
      ledger.saveDraft({
        id,
        date: "2025-01-03",
        description: "Changed",
        lines: [
          { accountId: "bank", debit: 10000, credit: 0 },
          { accountId: "sales", debit: 0, credit: 10000 },
        ],
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      ledger
        .saveDraft({
          date: "2025-01-03",
          description: "Unbalanced",
          lines: [{ accountId: "bank", debit: 1, credit: 0 }],
        })
        .then((draft) => ledger?.post(draft)),
    ).rejects.toThrow(/balanced/);
  });

  it("rejects oversized accounts and mismatched parent types without corrupting storage", async () => {
    ledger = await Ledger.open();
    const base = {
      type: "Asset" as const,
      description: "A valid description",
    };
    await expect(
      ledger.addAccount({
        ...base,
        code: "x".repeat(51),
        name: "Long code",
      }),
    ).rejects.toThrow(/too long/);
    await expect(
      ledger.addAccount({
        ...base,
        code: "9001",
        name: "x".repeat(201),
      }),
    ).rejects.toThrow(/too long/);
    await expect(
      ledger.addAccount({
        ...base,
        code: "9002",
        name: "Long description",
        description: "x".repeat(1001),
      }),
    ).rejects.toThrow(/too long/);
    await expect(
      ledger.addAccount({
        code: "9003",
        name: "Liability child",
        type: "Liability",
        description: "Valid",
        parentId: "bank",
      }),
    ).rejects.toThrow(/same type/);

    await ledger.release();
    ledger = await Ledger.open();
    expect(ledger.snapshot().accounts).toHaveLength(14);
  });

  it("creates a linked reversing entry and reports normal balances", async () => {
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Sale",
      lines: [
        { accountId: "bank", debit: 10000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 10000 },
      ],
    });
    await ledger.post(id);
    const reversal = await ledger.reverse(id, "Customer refund");
    const snapshot = ledger.snapshot();
    expect(
      snapshot.journals.find((journal) => journal.id === reversal),
    ).toMatchObject({ status: "posted", reversalOf: id });
    expect(report(snapshot, "2025-01-01", "2025-01-31")).toMatchObject({
      income: 0,
      expense: 0,
      profit: 0,
      cashBalance: 0,
      balanced: true,
    });
  });

  it("round-trips a valid backup and rejects invalid bytes without changing data", async () => {
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Draft",
      lines: [{ accountId: "bank", debit: 100, credit: 0 }],
    });
    const before = ledger.snapshot();
    const backup = await ledger.backup();
    await expect(ledger.restore(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      /backup/,
    );
    expect(ledger.snapshot()).toEqual(before);
    await ledger.restore(backup);
    expect(ledger.snapshot()).toEqual(before);
    expect(id).toBeDefined();
  });

  it("links transaction sources to drafts and rejects reconciliation links", async () => {
    ledger = await Ledger.open();
    const draft = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Imported sale",
      lines: [
        { accountId: "bank", debit: 100, credit: 0 },
        { accountId: "sales", debit: 0, credit: 100 },
      ],
    });
    await ledger.importRows([
      {
        date: "2025-01-02",
        description: "Imported sale",
        amount: 100,
        reference: "",
        mode: "transactions",
      },
    ]);
    const transaction = ledger.snapshot().sources[0];
    await ledger.linkSource(transaction.id, draft);
    expect(ledger.snapshot().sources[0].journalId).toBe(draft);
    await expect(ledger.linkSource(transaction.id, draft)).rejects.toThrow(
      /already linked/,
    );

    await ledger.importRows([
      {
        date: "2025-01-02",
        description: "Statement row",
        amount: 100,
        reference: "",
        mode: "reconciliation",
      },
    ]);
    const reconciliation = ledger
      .snapshot()
      .sources.find((source) => source.mode === "reconciliation")!;
    await expect(ledger.linkSource(reconciliation.id, draft)).rejects.toThrow(
      /transaction sources/,
    );
  });

  it("classifies a transaction source atomically and leaves journals unchanged on stale linking", async () => {
    ledger = await Ledger.open();
    await ledger.importRows([
      {
        date: "2025-01-02",
        description: "Imported sale",
        amount: 100,
        reference: "",
        mode: "transactions",
      },
    ]);
    const source = ledger.snapshot().sources[0];
    const input = {
      date: "2025-01-02",
      description: "Imported sale",
      lines: [
        { accountId: "bank", debit: 100, credit: 0 },
        { accountId: "sales", debit: 0, credit: 100 },
      ],
    };
    const draft = await ledger.saveDraftFromSource(source.id, input);
    expect(ledger.snapshot().sources[0].journalId).toBe(draft);
    const before = ledger.snapshot().journals;
    await expect(
      ledger.saveDraftFromSource(source.id, {
        ...input,
        description: "Should not be saved",
      }),
    ).rejects.toThrow(/already linked/);
    expect(ledger.snapshot().journals).toEqual(before);
  });

  it("matches a source once and records the reconciliation audit trail", async () => {
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Sale",
      lines: [
        { accountId: "bank", debit: 10000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 10000 },
      ],
    });
    await ledger.post(id);
    await ledger.importRows([
      {
        date: "2025-01-02",
        description: "Sale",
        amount: 10000,
        reference: "",
        mode: "reconciliation",
      },
    ]);
    const source = ledger.snapshot().sources[0];
    await ledger.match(source.id, id, 0);
    expect(ledger.snapshot().sources[0].matchedLine).toBe(`${id}:0`);
    await expect(ledger.match(source.id, id, 0)).rejects.toThrow(
      /already matched/,
    );
    await ledger.unmatch(source.id);
    expect(ledger.snapshot().sources[0].matchedLine).toBeUndefined();
  });

  it("requires signed reconciliation equality on explicit bank/cash accounts", async () => {
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Sale",
      lines: [
        { accountId: "bank", debit: 10000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 10000 },
      ],
    });
    await ledger.post(id);
    await ledger.importRows([
      {
        date: "2025-01-02",
        description: "Wrong sign",
        amount: -10000,
        reference: "",
        mode: "reconciliation",
      },
    ]);
    await expect(
      ledger.match(ledger.snapshot().sources[0].id, id, 0),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects reconciliation matches outside the three-day date tolerance", async () => {
    ledger = await Ledger.open();
    const id = await ledger.saveDraft({
      date: "2025-01-02",
      description: "Sale",
      lines: [
        { accountId: "bank", debit: 10000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 10000 },
      ],
    });
    await ledger.post(id);
    await ledger.importRows([
      {
        date: "2025-01-06",
        description: "Late statement",
        amount: 10000,
        reference: "Different reference is user-confirmed separately",
        mode: "reconciliation",
      },
    ]);
    const source = ledger.snapshot().sources[0];
    await expect(ledger.match(source.id, id, 0)).rejects.toThrow(/within 3 days/);
    expect(ledger.snapshot().sources[0].matchedLine).toBeUndefined();
  });

  it("serializes concurrent saves and persists the complete final ledger", async () => {
    ledger = await Ledger.open();
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        ledger!.saveDraft({
          date: "2025-01-02",
          description: `Concurrent ${index}`,
          lines: [{ accountId: "bank", debit: index + 1, credit: 0 }],
        }),
      ),
    );
    expect(ledger.snapshot().journals).toHaveLength(8);
    await ledger.release();
    ledger = await Ledger.open();
    expect(ledger.snapshot().journals).toHaveLength(8);
  });

  it("rejects an altered backup while preserving the original ledger", async () => {
    ledger = await Ledger.open();
    await ledger.saveDraft({
      date: "2025-01-02",
      description: "Original",
      lines: [{ accountId: "bank", debit: 100, credit: 0 }],
    });
    const before = ledger.snapshot();
    const altered = await ledger.backup();
    altered[0] ^= 0xff;
    await expect(ledger.restore(altered)).rejects.toThrow(/backup|integrity/i);
    expect(ledger.snapshot()).toEqual(before);
  });
});
