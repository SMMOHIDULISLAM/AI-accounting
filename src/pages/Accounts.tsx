import {
  t as tr,
  useLanguage,
  accountLabel,
  accountDescription,
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
import { parseMoney, report } from "../lib/accounting";
import { parseCSV, mapCSV, exportCSV } from "../lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "../lib/types";
import { today, saveFile } from "../components/utils";
export default function Accounts({ data, money, run, ledger }: any) {
  useLanguage();
  const [type, setType] = useState("All");
  const [adding, setAdding] = useState(false);
  const balances = report(data, "0001-01-01", today()).trial;
  return (
    <section className="panel">
      <div className="tabs">
        {["All", "Asset", "Liability", "Equity", "Income", "Expense"].map(
          (t) => (
            <button
              className={type === t ? "selected" : ""}
              onClick={() => setType(t)}
              key={t}
            >
              {tr(t)}
            </button>
          ),
        )}
        <button className="text-btn" onClick={() => setAdding(!adding)}>
          <Plus size={14} /> {tr(" Custom head")}
        </button>
      </div>
      {adding && (
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await run(() =>
                ledger.addAccount({
                  code: f.get("code"),
                  name: f.get("name"),
                  type: f.get("type"),
                  description: f.get("description"),
                  parentId: f.get("parentId") || undefined,
                }),
              )
            )
              setAdding(false);
          }}
        >
          <input
            name="code"
            placeholder={tr("Unique code")}
            maxLength={50}
            required
          />
          <input
            name="name"
            placeholder={tr("Account name")}
            maxLength={200}
            required
          />
          <select name="type">
            {["Asset", "Liability", "Equity", "Income", "Expense"].map((t) => (
              <option key={t} value={t}>
                {tr(t)}
              </option>
            ))}
          </select>
          <select name="parentId">
            <option value="">{tr("No parent")}</option>
            {data.accounts.map((a: Account) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
          </select>
          <input
            name="description"
            placeholder={tr("Plain-language explanation")}
            maxLength={1000}
            required
          />
          <button>{tr("Add account")}</button>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Code")}</th>
              <th>{tr("Account head & explanation")}</th>
              <th>{tr("Branch")}</th>
              <th>{tr("Balance")}</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts
              .filter((a: Account) => type === "All" || a.type === type)
              .map((a: Account) => (
                <tr key={a.id}>
                  <td className="numeric">{a.code}</td>
                  <td>
                    <strong>{accountLabel(a)}</strong>
                    <small>
                      {accountDescription(a)}
                      {a.parentId
                        ? tr(" · Parent: ") +
                          accountLabel(
                            data.accounts.find(
                              (p: Account) => p.id === a.parentId,
                            ),
                          )
                        : ""}
                    </small>
                  </td>
                  <td>
                    <span className="chip">{tr(a.type)}</span>
                  </td>
                  <td className="numeric">
                    {money(
                      balances.find((r: any) => r.account.id === a.id)
                        ?.balance || 0,
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
