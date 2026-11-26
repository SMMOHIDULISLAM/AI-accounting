import { assertDate, parseMoney, linesBalanced } from "./accounting";
import type { Line } from "./types";

export type WhatsAppDraft =
  | {
      ready: true;
      date: string;
      description: string;
      currency: "BDT";
      lines: Line[];
    }
  | { ready: false; reason: string };

/** Deliberately narrow grammar: uncertain messages must never invent entries. */
export function parseWhatsAppSale(text: string, date: string): WhatsAppDraft {
  assertDate(date);
  const normalized = text
    .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .trim();
  const match =
    /^(?:sales?|বিক্রি|বিক্রয়)\s+(?:cash|নগদ)\s+([\d,.]+)(?:\s+bdt)?(?:\s*[,;]?\s+(?:credit|due|বাকি)\s+([\d,.]+)(?:\s+bdt)?)?\s*$/i.exec(
      normalized,
    );
  if (!match)
    return {
      ready: false,
      reason:
        "Use: sale cash 100 bdt, credit 50 bdt. Other wording needs manual review.",
    };
  try {
    const cash = parseMoney(match[1]);
    const due = parseMoney(match[2] || "0");
    const total = cash + due;
    if (!Number.isSafeInteger(total) || total <= 0)
      throw new Error(
        "Sale total must be positive and within the supported amount range.",
      );
    const lines: Line[] = [
      ...(cash ? [{ accountId: "cash", debit: cash, credit: 0 }] : []),
      ...(due ? [{ accountId: "ar", debit: due, credit: 0 }] : []),
      { accountId: "sales", debit: 0, credit: total },
    ];
    if (!linesBalanced(lines)) throw new Error("Check the sale amounts.");
    return {
      ready: true,
      date,
      description: text.trim(),
      currency: "BDT",
      lines,
    };
  } catch (error) {
    return { ready: false, reason: (error as Error).message };
  }
}

export interface WhatsAppMessage {
  id: string;
  sender: string;
  timestamp: string;
  date: string;
  type: string;
  text: string;
  media?: { id: string; mimeType: string; sha256: string };
}
