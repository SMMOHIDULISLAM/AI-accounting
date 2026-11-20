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
              {t}
            </button>
          ),
        )}
        <button className="text-btn" onClick={() => setAdding(!adding)}>
          <Plus size={14} /> Custom head
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
            placeholder="Unique code"
            maxLength={50}
            required
          />
          <input
            name="name"
            placeholder="Account name"
            maxLength={200}
            required
          />
          <select name="type">
            {["Asset", "Liability", "Equity", "Income", "Expense"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select name="parentId">
            <option value="">No parent</option>
            {data.accounts.map((a: Account) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            name="description"
            placeholder="Plain-language explanation"
            maxLength={1000}
            required
          />
          <button>Add account</button>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account head & explanation</th>
              <th>Branch</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts
              .filter((a: Account) => type === "All" || a.type === type)
              .map((a: Account) => (
                <tr key={a.id}>
                  <td className="numeric">{a.code}</td>
                  <td>
                    <strong>{a.name}</strong>
                    <small>
                      {a.description}
                      {a.parentId
                        ? " · Parent: " +
                          data.accounts.find(
                            (p: Account) => p.id === a.parentId,
                          )?.name
                        : ""}
                    </small>
                  </td>
                  <td>
                    <span className="chip">{a.type}</span>
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
