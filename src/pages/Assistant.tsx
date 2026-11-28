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
import { parseMoney, report } from "../lib/accounting";
import { parseCSV, mapCSV, exportCSV } from "../lib/csv";
import type { Snapshot, Line, Journal, SourceRow, Account } from "../lib/types";
import { today, saveFile } from "../components/utils";
const flows = [
  {
    name: "Buying something",
    question:
      "Will it serve the business over several periods, or be consumed now?",
    options: [
      [
        "equipment",
        "Used for several periods",
        "Potential equipment asset; confirm useful life, business use and capitalization policy.",
      ],
      [
        "supplies",
        "Used up in daily operations",
        "Potential supplies expense; confirm whether stock is held for later use.",
      ],
      [
        "inventory",
        "Bought to resell",
        "Potential inventory asset; expense recognition may follow the sale.",
      ],
    ],
  },
  {
    name: "Customer paid us",
    question:
      "Have you delivered, or is there an invoice already in your books?",
    options: [
      [
        "ar",
        "Invoice already recorded",
        "Reduce receivables; do not record the income twice.",
      ],
      [
        "deposits",
        "Not delivered yet",
        "Potential customer-deposit liability until the obligation is fulfilled.",
      ],
      [
        "sales",
        "Delivered, no income recorded yet",
        "Potential earned income; confirm any performance obligations and tax.",
      ],
    ],
  },
  {
    name: "Owner funding",
    question: "Does the business have to repay the money?",
    options: [
      [
        "loan",
        "Yes, repayment is expected",
        "Potential owner-loan liability, not sales income.",
      ],
      [
        "capital",
        "No, this is invested capital",
        "Potential equity contribution; entity form matters.",
      ],
    ],
  },
  {
    name: "Paying a supplier",
    question: "Was this bill already recorded as an amount you owe?",
    options: [
      [
        "ap",
        "Yes, payable already recorded",
        "Settle the payable; do not expense the same bill twice.",
      ],
      [
        "expense",
        "No, new operating cost",
        "Potential new expense; durable items and inventory need a different head.",
      ],
    ],
  },
];
export default function Assistant({ data, selectAccount }: any) {
  useLanguage();
  const [flow, setFlow] = useState(0);
  const [selection, setSelection] = useState(-1);
  const [status, setStatus] = useState<{
    available: boolean;
    reason?: string;
    models: string[];
  }>({ available: false, models: [], reason: "Local AI not connected" });
  const [model, setModel] = useState("");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connect = async () => {
    try {
      const res = await fetch("/api/ai/status");
      const s = await res.json();
      setStatus(s);
      setModel(s.models?.[0] || "");
    } catch {
      setError("Could not check the local AI connection.");
    }
  };
  const f = flows[flow];
  return (
    <div className="assistant-layout">
      <section className="panel padded">
        <span className="guide-pill">
          <Sparkles size={14} /> {tr(" GUIDED RULES ·")}{" "}
          {data.settings.guidance ? tr("ON") : tr("OFF")}
        </span>
        <h2>{tr("Let’s understand the transaction.")}</h2>
        <p className="muted">
          {tr(
            "Choose what happened, then the explanation that matches the facts.",
          )}
        </p>
        {!data.settings.guidance ? (
          <div className="note">
            {tr(
              "Guidance is off. Use New entry and select your accounts manually, or turn guidance on in the top bar.",
            )}
          </div>
        ) : (
          <>
            <div className="scenario-tabs">
              {flows.map((f, i) => (
                <button
                  className={flow === i ? "selected secondary" : "secondary"}
                  key={i}
                  onClick={() => {
                    setFlow(i);
                    setSelection(-1);
                  }}
                >
                  {tr(f.name)}
                </button>
              ))}
            </div>
            <div className="question-box">
              <small>{tr("ONE IMPORTANT QUESTION")}</small>
              <h3>{tr(f.question)}</h3>
              {f.options.map(([id, label, reason], i) => (
                <button
                  key={id}
                  className={"choice " + (selection === i ? "chosen" : "")}
                  onClick={() => setSelection(i)}
                >
                  <span>
                    <strong>{tr(label)}</strong>
                    <small>{tr(reason)}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
            {selection >= 0 && (
              <div className="decision">
                <b>
                  {tr("Suggested head:")}{" "}
                  {accountLabel(
                    data.accounts.find(
                      (a: Account) => a.id === f.options[selection][0],
                    ),
                  )}
                </b>
                <p>{tr(f.options[selection][2])}</p>
                <button onClick={() => selectAccount(f.options[selection][0])}>
                  {tr("Create a draft with this head ")}
                  <Plus size={15} />
                </button>
                <small>
                  {tr("You will review date, amount and both journal sides.")}
                </small>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="panel padded ai-box">
        <span className="eyebrow">{tr("OPTIONAL · NO PAID API")}</span>
        <h2>{tr("Connect your local AI")}</h2>
        <p>
          {tr(
            "Ollama runs a downloaded model on your own computer. Your chosen question and account context stay local.",
          )}
        </p>
        <div
          className={
            "connection " +
            (status.available && status.models.length > 0 ? "connected" : "")
          }
        >
          <span className="small-dot" />
          {status.available && status.models.length > 0
            ? tr("Local model available")
            : tr(status.reason)}
        </div>
        <button className="secondary" onClick={connect}>
          {tr("Check connection")}
        </button>
        {status.available && status.models.length > 0 ? (
          <>
            <label>
              {tr("Installed model")}
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {status.models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              {tr("Question")}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tr(
                  "Describe the facts, not just an account name.",
                )}
              />
            </label>
            <button
              disabled={
                !model || !text.trim() || busy || !data.settings.guidance
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const res = await fetch("/api/ai/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model,
                      messages: [{ role: "user", content: text }],
                      context: {
                        language: getLanguage(),
                        country: data.settings.country,
                        framework: data.settings.framework,
                        accounts: data.accounts,
                      },
                    }),
                  });
                  const body = await res.json();
                  if (!res.ok) throw Error(body.error || "AI request failed");
                  setAnswer(body);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? tr("Thinking locally…") : tr("Ask local AI")}
            </button>
          </>
        ) : (
          <div className="note">
            {tr(
              "In this online Preview, use guided rules. To use AI, download the repository, install Ollama and a local model, then run",
            )}{" "}
            <code>{tr("pnpm local")}</code>
            {tr(". This page will not contact a paid provider.")}
          </div>
        )}
        {error && <p className="error-text">{tr(error)}</p>}
        {answer && (
          <div className="ai-answer">
            <b>{tr("AI draft — review required")}</b>
            <p>{answer.explanation}</p>
            {answer.questions?.map((q: string, i: number) => (
              <p key={i}>{q}</p>
            ))}
            {answer.options?.map((o: any, i: number) => (
              <div key={i}>
                <b>
                  {accountLabel(
                    data.accounts.find((a: Account) => a.id === o.accountId),
                  )}
                </b>
                <p>{o.reason}</p>
                <button
                  className="text-btn"
                  onClick={() => selectAccount(o.accountId)}
                >
                  {tr("Use in a draft")}
                </button>
              </div>
            ))}
          </div>
        )}
        <small>
          {tr(
            "Models can be wrong. They are not certified accountants. No automatic posting.",
          )}
        </small>
      </aside>
    </div>
  );
}
