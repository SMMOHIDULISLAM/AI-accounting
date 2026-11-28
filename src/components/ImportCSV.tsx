import { t as tr, useLanguage, uiNumber, message } from "../lib/i18n";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  BookOpen,
  CheckCheck,
  FileText,
  Sparkles,
  Settings as SettingsIcon,
  Plus,
  ArrowUpRight,
  Upload,
  Download,
  ShieldCheck,
  ChevronRight,
  X,
  Search,
  ArrowDownLeft,
  HelpCircle,
  Menu,
} from "lucide-react";
import { Ledger } from "../lib/db";
import { parseMoney, report } from "../lib/accounting";
import { parseCSV, mapCSV, exportCSV } from "../lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "../lib/types";
import { today, saveFile } from "../components/utils";
import { minorUnitsText } from "../lib/money";
export default function ImportCSV({
  existing,
  close,
  submit,
}: {
  existing: SourceRow[];
  close: () => void;
  submit: (rows: any[]) => Promise<void>;
}) {
  useLanguage();
  const [parsed, setParsed] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  }>();
  const [mapping, setMapping] = useState({
    date: "date",
    description: "description",
    reference: "reference",
    amount: "amount",
    debit: "",
    credit: "",
  });
  const [sign, setSign] = useState<"inflow-positive" | "outflow-positive">(
    "inflow-positive",
  );
  const [mode, setMode] = useState<"transactions" | "reconciliation">(
    "transactions",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [keepDuplicates, setKeepDuplicates] = useState(false);
  let result: { valid: any[]; errors: { row: number; message: string }[] } = {
    valid: [],
    errors: [],
  };
  try {
    if (parsed) result = mapCSV(parsed.rows, mapping, sign, mode);
  } catch (e) {
    result.errors = [{ row: 0, message: (e as Error).message }];
  }
  const isDuplicate = (r: any) =>
    existing.some(
      (s) =>
        s.date === r.date &&
        s.amount === r.amount &&
        s.description === r.description &&
        s.reference === r.reference &&
        s.mode === r.mode,
    ) ||
    result.valid
      .slice(0, result.valid.indexOf(r))
      .some(
        (s) =>
          s.date === r.date &&
          s.amount === r.amount &&
          s.description === r.description &&
          s.reference === r.reference,
      );
  const duplicates = result.valid.filter(isDuplicate).length;
  const rows = keepDuplicates
    ? result.valid
    : result.valid.filter((r) => !isDuplicate(r));
  return (
    <div>
      <div className="modal-title">
        <div>
          <span className="eyebrow">{tr("IMPORT, THEN UNDERSTAND")}</span>
          <h2>{tr("Import CSV")}</h2>
        </div>
        <button className="icon-btn" onClick={close} aria-label={tr("Close")}>
          <X />
        </button>
      </div>
      <div className="note">
        {tr(
          "Records enter a review inbox, not your posted ledger. Choose your bank's sign convention. Dates must be unambiguous.",
        )}
      </div>
      <label className="file-drop">
        {tr("Select CSV file")}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5e6)
                throw Error("CSV must be smaller than 5 MB.");
              const p = parseCSV(await file.text());
              setParsed(p);
              setError("");
              const auto = { ...mapping };
              Object.keys(auto).forEach((k) => {
                (auto as any)[k] =
                  p.headers.find((h) => h.toLowerCase() === k) || "";
              });
              setMapping(auto);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </label>
      <a href="/sample.csv" download>
        {tr("Download example CSV")}
      </a>
      {parsed && (
        <>
          <div className="form-grid">
            {Object.entries(mapping).map(([k, v]) => (
              <label key={k}>
                {tr(k)}
                <select
                  value={v}
                  onChange={(e) =>
                    setMapping({ ...mapping, [k]: e.target.value })
                  }
                >
                  <option value="">{tr("Not mapped")}</option>
                  {parsed.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label>
              {tr("Amount direction")}
              <select
                value={sign}
                onChange={(e) => setSign(e.target.value as typeof sign)}
              >
                <option value="inflow-positive">
                  {tr("Positive = money into bank")}
                </option>
                <option value="outflow-positive">
                  {tr("Positive = money out of bank")}
                </option>
              </select>
            </label>
            <label>
              {tr("Import purpose")}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="transactions">
                  {tr("Classify new transactions")}
                </option>
                <option value="reconciliation">
                  {tr("Bank statement for reconciliation only")}
                </option>
              </select>
            </label>
          </div>
          <p>
            <b>{result.valid.length}</b> {tr(" valid rows ·")}{" "}
            <b>{result.errors.length}</b> {tr(" errors · ")}
            <b>{duplicates}</b> {tr(" probable duplicates")}
          </p>
          {duplicates > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={keepDuplicates}
                onChange={(e) => setKeepDuplicates(e.target.checked)}
              />{" "}
              {tr("Keep probable duplicates (otherwise explicitly excluded)")}
            </label>
          )}
          {result.errors.map((e, i) => (
            <div className="error-text" key={i}>
              {tr("Row ")}
              {uiNumber(e.row)}: {tr(e.message)}
            </div>
          ))}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Date")}</th>
                  <th>{tr("Description")}</th>
                  <th>{tr("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.description}</td>
                    <td>{minorUnitsText(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error && <div className="alert error">{tr(error)}</div>}
      <div className="modal-footer">
        <button className="secondary" onClick={close}>
          {tr("Cancel")}
        </button>
        <button
          disabled={!rows.length || !!result.errors.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await submit(rows);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? tr("Importing…")
            : message("Import {count} reviewed rows", {
                count: uiNumber(rows.length),
              })}
        </button>
      </div>
    </div>
  );
}
