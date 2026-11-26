import { useState } from "react";
import {
  parseWhatsAppSale,
  type WhatsAppMessage,
  type WhatsAppDraft,
} from "../lib/whatsapp-command";
import { formatMoney } from "../lib/accounting";
import type { Snapshot } from "../lib/types";
import type { Ledger } from "../lib/db";
import { today } from "../components/utils";

export default function WhatsAppInbox({
  data,
  ledger,
  run,
}: {
  data: Snapshot;
  ledger: Ledger;
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>;
}) {
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [status, setStatus] = useState(
    "Connect to check your WhatsApp intake.",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [example, setExample] = useState("sale cash 100 bdt, credit 50 bdt");
  const [date, setDate] = useState(today());
  let preview: WhatsAppDraft;
  try {
    preview = parseWhatsAppSale(example, date);
  } catch (e) {
    preview = { ready: false, reason: (e as Error).message };
  }

  const refresh = async () => {
    setBusy(true);
    setError("");
    setMessages([]);
    try {
      const response = await fetch("/api/whatsapp/status");
      if (!response.ok) throw new Error("Could not check WhatsApp intake.");
      if (!(await response.json()).enabled) {
        setStatus(
          "WhatsApp intake is not configured on this server. You can try text entry below.",
        );
        return;
      }
      const inbox = await fetch("/api/whatsapp/inbox", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!inbox.ok)
        throw new Error(
          inbox.status === 401
            ? "Enter the inbox access token configured on your server."
            : "Could not load the WhatsApp inbox.",
        );
      const result = await inbox.json();
      setMessages(result.messages);
      setStatus(
        "Showing up to 100 pending messages. Create drafts, then open Transactions to review and post.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const importMessage = async (message: WhatsAppMessage) => {
    const draft = parseWhatsAppSale(message.text, message.date);
    if (!draft.ready || message.type !== "text") return;
    setBusy(true);
    setError("");
    try {
      const saved = await run(
        () => ledger.importWhatsAppDraft(message.id, draft.currency, draft),
        "WhatsApp draft saved. Review it in Transactions before posting.",
      );
      if (!saved) return;
      const response = await fetch("/api/whatsapp/ack", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: message.id }),
      });
      if (!response.ok)
        throw new Error(
          "Draft saved locally, but acknowledgment failed. Retry safely with the same ledger; it will not create a duplicate.",
        );
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-layout">
      <section className="panel padded">
        <span className="guide-pill">MY ACCOUNTS · WHATSAPP INTAKE</span>
        <h2>Turn your message into a draft</h2>
        <p>
          Try your sales message here. “Credit” means the amount a customer
          still owes; it becomes Receivables. Tax, inventory cost and customer
          details need your review.
        </p>
        <label>
          Transaction date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Your message
          <textarea
            value={example}
            maxLength={8000}
            onChange={(event) => setExample(event.target.value)}
          />
        </label>
        {preview.ready ? (
          <>
            <p>BDT draft · {preview.date}</p>
            {preview.lines.map((line) => (
              <div className="statement-row" key={line.accountId}>
                <span>
                  {data.accounts.find(
                    (account) => account.id === line.accountId,
                  )?.name || line.accountId}
                </span>
                <strong>
                  {line.debit
                    ? "Debit " + formatMoney(line.debit, "BDT")
                    : "Credit " + formatMoney(line.credit, "BDT")}
                </strong>
              </div>
            ))}
            <button
              disabled={busy || data.settings.currency !== "BDT"}
              onClick={async () => {
                if (!preview.ready) return;
                setBusy(true);
                try {
                  await run(
                    () => ledger.saveDraft(preview),
                    "Text draft saved. Review it in Transactions.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create text draft
            </button>
            {data.settings.currency !== "BDT" && (
              <p role="alert">
                This first intake version accepts BDT sales. Select a matching
                ledger.
              </p>
            )}
          </>
        ) : (
          <p role="status">{preview.reason}</p>
        )}
      </section>
      <section className="panel padded">
        <h2>Messages from WhatsApp</h2>
        <p>
          Save your connected WhatsApp Business number as “My Accounts” in your
          phone. Only approved sender numbers enter this inbox.
        </p>
        <label>
          Inbox access token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <button disabled={busy} onClick={refresh}>
          {busy ? "Working…" : "Connect / refresh inbox"}
        </button>
        <p role="status">{status}</p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {messages.map((message) => {
          const draft = parseWhatsAppSale(message.text, message.date);
          return (
            <article className="note" key={message.id}>
              <strong>
                {message.date} · {message.type} · …{message.sender.slice(-4)}
              </strong>
              <p className="message-text">
                {message.text || "No text caption"}
              </p>
              {message.media ? (
                <p>
                  Cash-memo attachment reference received. Photo/PDF download
                  and OCR are not available in this version. Enter and review
                  the amounts from your original memo.
                </p>
              ) : draft.ready && message.type === "text" ? (
                <>
                  {draft.lines.map((line) => (
                    <p key={line.accountId}>
                      {
                        data.accounts.find(
                          (account) => account.id === line.accountId,
                        )?.name
                      }
                      :{" "}
                      {line.debit
                        ? "Debit " + formatMoney(line.debit, "BDT")
                        : "Credit " + formatMoney(line.credit, "BDT")}
                    </p>
                  ))}
                  <button
                    disabled={busy || data.settings.currency !== draft.currency}
                    onClick={() => importMessage(message)}
                  >
                    Save reviewed draft
                  </button>
                </>
              ) : (
                <p>
                  {draft.ready
                    ? "This message type needs manual review."
                    : draft.reason}
                </p>
              )}
            </article>
          );
        })}
        <p className="muted">
          Tokens stay in this page’s memory. Messages are stored on your intake
          server; your accounting ledger stays in this browser. Refresh and
          import into one designated ledger.
        </p>
      </section>
    </div>
  );
}
