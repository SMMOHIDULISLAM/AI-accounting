import { describe, expect, it } from "vitest";
import { reportMessage, whatsappUrl } from "../src/lib/whatsapp";
import type { Snapshot } from "../src/lib/types";

const snapshot: Snapshot = {
  accounts: [
    { id: "bank", name: "Bank", type: "Asset", code: "1000", description: "" },
    {
      id: "sales",
      name: "Sales",
      type: "Income",
      code: "4000",
      description: "",
    },
  ],
  journals: [
    {
      id: "posted",
      date: "2026-11-27",
      description: "Private customer name",
      status: "posted",
      lines: [
        { accountId: "bank", debit: 12345, credit: 0 },
        { accountId: "sales", debit: 0, credit: 12345 },
      ],
    },
    {
      id: "draft",
      date: "2026-11-27",
      description: "Unapproved draft",
      status: "draft",
      lines: [{ accountId: "bank", debit: 99999, credit: 0 }],
    },
  ],
  settings: {
    name: "আমার ব্যবসা & Co",
    currency: "BDT",
    country: "Bangladesh",
    framework: "General",
    guidance: true,
  },
  sources: [],
  audit: [],
};

describe("WhatsApp report sharing", () => {
  it("encodes Bengali, newlines and URL characters without losing text", () => {
    const message = "হিসাব & profit?\nBDT 123.45 + 5%";
    const url = new URL(whatsappUrl(message, "+880 (171) 234-5678"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/8801712345678");
    expect(url.searchParams.get("text")).toBe(message);
  });
  it("supports choosing a contact instead of requiring a saved phone", () => {
    expect(new URL(whatsappUrl("Summary")).pathname).toBe("/");
  });
  it.each([
    "01712345678",
    "+",
    "8801",
    "8801712345678?text=changed",
    "https://evil.example",
    "+001234567890",
    "1234567890123456",
  ])("rejects invalid recipient %s", (phone) => {
    expect(() => whatsappUrl("Summary", phone)).toThrow();
  });
  it("bounds the preview and refuses empty messages", () => {
    expect(() => whatsappUrl("   ")).toThrow();
    expect(() => whatsappUrl("x".repeat(4001))).toThrow();
  });
  it("includes posted aggregates and the selected dates without transaction descriptions", () => {
    const text = reportMessage(snapshot, "2026-11-01", "2026-11-27");
    expect(text).toContain(snapshot.settings.name);
    expect(text).toContain("2026-11-01 to 2026-11-27");
    expect(text).toContain("123.45");
    expect(text).not.toContain("999.99");
    expect(text).not.toContain("Private customer");
    expect(text).not.toContain("Unapproved draft");
    expect(reportMessage(snapshot, "2026-11-01", "2026-11-26")).toContain(
      "0.00",
    );
    expect(() => reportMessage(snapshot, "2026-11-28", "2026-11-27")).toThrow();
  });
});
