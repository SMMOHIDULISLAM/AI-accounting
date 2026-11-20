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
export default function JournalEditor({
  data,
  source,
  existing,
  preset,
  close,
  save,
}: {
  data: Snapshot;
  source?: SourceRow;
  existing?: Journal;
  preset?: string;
  close: () => void;
  save: (v: any) => Promise<void>;
}) {
  const amount = Math.abs(source?.amount || 0) / 100;
  const [date, setDate] = useState(existing?.date || source?.date || today());
  const [description, setDescription] = useState(
    existing?.description || source?.description || "",
  );
  const [reference, setReference] = useState(
    existing?.reference || source?.reference || "",
  );
  const [lines, setLines] = useState(
    existing?.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.debit ? (l.debit / 100).toFixed(2) : "",
      credit: l.credit ? (l.credit / 100).toFixed(2) : "",
    })) || [
      {
        accountId: "bank",
        debit: source && source.amount > 0 ? amount.toFixed(2) : "",
        credit: source && source.amount < 0 ? amount.toFixed(2) : "",
      },
      {
        accountId: preset || "expense",
        debit: source && source.amount < 0 ? amount.toFixed(2) : "",
        credit: source && source.amount > 0 ? amount.toFixed(2) : "",
      },
    ],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState("");
  const update = (i: number, key: string, value: string) =>
    setLines(lines.map((l, n) => (n === i ? { ...l, [key]: value } : l)));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        id: existing?.id,
        date,
        description,
        reference,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ? parseMoney(l.debit) : 0,
          credit: l.credit ? parseMoney(l.credit) : 0,
        })),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="modal-title">
        <div>
          <span className="eyebrow">REVIEW BOTH SIDES</span>
          <h2>{existing ? "Edit draft" : "New journal entry"}</h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={close}
          aria-label="Close"
        >
          <X />
        </button>
      </div>
      <div className="form-grid">
        <label>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      </div>
      <label>
        What happened?
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. paid the office rent"
        />
      </label>
      {data.settings.guidance && (
        <div className="inline-guide">
          <Sparkles size={16} />
          <div>
            <b>Guided rules · no connected AI required</b>
            <p>
              Is this new spending, a durable asset, an existing bill, or money
              received in advance?
            </p>
            <select
              value={guide}
              onChange={(e) => {
                setGuide(e.target.value);
                if (e.target.value && lines[1])
                  update(1, "accountId", e.target.value);
              }}
            >
              <option value="">Select the explanation that fits</option>
              {[
                ["expense", "New ordinary business cost"],
                ["equipment", "A durable item used over several periods"],
                ["ap", "Paying a bill already recorded as payable"],
                ["deposits", "Customer paid before we delivered"],
                ["capital", "Owner contribution, not repayable"],
                ["loan", "Owner funding that must be repaid"],
                ["ar", "Collecting an invoice already recorded"],
                ["sales", "Earned income not already recorded"],
                ["supplies", "Consumables used in the business"],
                ["rent", "Payment for using our premises"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
            <small>
              Check existing invoices, delivery, tax and your capitalization
              policy before choosing.
            </small>
          </div>
        </div>
      )}
      <div className="journal-head">
        <span>ACCOUNT HEAD</span>
        <span>DEBIT</span>
        <span>CREDIT</span>
      </div>
      {lines.map((l, i) => (
        <div className="journal-line" key={i}>
          <div>
            <select
              aria-label={"Account line " + (i + 1)}
              value={l.accountId}
              onChange={(e) => update(i, "accountId", e.target.value)}
            >
              {data.accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
            <small>
              {data.accounts.find((a) => a.id === l.accountId)?.description}
            </small>
          </div>
          <input
            aria-label={"Debit line " + (i + 1)}
            inputMode="decimal"
            placeholder="0.00"
            value={l.debit}
            onChange={(e) => update(i, "debit", e.target.value)}
          />
          <input
            aria-label={"Credit line " + (i + 1)}
            inputMode="decimal"
            placeholder="0.00"
            value={l.credit}
            onChange={(e) => update(i, "credit", e.target.value)}
          />
          <button
            type="button"
            aria-label="Remove line"
            className="icon-btn"
            disabled={lines.length <= 2}
            onClick={() => setLines(lines.filter((_, n) => n !== i))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-btn"
        onClick={() =>
          setLines([...lines, { accountId: "expense", debit: "", credit: "" }])
        }
      >
        <Plus size={14} /> Add line
      </button>
      <div className="note">
        Debits and credits describe the two sides of a transaction—not simply
        income and expense. Drafts may be incomplete. Only balanced entries can
        be posted.
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="modal-footer">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
      </div>
    </form>
  );
}
