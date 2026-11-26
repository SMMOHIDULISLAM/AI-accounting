import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { whatsappUrl } from "../lib/whatsapp";

export default function WhatsAppShare({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [text, setText] = useState(message);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  let href = "",
    error = "";
  try {
    href = whatsappUrl(text, phone);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          setText(message);
          setOpen(true);
        }}
      >
        <MessageCircle size={16} /> Share on WhatsApp
      </button>
      <dialog
        ref={dialog}
        className="modal share-dialog"
        aria-labelledby="whatsapp-title"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="modal-title">
          <h2 id="whatsapp-title">Review WhatsApp message</h2>
          <button
            className="icon-btn"
            aria-label="Close WhatsApp preview"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <p>
          Check the figures and recipient. These totals will leave your device
          when you open WhatsApp.
        </p>
        <label>
          Recipient phone (optional)
          <input
            autoFocus
            type="tel"
            value={phone}
            placeholder="+8801712345678"
            maxLength={30}
            onChange={(event) => setPhone(event.target.value)}
          />
          <small>
            Include country code, or leave blank to choose a contact in
            WhatsApp.
          </small>
        </label>
        <label>
          Message preview
          <textarea
            rows={12}
            maxLength={4000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        <p className="muted">You choose Send inside WhatsApp.</p>
        <div className="modal-footer">
          <button className="secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          {href ? (
            <a
              className="button-link"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Open WhatsApp
            </a>
          ) : (
            <button disabled>Open WhatsApp</button>
          )}
        </div>
      </dialog>
    </>
  );
}
