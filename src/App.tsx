import {
  t as tr,
  useLanguage,
  uiMoney,
  uiNumber,
  locale,
  message,
} from "./lib/i18n";
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
import LanguageSwitch from "./components/LanguageSwitch";
import SponsorCard from "./components/SponsorCard";
import TelegramInbox from "./pages/TelegramInbox";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import type { OperationsStorage } from "./lib/operations-store";
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
  Factory,
} from "lucide-react";
import { Ledger } from "./lib/db";
import { parseMoney, report } from "./lib/accounting";
import { today } from "./components/utils";
import { parseCSV, mapCSV, exportCSV } from "./lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "./lib/types";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/operations", "Business operations", Factory],
  ["/transactions", "Transactions", ArrowLeftRight],
  ["/whatsapp", "My Accounts · WhatsApp", MessageCircle],
  ["/telegram", "Telegram inbox", MessageCircle],
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
const Operations = lazy(() => import("./pages/Operations"));
export default function App({
  ledgerOverride,
  cloudCompany,
  onSignOut,
  operationsStorage,
}: {
  ledgerOverride?: Ledger;
  cloudCompany?: { name: string; trial_ends_at: string };
  onSignOut?: () => void;
  operationsStorage?: OperationsStorage;
} = {}) {
  useLanguage();
  const [ledger, setLedger] = useState<Ledger>();
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [path, setPath] = useState(location.pathname);
  const [modal, setModal] = useState<ReactNode>();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const source = ledgerOverride
      ? Promise.resolve(ledgerOverride)
      : (opening ??= Ledger.open());
    source
      .then((l) => {
        setLedger(l);
        setData(l.snapshot());
      })
      .catch((e) => setError(String(e.message || e)));
    const pop = () => setPath(location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [ledgerOverride]);
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
  const money = (n: number) => uiMoney(n, data?.settings.currency || "BDT");
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
        <h1>{tr("AI Accounting")}</h1>
        <p>{tr(error || "Opening your local SQLite ledger…")}</p>
        <LanguageSwitch />
        {error && (
          <button onClick={() => location.reload()}>{tr("Try again")}</button>
        )}
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
            {tr("AI Accounting")}
            <small>{tr("YOUR BOOKS, UNDERSTOOD")}</small>
          </span>
        </a>
        <div className="workspace">
          <div className="avatar">
            {(data.settings.name || "My business").slice(0, 1)}
          </div>
          <div>
            <strong>{data.settings.name || tr("My business")}</strong>
            <small>
              {tr(
                cloudCompany
                  ? "Private cloud workspace · "
                  : "Local workspace · ",
              )}
              {data.settings.currency}
            </small>
          </div>
        </div>
        <div className="nav-label">{tr("WORKSPACE")}</div>
        <nav>
          {navigation.map(([p, t, Icon]) => (
            <a
              key={p}
              href={p}
              aria-label={tr(t)}
              className={path === p ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                go(p);
              }}
            >
              <Icon size={18} />
              {tr(t)}
              {p === "/transactions" && drafts.length > 0 && (
                <b>{uiNumber(drafts.length)}</b>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={19} />
          <strong>
            {tr(
              cloudCompany ? "Private company storage" : "Your data stays here",
            )}
          </strong>
          <p>
            {tr(
              cloudCompany
                ? "Saved to your private cloud company."
                : "SQLite stored in this browser.",
            )}
            <br />
            {tr("Back up regularly.")}
          </p>
          <button className="text-btn" onClick={() => go("/settings")}>
            {tr("Manage your data ")}
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="version">
          {tr("LOCAL WORKSPACE ")}
          <span>v0.5.0</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobile(!mobile)}
            aria-label={tr("Toggle navigation")}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            {tr("Workspace ")}
            <ChevronRight size={14} /> <b>{tr(title)}</b>
          </span>
          <div className="top-actions">
            <LanguageSwitch />
            {onSignOut && (
              <button className="text-btn" onClick={onSignOut}>
                {tr("Sign out")}
              </button>
            )}
            <span className="local-dot">{tr("Local SQLite")}</span>
            <button
              className="guidance-toggle"
              onClick={() =>
                run(() =>
                  ledger.updateSettings({ guidance: !data.settings.guidance }),
                )
              }
            >
              <Sparkles size={15} /> {tr(" Guidance")}{" "}
              {data.settings.guidance ? tr("on") : tr("off")}
            </button>
            <span className="user-avatar">{tr("ME")}</span>
          </div>
        </header>
        <div className="content">
          <SponsorCard />
          {cloudCompany && (
            <div className="note" role="status">
              {tr(
                "Private 30-day learning trial. Read/export stays available after expiry. Trial ends:",
              )}{" "}
              {new Date(cloudCompany.trial_ends_at).toLocaleDateString(
                locale(),
              )}
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {tr(error)}
              <button
                onClick={() => setError("")}
                aria-label={tr("Dismiss error")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {tr(notice)}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {path === "/"
                  ? tr("A CLEARER PICTURE")
                  : tr("YOUR ACCOUNTING WORKBENCH")}
              </div>
              <h1>
                {path === "/" ? tr("Good books. Better decisions.") : tr(title)}
              </h1>
              <p>
                {path === "/"
                  ? tr(
                      "Know where your business stands, one explained transaction at a time.",
                    )
                  : path === "/transactions"
                    ? tr(
                        "Import, understand, and review both sides before posting.",
                      )
                    : path === "/reports"
                      ? tr("Clear reports, calculated from your posted ledger.")
                      : tr(
                          "Keep your records understandable and in your control.",
                        )}
              </p>
            </div>
            <div className="heading-buttons">
              <button className="secondary" onClick={importCSV}>
                <Upload size={16} /> {tr(" Import CSV")}
              </button>
              <button onClick={() => journal()}>
                <Plus size={17} /> {tr(" New entry")}
              </button>
            </div>
          </div>
          {path === "/" && (
            <>
              <div className="period-line">
                <span>
                  {tr("THIS MONTH")}{" "}
                  <b>
                    {new Date().toLocaleDateString(locale(), {
                      month: "long",
                      year: "numeric",
                    })}
                  </b>
                </span>
                <span>
                  <span className="small-dot" /> {tr(" Posted entries only")}
                </span>
              </div>
              {reportError && (
                <p role="alert" className="alert error">
                  {tr("Report unavailable: ")}
                  {tr(reportError)}
                  {tr(". Your records and backups remain accessible.")}
                </p>
              )}
              {r && (
                <div className="metrics">
                  <Metric
                    title={tr("Bank & cash")}
                    value={money(r.cashBalance)}
                    icon={<ArrowLeftRight />}
                    foot={tr("Balance as of today")}
                  />
                  <Metric
                    title={tr("Income")}
                    value={money(r.income)}
                    icon={<ArrowDownLeft />}
                    foot={tr("Earned income this month")}
                  />
                  <Metric
                    title={tr("Expenses")}
                    value={money(r.expense)}
                    icon={<ArrowUpRight />}
                    foot={tr("Costs this month")}
                  />
                  <Metric
                    title={tr("Net profit")}
                    value={money(r.profit)}
                    icon={<FileText />}
                    foot={tr("Income less expenses")}
                  />
                </div>
              )}
              <div className="overview-body">
                <section className="panel ledger-panel">
                  <div className="panel-title">
                    <div>
                      <h2>{tr("Recent activity")}</h2>
                      <p>{tr("The story behind your numbers")}</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("/transactions")}
                    >
                      {tr("All transactions ")}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {!data.journals.length ? (
                    <div className="empty">
                      <div className="empty-icon">
                        <BookOpen size={28} />
                      </div>
                      <h3>{tr("A fresh start for your books")}</h3>
                      <p>
                        {tr("Add your first balanced entry or import a CSV.")}
                        <br />
                        {tr(
                          "Your assistant will help you choose the right account.",
                        )}
                      </p>
                      <button onClick={importCSV}>
                        <Upload size={16} /> {tr(" Import your transactions")}
                      </button>
                      <a href="/sample.csv" download>
                        {tr("Download example CSV")}
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
                          tr(
                            "Reason for reversal (original entry will remain in audit history)",
                          ),
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
                    <Sparkles size={14} /> {tr(" GUIDED RULES")}
                  </span>
                  <h2>{tr("You don’t need to know every account.")}</h2>
                  <p>
                    {tr(
                      "Tell us what happened. We’ll explain the choices, and you stay in charge.",
                    )}
                  </p>
                  <div className="example-question">
                    {tr(
                      "“I bought a laptop for my business. Is it an expense?”",
                    )}
                  </div>
                  <button onClick={() => go("/assistant")}>
                    {tr("Work it out together ")}
                    <ChevronRight size={17} />
                  </button>
                  <small>
                    {tr("Question-led rules work now.")}
                    <br />
                    {tr("Connect Ollama locally for open-ended AI.")}
                  </small>
                </aside>
              </div>
              <div className="bottom-strip">
                <div>
                  <CheckCheck size={21} />
                  <span>
                    <strong>
                      {drafts.length} {tr(" drafts to review")}
                    </strong>
                    <small>
                      {tr("Nothing is posted without your confirmation.")}
                    </small>
                  </span>
                </div>
                <button
                  className="text-btn"
                  onClick={() => go("/transactions")}
                >
                  {tr("Review inbox ")}
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="disclaimer">
                <HelpCircle size={14} />{" "}
                {tr(
                  " Draft management records. Not statutory, audit, or tax advice.",
                )}
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
          {path === "/operations" && (
            <Suspense fallback={<p>{tr("Loading…")}</p>}>
              <Operations
                ledger={ledger}
                data={data}
                run={run}
                storage={operationsStorage}
              />
            </Suspense>
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
          {path === "/telegram" && (
            <TelegramInbox data={data} ledger={ledger} run={run} />
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
            <SettingsPanel
              data={data}
              run={run}
              ledger={ledger}
              cloud={!!cloudCompany}
            />
          )}
          {!navigation.some((n) => n[0] === path) && (
            <div className="empty">
              <h2>{tr("Page not found")}</h2>
              <button onClick={() => go("/")}>{tr("Go to overview")}</button>
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
  useLanguage();
  return (
    <div className="metric">
      <div>
        <span>{tr(title)}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{tr(foot)}</small>
    </div>
  );
}
