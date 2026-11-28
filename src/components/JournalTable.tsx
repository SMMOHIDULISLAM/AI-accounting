import { t as tr, useLanguage, accountLabel } from "../lib/i18n";
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
export default function JournalTable({
  journals,
  data,
  money,
  edit,
  post,
  reverse,
}: {
  journals: Journal[];
  data: Snapshot;
  money: (n: number) => string;
  edit: (j: Journal) => void;
  post: (j: Journal) => void;
  reverse: (j: Journal) => void;
}) {
  useLanguage();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{tr("Transaction")}</th>
            <th>{tr("Date")}</th>
            <th>{tr("Amount")}</th>
            <th>{tr("Status")}</th>
            <th>{tr("Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {journals.map((j) => (
            <tr key={j.id}>
              <td>
                <strong>{j.description}</strong>
                <small>
                  {j.lines
                    .map((l) =>
                      accountLabel(
                        data.accounts.find((a) => a.id === l.accountId),
                      ),
                    )
                    .join(" → ")}
                </small>
              </td>
              <td>{j.date}</td>
              <td className="numeric">
                {money(j.lines.reduce((n, l) => n + l.debit, 0))}
              </td>
              <td>
                <span className={"chip " + j.status}>{tr(j.status)}</span>
                {j.reversalOf && <small>{tr("Reversal")}</small>}
              </td>
              <td>
                {j.status === "draft" ? (
                  <>
                    <button className="text-btn" onClick={() => edit(j)}>
                      {tr("Edit")}
                    </button>
                    <button className="mini-btn" onClick={() => post(j)}>
                      {tr("Post")}
                    </button>
                  </>
                ) : (
                  <button className="text-btn" onClick={() => reverse(j)}>
                    {tr("Reverse")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
