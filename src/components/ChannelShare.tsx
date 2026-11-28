import { useRef, useState, useEffect } from "react";
import { t, useLanguage } from "../lib/i18n";
import { channelShareUrl } from "../lib/channels";
export default function ChannelShare({ message }: { message: string }) {
  useLanguage();
  const [channel, setChannel] = useState<"telegram" | "email">(),
    [text, setText] = useState(message),
    [recipient, setRecipient] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (channel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [channel]);
  let href = "",
    error = "";
  try {
    if (channel) href = channelShareUrl(channel, text, recipient);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          setText(message);
          setChannel("telegram");
        }}
      >
        {t("Share on Telegram")}
      </button>
      <button
        className="secondary"
        onClick={() => {
          setText(message);
          setChannel("email");
        }}
      >
        {t("Prepare email")}
      </button>
      <dialog
        ref={dialog}
        className="modal share-dialog"
        aria-label={t("Review outgoing message")}
        onCancel={(e) => {
          e.preventDefault();
          setChannel(undefined);
        }}
      >
        <h2>{t("Review outgoing message")}</h2>
        <p>
          {t(
            "Review the recipient and financial figures. Opening the selected service transfers this preview to that service. You decide whether to send it there.",
          )}
        </p>
        {channel === "email" && (
          <label>
            {t("Recipient email (optional)")}
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
        )}
        <label>
          {t("Message preview")}
          <textarea
            aria-label={t("Message preview")}
            value={text}
            rows={12}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {error && <p role="alert">{t(error)}</p>}
        <div className="modal-footer">
          <button className="secondary" onClick={() => setChannel(undefined)}>
            {t("Cancel")}
          </button>
          {href && (
            <a
              className="button-link"
              href={href}
              target={channel === "telegram" ? "_blank" : undefined}
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              {t(
                channel === "telegram"
                  ? "Open Telegram"
                  : "Open email application",
              )}
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
