import { describe, expect, it } from "vitest";
import { Ledger, type LedgerStorage } from "../src/lib/db";

function storage(id: string) {
  let bytes: Uint8Array | undefined;
  let fail = false,
    writes = 0;
  const backend: LedgerStorage = {
    id,
    async read() {
      return bytes && new Uint8Array(bytes);
    },
    async write(value) {
      writes++;
      if (fail) throw Error("Synthetic remote failure");
      bytes = new Uint8Array(value);
    },
  };
  return {
    backend,
    setFail(value: boolean) {
      fail = value;
    },
    writes: () => writes,
  };
}
describe("private ledger persistence boundary", () => {
  it("keeps separate company storage isolated through save and reopen", async () => {
    const a = storage("company-a"),
      b = storage("company-b");
    const bookA = await Ledger.open(a.backend),
      bookB = await Ledger.open(b.backend);
    try {
      await bookA.updateSettings({ name: "Synthetic Company A" });
      expect(bookB.snapshot().settings.name).not.toBe("Synthetic Company A");
    } finally {
      await bookA.release();
      await bookB.release();
    }
    const reopened = await Ledger.open(a.backend);
    try {
      expect(reopened.snapshot().settings.name).toBe("Synthetic Company A");
    } finally {
      await reopened.release();
    }
  });
  it("rolls back a refused or conflicting remote mutation", async () => {
    const a = storage("company-conflict"),
      book = await Ledger.open(a.backend);
    const before = book.snapshot();
    a.setFail(true);
    try {
      await expect(
        book.saveDraft({
          date: "2026-11-27",
          description: "Synthetic failed draft",
          lines: [
            { accountId: "cash", debit: 10000, credit: 0 },
            { accountId: "sales", debit: 0, credit: 10000 },
          ],
        }),
      ).rejects.toThrow("Synthetic remote failure");
      expect(book.snapshot()).toEqual(before);
    } finally {
      await book.release();
    }
  });
  it("does not try to overwrite a remote backup again after a restore is refused", async () => {
    const a = storage("company-restore"),
      book = await Ledger.open(a.backend);
    try {
      const backup = await book.backup();
      const before = book.snapshot();
      const count = a.writes();
      a.setFail(true);
      await expect(book.restore(backup)).rejects.toThrow(
        "Synthetic remote failure",
      );
      expect(a.writes() - count).toBe(1);
      expect(book.snapshot()).toEqual(before);
    } finally {
      await book.release();
    }
  });
});
