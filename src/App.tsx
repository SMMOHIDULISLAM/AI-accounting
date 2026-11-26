import SettingsPanel from "./pages/SettingsPanel";
import Assistant from "./pages/Assistant";
import Reports from "./pages/Reports";
import Reconciliation from "./pages/Reconciliation";
import Accounts from "./pages/Accounts";
import ImportCSV from "./components/ImportCSV";
import JournalEditor from "./components/JournalEditor";
import Transactions from "./pages/Transactions";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import Integrations from "./pages/Integrations";
import Receipts from "./pages/Receipts";
import JournalTable from "./components/JournalTable";
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
  MessageCircle,
  Database,
  Receipt,
} from "lucide-react";
import { Ledger } from "./lib/db";
import { parseMoney, report, formatMoney } from "./lib/accounting";
import { today } from "./components/utils";
import { parseCSV, mapCSV, exportCSV } from "./lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "./lib/types";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", ArrowLeftRight],
  ["/whatsapp", "My Accounts · WhatsApp", MessageCircle],
  ["/integrations", "Imports & skills", Database],
  ["/receipts", "Cash memos", Receipt],
  ["/accounts", "Chart of accounts", BookOpen],
  ["/reconciliation", "Reconciliation", CheckCheck],
  ["/reports", "Statements", FileText],
  ["/assistant", "Assistant", Sparkles],
  ["/settings", "Settings", SettingsIcon],
] as const;
function saveFile(name: string, bytes: BlobPart, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let opening: Promise<Ledger> | undefined;
export default function App() {
  const [ledger, setLedger] = useState<Ledger>();
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [path, setPath] = useState(location.pathname);
  const [modal, setModal] = useState<ReactNode>();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    opening ??= Ledger.open();
    opening
      .then((l) => {
        setLedger(l);
        setData(l.snapshot());
      })
      .catch((e) => setError(String(e.message || e)));
    const pop = () => setPath(location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const go = (p: string) => {
    history.pushState({}, "", p);
    setPath(p);
    setMobile(false);
  };
  const run = async (
    fn: () => Promise<unknown>,
    message = "Saved to this browser",
  ) => {
    try {
      setError("");
      await fn();
      if (ledger) setData(ledger.snapshot());
      setNotice(message);
      setTimeout(() => setNotice(""), 4500);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const money = (n: number) => formatMoney(n, data?.settings.currency || "BDT");
  const journal = (source?: SourceRow, existing?: Journal) =>
    setModal(
      <JournalEditor
        key={source?.id || existing?.id || Date.now()}
        data={data!}
        source={source}
        existing={existing}
        close={() => setModal(undefined)}
        save={async (input) => {
          const ok = await run(async () => {
            if (source) await ledger!.saveDraftFromSource(source.id, input);
            else await ledger!.saveDraft(input);
          }, "Draft saved. Review before posting.");
          if (ok) setModal(undefined);
        }}
      />,
    );
  const importCSV = () =>
    setModal(
      <ImportCSV
        existing={data!.sources}
        close={() => setModal(undefined)}
        submit={async (rows) => {
          if (
            await run(
              () => ledger!.importRows(rows),
              "Source rows imported for review",
            )
          )
            setModal(undefined);
        }}
      />,
    );
  if (!data || !ledger)
    return (
      <div className="loading">
        <img src="/logo.svg" width="55" />
        <h1>AI Accounting</h1>
        <p>{error || "Opening your local SQLite ledger…"}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </div>
    );
  const posted = data.journals.filter((j) => j.status === "posted");
  const drafts = data.journals.filter((j) => j.status === "draft");
  let r: ReturnType<typeof report> | undefined;
  let reportError = "";
  try {
    r = report(data, today().slice(0, 7) + "-01", today());
  } catch (e) {
    reportError = (e as Error).message;
  }
  const title = navigation.find((n) => n[0] === path)?.[1] || "Overview";
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
        >
          <img src="/logo.svg" />
          <span>
            AI Accounting<small>YOUR BOOKS, UNDERSTOOD</small>
          </span>
        </a>
        <div className="workspace">
          <div className="avatar">
            {(data.settings.name || "My business").slice(0, 1)}
          </div>
          <div>
            <strong>{data.settings.name || "My business"}</strong>
            <small>Local workspace · {data.settings.currency}</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([p, t, Icon]) => (
            <a
              key={p}
              href={p}
              className={path === p ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                go(p);
              }}
            >
              <Icon size={18} />
              {t}
              {p === "/transactions" && drafts.length > 0 && (
                <b>{drafts.length}</b>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={19} />
          <strong>Your data stays here</strong>
          <p>
            SQLite stored in this browser.
            <br />
            Back up regularly.
          </p>
          <button className="text-btn" onClick={() => go("/settings")}>
            Manage your data <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="version">
          LOCAL WORKSPACE <span>v0.3</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={14} /> <b>{title}</b>
          </span>
          <div className="top-actions">
            <span className="local-dot">Local SQLite</span>
            <button
              className="guidance-toggle"
              onClick={() =>
                run(() =>
                  ledger.updateSettings({ guidance: !data.settings.guidance }),
                )
              }
            >
              <Sparkles size={15} /> Guidance{" "}
              {data.settings.guidance ? "on" : "off"}
            </button>
            <span className="user-avatar">ME</span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {path === "/"
                  ? "A CLEARER PICTURE"
                  : "YOUR ACCOUNTING WORKBENCH"}
              </div>
              <h1>{path === "/" ? "Good books. Better decisions." : title}</h1>
              <p>
                {path === "/"
                  ? "Know where your business stands, one explained transaction at a time."
                  : path === "/transactions"
                    ? "Import, understand, and review both sides before posting."
                    : path === "/reports"
                      ? "Clear reports, calculated from your posted ledger."
                      : "Keep your records understandable and in your control."}
              </p>
            </div>
            <div className="heading-buttons">
              <button className="secondary" onClick={importCSV}>
                <Upload size={16} /> Import CSV
              </button>
              <button onClick={() => journal()}>
                <Plus size={17} /> New entry
              </button>
            </div>
          </div>
          {path === "/" && (
            <>
              <div className="period-line">
                <span>
                  THIS MONTH{" "}
                  <b>
                    {new Date().toLocaleDateString("en", {
                      month: "long",
                      year: "numeric",
                    })}
                  </b>
                </span>
                <span>
                  <span className="small-dot" /> Posted entries only
                </span>
              </div>
              {reportError && (
                <p role="alert" className="alert error">
                  Report unavailable: {reportError}. Your records and backups
                  remain accessible.
                </p>
              )}
              {r && (
                <div className="metrics">
                  <Metric
                    title="Bank & cash"
                    value={money(r.cashBalance)}
                    icon={<ArrowLeftRight />}
                    foot="Balance as of today"
                  />
                  <Metric
                    title="Income"
                    value={money(r.income)}
                    icon={<ArrowDownLeft />}
                    foot="Earned income this month"
                  />
                  <Metric
                    title="Expenses"
                    value={money(r.expense)}
                    icon={<ArrowUpRight />}
                    foot="Costs this month"
                  />
                  <Metric
                    title="Net profit"
                    value={money(r.profit)}
                    icon={<FileText />}
                    foot="Income less expenses"
                  />
                </div>
              )}
              <div className="overview-body">
                <section className="panel ledger-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Recent activity</h2>
                      <p>The story behind your numbers</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("/transactions")}
                    >
                      All transactions <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {!data.journals.length ? (
                    <div className="empty">
                      <div className="empty-icon">
                        <BookOpen size={28} />
                      </div>
                      <h3>A fresh start for your books</h3>
                      <p>
                        Add your first balanced entry or import a CSV.
                        <br />
                        Your assistant will help you choose the right account.
                      </p>
                      <button onClick={importCSV}>
                        <Upload size={16} /> Import your transactions
                      </button>
                      <a href="/sample.csv" download>
                        Download example CSV
                      </a>
                    </div>
                  ) : (
                    <JournalTable
                      journals={data.journals.slice().reverse().slice(0, 6)}
                      data={data}
                      money={money}
                      edit={(j) => journal(undefined, j)}
                      post={(j) => run(() => ledger.post(j.id), "Entry posted")}
                      reverse={(j) => {
                        const reason = prompt(
                          "Reason for reversal (original entry will remain in audit history)",
                        );
                        if (reason)
                          run(
                            () => ledger.reverse(j.id, reason),
                            "Reversing entry posted",
                          );
                      }}
                    />
                  )}
                </section>
                <aside className="context-panel">
                  <span className="guide-pill">
                    <Sparkles size={14} /> GUIDED RULES
                  </span>
                  <h2>You don’t need to know every account.</h2>
                  <p>
                    Tell us what happened. We’ll explain the choices, and you
                    stay in charge.
                  </p>
                  <div className="example-question">
                    “I bought a laptop for my business. Is it an expense?”
                  </div>
                  <button onClick={() => go("/assistant")}>
                    Work it out together <ChevronRight size={17} />
                  </button>
                  <small>
                    Question-led rules work now.
                    <br />
                    Connect Ollama locally for open-ended AI.
                  </small>
                </aside>
              </div>
              <div className="bottom-strip">
                <div>
                  <CheckCheck size={21} />
                  <span>
                    <strong>{drafts.length} drafts to review</strong>
                    <small>Nothing is posted without your confirmation.</small>
                  </span>
                </div>
                <button
                  className="text-btn"
                  onClick={() => go("/transactions")}
                >
                  Review inbox <ChevronRight size={15} />
                </button>
              </div>
              <div className="disclaimer">
                <HelpCircle size={14} /> Draft management records. Not
                statutory, audit, or tax advice.
              </div>
            </>
          )}
          {path === "/transactions" && (
            <Transactions
              data={data}
              money={money}
              journal={journal}
              run={run}
              ledger={ledger}
            />
          )}
          {path === "/accounts" && (
            <Accounts data={data} money={money} run={run} ledger={ledger} />
          )}
          {path === "/reconciliation" && (
            <Reconciliation
              data={data}
              money={money}
              run={run}
              ledger={ledger}
            />
          )}
          {path === "/reports" && <Reports data={data} money={money} />}
          {path === "/integrations" && (
            <Integrations data={data} ledger={ledger} run={run} />
          )}
          {path === "/receipts" && (
            <Receipts data={data} ledger={ledger} run={run} />
          )}
          {path === "/whatsapp" && (
            <WhatsAppInbox data={data} ledger={ledger} run={run} />
          )}
          {path === "/assistant" && (
            <Assistant
              data={data}
              selectAccount={(id: string) =>
                setModal(
                  <JournalEditor
                    data={data}
                    preset={id}
                    close={() => setModal(undefined)}
                    save={async (input) => {
                      if (
                        await run(
                          () => ledger.saveDraft(input),
                          "Draft saved for review",
                        )
                      )
                        setModal(undefined);
                    }}
                  />,
                )
              }
            />
          )}
          {path === "/settings" && (
            <SettingsPanel data={data} run={run} ledger={ledger} />
          )}
          {!navigation.some((n) => n[0] === path) && (
            <div className="empty">
              <h2>Page not found</h2>
              <button onClick={() => go("/")}>Go to overview</button>
            </div>
          )}
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(undefined)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal}
          </div>
        </div>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  icon,
  foot,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  foot: string;
}) {
  return (
    <div className="metric">
      <div>
        <span>{title}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}
