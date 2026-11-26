import { assertDate, parseMoney } from "./accounting";
import type { SourceRow } from "./types";

export interface CSVMapping {
  date: string;
  description: string;
  reference?: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface CSVError {
  row: number;
  message: string;
}

function parseRawCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((part) => part.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((part) => part.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  if (typeof text !== "string") throw new Error("CSV must be text");
  const parsed = parseRawCSV(text.replace(/^\uFEFF/, ""));
  if (!parsed.length) return { headers: [], rows: [] };
  const headers = parsed[0].map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header))
    throw new Error("CSV headers are required");
  if (
    new Set(headers.map((header) => header.toLowerCase())).size !==
    headers.length
  )
    throw new Error("CSV headers must be unique");
  const rows = parsed.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });
    return record;
  });
  return { headers, rows };
}

function parseFlexibleDate(value: string): string {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    assertDate(text);
    return text;
  }
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (!match)
    throw new Error("Date must be YYYY-MM-DD or unambiguous DD/MM/YYYY");
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first <= 12 && second <= 12)
    throw new Error("Ambiguous date; use YYYY-MM-DD");
  if (first < 1 || first > 31 || second < 1 || second > 12)
    throw new Error("Invalid date");
  const normalized = `${match[3]}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  assertDate(normalized);
  return normalized;
}

function mappedValue(row: Record<string, string>, key?: string): string {
  return key ? (row[key] ?? "") : "";
}

export function mapCSV(
  rows: Record<string, string>[],
  mapping: CSVMapping,
  sign: "inflow-positive" | "outflow-positive",
  mode: SourceRow["mode"],
): { valid: Omit<SourceRow, "id">[]; errors: CSVError[] } {
  const valid: Omit<SourceRow, "id">[] = [];
  const errors: CSVError[] = [];
  if (!mapping.date || !mapping.description)
    throw new Error("Date and description columns are required");
  const hasAmount = Boolean(mapping.amount);
  const hasDebitCredit = Boolean(mapping.debit && mapping.credit);
  if (!hasAmount && !hasDebitCredit)
    throw new Error("Map either amount or both debit and credit columns");
  if (hasAmount && hasDebitCredit)
    throw new Error("Map amount or debit/credit, not both");

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const date = parseFlexibleDate(mappedValue(row, mapping.date));
      const description = mappedValue(row, mapping.description);
      if (!description) throw new Error("Description is required");
      let amount: number;
      if (hasAmount) {
        amount = parseMoney(mappedValue(row, mapping.amount));
        if (sign === "outflow-positive") amount = -amount;
      } else {
        const debitText = mappedValue(row, mapping.debit);
        const creditText = mappedValue(row, mapping.credit);
        if (!debitText && !creditText)
          throw new Error("Debit or credit amount is required");
        const debit = debitText ? parseMoney(debitText) : 0;
        const credit = creditText ? parseMoney(creditText) : 0;
        if (debit < 0 || credit < 0)
          throw new Error("Debit and credit must not be negative");
        amount = credit - debit;
        if (sign === "outflow-positive") amount = -amount;
      }
      valid.push({
        date,
        description,
        amount,
        reference: mappedValue(row, mapping.reference),
        mode,
      });
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
  return { valid, errors };
}

function fingerprint(
  row: Pick<SourceRow, "date" | "description" | "amount" | "reference">,
): string {
  return [
    row.date,
    row.description.trim().toLowerCase().replace(/\s+/g, " "),
    row.amount,
    row.reference.trim().toLowerCase(),
  ].join("|");
}

export function probableDuplicates(
  valid: Omit<SourceRow, "id">[],
  existing: SourceRow[],
): boolean[] {
  const seen = new Set(existing.map(fingerprint));
  return valid.map((row) => {
    const key = fingerprint(row);
    const duplicate = seen.has(key);
    seen.add(key);
    return duplicate;
  });
}

function safeCell(value: string | number): string {
  const text = String(value);
  const formulaSafe =
    typeof value === "string" &&
    (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text)) &&
    !/^-\d+(?:\.\d+)?$/.test(text)
      ? `'${text}` : text;
  return /[",\r\n]/.test(formulaSafe)
    ? `"${formulaSafe.replace(/"/g, '""')}"`
    : formulaSafe;
}

export function exportCSV(
  headers: string[],
  rows: (string | number)[][],
): string {
  return (
    [headers, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
