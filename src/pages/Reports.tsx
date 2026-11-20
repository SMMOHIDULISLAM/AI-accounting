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
import { parseMoney, report, isValidDate } from "../lib/accounting";
import { parseCSV, mapCSV, exportCSV } from "../lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "../lib/types";
import { today, saveFile } from "../components/utils";
export default function Reports({
  data,
  money,
}: {
  data: Snapshot;
  money: (n: number) => string;
}) {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState("Profit & loss");
  if (!isValidDate(from) || !isValidDate(to) || from > to)
    return (
      <div className="panel padded">
        <p role="alert">
          Select two valid dates. From date must not be after the reporting
          date.
        </p>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    );
  const r = report(data, from, to);
  const rows =
    tab === "Profit & loss"
      ? [
          ["Income", r.income],
          ["Expenses", r.expense],
          ["Net profit / loss", r.profit],
        ]
      : tab === "Balance sheet"
        ? [
            ["Assets", r.assets],
            ["Liabilities", r.liabilities],
            ["Contributed / other equity", r.equity],
            ["Accumulated earnings", r.earnings],
            ["Total equity", r.equity + r.earnings],
            ["Liabilities + equity", r.liabilities + r.equity + r.earnings],
          ]
        : tab === "Cash movements"
          ? [
              ["Money in", r.cashIn],
              ["Money out", r.cashOut],
              ["Net movement", r.cashIn - r.cashOut],
              ["Closing bank & cash", r.cashBalance],
            ]
          : [];
  const exportRows = () => {
    if (tab === "Trial balance")
      saveFile(
        "trial-balance.csv",
        exportCSV(
          ["Code", "Account", "Debit", "Credit"],
          r.trial.map((x) => [
            x.account.code,
            x.account.name,
            x.debit / 100,
            x.credit / 100,
          ]),
        ),
      );
    else if (tab === "General ledger")
      saveFile(
        "general-ledger.csv",
        exportCSV(
          ["Date", "Description", "Account", "Debit", "Credit"],
          data.journals
            .filter(
              (j) => j.status === "posted" && j.date >= from && j.date <= to,
            )
            .flatMap((j) =>
              j.lines.map((l) => [
                j.date,
                j.description,
                data.accounts.find((a) => a.id === l.accountId)?.name || "",
                l.debit / 100,
                l.credit / 100,
              ]),
            ),
        ),
      );
    else if (tab === "Exceptions")
      saveFile(
        "reconciliation-exceptions.csv",
        exportCSV(
          ["Date", "Description", "Amount"],
          data.sources
            .filter(
              (s) =>
                s.mode === "reconciliation" &&
                !s.matchedLine &&
                s.date >= from &&
                s.date <= to,
            )
            .map((s) => [s.date, s.description, s.amount / 100]),
        ),
      );
    else
      saveFile(
        tab + ".csv",
        exportCSV(
          ["Item", "Amount"],
          rows.map((x) => [x[0] as string, (x[1] as number) / 100]),
        ),
      );
  };
  return (
    <section className="panel">
      <div className="report-controls">
        <span className="guide-pill">DRAFT MANAGEMENT REPORT</span>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To / as of
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="secondary" onClick={exportRows}>
          <Download size={16} /> Export CSV
        </button>
      </div>
      <div className="tabs">
        {[
          "Profit & loss",
          "Balance sheet",
          "Trial balance",
          "General ledger",
          "Cash movements",
          "Exceptions",
        ].map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="report-paper">
        <div className="report-header">
          <img src="/logo.svg" width="32" />
          <h2>{data.settings.name || "My business"}</h2>
          <h3>{tab}</h3>
          <p>
            {tab === "Balance sheet" || tab === "Trial balance"
              ? "As of " + to
              : from + " to " + to}{" "}
            · {data.settings.currency}
          </p>
        </div>
        {rows.length > 0 &&
          rows.map(([label, value]) => (
            <div className="statement-row" key={label}>
              <span>{label}</span>
              <strong className="numeric">{money(value as number)}</strong>
            </div>
          ))}
        {tab === "Trial balance" && (
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {r.trial.map((x) => (
                <tr key={x.account.id}>
                  <td>{x.account.name}</td>
                  <td className="numeric">{money(x.debit)}</td>
                  <td className="numeric">{money(x.credit)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>Total</b>
                </td>
                <td>{money(r.trial.reduce((n, x) => n + x.debit, 0))}</td>
                <td>{money(r.trial.reduce((n, x) => n + x.credit, 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
        {tab === "General ledger" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date / description</th>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.journals
                  .filter(
                    (j) =>
                      j.status === "posted" && j.date >= from && j.date <= to,
                  )
                  .flatMap((j) =>
                    j.lines.map((l, i) => (
                      <tr key={j.id + i}>
                        <td>
                          {j.date}
                          <small>{j.description}</small>
                        </td>
                        <td>
                          {
                            data.accounts.find((a) => a.id === l.accountId)
                              ?.name
                          }
                        </td>
                        <td>{money(l.debit)}</td>
                        <td>{money(l.credit)}</td>
                      </tr>
                    )),
                  )}
              </tbody>
            </table>
          </div>
        )}
        {tab === "Exceptions" && (
          <>
            {data.sources
              .filter(
                (s) =>
                  s.mode === "reconciliation" &&
                  !s.matchedLine &&
                  s.date >= from &&
                  s.date <= to,
              )
              .map((s) => (
                <div className="statement-row" key={s.id}>
                  <span>
                    {s.date} · {s.description}
                  </span>
                  <b>{money(s.amount)}</b>
                </div>
              ))}
            <p>
              Unmatched statement rows remain visible. No automatic adjustments.
            </p>
          </>
        )}
        <div className="report-note">
          <b>
            {r.balanced
              ? "Posted ledger is balanced."
              : "Review: ledger imbalance."}
          </b>
          <p>
            General accrual bookkeeping. Framework preference:{" "}
            {data.settings.framework || "Not selected"}. Not a compliance
            certification. Adjustments, taxes, policies, notes, comparatives and
            other required statements must be reviewed separately. Cash
            movements are not a complete statutory cash-flow statement.
          </p>
        </div>
      </div>
    </section>
  );
}
