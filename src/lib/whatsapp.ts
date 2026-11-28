import { report, formatMoney } from "./accounting";
import type { Snapshot } from "./types";
import { translate, type Language } from "./i18n";
import { latinDigits } from "./digits";

/** A short aggregate summary, with no individual journal or source details. */
export function reportMessage(
  data: Snapshot,
  from: string,
  to: string,
  language: Language = "en",
): string {
  const r = report(data, from, to);
  const money = (amount: number) =>
    formatMoney(
      amount,
      data.settings.currency,
      language === "bn" ? "bn-BD" : "en-US",
    );
  const tr = (text: string) => translate(text, language);
  return [
    data.settings.name,
    tr("Draft management summary"),
    `${tr("Period")}: ${from} ${tr("to")} ${to}`,
    `${tr("Currency")}: ${data.settings.currency}`,
    `${tr("Income")}: ${money(r.income)}`,
    `${tr("Expenses")}: ${money(r.expense)}`,
    `${tr("Net profit / loss")}: ${money(r.profit)}`,
    `${tr("Bank & cash as of")} ${to}: ${money(r.cashBalance)}`,
    `${tr("Posted ledger")}: ${tr(r.balanced ? "balanced" : "REVIEW IMBALANCE")}`,
    tr("Posted entries only. Prepared with AI Accounting."),
  ].join("\n");
}

/** Official click-to-chat URL. Opening a link does not send the message. */
export function whatsappUrl(message: string, phone = ""): string {
  const input = latinDigits(phone).trim();
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
