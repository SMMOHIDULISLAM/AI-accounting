# Track 3 — WhatsApp-first bookkeeping

Run `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm edition:whatsapp`. Default URL: `http://127.0.0.1:3002`; the homepage opens My Accounts. This local launcher can use `.env` WhatsApp settings and the installed local Tesseract.

Implemented: signed/allowlisted incoming messages, durable inbox, idempotent reviewed draft import, explicit BDT cash/credit sale commands, manual-image English OCR and reviewed memo drafts. OCR runs locally, accepts PNG/JPEG, limits input/output and concurrency, and does not save the image or create a journal automatically. Paste text when OCR is unavailable. Keep originals separately.

The native OCR check passed on a clean synthetic English memo only. Bengali/handwriting quality, real receipts, duplicate-document detection, complete tax extraction and statutory treatment are not verified. Multiple candidate totals remain ambiguous.

Still required for operation entirely inside WhatsApp: real Meta number/app configuration, HTTPS hosting for webhooks, authenticated media download for incoming photos, conversational confirm/cancel/replies and a decision about the authoritative shared ledger. No live Meta configuration or outgoing messages were created by this update. See [WhatsApp setup](../../docs/WHATSAPP.md).

Use one designated ledger for intake. Browser storage at this port is separate from the core port and ERPNext. A browser backup does not back up the server inbox. Do not run multiple active consumers against the same queue.
