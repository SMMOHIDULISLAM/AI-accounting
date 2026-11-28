import { useState } from "react";
import { t, useLanguage, uiMoney, accountLabel } from "../lib/i18n";
import {
  parseWhatsAppSale,
  type WhatsAppMessage,
} from "../lib/whatsapp-command";
import type { Snapshot } from "../lib/types";
import type { Ledger } from "../lib/db";
export default function TelegramInbox({
  data,
  ledger,
  run,
}: {
  data: Snapshot;
  ledger: Ledger;
  run: (fn: () => Promise<unknown>, notice?: string) => Promise<boolean>;
}) {
  useLanguage();
  const [token, setToken] = useState(""),
    [messages, setMessages] = useState<WhatsAppMessage[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const status = await fetch("/api/telegram/status");
      if (!status.ok || !(await status.json()).enabled)
        throw Error(
          "Telegram intake is not configured. Report sharing is available in Statements.",
        );
      const response = await fetch("/api/telegram/inbox", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!response.ok)
        throw Error("Could not open Telegram inbox. Check the access token.");
      setMessages((await response.json()).messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importDraft(message: WhatsAppMessage) {
    setBusy(true);
    setError("");
    try {
      const draft = parseWhatsAppSale(message.text, message.date);
      if (!draft.ready) throw Error(draft.reason);
      const saved = await run(
        () => ledger.importWhatsAppDraft(message.id, draft.currency, draft),
        "Telegram draft saved for review",
      );
      if (!saved) return;
      const response = await fetch("/api/telegram/ack", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: message.id }),
      });
      if (!response.ok)
        throw Error(
          "Draft saved locally, but acknowledgment failed. Retry safely with the same ledger; it will not create a duplicate.",
        );
      setMessages((current) => current.filter((m) => m.id !== message.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padded">
      <h2>{t("Telegram inbox")}</h2>
      <p>
        {t(
          "A self-hosted Telegram bot can receive approved senders into a private queue. Live bot setup is required. Only explicit BDT cash/credit sales become drafts; other instructions need manual review.",
        )}
      </p>
      <label>
        {t("Inbox access token")}
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <button disabled={busy} onClick={() => void refresh()}>
        {t("Connect / refresh inbox")}
      </button>
      {error && (
        <p className="alert error" role="alert">
          {t(error)}
        </p>
      )}
      {messages.map((message) => {
        const draft = parseWhatsAppSale(message.text, message.date);
        return (
          <article className="note" key={message.id}>
            <small>
              {message.date} · {message.sender}
            </small>
            <p className="message-text">{message.text}</p>
            {draft.ready ? (
              <>
                {draft.lines.map((line, i) => (
                  <p key={i}>
                    {accountLabel(
                      data.accounts.find((a) => a.id === line.accountId),
                    )}{" "}
                    · {t("Debit")}: {uiMoney(line.debit, "BDT")} · {t("Credit")}
                    : {uiMoney(line.credit, "BDT")}
                  </p>
                ))}
                <button
                  disabled={busy || data.settings.currency !== "BDT"}
                  onClick={() => void importDraft(message)}
                >
                  {t("Save reviewed draft")}
                </button>
              </>
            ) : (
              <p>{t(draft.reason)}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
