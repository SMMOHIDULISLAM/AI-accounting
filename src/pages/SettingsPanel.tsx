import { useEffect, useState, type ReactNode } from "react";
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
export default function SettingsPanel({ data, run, ledger }: any) {
  const [name, setName] = useState(data.settings.name);
  const [currency, setCurrency] = useState(data.settings.currency);
  const [country, setCountry] = useState(data.settings.country);
  const [framework, setFramework] = useState(data.settings.framework);
  useEffect(() => {
    setName(data.settings.name);
    setCurrency(data.settings.currency);
    setCountry(data.settings.country);
    setFramework(data.settings.framework);
  }, [
    data.settings.name,
    data.settings.currency,
    data.settings.country,
    data.settings.framework,
  ]);
  return (
    <div className="settings-layout">
      <form
        className="panel padded"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            ledger.updateSettings({ name, currency, country, framework }),
          );
        }}
      >
        <h2>Your workspace</h2>
        <label>
          Business name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Reporting currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={data.journals.length > 0 || data.sources.length > 0}
          >
            {["BDT", "USD", "GBP", "EUR", "CAD", "INR", "AUD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <small>
            Single-currency ledger; select before adding records. No conversion.
          </small>
        </label>
        <label>
          Country / jurisdiction context
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label>
          Desired framework (context only)
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
          >
            <option>General accrual bookkeeping</option>
            <option>IFRS — review required</option>
            <option>IFRS for SMEs — review required</option>
            <option>Local GAAP — review required</option>
          </select>
        </label>
        <div className="note">
          This preference helps describe your needs. It does not install a
          country's tax or reporting rules. Qualification programs such as CPA,
          ACCA, CMA and CA are not separate reporting frameworks.
        </div>
        <button>Save workspace</button>
      </form>
      <section className="panel padded">
        <ShieldCheck size={28} />
        <h2>You own your records.</h2>
        <p>
          Real SQLite lives in this browser's IndexedDB. There is no cloud
          ledger sync. Browser storage is not an encrypted vault and can be
          cleared or evicted.
        </p>
        <button
          onClick={() =>
            run(async () => {
              const bytes = await ledger.backup();
              saveFile(
                "ai-accounting-" + today() + ".sqlite",
                bytes as BlobPart,
                "application/x-sqlite3",
              );
            }, "SQLite backup downloaded")
          }
        >
          <Download size={17} /> Download SQLite backup
        </button>
        <h3>Restore a backup</h3>
        <p>
          Restoring replaces this browser's current ledger. Download a backup
          first.
        </p>
        <label className="file-drop">
          Choose .sqlite backup
          <input
            type="file"
            accept=".sqlite,.db"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (
                confirm(
                  "Replace this ledger with the chosen backup? Download a current backup first.",
                )
              )
                await run(async () => {
                  if (file.size > 20e6) throw Error("Backup limit is 20 MB.");
                  await ledger.restore(
                    new Uint8Array(await file.arrayBuffer()),
                  );
                }, "Backup restored — reload settings to see restored profile");
              e.target.value = "";
            }}
          />
        </label>
        <div className="note">
          Backups contain sensitive accounting records. Keep them private. Your
          private source repository does not store or protect these records
          automatically.
        </div>
        <h3>Local audit history</h3>
        <div className="audit-list">
          {data.audit
            .slice()
            .reverse()
            .slice(0, 12)
            .map((a: any, i: number) => (
              <p key={i}>
                <small>{a.date}</small>
                {a.action}
              </p>
            ))}
          {!data.audit.length && <p>No actions yet.</p>}
        </div>
      </section>
    </div>
  );
}
