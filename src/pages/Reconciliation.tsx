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
export default function Reconciliation({ data, money, run, ledger }: any) {
  const [account, setAccount] = useState("bank");
  const [open, setOpen] = useState("0");
  const [close, setClose] = useState("0");
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const sources = data.sources.filter(
    (s: SourceRow) =>
      s.mode === "reconciliation" && s.date >= from && s.date <= to,
  );
  const bankLines = data.journals
    .filter(
      (j: Journal) => j.status === "posted" && j.date >= from && j.date <= to,
    )
    .flatMap((j: Journal) =>
      j.lines.map((l, i) => ({ j, l, i, key: j.id + ":" + i })),
    )
    .filter((x: any) => x.l.accountId === account);
  let difference: string;
  try {
    difference = money(
      parseMoney(open) +
        bankLines.reduce((n: number, x: any) => n + x.l.debit - x.l.credit, 0) -
        parseMoney(close),
    );
  } catch {
    difference = "Enter valid balances";
  }
  return (
    <>
      <div className="panel padded">
        <div className="form-grid">
          <label>
            Bank / cash account
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              {data.accounts
                .filter((a: Account) => ["bank", "cash"].includes(a.id))
                .map((a: Account) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Statement opening balance
            <input value={open} onChange={(e) => setOpen(e.target.value)} />
          </label>
          <label>
            Statement closing balance
            <input value={close} onChange={(e) => setClose(e.target.value)} />
          </label>
        </div>
        <div className="reconcile-total">
          <span>Opening + posted movements − statement closing</span>
          <strong>{difference}</strong>
        </div>
        <p className="muted">
          Balance inputs are a review calculation, not posted opening entries.
          Import a reconciliation-only CSV first. Matching never creates
          balancing entries.
        </p>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Bank statement matches</h2>
          <span>
            {sources.filter((s: SourceRow) => !s.matchedLine).length} unmatched
          </span>
        </div>
        {sources.map((s: SourceRow) => {
          const matches = bankLines.filter(
            (x: any) =>
              x.l.debit - x.l.credit === s.amount &&
              Math.abs(Date.parse(x.j.date) - Date.parse(s.date)) <=
                3 * 86400000 &&
              !data.sources.some((o: SourceRow) => o.matchedLine === x.key),
          );
          return (
            <div className="source-row" key={s.id}>
              <div>
                <strong>{s.description}</strong>
                <small>
                  {s.date} · {s.reference}
                </small>
              </div>
              <b className="numeric">{money(s.amount)}</b>
              {s.matchedLine ? (
                <>
                  <span className="chip posted">Confirmed match</span>
                  <button
                    className="text-btn"
                    onClick={() => run(() => ledger.unmatch(s.id))}
                  >
                    Undo match
                  </button>
                </>
              ) : (
                <div>
                  <select
                    aria-label="Proposed bank match"
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      const x = matches.find(
                        (m: any) => m.key === e.target.value,
                      );
                      if (
                        x &&
                        confirm(
                          "Confirm this statement row matches " +
                            x.j.description +
                            "?",
                        )
                      )
                        await run(
                          () => ledger.match(s.id, x.j.id, x.i),
                          "Match confirmed",
                        );
                      e.target.value = "";
                    }}
                  >
                    <option value="">
                      {matches.length
                        ? "Choose a candidate to confirm"
                        : "No amount/date candidate"}
                    </option>
                    {matches.map((x: any) => (
                      <option key={x.key} value={x.key}>
                        {x.j.date} · {x.j.description} ·{" "}
                        {x.j.reference || "No reference"}
                      </option>
                    ))}
                  </select>
                  <small>
                    Same amount, within 3 days. Confirm the reference yourself.
                  </small>
                </div>
              )}
            </div>
          );
        })}
        {!sources.length && (
          <div className="empty">
            <CheckCheck />
            <h3>No statement rows in this period</h3>
            <p>Import CSV with purpose “reconciliation only”.</p>
          </div>
        )}
      </section>
    </>
  );
}
