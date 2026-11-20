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
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {journals.map((j) => (
            <tr key={j.id}>
              <td>
                <strong>{j.description}</strong>
                <small>
                  {j.lines
                    .map(
                      (l) =>
                        data.accounts.find((a) => a.id === l.accountId)?.name,
                    )
                    .join(" → ")}
                </small>
              </td>
              <td>{j.date}</td>
              <td className="numeric">
                {money(j.lines.reduce((n, l) => n + l.debit, 0))}
              </td>
              <td>
                <span className={"chip " + j.status}>{j.status}</span>
                {j.reversalOf && <small>Reversal</small>}
              </td>
              <td>
                {j.status === "draft" ? (
                  <>
                    <button className="text-btn" onClick={() => edit(j)}>
                      Edit
                    </button>
                    <button className="mini-btn" onClick={() => post(j)}>
                      Post
                    </button>
                  </>
                ) : (
                  <button className="text-btn" onClick={() => reverse(j)}>
                    Reverse
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
