import { useSyncExternalStore } from "react";
import bangla from "./bn.json";
import { formatMoney } from "./accounting";
import type { Account } from "./types";

export type Language = "bn" | "en";
const key = "ai-accounting-language-v1";
let language: Language = "en";
try {
  if (typeof window !== "undefined")
    language = window.localStorage.getItem(key) === "en" ? "en" : "bn";
} catch {
  language = "bn";
}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function getLanguage(): Language {
  return language;
}
export function setLanguage(next: Language): void {
  if (next !== "bn" && next !== "en") return;
  language = next;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, next);
  } catch {
    /* Storage may be disabled. */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.title =
      next === "bn"
        ? "এআই হিসাব — আপনার ব্যবসার হিসাব"
        : "AI Accounting — your books, understood";
  }
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  const current = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return { language: current, setLanguage };
}
export function translate(text: string, current: Language): string {
  if (current === "en") return text;
  const normalized = text.replace(/\s+/g, " ").trim();
  const translated = (bangla as Record<string, string>)[normalized];
  if (!translated) {
    for (const prefix of [
      "Choose a supplier and current price for:",
      "Confirm a valid purchase price for:",
      "Uses the last received order's supplier and price as a proposal only. Verify both before approval.",
    ]) {
      if (text.startsWith(prefix))
        return (
          ((bangla as Record<string, string>)[prefix] || prefix) +
          text.slice(prefix.length)
        );
    }
    const invalidMoney = /^Invalid money amount: (.*)$/s.exec(text);
    if (invalidMoney) return "টাকার পরিমাণ সঠিক নয়: " + invalidMoney[1];
    const unknownAccount = /^Unknown account: (.*)$/s.exec(text);
    if (unknownAccount) return "অজানা খাত: " + unknownAccount[1];
    return text;
  }
  const before = /^\s/.test(text) ? " " : "";
  const after = /\s$/.test(text) ? " " : "";
  return before + translated + after;
}
/** Only call for product copy; never pass customer names or journal descriptions. */
export function t(text: string | number | null | undefined): string {
  if (text == null) return "";
  return translate(String(text), language);
}
export function message(
  key: string,
  values: Record<string, string | number>,
): string {
  return t(key).replace(/\{(\w+)\}/g, (match, name: string) =>
    String(values[name] ?? match),
  );
}
export function locale(): string {
  return language === "bn" ? "bn-BD" : "en-US";
}
export function uiMoney(amount: number, currency = "BDT"): string {
  return formatMoney(amount, currency, locale());
}
export function uiNumber(value: number): string {
  return new Intl.NumberFormat(locale()).format(value);
}
const seeds: Record<string, string> = {
  bank: "Bank",
  cash: "Cash",
  ar: "Receivables",
  equipment: "Equipment",
  inventory: "Inventory",
  ap: "Payables",
  deposits: "Customer Deposits",
  capital: "Owner capital",
  loan: "Owner loan",
  sales: "Sales",
  supplies: "Supplies",
  rent: "Rent",
  fees: "Fees",
  expense: "General expense",
};
export function accountLabel(
  account?: Pick<Account, "id" | "name"> & { code?: string },
): string {
  if (!account) return "";
  const generated: Record<string, string> = {
    "5300": "Cost of goods sold",
    "5400": "Wages and salaries",
    "2200": "Payroll payable",
    "2210": "Payroll deductions payable",
  };
  if (account.code && generated[account.code] === account.name)
    return t(account.name);
  return seeds[account.id] === account.name ? t(account.name) : account.name;
}
export function accountDescription(account?: Account): string {
  if (!account) return "";
  return seeds[account.id] === account.name
    ? t(account.description)
    : account.description;
}
