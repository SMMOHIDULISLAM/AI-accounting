# My Accounts: WhatsApp input

## Workflow

Save a connected WhatsApp Business number as **My Accounts**. Send `sale cash 100 bdt, credit 50 bdt`. Open My Accounts in the app, connect to the inbox, inspect the proposed split, save the draft, then review and post in Transactions. Cash is debited 100 BDT, receivables 50 BDT, and sales credited 150 BDT. No customer, tax rate, invoice, stock movement or cost of goods sold is invented.

The in-app text form lets you test this before connecting WhatsApp. A normal personal contact name does not provision an API integration. A WhatsApp Business Platform number and configuration are required for live intake.

## Implemented

- `GET /webhooks/whatsapp`: constant-time verification-token comparison and challenge response.
- `POST /webhooks/whatsapp`: raw-body HMAC-SHA256 validation, 1 MB limit, business-account/phone-number filtering, sender allowlist, durable SQLite transaction and message-ID deduplication. Success is acknowledged after storage succeeds; storage failure returns 503 for delivery retry.
- `GET /api/whatsapp/inbox`: bearer token, no-store responses, at most 100 pending messages.
- `POST /api/whatsapp/ack`: bearer token plus same-origin checks. Acknowledgment follows local draft persistence; it does not post the journal or delete the source.
- Explicit BDT sale parsing, including Bengali digits. Received timestamps use business timezone (default Asia/Dhaka). Adjust the draft date for earlier transactions.
- Idempotent message-ID import preserves an existing draft or posted journal on retry. Currency mismatch cannot create an entry.
- Image/PDF attachment IDs, MIME type, caption and checksum metadata are retained. Incoming WhatsApp file bytes are not downloaded automatically. Separately, Cash memos can read a manually chosen PNG/JPEG through installed local English Tesseract, with review before creating a draft. Media references may expire; keep original memos independently.

## Connect a real number

1. Set up a Meta developer app and WhatsApp Business Platform test/production number through current official onboarding.
2. Host behind valid HTTPS on a server with durable private storage. Use `pnpm build` then `pnpm serve`; keep Ollama disabled on public hosting. Do not expose the Vite development server to the internet.
3. Copy `.env.example` to private `.env`, or set server environment variables. Get `WA_APP_SECRET`, `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID` from your app/account. Generate separate random `WA_VERIFY_TOKEN` and `WA_INBOX_TOKEN` values of at least 32 characters. `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` generates a token; run separately for each. Never put secrets in source files or public issues/PR comments.
4. Set `WA_ALLOWED_SENDERS` to authorized international phone digits, comma-separated, including country codes with no plus/leading zero. Set `WA_TIMEZONE` and persistent `WA_INBOX_PATH` outside public assets. Restart. Partial configuration fails closed.
5. Configure callback `https://YOUR_HOST/webhooks/whatsapp`, use the matching verification token, and subscribe to `messages` in Meta. Complete current app/number activation steps. No access token or outgoing-message API is used in this intake-only version.
6. Send a test message from an allowed number. Enter the **inbox** token in the app and refresh. Check sender, date, original text, currency and split; save the draft and post after review. Test delivery retries, restart and failed acknowledgment before relying on it.

The token grants access to the entire single-business inbox; this is not multi-tenant authentication. Keep tokens in a secret manager or private environment. Mount persistent storage and keep backups. Test same-origin POSTs through the HTTPS proxy before activation. Use one designated browser ledger: separate browsers can otherwise import messages into separate ledgers. A restored older ledger does not automatically replay acknowledged messages; keep both browser and inbox backups and plan recovery.

## Remaining for the complete WhatsApp product

- Real number onboarding, secrets, hosting, HTTPS and live delivery evidence.
- Authenticated incoming-media download, receipt retention, confidence and duplicate-document checks. Manual-image English OCR exists, but real memo/Bengali/handwriting quality and automatic WhatsApp-photo processing are not verified. A caption is not evidence that an image was read.
- Conversational questions, confirm/cancel, status and report replies inside WhatsApp. Outbound messaging needs an explicit implementation, scoped credentials and current Meta rules/cost review.
- More transaction types, named customers/suppliers, invoice matching, returns, expenses, tax and inventory rules.
- A shared-ledger and authentication design if all operations must happen in WhatsApp or across devices. This update does not silently convert browser storage into a cloud ledger.
- Android integration and a tested schema migration. No automatic web/native sync exists.

This update does not subscribe to a paid service, send real messages, create a Business account or deploy a server.

## Official references

- [WhatsApp webhook verification, signatures and retries](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [WhatsApp Business Platform and messages references](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
- [Click to chat for separate report sharing](https://faq.whatsapp.com/5913398998672934/)
- [Node 24 SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
