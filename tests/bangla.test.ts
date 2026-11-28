import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMoney, formatMoney } from "../src/lib/accounting";
import { parseCSV, mapCSV, exportCSV } from "../src/lib/csv";
import { latinDigits } from "../src/lib/digits";
import { minorUnitsText } from "../src/lib/money";
import { stockCost } from "../src/lib/accounting-skills";
import { accountLabel, setLanguage, translate } from "../src/lib/i18n";
import { reportMessage, whatsappUrl } from "../src/lib/whatsapp";
import JournalEditor from "../src/components/JournalEditor";
import WhatsAppInbox from "../src/pages/WhatsAppInbox";
import SettingsPanel from "../src/pages/SettingsPanel";
import type { Snapshot } from "../src/lib/types";
import type { Ledger } from "../src/lib/db";

const data: Snapshot = {
  accounts: [
    {
      id: "bank",
      code: "1000",
      name: "Bank",
      type: "Asset",
      description: "Money held in a business bank account.",
    },
    { id: "cash", code: "1010", name: "Cash", type: "Asset", description: "" },
    {
      id: "ar",
      code: "1100",
      name: "Receivables",
      type: "Asset",
      description: "",
    },
    {
      id: "sales",
      code: "4000",
      name: "Sales",
      type: "Income",
      description: "",
    },
    {
      id: "expense",
      code: "5900",
      name: "General expense",
      type: "Expense",
      description: "",
    },
    {
      id: "custom-cash",
      code: "1400",
      name: "Cash",
      type: "Asset",
      description: "Custom label must stay unchanged",
    },
  ],
  journals: [],
  sources: [],
  audit: [],
  settings: {
    name: "আমার দোকান - Customer Sales",
    currency: "BDT",
    country: "Bangladesh",
    framework: "General accrual bookkeeping",
    guidance: true,
  },
};
beforeEach(() => setLanguage("en"));
describe("Bangla interface and canonical accounting data", () => {
  it("accepts Bangla amounts exactly and retains the supported amount bound", () => {
    expect(parseMoney("৳ ১,২৩৪.৫৬")).toBe(123456);
    expect(parseMoney("(২৫০.৫০)")).toBe(-25050);
    expect(parseMoney("৯০০৭১৯৯২৫৪৭৪০৯.৯১")).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => parseMoney("৯০০৭১৯৯২৫৪৭৪০৯.৯২")).toThrow("too large");
  });
  it("formats Bangla currency without rounding the final minor-unit digits", () => {
    const formatted = formatMoney(Number.MAX_SAFE_INTEGER, "BDT", "bn-BD");
    expect(formatted).toMatch(/[০-৯]/);
    expect(latinDigits(formatted).replace(/\D/g, "")).toBe(
      String(Number.MAX_SAFE_INTEGER),
    );
    expect(formatMoney(-10001, "BDT", "bn-BD")).toContain("১০০.০১");
  });
  it("normalizes only input fields while retaining descriptions and machine-readable exports", () => {
    const parsed = parseCSV(
      "date,description,reference,amount\n২০২৬-১১-২৭,Customer Sales আমার দোকান,INV-001,১০০.৫০",
    );
    const result = mapCSV(
      parsed.rows,
      {
        date: "date",
        description: "description",
        reference: "reference",
        amount: "amount",
      },
      "inflow-positive",
      "transactions",
    );
    expect(result.errors).toEqual([]);
    expect(result.valid[0]).toMatchObject({
      date: "2026-11-27",
      description: "Customer Sales আমার দোকান",
      reference: "INV-001",
      amount: 10050,
    });
    expect(
      exportCSV(
        ["Date", "Amount"],
        [[result.valid[0].date, minorUnitsText(result.valid[0].amount)]],
      ),
    ).toContain("100.50");
  });
  it("calculates the same exact stock cost with Bangla quantities", () => {
    expect(stockCost("১০", 10000, "৩")).toEqual(stockCost("10", 10000, "3"));
  });
  it("translates seeded accounts but preserves custom and renamed accounts", () => {
    setLanguage("bn");
    expect(accountLabel(data.accounts[0])).toBe("ব্যাংক");
    expect(accountLabel(data.accounts[5])).toBe("Cash");
    expect(
      accountLabel({ ...data.accounts[0], name: "Bank of My Business" }),
    ).toBe("Bank of My Business");
  });
  it("renders a Bangla review form while keeping account option values canonical", () => {
    setLanguage("bn");
    const html = renderToStaticMarkup(
      createElement(JournalEditor, {
        data,
        preset: "custom-cash",
        close: () => {},
        save: async () => {},
      }),
    );
    expect(html).toContain("খসড়া সংরক্ষণ");
    expect(html).toContain('value="bank"');
    expect(html).toContain("ব্যাংক");
    expect(html).toContain("Custom label must stay unchanged");
  });
  it("switches review languages without changing supplied ledger records", () => {
    const original = JSON.stringify(data);
    const props = {
      data,
      ledger: null as unknown as Ledger,
      run: async () => true,
    };
    setLanguage("bn");
    const bn = renderToStaticMarkup(createElement(WhatsAppInbox, props));
    expect(bn).toContain("বিক্রি নগদ ১০০ বাকি ৫০");
    expect(bn).toContain("পাওনা");
    expect(bn).toContain("১৫০.০০");
    setLanguage("en");
    const en = renderToStaticMarkup(createElement(WhatsAppInbox, props));
    expect(en).toContain("Create text draft");
    expect(en).toContain("150.00");
    expect(JSON.stringify(data)).toBe(original);
  });
  it("preserves framework values and business names while translating settings", () => {
    setLanguage("bn");
    const html = renderToStaticMarkup(
      createElement(SettingsPanel, {
        data,
        ledger: null,
        run: async () => true,
      }),
    );
    expect(html).toContain('value="General accrual bookkeeping"');
    expect(html).toContain("আমার দোকান - Customer Sales");
    expect(html).toContain("বিনামূল্যে স্থানীয় সংস্করণ");
  });
  it("builds a Bangla report preview and normalizes a Bangla phone without sending it", () => {
    const text = reportMessage(data, "2026-11-01", "2026-11-27", "bn");
    expect(text).toContain("আমার দোকান - Customer Sales");
    expect(text).toContain("নিট লাভ / ক্ষতি");
    expect(whatsappUrl(text, "+৮৮০১৭১২৩৪৫৬৭৮")).toContain(
      "https://wa.me/8801712345678?",
    );
    expect(reportMessage(data, "2026-11-01", "2026-11-27")).toContain(
      "Net profit / loss",
    );
  });
  it("keeps diagnostic details intact when localizing an input error", () => {
    expect(translate("Invalid money amount: INV-X", "bn")).toBe(
      "টাকার পরিমাণ সঠিক নয়: INV-X",
    );
    expect(translate("Future diagnostic: REF-123", "bn")).toBe(
      "Future diagnostic: REF-123",
    );
  });
});
