import { t as tr, useLanguage } from "../lib/i18n";
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
import JournalTable from "../components/JournalTable";
export default function Transactions({
  data,
  money,
  journal,
  run,
  ledger,
}: any) {
  useLanguage();
  const [tab, setTab] = useState("inbox");
  const [search, setSearch] = useState("");
  const list = data.journals.filter(
    (j: Journal) =>
      (tab === "drafts" ? j.status === "draft" : j.status === "posted") &&
      j.description.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="tabs">
        {["inbox", "drafts", "posted"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t === "inbox"
              ? tr("Imported inbox")
              : t === "drafts"
                ? tr("Draft journals")
                : tr("Posted ledger")}
          </button>
        ))}
        <div className="search">
          <Search size={16} />
          <input
            placeholder={tr("Search descriptions")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {tab === "inbox" ? (
        <div>
          {data.sources
            .filter(
              (s: SourceRow) =>
                s.mode === "transactions" &&
                s.description.toLowerCase().includes(search.toLowerCase()),
            )
            .map((s: SourceRow) => (
              <div className="source-row" key={s.id}>
                <div>
                  <strong>{s.description}</strong>
                  <small>
                    {s.date} · {s.reference || "No reference"}
                  </small>
                </div>
                <span className="numeric">{money(s.amount)}</span>
                <span className="chip">
                  {s.journalId
                    ? tr("Linked draft / entry")
                    : tr("Needs review")}
                </span>
                <button
                  className="secondary"
                  disabled={!!s.journalId}
                  onClick={() => journal(s)}
                >
                  {tr("Classify ")}
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          {!data.sources.filter((s: SourceRow) => s.mode === "transactions")
            .length && (
            <div className="empty">
              <Upload />
              <h3>{tr("Your inbox is clear")}</h3>
              <p>{tr("Import a CSV to review transactions here.")}</p>
            </div>
          )}
        </div>
      ) : (
        <JournalTable
          journals={list}
          data={data}
          money={money}
          edit={(j) => journal(undefined, j)}
          post={(j) => run(() => ledger.post(j.id), "Posted")}
          reverse={(j) => {
            const reason = prompt(tr("Why are you reversing this entry?"));
            if (reason) run(() => ledger.reverse(j.id, reason));
          }}
        />
      )}
    </section>
  );
}
