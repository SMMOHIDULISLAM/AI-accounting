import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhatsAppInbox from "../src/pages/WhatsAppInbox";
import Reports from "../src/pages/Reports";
import type { Ledger } from "../src/lib/db";
import type { Snapshot } from "../src/lib/types";

const data: Snapshot = {
  accounts: [
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
  ],
  journals: [],
  sources: [],
  audit: [],
  settings: {
    name: "Test business",
    currency: "BDT",
    country: "Bangladesh",
    framework: "General",
    guidance: true,
  },
};
describe("server-rendered review screens — not browser interaction evidence", () => {
  it("renders the requested cash/receivable sale split before connecting", () => {
    const html = renderToStaticMarkup(
      createElement(WhatsAppInbox, {
        data,
        ledger: null as unknown as Ledger,
        run: async () => true,
      }),
    );
    for (const value of [
      "My Accounts",
      "Cash",
      "Receivables",
      "Sales",
      "100.00",
      "50.00",
      "150.00",
      "Create text draft",
    ])
      expect(html.toLowerCase()).toContain(value.toLowerCase());
  });
  it("renders statement exports and an explicit WhatsApp message preview", () => {
    const html = renderToStaticMarkup(
      createElement(Reports, { data, money: (n) => String(n) }),
    );
    expect(html).toContain("Export CSV");
    expect(html).toContain("Share on WhatsApp");
    expect(html).toContain("Review WhatsApp message");
  });
});
