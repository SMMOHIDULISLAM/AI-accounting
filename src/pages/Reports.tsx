import {
  t as tr,
  useLanguage,
  accountLabel,
  message,
  getLanguage,
} from "../lib/i18n";
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
import { minorUnitsText } from "../lib/money";
import { reportMessage } from "../lib/whatsapp";
import WhatsAppShare from "../components/WhatsAppShare";
import ChannelShare from "../components/ChannelShare";
export default function Reports({
  data,
  money,
}: {
  data: Snapshot;
  money: (n: number) => string;
}) {
  useLanguage();
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState("Profit & loss");
  if (!isValidDate(from) || !isValidDate(to) || from > to)
    return (
      <div className="panel padded">
        <p role="alert">
          {tr(
            "Select two valid dates. From date must not be after the reporting date.",
          )}
        </p>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    );
  let r: ReturnType<typeof report>;
  try {
    r = report(data, from, to);
  } catch (error) {
    return (
      <p className="alert error" role="alert">
        {tr("Report unavailable: ")}
        {(error as Error).message}
        {tr(". Records and backup controls remain available.")}
      </p>
    );
  }
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
            minorUnitsText(x.debit),
            minorUnitsText(x.credit),
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
                minorUnitsText(l.debit),
                minorUnitsText(l.credit),
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
            .map((s) => [s.date, s.description, minorUnitsText(s.amount)]),
        ),
      );
    else
      saveFile(
        tab + ".csv",
        exportCSV(
          ["Item", "Amount"],
          rows.map((x) => [x[0] as string, minorUnitsText(x[1] as number)]),
        ),
      );
  };
  return (
    <section className="panel">
      <div className="report-controls">
        <span className="guide-pill">{tr("DRAFT MANAGEMENT REPORT")}</span>
        <label>
          {tr("From")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {tr("To / as of")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="secondary" onClick={exportRows}>
          <Download size={16} /> {tr(" Export CSV")}
        </button>
        <WhatsAppShare
          key={`${from}:${to}`}
          message={reportMessage(data, from, to, getLanguage())}
        />
        <ChannelShare message={reportMessage(data, from, to, getLanguage())} />
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
            {tr(t)}
          </button>
        ))}
      </div>
      <div className="report-paper">
        <div className="report-header">
          <img src="/logo.svg" width="32" />
          <h2>{data.settings.name || tr("My business")}</h2>
          <h3>{tr(tab)}</h3>
          <p>
            {tab === "Balance sheet" || tab === "Trial balance"
              ? tr("As of ") + to
              : from + tr(" to ") + to}{" "}
            · {data.settings.currency}
          </p>
        </div>
        {rows.length > 0 &&
          rows.map(([label, value]) => (
            <div className="statement-row" key={label}>
              <span>{tr(label)}</span>
              <strong className="numeric">{money(value as number)}</strong>
            </div>
          ))}
        {tab === "Trial balance" && (
          <table>
            <thead>
              <tr>
                <th>{tr("Account")}</th>
                <th>{tr("Debit")}</th>
                <th>{tr("Credit")}</th>
              </tr>
            </thead>
            <tbody>
              {r.trial.map((x) => (
                <tr key={x.account.id}>
                  <td>{accountLabel(x.account)}</td>
                  <td className="numeric">{money(x.debit)}</td>
                  <td className="numeric">{money(x.credit)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>{tr("Total")}</b>
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
                  <th>{tr("Date / description")}</th>
                  <th>{tr("Account")}</th>
                  <th>{tr("Debit")}</th>
                  <th>{tr("Credit")}</th>
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
                          {accountLabel(
                            data.accounts.find((a) => a.id === l.accountId),
                          )}
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
              {tr(
                "Unmatched statement rows remain visible. No automatic adjustments.",
              )}
            </p>
          </>
        )}
        <div className="report-note">
          <b>
            {r.balanced
              ? tr("Posted ledger is balanced.")
              : tr("Review: ledger imbalance.")}
          </b>
          <p>
            {tr("General accrual bookkeeping. Framework preference:")}{" "}
            {tr(data.settings.framework || "Not selected")}
            {tr(
              ". Not a compliance certification. Adjustments, taxes, policies, notes, comparatives and other required statements must be reviewed separately. Cash movements are not a complete statutory cash-flow statement.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
