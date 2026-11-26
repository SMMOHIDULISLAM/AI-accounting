import { report, formatMoney } from "./accounting";
import type { Snapshot } from "./types";

/** A short aggregate summary, with no individual journal or source details. */
export function reportMessage(
  data: Snapshot,
  from: string,
  to: string,
): string {
  const r = report(data, from, to);
  const money = (amount: number) => formatMoney(amount, data.settings.currency);
  return [
    data.settings.name,
    "Draft management summary",
    `Period: ${from} to ${to}`,
    `Currency: ${data.settings.currency}`,
    `Income: ${money(r.income)}`,
    `Expenses: ${money(r.expense)}`,
    `Net profit / loss: ${money(r.profit)}`,
    `Bank & cash as of ${to}: ${money(r.cashBalance)}`,
    `Posted ledger: ${r.balanced ? "balanced" : "REVIEW IMBALANCE"}`,
    "Posted entries only. Prepared with AI Accounting.",
  ].join("\n");
}

/** Official click-to-chat URL. Opening a link does not send the message. */
export function whatsappUrl(message: string, phone = ""): string {
  const input = phone.trim();
  if (input && !/^\+?[1-9][0-9 ()-]*$/.test(input))
    throw new Error(
      "Use a full international phone number, for example +8801712345678.",
    );
  const digits = input.replace(/[+ ()-]/g, "");
  if (digits && !/^[1-9]\d{6,14}$/.test(digits))
    throw new Error(
      "Use 7 to 15 digits including the country code, without a leading zero.",
    );
  if (!message.trim())
    throw new Error("Write a message before opening WhatsApp.");
  if (message.length > 4000)
    throw new Error("Keep the message within 4,000 characters.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
